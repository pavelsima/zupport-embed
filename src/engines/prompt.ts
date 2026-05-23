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

// System prompt used by both the Tier A ONNX path (via chat-template) and
// the Tier B wllama path (manual ChatML). English-only.
//
// Phrased deliberately for ~360M-parameter models (SmolLM2): short, numbered
// rules outperform paragraph instructions, and an explicit length cap ("1-3
// short sentences") is the single most reliable lever for stopping rambling.
export const buildSystemPrompt = ({ shopName, chunks }: PromptInput): string => {
  const today = new Date().toLocaleDateString()
  const context = chunks.map((c) => `[${c.heading}]\n${c.text}`).join('\n\n')
  return (
    `You are a friendly customer support assistant for ${shopName}. ` +
    `Your job is to answer the customer's question using ONLY the CONTEXT below.\n\n` +
    `Rules:\n` +
    `1. Reply in 1-3 short sentences. No bullet lists. No headings. No code blocks unless the customer specifically asks for code.\n` +
    `2. Speak directly to the customer in plain, warm language. Do not narrate ("I would say...", "The answer is...").\n` +
    `3. If the CONTEXT does not contain the answer, say so briefly and suggest they contact human support. Do not guess.\n` +
    `4. Do not invent product names, numbers, links, prices, or policies that are not in the CONTEXT.\n\n` +
    `Today's date: ${today}\n\n` +
    `CONTEXT:\n${context}`
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
