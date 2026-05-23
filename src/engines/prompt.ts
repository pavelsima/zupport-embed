import type { RetrievalChunk } from '../rag/types'

export interface PromptHistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface PromptInput {
  question: string
  shopName: string
  chunks: RetrievalChunk[]
  history?: PromptHistoryTurn[]
}

// Strip Markdown backslash-escapes from a chunk. Some publish pipelines
// store text already escaped for Markdown rendering (e.g. `5\.2`, `\(`,
// `\_`). For LLM context this is noise that confuses small models —
// SmolLM2-360M reads `Cache\_TTL` and can't recognise it as a variable.
// Strip the escape only when the next char is a known Markdown special
// so we don't accidentally collapse literal "\n" sequences in code.
const MARKDOWN_ESCAPE_RE = /\\([\\`*_{}[\]()#+\-.!|>~])/g
const unescapeMarkdown = (s: string): string => s.replace(MARKDOWN_ESCAPE_RE, '$1')

// System prompt used by both the Tier A ONNX path (via chat-template) and
// the Tier B wllama path (manual ChatML). English-only.
//
// Phrased deliberately for ~360M-parameter models (SmolLM2). v0.9.4's
// numbered-rules style backfired — SmolLM2 started narrating about
// "following the rules" instead of answering. A short, conversational
// directive works better: one paragraph, plain English, the information
// block immediately after.
export const buildSystemPrompt = ({ shopName, chunks }: PromptInput): string => {
  const today = new Date().toLocaleDateString()
  const context = chunks
    .map((c) => `[${unescapeMarkdown(c.heading)}]\n${unescapeMarkdown(c.text)}`)
    .join('\n\n')
  return (
    `You are ${shopName}'s customer support assistant. ` +
    `Use the information below to answer the customer's question in 3-4 short sentences. Stop when the question is answered — do not pad. ` +
    `If the information does not cover the question, briefly say you don't know and suggest contacting human support. ` +
    `Do not make up facts, prices, or policies. Do not repeat the same sentence.\n\n` +
    `Today's date: ${today}\n\n` +
    `Information:\n${context}`
  )
}

// ChatML format used by SmolLM2 (Tier B via wllama). SmolLM2 uses
// <|im_start|>/<|im_end|> turn markers; we render the turns manually because
// wllama's GGUF chat-template support is patchy across versions.
export const buildChatMlPrompt = (input: PromptInput): string => {
  const system = buildSystemPrompt(input)
  const historyBlock = (input.history ?? [])
    .map((t) => `<|im_start|>${t.role}\n${t.content}<|im_end|>\n`)
    .join('')
  return (
    `<|im_start|>system\n${system}<|im_end|>\n` +
    historyBlock +
    `<|im_start|>user\n${input.question}<|im_end|>\n` +
    `<|im_start|>assistant\n`
  )
}

export const STOP_TOKENS = ['<|im_end|>', '<|endoftext|>']
