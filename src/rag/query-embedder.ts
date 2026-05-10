// Thin wrapper around the embedder web worker. Lazily spawns the worker
// on first .embed() call so the launcher button shows up immediately.

// Inlined as a Blob URL so the IIFE embed bundle stays a single file —
// classic <script src=…> from GitHub Releases can't resolve a separate
// worker chunk cross-origin.
import EmbedderWorker from '../workers/embedder.worker.ts?worker&inline'

interface EmbedderRequest {
  resolve: (vec: number[]) => void
  reject: (err: Error) => void
}

export class QueryEmbedder {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, EmbedderRequest>()
  private readyPromise: Promise<void> | null = null

  constructor(private readonly modelBaseUrl?: string) {}

  private ensureWorker(): Promise<void> {
    if (this.readyPromise) return this.readyPromise
    this.readyPromise = new Promise<void>((resolve, reject) => {
      const worker = new EmbedderWorker({ name: 'answerlay-embedder' })
      this.worker = worker
      worker.onmessage = (e) => {
        const data = e.data
        if (data.type === 'ready') {
          resolve()
        } else if (data.type === 'embed') {
          const req = this.pending.get(data.id)
          if (!req) return
          this.pending.delete(data.id)
          if (data.ok) req.resolve(data.vector)
          else req.reject(new Error(data.error || 'Embedder failed'))
        } else if (data.type === 'error') {
          reject(new Error(data.message || 'Embedder worker error'))
          for (const req of this.pending.values()) {
            req.reject(new Error(data.message || 'Embedder worker error'))
          }
          this.pending.clear()
        }
      }
      worker.onerror = (e) => {
        const err = new Error(e.message || 'Embedder worker error')
        reject(err)
        for (const req of this.pending.values()) req.reject(err)
        this.pending.clear()
      }
      worker.postMessage({ type: 'init', modelBaseUrl: this.modelBaseUrl })
    })
    return this.readyPromise
  }

  async embed(text: string): Promise<number[]> {
    await this.ensureWorker()
    return new Promise<number[]>((resolve, reject) => {
      const id = this.nextId++
      this.pending.set(id, { resolve, reject })
      this.worker!.postMessage({ type: 'embed', id, text })
    })
  }

  destroy(): void {
    this.worker?.terminate()
    this.worker = null
    this.readyPromise = null
    for (const req of this.pending.values()) req.reject(new Error('Embedder destroyed'))
    this.pending.clear()
  }
}
