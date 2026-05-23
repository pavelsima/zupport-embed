import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { Engine } from '../engines/engine'
import { LlmEngine } from '../engines/llm'
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
import { TIER_APPROX_MB } from '../engines/tier'
import {
  allReady,
  formatEtaFriendly,
  initialState,
  liveEtaSeconds,
  makeInitialStages,
  newId,
  resolveGreetingQuickReplies,
  scenarioToQuickReply,
  type ChatMessage,
  type ChatState,
  type DownloadStats,
  type LoadStage,
  type StageKey,
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
  state: ChatState = { ...initialState, stages: makeInitialStages() }

  private host: ReactiveControllerHost
  private opts: ControllerOptions
  private engine: Engine | null = null
  private enginePromise: Promise<Engine | null> | null = null
  private scenariosEngine: ScenariosEngine | null = null
  private embedder: QueryEmbedder | null = null
  private embedderPromise: Promise<void> | null = null
  private scenariosPayload: ScenariosPayload | null = null
  private vectorsPayload: VectorsPayload | null = null
  private greetingMessageId: string | null = null
  private destroyed = false

  // Rolling tracker for the LLM-stage download.
  //
  // WebLLM's progress callback can fire in big jumps (a whole shard
  // lands, multiple shaders compile in one tick, etc.) and `progress`
  // includes compile/mount work, not just bytes. A naïve EMA seeded
  // from the first sample lands at 1000+ MB/s and never recovers.
  //
  // We keep a rolling 8 s window of {t, p} samples and compute speed
  // over that window. Samples that imply >250 MB/s are treated as
  // non-network progress (cache hit, compile burst) and ignored — we
  // keep the last value that was in a sane range so the UI doesn't
  // flicker to "—" mid-download.
  private llmTracker: {
    samples: Array<{ t: number; p: number }>
    lastGoodSpeedMBs: number
    started: boolean
  } = { samples: [], lastGoodSpeedMBs: 0, started: false }

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

  // Patch a single stage. If the patch flips a stage to `done`/`skipped`,
  // and every stage is now resolved, also flip overall status to `ready`.
  // If a non-skipped stage moves out of `done`, fall back to `loading`.
  // Stage transitions are logged to the console so developers can see the
  // pipeline progress in DevTools — end users only see the friendly
  // rotating copy in the loading panel.
  private setStage(key: StageKey, patch: Partial<LoadStage>): void {
    const prev = this.state.stages[key]
    const next = { ...prev, ...patch }
    const nextStages = { ...this.state.stages, [key]: next }
    if (next.status !== prev.status) {
      console.info(`[answerlay] ${key}: ${prev.status} → ${next.status}`, {
        progress: next.progress,
        file: next.file,
        error: next.error,
      })
    }
    const nextStatus: Status =
      this.state.status === 'thinking' ||
      this.state.status === 'streaming' ||
      this.state.status === 'error'
        ? this.state.status
        : allReady(nextStages)
          ? 'ready'
          : 'loading'
    const downloadStats =
      key === 'llm'
        ? this.computeDownloadStats(next)
        : this.state.downloadStats
    this.setState({ stages: nextStages, status: nextStatus, downloadStats })
  }

  // Update the rolling download tracker and return a snapshot for state.
  // Returns null until the LLM stage actually starts downloading. Once
  // `done`, holds the final stats (100%) so the avatar can show "Ready".
  private computeDownloadStats(stage: LoadStage): DownloadStats | null {
    const tier = this.state.tier?.tier ?? 'A'
    const totalMB = TIER_APPROX_MB[tier] || 570
    const wallNow = Date.now()
    if (stage.status === 'done') {
      return {
        downloadedMB: totalMB,
        totalMB,
        speedMBs: this.llmTracker.lastGoodSpeedMBs,
        etaSeconds: 0,
        etaAnchor: wallNow,
      }
    }
    if (stage.status !== 'downloading' && stage.status !== 'mounting') {
      return this.state.downloadStats
    }
    const p =
      typeof stage.progress === 'number'
        ? Math.max(0, Math.min(1, stage.progress))
        : 0
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (!this.llmTracker.started) {
      this.llmTracker = {
        samples: [{ t: now, p }],
        lastGoodSpeedMBs: 0,
        started: true,
      }
      return {
        downloadedMB: p * totalMB,
        totalMB,
        speedMBs: 0,
        etaSeconds: null,
        etaAnchor: wallNow,
      }
    }
    // Append + trim to an 8 s window; keep at least 2 samples so we can
    // still compute when callbacks slow down.
    this.llmTracker.samples.push({ t: now, p })
    const cutoff = now - 8000
    while (
      this.llmTracker.samples.length > 2 &&
      this.llmTracker.samples[0]!.t < cutoff
    ) {
      this.llmTracker.samples.shift()
    }
    const first = this.llmTracker.samples[0]!
    const last = this.llmTracker.samples[this.llmTracker.samples.length - 1]!
    const winDt = (last.t - first.t) / 1000
    if (winDt >= 1.5 && last.p > first.p) {
      const inst = ((last.p - first.p) * totalMB) / winDt
      // Realistic network downloads land between ~0.05 MB/s (very slow
      // mobile) and ~250 MB/s (gigabit fibre + nearby CDN). Anything
      // above 250 MB/s almost certainly reflects either a cache hit or
      // a burst of compile-phase progress with no actual bytes — ignore
      // those samples so the displayed speed stays honest.
      if (inst > 0 && inst < 250) {
        this.llmTracker.lastGoodSpeedMBs = inst
      }
    }
    const speed = this.llmTracker.lastGoodSpeedMBs
    const remaining = (1 - p) * totalMB
    const etaSeconds =
      speed > 0 ? Math.max(1, Math.round(remaining / speed)) : null
    return {
      downloadedMB: p * totalMB,
      totalMB,
      speedMBs: speed,
      etaSeconds,
      etaAnchor: wallNow,
    }
  }

  private pushMessage(msg: ChatMessage): void {
    const stamped: ChatMessage =
      msg.createdAt === undefined ? { ...msg, createdAt: Date.now() } : msg
    this.setState({ messages: [...this.state.messages, stamped] })
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
  // after a publish (and by its Reset button). The loaded models stay in
  // memory — refresh only touches data stages.
  async refresh(opts: { clearMessages?: boolean; bypassCache?: boolean } = {}): Promise<void> {
    if (opts.bypassCache) {
      try {
        await clearCachedVectors(this.opts.assistantId, 'bge')
      } catch {
        // best-effort
      }
    }
    const prevDisable = this.opts.disableCache
    if (opts.bypassCache) this.opts.disableCache = true
    try {
      this.setStage('config', { status: 'downloading', progress: 0 })
      const resolved = await loadConfig({
        assistantId: this.opts.assistantId,
        configUrl: this.opts.configUrl,
        configBaseUrl: this.opts.configBaseUrl,
        inlineConfig: this.opts.inlineConfig,
      })
      this.setState({ config: resolved })
      this.setStage('config', { status: 'done', progress: 1 })

      await Promise.allSettled([
        this.runScenariosStage(),
        this.runVectorsStage(),
      ])
      this.updateGreetingQuickReplies()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setStage('config', { status: 'error', error: message })
      this.opts.emit('answerlay-error', { phase: 'config', error: message })
    } finally {
      this.opts.disableCache = prevDisable
    }
    if (opts.clearMessages) {
      this.greetingMessageId = null
      // Drop the existing conversation first; seedGreeting pushes one new
      // message on top of an empty list.
      this.setState({ messages: [], errorMessage: null })
      const greeting = this.state.config?.config.greeting
      if (greeting) this.seedGreeting(greeting)
      this.updateGreetingQuickReplies()
    }
  }

  /**
   * Boot sequence (new orchestration):
   *   1. Mark `config` downloading → load config.json → done. On failure,
   *      mark `config` error and abort (other stages stay pending).
   *   2. Seed greeting from config.
   *   3. Probe device tier. Mark `embedder`/`llm` as skipped where
   *      appropriate (tier D: skip LLM; mobile launcher click later
   *      triggers the embedder).
   *   4. Kick off all remaining stages in parallel via Promise.allSettled
   *      so one failure can't tank the others.
   *   5. Status transitions to `ready` automatically when every required
   *      stage resolves to done/skipped (handled inside setStage).
   */
  private async boot(): Promise<void> {
    this.setStage('config', { status: 'downloading', progress: 0 })
    let resolved: ResolvedConfig
    try {
      resolved = await loadConfig({
        assistantId: this.opts.assistantId,
        configUrl: this.opts.configUrl,
        configBaseUrl: this.opts.configBaseUrl,
        inlineConfig: this.opts.inlineConfig,
      })
      this.setState({ config: resolved })
      this.setStage('config', { status: 'done', progress: 1 })
      if (resolved.config.greeting) {
        this.seedGreeting(resolved.config.greeting)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setStage('config', { status: 'error', error: message })
      this.opts.emit('answerlay-error', { phase: 'config', error: message })
      this.setStatus('error', message)
      return
    }

    const tier = await selectTier({
      modeOverride: this.opts.modeOverride,
      tierOverride: this.opts.tierOverride,
    })
    this.setState({ tier })

    // Mark stages skipped/pending based on tier.
    if (tier.tier === 'D') {
      // Mobile / scenarios-only: no LLM, no embedder. Scenario matching is
      // lexical (Fuse) — keeps iOS off the embedder download.
      // Vectors aren't strictly needed here either, but the user spec is to
      // load them eagerly so the data stays fresh.
      this.setStage('llm', { status: 'skipped' })
      this.setStage('embedder', { status: 'skipped' })
    }

    // Vectors are eager-loaded on all tiers. Scenarios payload triggers a
    // greeting-quick-replies refresh once it lands. Embedder + LLM are tier-
    // gated.
    const tasks: Promise<unknown>[] = [
      this.runScenariosStage().then(() => this.updateGreetingQuickReplies()),
      this.runVectorsStage(),
    ]
    if (tier.tier !== 'D') {
      tasks.push(this.preWarmEmbedder())
      tasks.push(this.preWarmEngine())
    }

    // Emit ready as soon as the tier is known so listeners that care about
    // "openable" can react. The actual chat-ready transition is conveyed
    // through stage progression + the `ready` status flip in setStage.
    this.opts.emit('answerlay-ready', { tier: tier.tier, mode: tier.mode })

    await Promise.allSettled(tasks)
  }

  private async runScenariosStage(): Promise<void> {
    const url = this.state.config?.scenariosPublicUrl
    if (!url) {
      this.setStage('scenarios', { status: 'skipped' })
      return
    }
    this.setStage('scenarios', { status: 'downloading', progress: 0 })
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
      this.scenariosEngine = new ScenariosEngine(merged, cfg?.scenarioMatchThreshold)
      this.setStage('scenarios', { status: 'done', progress: 1 })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setStage('scenarios', { status: 'error', error: message })
      this.opts.emit('answerlay-error', { phase: 'scenarios', error: message })
    }
  }

  private async runVectorsStage(): Promise<void> {
    const url = this.state.config?.vectorsPublicUrl
    if (!url) {
      this.setStage('vectors', { status: 'skipped' })
      return
    }

    if (!this.opts.disableCache) {
      const cached = await getCachedVectors(this.opts.assistantId, 'bge')
      if (cached) {
        // A 1-frame `mounting` micro-state stops the loading panel from
        // flickering when vectors come straight from IDB.
        this.setStage('vectors', { status: 'mounting', progress: 1 })
        await new Promise((r) => requestAnimationFrame(() => r(undefined)))
        this.vectorsPayload = {
          model: 'bge-small-en-v1.5',
          dim: cached.chunks[0]?.embedding.length ?? 384,
          builtAt: cached.builtAt,
          chunkCount: cached.chunks.length,
          chunks: cached.chunks,
        }
        this.setStage('vectors', { status: 'done', progress: 1 })
        return
      }
    }

    this.setStage('vectors', { status: 'downloading', progress: 0 })
    try {
      const res = await fetch(url, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`vectors.json: HTTP ${res.status}`)
      const payload = (await res.json()) as VectorsPayload
      this.vectorsPayload = payload

      if (!this.opts.disableCache) {
        void setCachedVectors(this.opts.assistantId, 'bge', {
          loadedAt: Date.now(),
          builtAt: payload.builtAt,
          chunks: payload.chunks,
        })
      }
      this.setStage('vectors', { status: 'done', progress: 1 })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setStage('vectors', { status: 'error', error: message })
      this.opts.emit('answerlay-error', { phase: 'vectors', error: message })
    }
  }

  private preWarmEmbedder(): Promise<void> {
    if (this.embedderPromise) return this.embedderPromise
    this.setStage('embedder', { status: 'downloading', progress: 0 })
    this.embedderPromise = this.ensureEmbedder()
      .preWarm((p) => {
        this.setStage('embedder', {
          status: p.status === 'ready' ? 'mounting' : 'downloading',
          file: p.file,
          progress: typeof p.progress === 'number' ? p.progress : undefined,
        })
      })
      .then(() => {
        this.setStage('embedder', { status: 'done', progress: 1 })
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        this.setStage('embedder', { status: 'error', error: message })
        this.opts.emit('answerlay-error', { phase: 'engine', error: message })
        // Allow a future retry — clear the cached promise so the next call
        // re-attempts initialisation.
        this.embedderPromise = null
        throw err
      })
    return this.embedderPromise
  }

  private async preWarmEngine(): Promise<void> {
    try {
      await this.ensureEngine()
    } catch {
      // Errors are surfaced into the stage map by _initEngine.
    }
  }

  setMode(mode: 'mobile' | 'desktop'): void {
    if (this.state.tier?.mode === mode) return
    this.engine?.destroy()
    this.engine = null
    this.enginePromise = null
    this.opts.modeOverride = mode
    // Reset the LLM + embedder stages. Scenarios + vectors stay loaded.
    if (mode === 'mobile') {
      this.setStage('llm', { status: 'skipped' })
      this.setStage('embedder', { status: 'skipped' })
    } else {
      this.setStage('llm', { status: 'pending' })
      if (this.state.stages.embedder.status === 'skipped') {
        this.setStage('embedder', { status: 'pending' })
      }
    }
    this.setState({ tier: null })
    void selectTier({
      modeOverride: mode,
      tierOverride: this.opts.tierOverride,
    }).then((tier) => {
      this.setState({ tier })
      this.opts.emit('answerlay-tier-change', { tier: tier.tier, reason: 'mode-changed' })
      if (tier.tier !== 'D') {
        // Re-trigger embedder + LLM pre-warm if they aren't already done.
        if (this.state.stages.embedder.status !== 'done') {
          void this.preWarmEmbedder()
        }
        void this.preWarmEngine()
      }
    })
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

    this.setStage('llm', { status: 'downloading', progress: 0 })

    const onProgress = (p: { file?: string; progress?: number }) => {
      this.setStage('llm', {
        status: 'downloading',
        file: p.file,
        progress: typeof p.progress === 'number' ? p.progress : undefined,
      })
    }

    const tryTier = async (t: Tier): Promise<Engine | null> => {
      try {
        if (t === 'A') {
          const e = new LlmEngine(this.opts.modelBaseUrl ?? undefined)
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
        this.setStage('llm', { status: 'done', progress: 1 })
        return engine
      }
      cur = stepDownTier(cur)
    }

    // Every desktop tier failed → silently downgrade to D. The widget keeps
    // working on scenarios + fallback, the loading screen flips to ready.
    const updated: TierSelection = { ...tier, tier: 'D', reason: 'engine-init-failed' }
    this.setState({ tier: updated })
    this.opts.emit('answerlay-tier-change', { tier: 'D', reason: 'engine-init-failed' })
    this.setStage('llm', { status: 'skipped' })
    return null
  }

  // Public API used by the answerlay-chat element when the user dismisses
  // a stage error and asks to retry. Re-runs whichever stages are in error.
  async retryFailedStages(): Promise<void> {
    const stages = this.state.stages
    const tasks: Promise<unknown>[] = []
    if (stages.config.status === 'error') {
      // Config failures abort the boot; re-run from the top.
      await this.refresh()
      return
    }
    if (stages.scenarios.status === 'error') tasks.push(this.runScenariosStage())
    if (stages.vectors.status === 'error') tasks.push(this.runVectorsStage())
    if (stages.embedder.status === 'error') tasks.push(this.preWarmEmbedder())
    if (stages.llm.status === 'error') tasks.push(this.preWarmEngine())
    await Promise.allSettled(tasks)
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
        confidentCutoff: this.state.config?.config?.scenarioMatchThreshold,
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

    // If the LLM hasn't finished downloading yet, don't block on the
    // engine promise (would silently queue for many seconds). Push an
    // ETA-aware fallback message with scenario suggestions so the user
    // has something useful to click while they wait.
    if (this.state.stages.llm.status !== 'done') {
      await this.respondLoadingFallback(trimmed)
      return
    }

    // Run the LLM. The engine is normally pre-warmed at boot, but if
    // pre-warm failed or is mid-flight, fall back to ensureEngine here.
    const engine = await this.ensureEngine()
    if (!engine) {
      // Fell to scenarios-only at runtime — re-route.
      await this.respondScenariosOnly(trimmed)
      return
    }

    const vectors = this.vectorsPayload
    const topK = this.state.config?.config.topK ?? 5
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

    const history = this.buildHistoryForLLM()

    try {
      let collected = ''
      const finalText = await engine.ask(
        {
          question: trimmed,
          shopName: this.state.config?.config.name ?? 'us',
          chunks,
          maxTokens,
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

  // Used when the user asks a non-scenario question before the LLM has
  // finished downloading. The message text promises "options below", so
  // we *guarantee* quick-replies are attached: lexical suggestions when
  // we have them, falling back to the configured greeting quick-replies,
  // and finally to the first few scenarios — whichever yields buttons.
  private async respondLoadingFallback(question: string): Promise<void> {
    let suggestions: { scenarioId: string; label: string }[] = []
    let matchedScenario:
      | { id: string; answer: string; source: 'scenario' }
      | undefined
    if (this.scenariosEngine) {
      const result = await this.scenariosEngine.ask(question)
      // If the scenarios engine did find a match (rare — shortCircuit
      // already ran), respect it: better to answer than to nag about
      // download time.
      if (result.source === 'scenario' && result.scenario) {
        matchedScenario = {
          id: result.scenario.id,
          answer: result.answer,
          source: 'scenario',
        }
      } else {
        suggestions = result.suggestions?.map(scenarioToQuickReply) ?? []
      }
    }

    if (matchedScenario) {
      this.pushMessage({
        id: newId('a'),
        role: 'assistant',
        content: matchedScenario.answer,
        status: 'done',
        source: 'scenario',
        matchedScenarioId: matchedScenario.id,
      })
      this.opts.emit('answerlay-message', {
        role: 'assistant',
        text: matchedScenario.answer,
        matchedScenarioId: matchedScenario.id,
      })
      this.setStatus('ready')
      return
    }

    // Guarantee buttons. The lexical matcher returns nothing when there's
    // no token overlap; fall back to the curated greeting list, then to
    // the first few scenarios overall so the user always has something
    // clickable while they wait.
    if (suggestions.length === 0) {
      const cfg = this.state.config?.config
      const scenarios = this.scenariosPayload?.scenarios ?? []
      const greeting = resolveGreetingQuickReplies(
        cfg?.greetingQuickReplyIds,
        scenarios,
      )
      if (greeting.length > 0) {
        suggestions = greeting
      } else if (scenarios.length > 0) {
        suggestions = scenarios.slice(0, 4).map(scenarioToQuickReply)
      }
    }

    const liveEta = this.state.downloadStats
      ? liveEtaSeconds(this.state.downloadStats)
      : null
    const etaPhrase = formatEtaFriendly(liveEta)
    const content =
      `I'm not fully trained yet — the full AI assistant will be ready ${etaPhrase}. ` +
      `For now you can try one of the options below, and once I'm done you can ask me anything.`
    this.pushMessage({
      id: newId('a'),
      role: 'assistant',
      content,
      status: 'done',
      source: 'fallback',
      quickReplies: suggestions.length > 0 ? suggestions : undefined,
    })
    this.opts.emit('answerlay-message', { role: 'assistant', text: content })
    this.setStatus('ready')
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
