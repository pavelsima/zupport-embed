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

  it('uses the embedding callback when lexical fails and a scenario has embeddings', async () => {
    const withEmb: PublishedScenario[] = [
      {
        ...scenarios[0]!,
        embeddings: [[0.99, 0.01, 0]],
      },
    ]
    const result = await shortCircuit({
      question: 'something completely unrelated',
      scenarios: withEmb,
      embed: async () => [1, 0, 0],
    })
    expect(result.kind).toBe('scenario')
    if (result.kind === 'scenario') {
      expect(result.source).toBe('embedding')
    }
  })

  it('survives an embedder failure and returns suggestions', async () => {
    const result = await shortCircuit({
      question: 'gibberish question with nothing matching',
      scenarios,
      embed: async () => {
        throw new Error('embedder offline')
      },
    })
    expect(result.kind).toBe('miss')
  })
})
