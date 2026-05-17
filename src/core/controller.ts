import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { Engine } from '../engines/engine'
import { QwenEngine } from '../engines/qwen'
import { WllamaEngine } from '../engines/wllama'
import { ScenariosEngine } from '../engines/scenarios-only'
import { selectTier, stepDownTier } from '../engines/select'
import type { Tier, TierSelection } from '../engines/tier'
import { shortCircuit } from '../engines/short-circuit'
import { cosineTopK, toRetrievalChunk } from '../rag/retrieve'
import { QueryEmbedder } from '../rag/query-embedder'
import { clearCachedVectors, getCachedVectors, setCachedVectors } from '../rag/idb'
import {
  resolveScenarioFallbackMessage,
  type ScenariosPayload,
} from '../rag/scenarios-types'
import type { VectorsPayload } from '../rag/types'
import { loadConfig, type ResolvedConfig } from './config-loader'
import {
  initialState,
  newId,
  resolveGreetingQuickReplies,
  scenarioToQuickReply,
  type ChatMessage,
  type ChatState,
  type Status,
} from './store'

export interface ControllerOptions {
  assistantId: string
  configUrl: string | null
  // Override the default Firebase Storage bucket. When neither
  // `configUrl` nor `inlineConfig` is supplied, the loader derives
  // `${configBaseUrl}/public%2Fassistants%2F${id}%2Fconfig.json?alt=media`.
  configBaseUrl: string | null
  modeOverride: 'mobile' | 'desktop' | null
  tierOverride: Tier | null
  disableCache: boolean
  modelBaseUrl: string | null
  inlineConfig: ResolvedConfig['config'] | null
  emit: (
    name: 'answerlay-ready' | 'answerlay-message' | 'answerlay-error' | 'answerlay-tier-change',
    detail: unknown,
  ) => void
}

export class ChatController implements ReactiveController {
  state: ChatState = { ...initialState }

  private host: ReactiveControllerHost
  private opts: ControllerOptions
  private engine: Engine | null = null
  private enginePromise: Promise<Engine | null> | null = null
  private scenariosEngine: ScenariosEngine | null = null
  private embedder: QueryEmbedder | null = null
  private scenariosPayload: ScenariosPayload | null = null
  private vectorsPayload: VectorsPayload | null = null
  private greetingMessageId: string | null = null
  private destroyed = false

  constructor(host: ReactiveControllerHost, opts: ControllerOptions) {
    this.host = host
    this.opts = opts
    host.addController(this)
  }

  hostConnected(): void {
    void this.boot()
  }

  hostDisconnected(): void {
    this.destroyed = true
    this.engine?.destroy()
    this.embedder?.destroy()
  }

  setOptions(patch: Partial<ControllerOptions>): void {
    this.opts = { ...this.opts, ...patch }
  }

  private setState(patch: Partial<ChatState>): void {
    this.state = { ...this.state, ...patch }
    this.host.requestUpdate()
  }

  private setStatus(status: Status, errorMessage: string | null = null): void {
    this.setState({ status, errorMessage })
  }

  private pushMessage(msg: ChatMessage): void {
    this.setState({ messages: [...this.state.messages, msg] })
  }

  private updateMessage(id: string, patch: Partial<ChatMessage>): void {
    this.setState({
      messages: this.state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })
  }

  private seedGreeting(content: string): void {
    const id = newId('g')
    this.greetingMessageId = id
    this.pushMessage({ id, role: 'assistant', content, status: 'done' })
  }

  private updateGreetingQuickReplies(): void {
    if (!this.greetingMessageId) return
    const ids = this.state.config?.config.greetingQuickReplyIds
    const scenarios = this.scenariosPayload?.scenarios ?? []
    const quickReplies = resolveGreetingQuickReplies(ids, scenarios)
    this.updateMessage(this.greetingMessageId, {
      quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
    })
  }

  // Last completed user→LLM-assistant pair, used to give the model one turn
  // of follow-up context. Scenarios/fallbacks/errors are skipped — they
  // aren't model-generated and would teach the wrong style.
  private buildHistoryForLLM(): { role: 'user' | 'assistant'; content: string }[] {
    const msgs = this.state.messages
    const MAX = 1000
    const cap = (s: string) => (s.length > MAX ? s.slice(0, MAX) : s)
    for (let i = msgs.length - 1; i >= 1; i--) {
      const a = msgs[i]
      const u = msgs[i - 1]
      if (
        a?.role === 'assistant' &&
        a.status === 'done' &&
        a.source === 'llm' &&
        a.content &&
        u?.role === 'user' &&
        u.content
      ) {
        return [
          { role: 'user', content: cap(u.content) },
          { role: 'assistant', content: cap(a.content) },
        ]
      }
    }
    return []
  }

  setOpen(open: boolean): void {
    this.setState({ open })
  }

  // Re-pull config, scenarios, and vectors. Used by the dashboard test panel
  // after a publish (and by its Reset button). Streaming continues to play
  // out — only the underlying RAG state is swapped.
  async refresh(opts: { clearMessages?: boolean; bypassCache?: boolean } = {}): Promise<void> {
    if (opts.bypassCache) {
      try {
        await clearCachedVectors(this.opts.assistantId, 'e5s')
      } catch {
        // best-effort
      }
    }
    const prevDisable = this.opts.disableCache
    if (opts.bypassCache) this.opts.disableCache = true
    try {
      const resolved = await loadConfig({
        assistantId: this.opts.assistantId,
        configUrl: this.opts.configUrl,
        configBaseUrl: this.opts.configBaseUrl,
        inlineConfig: this.opts.inlineConfig,
      })
      this.setState({ config: resolved })
      await this.fetchScenarios()
      this.updateGreetingQuickReplies()
      this.vectorsPayload = null
      await this.fetchVectors()
    } catch (err) {
      this.opts.emit('answerlay-error', {
        phase: 'config',
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      this.opts.disableCache = prevDisable
    }
    if (opts.clearMessages) {
      this.greetingMessageId = null
      const greeting = this.state.config?.config.greeting
      if (greeting) this.seedGreeting(greeting)
      else this.setState({ messages: [] })
      this.setState({ errorMessage: null })
      this.updateGreetingQuickReplies()
      this.setStatus('ready')
    }
  }

  /**
   * Boot sequence:
   *   1. Fetch config.json (or use inline config).
   *   2. Seed greeting message.
   *   3. Probe device tier.
   *   4. Fetch scenarios.json (always, used for short-circuit on Tiers A/B/C
   *      and as the only response source on Tier D).
   *   5. Set status to ready. Engines are loaded lazily on first send.
   */
  private async boot(): Promise<void> {
    this.setStatus('config-loading')
    try {
      const resolved = await loadConfig({
        assistantId: this.opts.assistantId,
        configUrl: this.opts.configUrl,
        configBaseUrl: this.opts.configBaseUrl,
        inlineConfig: this.opts.inlineConfig,
      })
      this.setState({ config: resolved })
      if (resolved.config.greeting) {
        this.seedGreeting(resolved.config.greeting)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.opts.emit('answerlay-error', { phase: 'config', error: message })
      this.setStatus('config-error', message)
      return
    }

    const tier = await selectTier({
      modeOverride: this.opts.modeOverride,
      tierOverride: this.opts.tierOverride,
    })
    this.setState({ tier })

    await this.fetchScenarios()
    this.updateGreetingQuickReplies()
    this.setStatus('ready')
    this.opts.emit('answerlay-ready', { tier: tier.tier, mode: tier.mode })

    // Pre-warm the engine immediately so the model is ready on the first
    // message instead of blocking it. Tier D (mobile/scenarios-only) has no
    // LLM to load.
    if (tier.tier !== 'D') {
      void this.ensureEngine()
    }
  }

  setMode(mode: 'mobile' | 'desktop'): void {
    if (this.state.tier?.mode === mode) return
    this.engine?.destroy()
    this.engine = null
    this.enginePromise = null
    this.opts.modeOverride = mode
    this.setState({ tier: null })
    void selectTier({
      modeOverride: mode,
      tierOverride: this.opts.tierOverride,
    }).then((tier) => {
      this.setState({ tier })
      this.opts.emit('answerlay-tier-change', { tier: tier.tier, reason: 'mode-changed' })
    })
  }

  private async fetchScenarios(): Promise<void> {
    const url = this.state.config?.scenariosPublicUrl
    if (!url) return
    try {
      const res = await fetch(url, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`scenarios.json: HTTP ${res.status}`)
      const payload = (await res.json()) as ScenariosPayload
      const cfg = this.state.config?.config
      const merged: ScenariosPayload = {
        ...payload,
        fallbackMessage: resolveScenarioFallbackMessage(
          cfg?.scenarioFallbackMessage,
          payload.fallbackMessage,
        ),
      }
      this.scenariosPayload = merged
      this.scenariosEngine = new ScenariosEngine(
        merged,
        (text) => this.ensureEmbedder().embed(text),
        cfg?.scenarioMatchThreshold,
      )
    } catch (err) {
      this.opts.emit('answerlay-error', {
        phase: 'scenarios',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private async fetchVectors(): Promise<void> {
    const url = this.state.config?.vectorsPublicUrl
    if (!url) return

    if (!this.opts.disableCache) {
      const cached = await getCachedVectors(this.opts.assistantId, 'e5s')
      if (cached) {
        this.vectorsPayload = {
          model: 'e5-small',
          dim: cached.chunks[0]?.embedding.length ?? 384,
          builtAt: cached.builtAt,
          chunkCount: cached.chunks.length,
          chunks: cached.chunks,
        }
        return
      }
    }

    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`vectors.json: HTTP ${res.status}`)
    const payload = (await res.json()) as VectorsPayload
    this.vectorsPayload = payload

    if (!this.opts.disableCache) {
      void setCachedVectors(this.opts.assistantId, 'e5s', {
        loadedAt: Date.now(),
        builtAt: payload.builtAt,
        chunks: payload.chunks,
      })
    }
  }

  private ensureEmbedder(): QueryEmbedder {
    if (!this.embedder) {
      this.embedder = new QueryEmbedder(this.opts.modelBaseUrl ?? undefined)
    }
    return this.embedder
  }

  private ensureEngine(): Promise<Engine | null> {
    if (!this.enginePromise) this.enginePromise = this._initEngine()
    return this.enginePromise
  }

  private async _initEngine(): Promise<Engine | null> {
    if (this.engine) return this.engine
    const tier = this.state.tier
    if (!tier) return null
    if (tier.tier === 'D') return null

    this.setStatus('engine-loading')
    const onProgress = (p: { file?: string; progress?: number }) => {
      this.setState({ loadingProgress: { file: p.file, progress: p.progress } })
    }

    const tryTier = async (t: Tier): Promise<Engine | null> => {
      try {
        if (t === 'A') {
          const e = new QwenEngine(this.opts.modelBaseUrl ?? undefined)
          await e.init(onProgress)
          return e
        }
        if (t === 'B') {
          const e = new WllamaEngine(t, this.opts.modelBaseUrl ?? undefined)
          await e.init(onProgress)
          return e
        }
        return null
      } catch (err) {
        this.opts.emit('answerlay-error', {
          phase: 'engine',
          error: err instanceof Error ? err.message : String(err),
        })
        return null
      }
    }

    let cur: Tier | null = tier.tier
    while (cur && cur !== 'D') {
      const tryFor: Tier = cur
      const engine = await tryTier(tryFor)
      if (engine) {
        this.engine = engine
        if (tryFor !== tier.tier) {
          const updated: TierSelection = { ...tier, tier: tryFor, reason: 'engine-init-failed' }
          this.setState({ tier: updated })
          this.opts.emit('answerlay-tier-change', { tier: tryFor, reason: 'engine-init-failed' })
        }
        try {
          await this.fetchVectors()
        } catch (err) {
          this.opts.emit('answerlay-error', {
            phase: 'vectors',
            error: err instanceof Error ? err.message : String(err),
          })
        }
        this.setStatus('ready')
        return engine
      }
      cur = stepDownTier(cur)
    }

    // Fell all the way through — no LLM, scenarios-only. We only reach this
    // when the original tier was A/B (D returns early above), so always
    // notify the host of the downgrade.
    const updated: TierSelection = { ...tier, tier: 'D', reason: 'engine-init-failed' }
    this.setState({ tier: updated })
    this.opts.emit('answerlay-tier-change', { tier: 'D', reason: 'engine-init-failed' })
    this.setStatus('ready')
    return null
  }

  async send(text: string): Promise<void> {
    if (this.destroyed) return
    if (!this.state.tier) return
    if (this.state.status === 'thinking' || this.state.status === 'streaming') return

    const trimmed = text.trim()
    if (!trimmed) return

    this.pushMessage({ id: newId('u'), role: 'user', content: trimmed, status: 'done' })
    this.opts.emit('answerlay-message', { role: 'user', text: trimmed })

    this.setStatus('thinking')

    // Tier D / mobile — scenarios only.
    if (this.state.tier.tier === 'D') {
      await this.respondScenariosOnly(trimmed)
      return
    }

    // Tiers A/B — try short-circuit first.
    if (this.scenariosPayload) {
      const result = await shortCircuit({
        question: trimmed,
        scenarios: this.scenariosPayload.scenarios,
        embed: (t) => this.ensureEmbedder().embed(t),
        embeddingModel: this.scenariosPayload.embeddingModel,
        matchThreshold: this.state.config?.config.scenarioMatchThreshold,
      })
      if (result.kind === 'scenario') {
        const id = newId('a')
        this.pushMessage({
          id,
          role: 'assistant',
          content: result.scenario.answer,
          status: 'done',
          source: 'scenario',
          matchedScenarioId: result.scenario.id,
        })
        this.opts.emit('answerlay-message', {
          role: 'assistant',
          text: result.scenario.answer,
          matchedScenarioId: result.scenario.id,
        })
        this.setStatus('ready')
        return
      }
    }

    // Run the LLM. Initialise engine + vectors lazily.
    const engine = await this.ensureEngine()
    if (!engine) {
      // Fell to scenarios-only at runtime — re-route.
      await this.respondScenariosOnly(trimmed)
      return
    }

    const vectors = this.vectorsPayload
    const topK = this.state.config?.config.topK ?? 4
    const maxTokens = this.state.config?.config.maxTokens ?? 256
    let chunks: ReturnType<typeof toRetrievalChunk>[] = []
    if (vectors && vectors.chunks.length > 0) {
      try {
        const queryVec = await this.ensureEmbedder().embed(trimmed)
        const top = cosineTopK(queryVec, vectors.chunks, topK)
        chunks = top.map((s) => toRetrievalChunk(s.chunk))
      } catch (err) {
        this.opts.emit('answerlay-error', {
          phase: 'inference',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const id = newId('a')
    this.pushMessage({ id, role: 'assistant', content: '', status: 'streaming', source: 'llm' })
    this.setStatus('streaming')

    const language = this.state.config?.config.language || undefined
    const history = this.buildHistoryForLLM()

    try {
      let collected = ''
      const finalText = await engine.ask(
        {
          question: trimmed,
          shopName: this.state.config?.config.name ?? 'us',
          chunks,
          maxTokens,
          language,
          history,
        },
        (token) => {
          collected += token
          this.updateMessage(id, { content: collected })
        },
      )
      this.updateMessage(id, { content: finalText || collected, status: 'done' })
      this.opts.emit('answerlay-message', { role: 'assistant', text: finalText || collected })
      this.setStatus('ready')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.updateMessage(id, { status: 'error' })
      this.opts.emit('answerlay-error', { phase: 'inference', error: message })
      this.setStatus('error', message)
    }
  }

  private async respondScenariosOnly(question: string): Promise<void> {
    if (!this.scenariosEngine) {
      const fallback = resolveScenarioFallbackMessage(
        this.state.config?.config.scenarioFallbackMessage,
      )
      this.pushMessage({
        id: newId('a'),
        role: 'assistant',
        content: fallback,
        status: 'done',
        source: 'fallback',
      })
      this.setStatus('ready')
      return
    }

    const result = await this.scenariosEngine.ask(question)
    const msg: ChatMessage = {
      id: newId('a'),
      role: 'assistant',
      content: result.answer,
      status: 'done',
      source: result.source,
      matchedScenarioId: result.scenario?.id,
      quickReplies: result.suggestions?.map(scenarioToQuickReply),
    }
    this.pushMessage(msg)
    this.opts.emit('answerlay-message', {
      role: 'assistant',
      text: result.answer,
      matchedScenarioId: result.scenario?.id,
    })
    this.setStatus('ready')
  }

}
