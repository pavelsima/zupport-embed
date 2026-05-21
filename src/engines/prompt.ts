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
export const buildSystemPrompt = ({ shopName, chunks }: PromptInput): string => {
  const today = new Date().toLocaleDateString()
  const context = chunks.map((c) => `[${c.heading}]\n${c.text}`).join('\n\n')
  return (
    `You are a helpful support assistant for ${shopName}.\n` +
    `Answer questions using ONLY the context provided below.\n` +
    `If the information is not in the context, say so honestly and suggest contacting support.\n` +
    `Be concise.\n` +
    `Today's date: ${today}\n\n` +
    `--- RELEVANT INFORMATION ---\n${context}\n---`
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
