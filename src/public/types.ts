// Public type surface re-exported from the package root and from
// `@answerlay/embed/types`. These are the contract between the main
// Answerlay app's publishers and this widget.

export interface AssistantConfig {
  name: string
  greeting: string
  brandColor: string
  position: 'bottom-right' | 'bottom-left'
  topK: number
  maxTokens: number
  scenarioFallbackMessage?: string
  // Cosine-similarity cutoff (0..1) for scenario matching. Higher = stricter.
  // When absent, the matcher falls back to EMBEDDING_CONFIDENT.
  scenarioMatchThreshold?: number
  // BCP-47-ish language code ('cs', 'en', 'de', …). When set, the LLM is
  // hard-instructed to respond in this language. When absent, language is
  // auto-detected from the user's query.
  language?: string
}

export const DEFAULT_CONFIG: AssistantConfig = {
  name: 'Support Assistant',
  greeting: 'Hi! How can I help?',
  brandColor: '#1D9E75',
  position: 'bottom-right',
  topK: 4,
  maxTokens: 256,
  scenarioMatchThreshold: 0.72,
}

// The new public config.json the main app must publish per assistant.
export interface PublishedConfig {
  schema: 1
  assistantId: string
  config: AssistantConfig
  scenariosPublicUrl: string | null
  vectorsPublicUrl: string | null
  builtAt: string
}

export type {
  ScenariosPayload,
  PublishedScenario,
  ScenarioMatcherModel,
} from '../rag/scenarios-types'
export type { Chunk, VectorsPayload, RetrievalChunk } from '../rag/types'
export type { Tier, TierSelection, DowngradeReason, EngineMode } from '../engines/tier'
