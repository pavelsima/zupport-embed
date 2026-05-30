// Library entry — named exports for npm consumers (Vue/React/Nuxt apps).
// Importing this does NOT auto-register the custom element. Use
// `@answerlay/embed/embed` for the side-effectful CDN bundle.

export { AnswerlayChat } from './elements/answerlay-chat'
export { AnswerlayTypewriter } from './elements/answerlay-typewriter'
export { ChatController } from './core/controller'
export type { ControllerOptions } from './core/controller'
export {
  initialState,
  newId,
  scenarioToQuickReply,
  type ChatMessage,
  type ChatState,
  type Status,
} from './core/store'
export { loadConfig, type ResolvedConfig } from './core/config-loader'
export {
  DEFAULT_CONFIG_BASE_URL,
  buildPublicJsonUrl,
  deriveConfigUrl,
} from './core/defaults'
export { selectRuntime, isMobile, isIOS, isAndroid } from './engines/select'
export { shortCircuit, buildScenarioFuse } from './engines/short-circuit'
export type { ShortCircuitResult, ShortCircuitHit, ShortCircuitMiss } from './engines/short-circuit'
export { ScenariosEngine } from './engines/scenarios-only'
export type { ScenariosResult } from './engines/scenarios-only'
export { LlmEngine } from './engines/llm'
export { QueryEmbedder } from './rag/query-embedder'
export { cosineTopK, toRetrievalChunk } from './rag/retrieve'
export { lexicalMatch, LEXICAL_CONFIDENT } from './rag/matcher'
export { renderMarkdown } from './chat/render-markdown'
export { LLM_LABEL, LLM_APPROX_MB } from './engines/tier'
export type {
  EngineKind,
  RuntimeMode,
  RuntimeSelection,
  DowngradeReason,
} from './engines/tier'
export type {
  AssistantConfig,
  PublishedConfig,
  ScenariosPayload,
  PublishedScenario,
  Chunk,
  VectorsPayload,
  RetrievalChunk,
} from './public/types'
export { DEFAULT_CONFIG } from './public/types'
export { DEFAULT_FALLBACK_MESSAGE } from './rag/scenarios-types'
