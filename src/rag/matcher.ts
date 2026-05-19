import Fuse from 'fuse.js'
import type { PublishedScenario } from './scenarios-types'

// Confidence threshold tuned for short questions (3–15 words). Fuse uses
// a "lower is better" raw score; LEXICAL_CONFIDENT is the cutoff *after*
// inverting it to a 0..1 similarity-like value.
export const LEXICAL_CONFIDENT = 0.25
export const SUGGEST_TOP_N = 3

interface FuseRow {
  id: string
  question: string
  variants: string
  ref: PublishedScenario
}

const buildFuse = (scenarios: PublishedScenario[]) =>
  new Fuse<FuseRow>(
    scenarios.map((s) => ({
      id: s.id,
      question: s.question,
      variants: s.variants.join(' · '),
      ref: s,
    })),
    {
      keys: [
        { name: 'question', weight: 2 },
        { name: 'variants', weight: 1.5 },
      ],
      threshold: 0.5,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 3,
    },
  )

export interface ScenarioMatch {
  scenario: PublishedScenario
  score: number
  source: 'lexical'
}

export interface LexicalResult {
  best: ScenarioMatch | null
  ranked: ScenarioMatch[]
}

export const lexicalMatch = (
  scenarios: PublishedScenario[],
  query: string,
  fuse?: Fuse<FuseRow>,
): LexicalResult => {
  if (!query.trim() || scenarios.length === 0) return { best: null, ranked: [] }
  const f = fuse ?? buildFuse(scenarios)
  const results = f.search(query, { limit: Math.max(SUGGEST_TOP_N, 5) })
  const ranked: ScenarioMatch[] = results.map((r) => ({
    scenario: r.item.ref,
    score: Math.max(0, Math.min(1, 1 - (r.score ?? 0.5))),
    source: 'lexical' as const,
  }))
  const top = results[0]
  const best =
    top && (top.score ?? 1) <= LEXICAL_CONFIDENT
      ? { scenario: top.item.ref, score: 1 - (top.score ?? 0), source: 'lexical' as const }
      : null
  return { best, ranked }
}

export const buildScenarioFuse = buildFuse
