// Public scenarios.json — the artefact the mobile chat downloads when
// running in scenarios mode, and the desktop chat consults for the
// pre-LLM short-circuit.

// Legacy — scenario matching is now lexical (Fuse) only. The runtime no
// longer reads pre-computed embeddings; this type stays for back-compat
// with older publisher payloads.
export type ScenarioMatcherModel = 'mlm-l6-v2' | 'mlm-l12-v2' | 'e5-small'

export interface PublishedScenario {
  id: string
  question: string
  variants: string[]
  answer: string
  // Legacy — pre-computed embeddings ignored by the runtime as of the
  // lexical-only scenario matcher. Kept so old payloads still parse.
  embeddings?: number[][]
}

export interface ScenariosPayload {
  schema: 1
  builtAt: string
  // Legacy — ignored by the runtime (lexical-only matching).
  embeddingModel?: ScenarioMatcherModel
  // Legacy — ignored by the runtime (lexical-only matching).
  embeddingDim?: number
  fallbackMessage: string
  scenarios: PublishedScenario[]
}

export const DEFAULT_FALLBACK_MESSAGE =
  "I don't have an answer for that yet — did you mean one of these?"

/** Config wins over scenarios.json so config-only republish updates mobile fallback immediately. */
export function resolveScenarioFallbackMessage(
  configMessage?: string,
  scenariosMessage?: string,
): string {
  const fromConfig = configMessage?.trim()
  if (fromConfig) return fromConfig
  const fromScenarios = scenariosMessage?.trim()
  if (fromScenarios) return fromScenarios
  return DEFAULT_FALLBACK_MESSAGE
}
