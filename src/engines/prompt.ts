import type { RetrievalChunk } from '../rag/types'

export interface PromptInput {
  question: string
  shopName: string
  chunks: RetrievalChunk[]
}

// Strip Markdown backslash-escapes from a chunk. Some publish pipelines
// store text already escaped for Markdown rendering (e.g. `5\.2`, `\(`,
// `\_`). For LLM context this is noise that confuses small models —
// they read `Cache\_TTL` and can't recognise it as a variable.
// Strip the escape only when the next char is a known Markdown special
// so we don't accidentally collapse literal "\n" sequences in code.
const MARKDOWN_ESCAPE_RE = /\\([\\`*_{}[\]()#+\-.!|>~])/g
const unescapeMarkdown = (s: string): string => s.replace(MARKDOWN_ESCAPE_RE, '$1')

// System prompt for the in-browser LLM (Qwen3-0.6B, via chat-template).
// English-only.
//
// A short, conversational directive works better than numbered rules for
// small models — one paragraph, plain English, the information block
// immediately after.
export const buildSystemPrompt = ({ shopName, chunks }: PromptInput): string => {
  const today = new Date().toLocaleDateString()
  const context = chunks
    .map((c) => `[${unescapeMarkdown(c.heading)}]\n${unescapeMarkdown(c.text)}`)
    .join('\n\n')
  return (
    `You are ${shopName}'s customer support assistant. ` +
    `Use the information below to answer the customer's question concisely — aim for 2-5 short sentences and stop when the question is answered. ` +
    `If the information does not cover the question, briefly say you don't know and suggest contacting human support. ` +
    `Do not make up facts, prices, or policies.\n\n` +
    `Today's date: ${today}\n\n` +
    `Information:\n${context}`
  )
}
