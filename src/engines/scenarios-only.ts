import {
  DEFAULT_FALLBACK_MESSAGE,
  type PublishedScenario,
  type ScenariosPayload,
} from '../rag/scenarios-types'
import { buildScenarioFuse, shortCircuit } from './short-circuit'

export interface ScenariosResult {
  answer: string
  source: 'scenario' | 'fallback'
  scenario?: PublishedScenario
  suggestions?: PublishedScenario[]
  matchSource?: 'lexical'
}

// The scenarios-only "engine" used on Tier D and on mobile. Pure lexical
// (Fuse) matching — no embedder load.
export class ScenariosEngine {
  private fuse: ReturnType<typeof buildScenarioFuse> | null = null

  constructor(
    private readonly payload: ScenariosPayload,
    private readonly confidentCutoff?: number,
  ) {
    this.fuse = buildScenarioFuse(payload.scenarios)
  }

  async ask(question: string): Promise<ScenariosResult> {
    const result = await shortCircuit({
      question,
      scenarios: this.payload.scenarios,
      fuse: this.fuse ?? undefined,
      confidentCutoff: this.confidentCutoff,
    })

    if (result.kind === 'scenario') {
      return {
        answer: result.scenario.answer,
        source: 'scenario',
        scenario: result.scenario,
        matchSource: result.source,
      }
    }

    return {
      answer: this.payload.fallbackMessage || DEFAULT_FALLBACK_MESSAGE,
      source: 'fallback',
      suggestions: result.suggestions,
    }
  }

  scenarioById(id: string): PublishedScenario | null {
    return this.payload.scenarios.find((s) => s.id === id) ?? null
  }
}
