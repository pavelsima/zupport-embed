import type { PublishedScenario } from '../rag/scenarios-types'
import type { Tier, TierSelection } from '../engines/tier'
import type { ResolvedConfig } from './config-loader'

// Chat-loop status. Loading concerns live in `stages` (below), not here.
// `loading` is the umbrella state during boot; once every required stage is
// done/skipped, the controller flips to `ready`.
export type Status =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'thinking'
  | 'streaming'
  | 'error'

export type StageKey = 'config' | 'scenarios' | 'vectors' | 'embedder' | 'llm'

export type StageStatus =
  | 'pending'
  | 'downloading'
  | 'mounting'
  | 'done'
  | 'error'
  | 'skipped'

export interface LoadStage {
  key: StageKey
  label: string
  status: StageStatus
  progress?: number // 0..1
  file?: string
  error?: string
}

export const STAGE_LABELS: Record<StageKey, string> = {
  config: 'Loading configuration',
  scenarios: 'Loading scenarios',
  vectors: 'Loading knowledge base',
  embedder: 'Loading intent model',
  llm: 'Loading AI model',
}

export const STAGE_ORDER: StageKey[] = [
  'config',
  'scenarios',
  'vectors',
  'embedder',
  'llm',
]

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'streaming' | 'done' | 'error'
  source?: 'scenario' | 'fallback' | 'llm'
  matchedScenarioId?: string
  quickReplies?: { scenarioId: string; label: string }[]
  // Unix ms when the message was created. Used to render a relative
  // timestamp under assistant bubbles ("Just now", "2m ago", …).
  createdAt?: number
}

// Friendly relative-time formatter for assistant message timestamps.
// Optimised for short-lived chat sessions — visitors rarely sit beyond an
// hour, so anything older just collapses to hours.
export const formatRelativeTime = (createdAt: number, now = Date.now()): string => {
  const seconds = Math.max(0, Math.floor((now - createdAt) / 1000))
  if (seconds < 45) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export interface ChatState {
  status: Status
  stages: Record<StageKey, LoadStage>
  config: ResolvedConfig | null
  tier: TierSelection | null
  messages: ChatMessage[]
  open: boolean
  errorMessage: string | null
}

const makeStage = (key: StageKey): LoadStage => ({
  key,
  label: STAGE_LABELS[key],
  status: 'pending',
})

export const makeInitialStages = (): Record<StageKey, LoadStage> => ({
  config: makeStage('config'),
  scenarios: makeStage('scenarios'),
  vectors: makeStage('vectors'),
  embedder: makeStage('embedder'),
  llm: makeStage('llm'),
})

export const initialState: ChatState = {
  status: 'loading',
  stages: makeInitialStages(),
  config: null,
  tier: null,
  messages: [],
  open: false,
  errorMessage: null,
}

// Derived: every non-skipped stage is done (or skipped). Used to decide
// whether the open panel should show chat or the loading view.
export const allReady = (stages: ChatState['stages']): boolean =>
  Object.values(stages).every(
    (s) => s.status === 'done' || s.status === 'skipped',
  )

// Derived: any stage failed terminally. The loading panel uses this to
// render a Retry button when the failure can't be silently downgraded.
export const hasStageError = (stages: ChatState['stages']): boolean =>
  Object.values(stages).some((s) => s.status === 'error')

// Aggregate progress across all non-skipped stages, 0..1. Used for the
// single thin progress bar shown in the loading panel.
export const aggregateProgress = (stages: ChatState['stages']): number => {
  const active = Object.values(stages).filter((s) => s.status !== 'skipped')
  if (!active.length) return 1
  let sum = 0
  for (const s of active) {
    if (s.status === 'done') sum += 1
    else if (s.status === 'mounting') sum += 0.95
    else if (s.status === 'downloading')
      sum += typeof s.progress === 'number' ? Math.max(0, Math.min(1, s.progress)) : 0.05
    else if (s.status === 'error') sum += 0
    // pending contributes 0
  }
  return sum / active.length
}

// The stages that must be done for the user to send a message at a given
// tier. Tier D needs scenarios + embedder; tiers A/B additionally need the
// LLM + vectors for RAG retrieval.
export const requiredStagesForTier = (tier: Tier | null): StageKey[] => {
  if (tier === 'D' || tier === null) return ['scenarios', 'embedder']
  return ['scenarios', 'vectors', 'embedder', 'llm']
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
