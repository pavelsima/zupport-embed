import { describe, expect, it } from 'vitest'
import { shortCircuit } from '../../src/engines/short-circuit'
import type { PublishedScenario } from '../../src/rag/scenarios-types'

const scenarios: PublishedScenario[] = [
  {
    id: 'shipping',
    question: 'How long does shipping take?',
    variants: ['Delivery time', 'When will my order arrive?'],
    answer: '3–5 business days.',
  },
  {
    id: 'returns',
    question: 'What is your return policy?',
    variants: [],
    answer: '30 days.',
  },
]

describe('shortCircuit', () => {
  it('returns the lexical match when confident', async () => {
    const result = await shortCircuit({
      question: 'How long does shipping take?',
      scenarios,
    })
    expect(result.kind).toBe('scenario')
    if (result.kind === 'scenario') {
      expect(result.scenario.id).toBe('shipping')
      expect(result.source).toBe('lexical')
    }
  })

  it('falls back to suggestions when nothing crosses threshold', async () => {
    const result = await shortCircuit({
      question: 'tell me a joke',
      scenarios,
    })
    expect(result.kind).toBe('miss')
  })

  it('ignores legacy pre-computed embeddings on scenarios', async () => {
    // Old publisher payloads still ship an `embeddings` array. Runtime
    // is now lexical-only — the field should be silently ignored, not
    // cause a parse or match error.
    const withLegacyEmbeddings: PublishedScenario[] = [
      { ...scenarios[0]!, embeddings: [[0.1, 0.2, 0.3]] },
    ]
    const result = await shortCircuit({
      question: 'How long does shipping take?',
      scenarios: withLegacyEmbeddings,
    })
    expect(result.kind).toBe('scenario')
    if (result.kind === 'scenario') {
      expect(result.source).toBe('lexical')
    }
  })

  it('matches on authored variants as synonyms', async () => {
    const result = await shortCircuit({
      question: 'When will my order arrive?',
      scenarios,
    })
    expect(result.kind).toBe('scenario')
    if (result.kind === 'scenario') {
      expect(result.scenario.id).toBe('shipping')
    }
  })
})
