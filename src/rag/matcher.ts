import Fuse from 'fuse.js'
import type { PublishedScenario, ScenarioMatcherModel } from './scenarios-types'

// The runtime query embedder always uses mlm-l12-v2. Comparing against
// scenario embeddings from a different model produces meaningless cosine
// scores, so we guard against that here.
const RUNTIME_EMBEDDING_MODEL: ScenarioMatcherModel = 'mlm-l12-v2'

// Confidence thresholds tuned for short questions (3–15 words). The lexical
// pass uses Fuse's "lower is better" raw score; the embedding pass uses
// cosine similarity (higher is better, both vectors L2-normalized).
export const LEXICAL_CONFIDENT = 0.25
export const EMBEDDING_CONFIDENT = 0.72
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
  source: 'lexical' | 'embedding'
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

export const cosine = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!
  return dot
}

export interface EmbeddingResult {
  best: ScenarioMatch | null
  ranked: ScenarioMatch[]
}

export const embeddingMatch = (
  scenarios: PublishedScenario[],
  queryVec: number[],
  payloadModel?: ScenarioMatcherModel,
  threshold?: number,
): EmbeddingResult => {
  // If the scenario embeddings were produced by a different model than the
  // runtime query embedder, the vectors are in incompatible semantic spaces.
  // Skip embedding comparison and fall back to lexical-only matching.
  if (payloadModel && payloadModel !== RUNTIME_EMBEDDING_MODEL) {
    return { best: null, ranked: [] }
  }
  if (queryVec.length === 0) return { best: null, ranked: [] }
  const scored: ScenarioMatch[] = []
  for (const s of scenarios) {
    if (!s.embeddings || s.embeddings.length === 0) continue
    let max = -1
    for (const vec of s.embeddings) {
      const sim = cosine(queryVec, vec)
      if (sim > max) max = sim
    }
    if (max > -1) {
      scored.push({ scenario: s, score: max, source: 'embedding' })
    }
  }
  scored.sort((a, b) => b.score - a.score)
  const cutoff = typeof threshold === 'number' ? threshold : EMBEDDING_CONFIDENT
  const best = scored[0] && scored[0].score >= cutoff ? scored[0] : null
  return { best, ranked: scored.slice(0, Math.max(SUGGEST_TOP_N, 5)) }
}

export const mergeSuggestions = (
  lexical: ScenarioMatch[],
  embedding: ScenarioMatch[],
  limit = SUGGEST_TOP_N,
): PublishedScenario[] => {
  const byId = new Map<string, { scenario: PublishedScenario; score: number }>()
  for (const m of lexical) byId.set(m.scenario.id, { scenario: m.scenario, score: m.score })
  for (const m of embedding) {
    const cur = byId.get(m.scenario.id)
    if (cur) cur.score = cur.score + m.score
    else byId.set(m.scenario.id, { scenario: m.scenario, score: m.score })
  }
  return Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.scenario)
}

export const buildScenarioFuse = buildFuse
