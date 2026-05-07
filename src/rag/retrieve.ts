import type { Chunk, RetrievalChunk } from './types'

const cosine = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export interface ScoredChunk {
  chunk: Chunk
  score: number
}

export const cosineTopK = (
  query: ArrayLike<number>,
  chunks: Chunk[],
  k: number,
): ScoredChunk[] => {
  if (chunks.length === 0 || k <= 0) return []
  const scored: ScoredChunk[] = chunks.map((c) => ({
    chunk: c,
    score: cosine(query, c.embedding),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

export const toRetrievalChunk = (c: Chunk): RetrievalChunk => ({
  id: c.chunk_id,
  heading: c.meta.section_heading || c.meta.source_file,
  text: c.text,
})
