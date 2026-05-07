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
