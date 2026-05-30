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
  // Fuse "lower is better" raw-score cutoff used by the lexical matcher
  // (matcher.ts). Smaller = stricter. Omit to fall back to the embed's
  // default (LEXICAL_CONFIDENT).
  scenarioMatchThreshold?: number
  // Scenario IDs shown as quick-reply buttons under the greeting (max 8).
  greetingQuickReplyIds?: string[]
  // Optional, additive fields used by the widget chrome. Existing
  // configs without these fields still render correctly.
  launcherTooltip?: string
  statusLabel?: string
  // Hide the "Powered by Answerlay" line at the bottom of the panel.
  hideCredit?: boolean
  // When true, the widget pops a small bubble with the greeting text above
  // the launcher icon once status flips to `ready` (desktop) or 5 s after
  // config loads (mobile). Auto-hides after 8 s; dismissible; once dismissed
  // in a tab session, it does not reappear (sessionStorage per assistantId).
  showGreetingBubble?: boolean
  // Avatar shown in the chat header. 'bottts' = generated DiceBear robot
  // seeded by name (default). 'silhouette' = neutral person icon in brand
  // color. 'none' = no avatar.
  avatarStyle?: 'bottts' | 'silhouette' | 'none'
}

export const DEFAULT_CONFIG: AssistantConfig = {
  name: 'Support Assistant',
  greeting: 'Hi! How can I help?',
  brandColor: '#1D9E75',
  position: 'bottom-right',
  topK: 5,
  maxTokens: 256,
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
export type {
  EngineKind,
  RuntimeMode,
  RuntimeSelection,
  DowngradeReason,
} from '../engines/tier'
