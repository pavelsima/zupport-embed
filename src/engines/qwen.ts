import type {
  AskInput,
  Engine,
  GenerationCallback,
  InitResult,
  ProgressCallback,
} from './engine'
import { TIER_APPROX_MB, TIER_LABELS } from './tier'

interface PendingTask {
  resolve: (text: string) => void
  reject: (err: Error) => void
  onToken: GenerationCallback | undefined
  collected: string
}

export class QwenEngine implements Engine {
  readonly tier = 'A' as const
  readonly label = TIER_LABELS.A
  readonly mode = 'generation' as const
  readonly approxSizeMB = TIER_APPROX_MB.A

  private worker: Worker | null = null
  private device: string | null = null
  private initResolve: ((r: InitResult) => void) | null = null
  private initReject: ((err: Error) => void) | null = null
  private pending: PendingTask | null = null

  constructor(private readonly modelBaseUrl?: string) {}

  init(onProgress: ProgressCallback): Promise<InitResult> {
    if (this.worker) return Promise.resolve({ device: this.device ?? 'unknown' })

    return new Promise<InitResult>((resolve, reject) => {
      this.initResolve = resolve
      this.initReject = reject

      const worker = new Worker(new URL('../workers/qwen.worker.ts', import.meta.url), {
        type: 'module',
        name: 'answerlay-qwen',
      })
      this.worker = worker

      worker.onmessage = (e) => {
        const data = e.data
        if (data.type === 'progress') {
          const p = data.progress ?? {}
          if (p.file) {
            onProgress({
              file: p.file,
              loaded: p.loaded,
              total: p.total,
              progress: typeof p.progress === 'number' ? p.progress / 100 : undefined,
              done: p.status === 'done',
            })
          }
        } else if (data.type === 'ready') {
          this.device = data.device
          this.initResolve?.({ device: data.device })
          this.initResolve = this.initReject = null
        } else if (data.type === 'token') {
          if (this.pending) {
            this.pending.collected += data.token
            this.pending.onToken?.(data.token)
          }
        } else if (data.type === 'done') {
          if (this.pending) {
            this.pending.resolve(data.text || this.pending.collected)
            this.pending = null
          }
        } else if (data.type === 'error') {
          const err = new Error(data.message || 'Qwen worker error')
          if (data.where === 'init') {
            this.initReject?.(err)
            this.initResolve = this.initReject = null
          } else if (this.pending) {
            this.pending.reject(err)
            this.pending = null
          }
        }
      }

      worker.onerror = (e) => {
        const err = new Error(e.message || 'Qwen worker error')
        if (this.initReject) {
          this.initReject(err)
          this.initResolve = this.initReject = null
        } else if (this.pending) {
          this.pending.reject(err)
          this.pending = null
        }
      }

      worker.postMessage({ type: 'init', modelBaseUrl: this.modelBaseUrl })
    })
  }

  ask(input: AskInput, onToken?: GenerationCallback): Promise<string> {
    if (!this.worker) return Promise.reject(new Error('Qwen engine not initialised'))
    if (this.pending) return Promise.reject(new Error('Qwen engine is already generating'))

    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject, onToken, collected: '' }
      this.worker!.postMessage({
        type: 'query',
        question: input.question,
        shopName: input.shopName,
        chunks: input.chunks,
        maxTokens: input.maxTokens ?? 256,
      })
    })
  }

  destroy(): void {
    this.worker?.terminate()
    this.worker = null
    this.pending = null
    this.initResolve = this.initReject = null
  }
}
