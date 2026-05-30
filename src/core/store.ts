import type { PublishedScenario } from '../rag/scenarios-types'
import type { EngineKind, RuntimeSelection } from '../engines/tier'
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
  embedder: 'Loading retrieval model',
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

// Live download telemetry for the LLM stage. Used by the header avatar
// tooltip and by the in-chat fallback message when the user asks a
// question before the model is ready. `etaAnchor` is the Date.now()
// timestamp when `etaSeconds` was computed — UIs subtract elapsed time
// to render a live-ticking countdown without re-reading state every
// frame.
export interface DownloadStats {
  downloadedMB: number
  totalMB: number
  speedMBs: number
  etaSeconds: number | null
  etaAnchor: number
}

// Project the ETA from an anchor timestamp into "now" so the displayed
// number ticks down between progress samples. Returns null if the
// original ETA was null.
export const liveEtaSeconds = (
  stats: DownloadStats | null,
  now: number = Date.now(),
): number | null => {
  if (!stats || stats.etaSeconds === null) return null
  const elapsed = Math.max(0, (now - stats.etaAnchor) / 1000)
  return Math.max(0, stats.etaSeconds - elapsed)
}

export interface ChatState {
  status: Status
  stages: Record<StageKey, LoadStage>
  config: ResolvedConfig | null
  runtime: RuntimeSelection | null
  messages: ChatMessage[]
  open: boolean
  errorMessage: string | null
  downloadStats: DownloadStats | null
}

export const formatMB = (mb: number): string => {
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`
  if (mb >= 100) return `${Math.round(mb)} MB`
  return `${mb.toFixed(1)} MB`
}

export const formatSpeed = (mbps: number): string => {
  if (!Number.isFinite(mbps) || mbps <= 0) return '—'
  if (mbps >= 100) return `${Math.round(mbps)} MB/s`
  if (mbps >= 10) return `${mbps.toFixed(1)} MB/s`
  return `${mbps.toFixed(2)} MB/s`
}

export const formatEta = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 5) return 'a few seconds'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.round(seconds / 60)
  if (m < 60) return m === 1 ? '1 min' : `${m} min`
  return `${Math.round(seconds / 3600)}h`
}

// Friendly phrasing for the fallback chat message. Returns a complete
// time phrase (with leading preposition) so callers can drop it into
// "...will be ready ${phrase}." without awkward wording like "in about
// a few seconds".
//
// Bands:
//   null / <=0 : "soon"
//   <15s       : "in a few seconds"
//   <40s       : "in about half a minute"
//   <60s       : "within a minute"
//   60s+       : "in about 1 minute" / "in about N minutes"
export const formatEtaFriendly = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return 'soon'
  if (seconds < 15) return 'in a few seconds'
  if (seconds < 40) return 'in about half a minute'
  if (seconds < 60) return 'within a minute'
  const m = Math.max(1, Math.round(seconds / 60))
  return m === 1 ? 'in about 1 minute' : `in about ${m} minutes`
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
  runtime: null,
  messages: [],
  open: false,
  errorMessage: null,
  downloadStats: null,
}

// Derived: every non-skipped stage is done (or skipped). Used to decide
// whether the open panel should show chat or the loading view.
export const allReady = (stages: ChatState['stages']): boolean =>
  Object.values(stages).every(
    (s) => s.status === 'done' || s.status === 'skipped',
  )

// Derived: chat panel is interactable. Config + scenarios are the minimum
// — scenario matching can answer immediately; the LLM keeps downloading
// in the background and the header surfaces its progress.
export const isChatOpenable = (stages: ChatState['stages']): boolean => {
  const ok = (s: LoadStage) => s.status === 'done' || s.status === 'skipped'
  return ok(stages.config) && ok(stages.scenarios)
}

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

// The stages that must be done for the user to send a message with a given
// engine. Scenarios only needs the scenarios payload (lexical Fuse matching,
// no model); the LLM additionally needs the embedder + vectors for RAG.
export const requiredStagesForEngine = (engine: EngineKind | null): StageKey[] => {
  if (engine === 'scenarios' || engine === null) return ['scenarios']
  return ['scenarios', 'vectors', 'embedder', 'llm']
}

export const newId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

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
