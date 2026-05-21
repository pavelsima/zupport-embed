/// <reference lib="webworker" />
// bge-small-en-v1.5 query embedder, WASM only (works on iOS). English-only.
// User queries are prefixed with the canonical bge retrieval prompt to match
// queue-produced passage vectors (passages embedded with no prefix).
// Loads transformers.js from jsDelivr to keep the embed bundle small.

const EMBEDDER_MODEL_ID = 'Xenova/bge-small-en-v1.5'

const BGE_QUERY_PREFIX = 'Represent this sentence for searching relevant passages: '

const EMBEDDER_TRANSFORMERS_CDN =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null

const embedderPost = (msg: unknown) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg)

const embedderInitOnce = async (modelBaseUrl?: string) => {
  if (extractor) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformers: any = await import(/* @vite-ignore */ EMBEDDER_TRANSFORMERS_CDN)
  const { pipeline, env } = transformers
  if (modelBaseUrl) {
    env.allowRemoteModels = true
    env.remoteHost = modelBaseUrl
  }
  extractor = await pipeline('feature-extraction', EMBEDDER_MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    progress_callback: (p: any) => {
      // transformers.js emits a stream of progress events while ONNX shards
      // download. Forward them so the loading panel can show real progress.
      embedderPost({
        type: 'progress',
        progress: {
          file: p.file,
          loaded: p.loaded,
          total: p.total,
          progress: typeof p.progress === 'number' ? p.progress / 100 : undefined,
          status: p.status,
        },
      })
    },
  })
  embedderPost({ type: 'ready' })
}

const embedderHandleEmbed = async (id: number, text: string) => {
  if (!extractor) throw new Error('Embedder not initialised')
  const output = await extractor(BGE_QUERY_PREFIX + text, { pooling: 'mean', normalize: true })
  const data: Float32Array = output.data ?? output
  const vector = Array.from(data)
  embedderPost({ type: 'embed', id, ok: true, vector })
}

;(self as unknown as DedicatedWorkerGlobalScope).onmessage = async (e: MessageEvent) => {
  const data = e.data
  try {
    if (data.type === 'init') await embedderInitOnce(data.modelBaseUrl)
    else if (data.type === 'embed') await embedderHandleEmbed(data.id, data.text)
  } catch (err) {
    if (data.type === 'embed') {
      embedderPost({
        type: 'embed',
        id: data.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    } else {
      embedderPost({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
