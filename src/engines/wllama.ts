import type { Wllama as WllamaType } from '@wllama/wllama'
import type {
  AskInput,
  Engine,
  GenerationCallback,
  InitResult,
  ProgressCallback,
} from './engine'
import { buildChatMlPrompt, STOP_TOKENS } from './prompt'
import { TIER_APPROX_MB, TIER_LABELS, type Tier } from './tier'

const stripThinkingTags = (text: string): string =>
  text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '').trim()

export type WllamaTier = 'B'

interface VariantConfig {
  modelUrl: string
  filename: string
}

const VARIANTS: Record<WllamaTier, VariantConfig> = {
  B: {
    modelUrl:
      'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf',
    filename: 'qwen3-0.6b-q4.gguf',
  },
}

const wllamaWasmUrls = (version = '2.4.0') => ({
  'single-thread/wllama.wasm': `https://cdn.jsdelivr.net/npm/@wllama/wllama@${version}/esm/single-thread/wllama.wasm`,
  'multi-thread/wllama.wasm': `https://cdn.jsdelivr.net/npm/@wllama/wllama@${version}/esm/multi-thread/wllama.wasm`,
})

export class WllamaEngine implements Engine {
  readonly tier: Tier
  readonly label: string
  readonly mode = 'generation' as const
  readonly approxSizeMB: number

  private readonly variant: WllamaTier
  private readonly modelUrl: string
  private readonly filename: string
  private wllama: WllamaType | null = null
  private busy = false

  constructor(variant: WllamaTier = 'B', modelBaseUrl?: string) {
    const cfg = VARIANTS[variant]
    this.variant = variant
    this.tier = variant
    this.label = TIER_LABELS[variant]
    this.approxSizeMB = TIER_APPROX_MB[variant]
    this.modelUrl = modelBaseUrl
      ? `${modelBaseUrl.replace(/\/$/, '')}/${cfg.filename}`
      : cfg.modelUrl
    this.filename = cfg.filename
  }

  async init(onProgress: ProgressCallback): Promise<InitResult> {
    onProgress({ phase: 'starting' })
    // Dynamic-import wllama so it's not in the launcher's first paint
    // bundle. wllama+glue is several MB; nobody on Tier A needs it.
    const { Wllama } = await import('@wllama/wllama')
    this.wllama = new Wllama(wllamaWasmUrls())

    let totalSize = 0
    let loaded = 0

    await this.wllama.loadModelFromUrl(this.modelUrl, {
      progressCallback: ({ loaded: l, total: t }: { loaded: number; total: number }) => {
        loaded = l
        totalSize = t || totalSize
        onProgress({
          file: this.filename,
          loaded,
          total: totalSize || loaded,
          progress: totalSize > 0 ? loaded / totalSize : 0,
          done: totalSize > 0 && loaded >= totalSize,
        })
      },
    })

    onProgress({ phase: 'ready' })
    return { device: 'wasm' }
  }

  async ask(input: AskInput, onToken?: GenerationCallback): Promise<string> {
    if (!this.wllama) throw new Error('wllama engine not initialised')
    if (this.busy) throw new Error('wllama engine is already generating')
    this.busy = true

    let rawCollected = ''
    let cleanSent = ''
    try {
      const prompt = buildChatMlPrompt({
        question: input.question,
        shopName: input.shopName,
        chunks: input.chunks,
        language: input.language,
        history: input.history,
      })

      await this.wllama.createCompletion(prompt, {
        nPredict: input.maxTokens ?? 256,
        sampling: { temp: 0.3, top_k: 40, top_p: 0.9 },
        // wllama 2.4 typed stopTokens as number[] (token IDs). We use string
        // markers because the original main-app code did and it works at
        // runtime; cast to keep TS happy without rewriting the engine.
        stopTokens: STOP_TOKENS as unknown as number[],
        onNewToken: (_token: number, _piece: Uint8Array, currentText: string) => {
          rawCollected = currentText
          const cleanNow = stripThinkingTags(rawCollected)
          const delta = cleanNow.slice(cleanSent.length)
          if (delta) {
            cleanSent = cleanNow
            onToken?.(delta)
          }
        },
      })

      const raw = rawCollected
      const finalText = STOP_TOKENS.reduce(
        (s, t) => (s.endsWith(t) ? s.slice(0, -t.length).trim() : s),
        raw.trim(),
      )
      return stripThinkingTags(finalText)
    } finally {
      this.busy = false
    }
  }

  destroy(): void {
    this.wllama?.exit().catch(() => {})
    this.wllama = null
  }

}
