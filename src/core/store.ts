import type { PublishedScenario } from '../rag/scenarios-types'
import type { Tier, TierSelection } from '../engines/tier'
import type { ResolvedConfig } from './config-loader'

export type Status =
  | 'idle'
  | 'config-loading'
  | 'config-error'
  | 'engine-loading'
  | 'ready'
  | 'thinking'
  | 'streaming'
  | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'streaming' | 'done' | 'error'
  source?: 'scenario' | 'fallback' | 'llm'
  matchedScenarioId?: string
  quickReplies?: { scenarioId: string; label: string }[]
}

export interface ChatState {
  status: Status
  config: ResolvedConfig | null
  tier: TierSelection | null
  messages: ChatMessage[]
  open: boolean
  errorMessage: string | null
  loadingProgress: { file?: string; progress?: number } | null
}

export const initialState: ChatState = {
  status: 'idle',
  config: null,
  tier: null,
  messages: [],
  open: false,
  errorMessage: null,
  loadingProgress: null,
}

export const newId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const tierLabel = (tier: Tier): string => `Tier ${tier}`

export const scenarioToQuickReply = (s: PublishedScenario) => ({
  scenarioId: s.id,
  label: s.question,
})

export const MAX_GREETING_QUICK_REPLIES = 8

/** Resolve config greeting quick-reply IDs to quick-reply buttons (order preserved). */
export const resolveGreetingQuickReplies = (
  ids: string[] | undefined,
  scenarios: PublishedScenario[],
): { scenarioId: string; label: string }[] => {
  if (!ids?.length) return []
  const byId = new Map(scenarios.map((s) => [s.id, s]))
  const out: { scenarioId: string; label: string }[] = []
  for (const id of ids) {
    if (out.length >= MAX_GREETING_QUICK_REPLIES) break
    const s = byId.get(id)
    if (s) out.push(scenarioToQuickReply(s))
  }
  return out
}
