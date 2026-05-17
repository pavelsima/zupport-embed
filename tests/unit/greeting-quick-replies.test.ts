import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/core/config-loader'
import { MAX_GREETING_QUICK_REPLIES, resolveGreetingQuickReplies } from '../../src/core/store'
import type { PublishedScenario } from '../../src/rag/scenarios-types'

const scenarios: PublishedScenario[] = [
  { id: 'a', question: 'Q A', variants: [], answer: 'A' },
  { id: 'b', question: 'Q B', variants: [], answer: 'B' },
  { id: 'c', question: 'Q C', variants: [], answer: 'C' },
]

describe('resolveGreetingQuickReplies', () => {
  it('returns empty when ids are missing or empty', () => {
    expect(resolveGreetingQuickReplies(undefined, scenarios)).toEqual([])
    expect(resolveGreetingQuickReplies([], scenarios)).toEqual([])
  })

  it('preserves config order and maps to quick replies', () => {
    expect(resolveGreetingQuickReplies(['c', 'a'], scenarios)).toEqual([
      { scenarioId: 'c', label: 'Q C' },
      { scenarioId: 'a', label: 'Q A' },
    ])
  })

  it('skips unknown ids', () => {
    expect(resolveGreetingQuickReplies(['missing', 'b'], scenarios)).toEqual([
      { scenarioId: 'b', label: 'Q B' },
    ])
  })

  it(`caps at ${MAX_GREETING_QUICK_REPLIES} items`, () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      question: `Q ${i}`,
      variants: [] as string[],
      answer: `${i}`,
    }))
    const ids = many.map((s) => s.id)
    const result = resolveGreetingQuickReplies(ids, many)
    expect(result).toHaveLength(MAX_GREETING_QUICK_REPLIES)
    expect(result[0]?.scenarioId).toBe('s0')
    expect(result[MAX_GREETING_QUICK_REPLIES - 1]?.scenarioId).toBe(`s${MAX_GREETING_QUICK_REPLIES - 1}`)
  })
})

describe('loadConfig greetingQuickReplyIds', () => {
  it('passes greetingQuickReplyIds through inline config', async () => {
    const result = await loadConfig({
      assistantId: 'a',
      inlineConfig: {
        name: 'Test',
        greeting: 'Hi',
        brandColor: '#000000',
        position: 'bottom-right',
        topK: 4,
        maxTokens: 256,
        greetingQuickReplyIds: ['x', 'y'],
      },
    })
    expect(result.config.greetingQuickReplyIds).toEqual(['x', 'y'])
  })
})
