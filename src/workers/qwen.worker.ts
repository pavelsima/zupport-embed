/// <reference lib="webworker" />
// Qwen3-0.6B ONNX worker. The transformers.js library is loaded from
// jsDelivr at runtime — bundling it into our package would balloon the
// CDN footprint by 25+ MB (the ONNX Runtime WASM is huge). The trade-off
// is one extra network request on first use; afterwards the library is
// HTTP-cached by the browser.

const TRANSFORMERS_CDN =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransformersModule = any

interface RetrievalChunkLite {
  id: string
  heading: string
  text: string
}

const LANGUAGE_NAMES: Record<string, string> = {
  cs: 'Czech', en: 'English', de: 'German', fr: 'French', es: 'Spanish',
  it: 'Italian', pt: 'Portuguese', pl: 'Polish', nl: 'Dutch', ja: 'Japanese',
}

// Strip <think>...</think> blocks that Qwen3 may emit in thinking mode.
// Uses a greedy match so partial blocks (mid-stream) are also cleaned.
const stripThinkingTags = (text: string): string =>
  text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '').trim()

const QWEN_MODEL_ID = 'onnx-community/Qwen3-0.6B-ONNX'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let qwenGenerator: any = null
let qwenDevice: 'webgpu' | 'wasm' | null = null
let qwenIsGenerating = false

const qwenPost = (msg: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg)

const qwenInitOnce = async (modelBaseUrl?: string) => {
  if (qwenGenerator) return
  const transformers: TransformersModule = await import(/* @vite-ignore */ TRANSFORMERS_CDN)
  const { pipeline, env } = transformers

  if (modelBaseUrl) {
    env.allowRemoteModels = true
    env.remoteHost = modelBaseUrl
  }

  const tryDevice = async (device: 'webgpu' | 'wasm') =>
    pipeline('text-generation', QWEN_MODEL_ID, {
      dtype: device === 'webgpu' ? 'q4f16' : 'q4',
      device,
      progress_callback: (p: unknown) => qwenPost({ type: 'progress', progress: p }),
    })

  try {
    qwenGenerator = await tryDevice('webgpu')
    qwenDevice = 'webgpu'
  } catch (webgpuErr) {
    console.warn('[answerlay] WebGPU init failed, falling back to WASM:', webgpuErr)
    qwenGenerator = await tryDevice('wasm')
    qwenDevice = 'wasm'
  }

  qwenPost({ type: 'ready', device: qwenDevice })
}

const qwenBuildMessages = ({
  shopName,
  question,
  chunks,
  language,
  history,
}: {
  shopName: string
  question: string
  chunks: RetrievalChunkLite[]
  language?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
}) => {
  const today = new Date().toLocaleDateString()
  const context = chunks.map((c) => `[${c.heading}]\n${c.text}`).join('\n\n')
  const langName = language ? (LANGUAGE_NAMES[language] ?? language) : null
  const languageInstruction = langName
    ? `You MUST respond ONLY in ${langName}. Do NOT use English or any other language unless ${langName} is English.\n`
    : `Use the same language as the customer's question.\n`
  const system =
    `You are a helpful support assistant for ${shopName}.\n` +
    `Answer questions using ONLY the context provided below.\n` +
    `If the information is not in the context, say so honestly and suggest contacting support.\n` +
    `Be concise. ${languageInstruction}` +
    `Today's date: ${today}\n\n` +
    `--- RELEVANT INFORMATION ---\n${context}\n---`
  return [
    { role: 'system', content: system },
    ...(history ?? []),
    { role: 'user', content: question },
  ]
}

const qwenHandleQuery = async (payload: {
  question: string
  shopName: string
  chunks: RetrievalChunkLite[]
  maxTokens?: number
  language?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
}) => {
  if (!qwenGenerator) throw new Error('Model not initialised — call init first.')
  if (qwenIsGenerating) throw new Error('Already generating a response.')
  qwenIsGenerating = true

  try {
    const transformers: TransformersModule = await import(
      /* @vite-ignore */ TRANSFORMERS_CDN
    )
    const { TextStreamer } = transformers
    const messages = qwenBuildMessages(payload)

    const prompt = qwenGenerator.tokenizer.apply_chat_template(messages, {
      tokenize: false,
      add_generation_prompt: true,
      enable_thinking: false,
    })

    // Buffer for the current token stream. We accumulate and strip thinking
    // tags lazily — only post clean tokens to the UI.
    let rawCollected = ''
    let cleanSent = ''

    const streamer = new TextStreamer(qwenGenerator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        rawCollected += text
        // Strip any <think>...</think> block that may have completed, then
        // compute what incremental clean text is new since last post.
        const cleanNow = stripThinkingTags(rawCollected)
        const delta = cleanNow.slice(cleanSent.length)
        if (delta) {
          cleanSent = cleanNow
          qwenPost({ type: 'token', token: delta })
        }
      },
    })

    await qwenGenerator(prompt, {
      max_new_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 256,
      do_sample: false,
      streamer,
    })

    // Final clean pass in case a partial <think> block was still open.
    const finalText = stripThinkingTags(rawCollected)
    qwenPost({ type: 'done', text: finalText })
  } finally {
    qwenIsGenerating = false
  }
}

;(self as unknown as DedicatedWorkerGlobalScope).onmessage = async (e: MessageEvent) => {
  const data = e.data
  try {
    if (data.type === 'init') await qwenInitOnce(data.modelBaseUrl)
    else if (data.type === 'query') await qwenHandleQuery(data)
  } catch (err) {
    qwenPost({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      where: data.type === 'init' ? 'init' : 'query',
    })
  }

}
