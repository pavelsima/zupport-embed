import { describe, expect, it } from 'vitest'
import {
  buildScenarioFuse,
  cosine,
  embeddingMatch,
  EMBEDDING_CONFIDENT,
  LEXICAL_CONFIDENT,
  lexicalMatch,
  mergeSuggestions,
} from '../../src/rag/matcher'
import type { PublishedScenario } from '../../src/rag/scenarios-types'

const fixtures: PublishedScenario[] = [
  {
    id: 'shipping',
    question: 'How long does shipping take?',
    variants: ['When will my order arrive?', 'Delivery times'],
    answer: '3–5 business days.',
  },
  {
    id: 'returns',
    question: 'What is your return policy?',
    variants: ['Refund process', 'How do I return?'],
    answer: '30 days unworn.',
  },
]

describe('lexicalMatch', () => {
  it('returns no best match for empty query', () => {
    const r = lexicalMatch(fixtures, '')
    expect(r.best).toBeNull()
    expect(r.ranked).toHaveLength(0)
  })

  it('finds a confident match on a near-exact question', () => {
    const r = lexicalMatch(fixtures, 'How long does shipping take')
    expect(r.best?.scenario.id).toBe('shipping')
  })

  it('returns ranked suggestions even when below the confidence bar', () => {
    const r = lexicalMatch(fixtures, 'shipping')
    expect(r.ranked.length).toBeGreaterThan(0)
  })

  it('reuses a prebuilt fuse instance', () => {
    const fuse = buildScenarioFuse(fixtures)
    const r = lexicalMatch(fixtures, 'return policy', fuse)
    expect(r.best?.scenario.id).toBe('returns')
  })
})

describe('cosine', () => {
  it('returns 0 on length mismatch', () => {
    expect(cosine([1, 0], [1, 0, 0])).toBe(0)
  })

  it('returns 1 for identical normalised vectors', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
  })
})

describe('embeddingMatch', () => {
  it('skips scenarios without embeddings', () => {
    const r = embeddingMatch(fixtures, [1, 0, 0])
    expect(r.best).toBeNull()
    expect(r.ranked).toHaveLength(0)
  })

  it('takes the max similarity across question + variants', () => {
    const withEmb: PublishedScenario[] = [
      {
        ...fixtures[0]!,
        embeddings: [
          [0.6, 0.8, 0],
          [0.99, 0.01, 0],
          [0, 1, 0],
        ],
      },
    ]
    const r = embeddingMatch(withEmb, [1, 0, 0])
    expect(r.best?.scenario.id).toBe('shipping')
    expect(r.best?.score).toBeGreaterThan(EMBEDDING_CONFIDENT)
  })

  it('returns null best below confidence', () => {
    const withEmb: PublishedScenario[] = [
      { ...fixtures[0]!, embeddings: [[0.5, 0.5, 0.5]] },
    ]
    const r = embeddingMatch(withEmb, [1, 0, 0])
    expect(r.best).toBeNull()
    expect(r.ranked.length).toBe(1)
  })
})

describe('mergeSuggestions', () => {
  it('dedups by scenario id and sums scores', () => {
    const lex = [
      { scenario: fixtures[0]!, score: 0.5, source: 'lexical' as const },
    ]
    const emb = [
      { scenario: fixtures[0]!, score: 0.4, source: 'embedding' as const },
      { scenario: fixtures[1]!, score: 0.3, source: 'embedding' as const },
    ]
    const out = mergeSuggestions(lex, emb)
    expect(out[0]?.id).toBe('shipping')
    expect(out).toHaveLength(2)
  })
})

describe('thresholds', () => {
  it('stays as documented constants', () => {
    expect(LEXICAL_CONFIDENT).toBe(0.25)
    expect(EMBEDDING_CONFIDENT).toBe(0.72)
  })
})
