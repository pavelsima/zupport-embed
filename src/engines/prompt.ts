import type { RetrievalChunk } from '../rag/types'

export interface PromptInput {
  question: string
  shopName: string
  chunks: RetrievalChunk[]
  language?: string
}

const LANGUAGE_NAMES: Record<string, string> = {
  cs: 'Czech',
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  nl: 'Dutch',
  ja: 'Japanese',
}

// System prompt used by both Qwen (chat-template path) and wllama (manual
// ChatML). The shape is identical so curated answers are reproducible across
// tiers.
export const buildSystemPrompt = ({ question: _question, shopName, chunks, language }: PromptInput): string => {
  const today = new Date().toLocaleDateString()
  const context = chunks.map((c) => `[${c.heading}]\n${c.text}`).join('\n\n')
  const langName = language ? (LANGUAGE_NAMES[language] ?? language) : null
  const languageInstruction = langName
    ? `You MUST respond ONLY in ${langName}. Do NOT use English or any other language unless ${langName} is English.\n`
    : `Use the same language as the customer's question.\n`
  return (
    `You are a helpful support assistant for ${shopName}.\n` +
    `Answer questions using ONLY the context provided below.\n` +
    `If the information is not in the context, say so honestly and suggest contacting support.\n` +
    `Be concise. ${languageInstruction}` +
    `Today's date: ${today}\n\n` +
    `--- RELEVANT INFORMATION ---\n${context}\n---`
  )
}

export const buildChatMlPrompt = (input: PromptInput): string => {
  const system = buildSystemPrompt(input)
  // Prefill the assistant turn with an empty <think> block so Qwen3 skips
  // thinking mode and generates only the answer. This works with raw ChatML
  // (i.e. when the GGUF chat template isn't applied by the runtime).
  return (
    `<|im_start|>system\n${system}<|im_end|>\n` +
    `<|im_start|>user\n${input.question}<|im_end|>\n` +
    `<|im_start|>assistant\n<think>\n\n</think>\n\n`
  )
}

export const STOP_TOKENS = ['<|im_end|>', '<|endoftext|>']
