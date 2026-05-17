/// <reference lib="webworker" />
// multilingual-e5-small query embedder, WASM only (works on iOS).
// User queries must use the e5 "query: " prefix to match queue-produced vectors.
// Loads transformers.js from jsDelivr to keep the embed bundle small.

const EMBEDDER_MODEL_ID = 'Xenova/multilingual-e5-small'

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
  })
  embedderPost({ type: 'ready' })
}

const embedderHandleEmbed = async (id: number, text: string) => {
  if (!extractor) throw new Error('Embedder not initialised')
  const output = await extractor('query: ' + text, { pooling: 'mean', normalize: true })
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
