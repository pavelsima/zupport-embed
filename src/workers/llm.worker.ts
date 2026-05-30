/// <reference lib="webworker" />
// Qwen3-0.6B ONNX worker (the desktop LLM, English-only). The transformers.js
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

const LLM_MODEL_ID = 'onnx-community/Qwen3-0.6B-ONNX'

// Strip Qwen3 reasoning blocks. We disable thinking via the chat
// template, but as a safety net we also remove any <think>...</think>
// spans (and any unterminated trailing <think>) from final output.
const stripThinkBlocks = (s: string): string =>
  s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '').trim()

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

    // Qwen3's chat template is bundled in the tokenizer config. We pass
    // enable_thinking:false so the model skips its <think>...</think>
    // reasoning prefix and produces a direct answer — appropriate for
    // grounded RAG support replies where the chain-of-thought would just
    // burn tokens.
    const prompt = llmGenerator.tokenizer.apply_chat_template(messages, {
      tokenize: false,
      add_generation_prompt: true,
      enable_thinking: false,
    })
    console.log('[answerlay] llm.worker: prompt sent to model\n' + prompt)

    let collected = ''

    const streamer = new TextStreamer(llmGenerator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        collected += text
        if (text) llmPost({ type: 'token', token: text })
      },
    })

    // Qwen3 non-thinking generation: HF model card recommends temperature
    // 0.7 / top_p 0.8 / top_k 20 / repetition_penalty 1.0. We pull
    // temperature down to 0.3 because grounded RAG benefits from sticking
    // closely to CONTEXT rather than free-associating.
    await llmGenerator(prompt, {
      max_new_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 256,
      do_sample: true,
      temperature: 0.3,
      top_p: 0.8,
      top_k: 20,
      repetition_penalty: 1.0,
      streamer,
    })

    llmPost({ type: 'done', text: stripThinkBlocks(collected) })
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
