import { describe, expect, it } from 'vitest'
import {
  buildScenarioFuse,
  LEXICAL_CONFIDENT,
  lexicalMatch,
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

  it('matches on authored variants as synonyms', () => {
    const r = lexicalMatch(fixtures, 'When will my order arrive')
    expect(r.best?.scenario.id).toBe('shipping')
  })
})

describe('thresholds', () => {
  it('stays as documented constants', () => {
    expect(LEXICAL_CONFIDENT).toBe(0.25)
  })
})
