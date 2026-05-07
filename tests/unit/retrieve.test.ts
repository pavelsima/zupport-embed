import { describe, expect, it } from 'vitest'
import { cosineTopK, toRetrievalChunk } from '../../src/rag/retrieve'
import type { Chunk } from '../../src/rag/types'

const makeChunk = (id: string, embedding: number[], text = id): Chunk => ({
  chunk_id: id,
  text,
  embedding,
  meta: {
    source_file: 'doc.md',
    source_file_id: 'f1',
    source_type: 'md',
    section_heading: 'Heading',
    chunk_index: 0,
    token_count: 10,
    language: 'en',
  },
})

describe('cosineTopK', () => {
  it('returns top-k chunks by similarity', () => {
    const chunks = [
      makeChunk('a', [1, 0, 0]),
      makeChunk('b', [0, 1, 0]),
      makeChunk('c', [0.9, 0.1, 0]),
    ]
    const top = cosineTopK([1, 0, 0], chunks, 2)
    expect(top.map((s) => s.chunk.chunk_id)).toEqual(['a', 'c'])
  })

  it('returns 0 score on dimension mismatch', () => {
    const chunks = [makeChunk('a', [1, 0])]
    const top = cosineTopK([1, 0, 0], chunks, 1)
    expect(top[0]?.score).toBe(0)
  })

  it('returns empty array for k <= 0', () => {
    const top = cosineTopK([1, 0], [makeChunk('a', [1, 0])], 0)
    expect(top).toEqual([])
  })

  it('returns empty array for empty chunks', () => {
    expect(cosineTopK([1, 0], [], 5)).toEqual([])
  })
})

describe('toRetrievalChunk', () => {
  it('falls back to source_file when section_heading is null', () => {
    const c: Chunk = {
      chunk_id: 'x',
      text: 'hello',
      embedding: [],
      meta: {
        source_file: 'guide.md',
        source_file_id: 'f',
        source_type: 'md',
        section_heading: null,
        chunk_index: 0,
        token_count: 1,
        language: 'en',
      },
    }
    expect(toRetrievalChunk(c).heading).toBe('guide.md')
  })

  it('uses section_heading when present', () => {
    const c = makeChunk('x', [], 'hi')
    expect(toRetrievalChunk(c).heading).toBe('Heading')
  })
})
