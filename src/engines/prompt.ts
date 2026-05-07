import type { RetrievalChunk } from '../rag/types'

export interface PromptInput {
  question: string
  shopName: string
  chunks: RetrievalChunk[]
}

// System prompt used by both Qwen (chat-template path) and wllama (manual
// ChatML). The shape is identical so curated answers are reproducible across
// tiers.
export const buildSystemPrompt = ({ question: _question, shopName, chunks }: PromptInput): string => {
  const today = new Date().toLocaleDateString()
  const context = chunks.map((c) => `[${c.heading}]\n${c.text}`).join('\n\n')
  return (
    `You are a helpful support assistant for ${shopName}.\n` +
    `Answer questions using ONLY the context provided below.\n` +
    `If the information is not in the context, say so honestly and suggest contacting support.\n` +
    `Be concise. Use the same language as the customer's question.\n` +
    `Today's date: ${today}\n\n` +
    `--- RELEVANT INFORMATION ---\n${context}\n---`
  )
}

export const buildChatMlPrompt = (input: PromptInput): string => {
  const system = buildSystemPrompt(input)
  return (
    `<|im_start|>system\n${system}<|im_end|>\n` +
    `<|im_start|>user\n${input.question}<|im_end|>\n` +
    `<|im_start|>assistant\n`
  )
}

export const STOP_TOKENS = ['<|im_end|>', '<|endoftext|>']
