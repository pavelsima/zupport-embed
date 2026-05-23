/// <reference lib="webworker" />
// SmolLM2-360M-Instruct ONNX worker (Tier A, English-only). The transformers.js
// library is loaded from jsDelivr at runtime — bundling it into our package
// would balloon the CDN footprint by 25+ MB (the ONNX Runtime WASM is huge).
// The trade-off is one extra network request on first use; afterwards the
// library is HTTP-cached by the browser.

import { buildSystemPrompt } from '../engines/prompt'

const TRANSFORMERS_CDN =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransformersModule = any

interface RetrievalChunkLite {
  id: string
  heading: string
  text: string
}

const LLM_MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let llmGenerator: any = null
let llmDevice: 'webgpu' | 'wasm' | null = null
let llmIsGenerating = false

const llmPost = (msg: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg)

const llmInitOnce = async (modelBaseUrl?: string) => {
  if (llmGenerator) return
  const transformers: TransformersModule = await import(/* @vite-ignore */ TRANSFORMERS_CDN)
  const { pipeline, env } = transformers

  if (modelBaseUrl) {
    env.allowRemoteModels = true
    env.remoteHost = modelBaseUrl
  }

  const tryDevice = async (device: 'webgpu' | 'wasm') =>
    pipeline('text-generation', LLM_MODEL_ID, {
      dtype: device === 'webgpu' ? 'q4f16' : 'q4',
      device,
      progress_callback: (p: unknown) => llmPost({ type: 'progress', progress: p }),
    })

  try {
    llmGenerator = await tryDevice('webgpu')
    llmDevice = 'webgpu'
  } catch (webgpuErr) {
    console.warn('[answerlay] WebGPU init failed, falling back to WASM:', webgpuErr)
    llmGenerator = await tryDevice('wasm')
    llmDevice = 'wasm'
  }

  llmPost({ type: 'ready', device: llmDevice })
}

const llmBuildMessages = ({
  shopName,
  question,
  chunks,
  history,
}: {
  shopName: string
  question: string
  chunks: RetrievalChunkLite[]
  history?: { role: 'user' | 'assistant'; content: string }[]
}) => {
  const system = buildSystemPrompt({ shopName, question, chunks })
  return [
    { role: 'system', content: system },
    ...(history ?? []),
    { role: 'user', content: question },
  ]
}

const llmHandleQuery = async (payload: {
  question: string
  shopName: string
  chunks: RetrievalChunkLite[]
  maxTokens?: number
  history?: { role: 'user' | 'assistant'; content: string }[]
}) => {
  if (!llmGenerator) throw new Error('Model not initialised — call init first.')
  if (llmIsGenerating) throw new Error('Already generating a response.')
  llmIsGenerating = true

  try {
    const transformers: TransformersModule = await import(
      /* @vite-ignore */ TRANSFORMERS_CDN
    )
    const { TextStreamer } = transformers
    console.log(
      '[answerlay] llm.worker: rag chunks',
      payload.chunks.map((c) => ({ heading: c.heading, len: c.text.length })),
    )
    const messages = llmBuildMessages(payload)

    // SmolLM2's chat template is bundled in the tokenizer config.
    const prompt = llmGenerator.tokenizer.apply_chat_template(messages, {
      tokenize: false,
      add_generation_prompt: true,
    })

    let collected = ''

    const streamer = new TextStreamer(llmGenerator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        collected += text
        if (text) llmPost({ type: 'token', token: text })
      },
    })

    // Qwen2.5-0.5B degenerates into loops ("The The The...") under greedy
    // decoding. Sampling + a mild repetition penalty keeps it coherent.
    await llmGenerator(prompt, {
      max_new_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 160,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9,
      repetition_penalty: 1.15,
      streamer,
    })

    llmPost({ type: 'done', text: collected.trim() })
  } finally {
    llmIsGenerating = false
  }
}

;(self as unknown as DedicatedWorkerGlobalScope).onmessage = async (e: MessageEvent) => {
  const data = e.data
  try {
    if (data.type === 'init') await llmInitOnce(data.modelBaseUrl)
    else if (data.type === 'query') await llmHandleQuery(data)
  } catch (err) {
    llmPost({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      where: data.type === 'init' ? 'init' : 'query',
    })
  }

}
