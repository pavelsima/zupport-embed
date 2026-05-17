import Fuse from 'fuse.js'
import {
  buildScenarioFuse,
  embeddingMatch,
  lexicalMatch,
  mergeSuggestions,
  type ScenarioMatch,
} from '../rag/matcher'
import type { PublishedScenario, ScenarioMatcherModel } from '../rag/scenarios-types'

export interface ShortCircuitInput {
  question: string
  scenarios: PublishedScenario[]
  fuse?: Fuse<{ id: string; question: string; variants: string; ref: PublishedScenario }>
  embed?: (text: string) => Promise<number[]>
  embeddingModel?: ScenarioMatcherModel
  // Cosine-similarity cutoff for the embedding pass. Omit for the default.
  matchThreshold?: number
}

export interface ShortCircuitHit {
  kind: 'scenario'
  scenario: PublishedScenario
  source: 'lexical' | 'embedding'
  score: number
}

export interface ShortCircuitMiss {
  kind: 'miss'
  suggestions: PublishedScenario[]
  rankedLexical: ScenarioMatch[]
  rankedEmbedding: ScenarioMatch[]
}

export type ShortCircuitResult = ShortCircuitHit | ShortCircuitMiss

// Run the same lexical + embedding match used in mobile-mode against the
// scenarios.json. If either pass crosses its confidence threshold, return
// the curated answer and skip the LLM.
export const shortCircuit = async (
  input: ShortCircuitInput,
): Promise<ShortCircuitResult> => {
  const lex = lexicalMatch(input.scenarios, input.question, input.fuse)
  if (lex.best) {
    return {
      kind: 'scenario',
      scenario: lex.best.scenario,
      source: 'lexical',
      score: lex.best.score,
    }
  }

  let rankedEmbedding: ScenarioMatch[] = []
  if (input.embed) {
    try {
      const qVec = await input.embed(input.question)
      const emb = embeddingMatch(input.scenarios, qVec, input.embeddingModel, input.matchThreshold)
      rankedEmbedding = emb.ranked
      if (emb.best) {
        return {
          kind: 'scenario',
          scenario: emb.best.scenario,
          source: 'embedding',
          score: emb.best.score,
        }
      }
    } catch {
      // Embedding failed — fall through to suggestions list.
    }
  }

  return {
    kind: 'miss',
    suggestions: mergeSuggestions(lex.ranked, rankedEmbedding),
    rankedLexical: lex.ranked,
    rankedEmbedding,
  }
}

export { buildScenarioFuse }
