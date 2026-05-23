import Fuse from 'fuse.js'
import {
  buildScenarioFuse,
  lexicalMatch,
  SUGGEST_TOP_N,
  type ScenarioMatch,
} from '../rag/matcher'
import type { PublishedScenario } from '../rag/scenarios-types'

export interface ShortCircuitInput {
  question: string
  scenarios: PublishedScenario[]
  fuse?: Fuse<{ id: string; question: string; variants: string; ref: PublishedScenario }>
  /** Optional Fuse "lower is better" cutoff; falls back to LEXICAL_CONFIDENT. */
  confidentCutoff?: number
}

export interface ShortCircuitHit {
  kind: 'scenario'
  scenario: PublishedScenario
  source: 'lexical'
  score: number
}

export interface ShortCircuitMiss {
  kind: 'miss'
  suggestions: PublishedScenario[]
  rankedLexical: ScenarioMatch[]
}

export type ShortCircuitResult = ShortCircuitHit | ShortCircuitMiss

// Lexical-only scenario short-circuit. Runs Fuse over the published
// question + variants; returns a hit when the top match crosses
// LEXICAL_CONFIDENT, otherwise the lexical-ranked suggestion list.
export const shortCircuit = async (
  input: ShortCircuitInput,
): Promise<ShortCircuitResult> => {
  const lex = lexicalMatch(input.scenarios, input.question, input.fuse, input.confidentCutoff)
  if (lex.best) {
    return {
      kind: 'scenario',
      scenario: lex.best.scenario,
      source: 'lexical',
      score: lex.best.score,
    }
  }

  return {
    kind: 'miss',
    suggestions: lex.ranked.slice(0, SUGGEST_TOP_N).map((m) => m.scenario),
    rankedLexical: lex.ranked,
  }
}

export { buildScenarioFuse }
