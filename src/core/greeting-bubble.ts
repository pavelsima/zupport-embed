import type { Status } from './store'

export const BUBBLE_DELAY_MS = 5000
/** @deprecated Kept as an alias for the public re-export surface. */
export const MOBILE_BUBBLE_DELAY_MS = BUBBLE_DELAY_MS
export const BUBBLE_AUTO_HIDE_MS = 8000

export interface BubbleDecisionInput {
  /** `config.showGreetingBubble === true`. */
  enabled: boolean
  /** Overall controller status. Retained for future gating (e.g. suppress on error). */
  status: Status
  /** Resolved tier mode, or null if tier not yet probed. */
  tierMode: 'desktop' | 'mobile' | null
  /** `performance.now()`-style timestamp when config.json finished loading. */
  configLoadedAt: number | null
  /** Current timestamp (caller passes Date.now() or performance.now()). */
  now: number
  /** Chat panel is open. */
  open: boolean
  /** Dismissed earlier in this tab session (sessionStorage flag). */
  dismissed: boolean
  /**
   * Latch: once the bubble has shown (and either auto-hid or been dismissed),
   * we don't show it again on subsequent `updated()` ticks even within the
   * same lifecycle.
   */
  alreadyShown: boolean
}

/**
 * Pure trigger decision for the greeting bubble. See the unit tests for the
 * full truth table.
 *
 * Both desktop and mobile now show the bubble once `BUBBLE_DELAY_MS` has
 * elapsed since config load. Desktop used to wait for `status === 'ready'`,
 * but with async LLM loading the chat opens before the model is fully
 * downloaded — the bubble should attract attention on the same cadence as
 * mobile rather than after a multi-second model download.
 */
export function shouldShowGreetingBubble(input: BubbleDecisionInput): boolean {
  if (!input.enabled) return false
  if (input.open) return false
  if (input.dismissed) return false
  if (input.alreadyShown) return false

  if (input.configLoadedAt === null) return false
  return input.now - input.configLoadedAt >= BUBBLE_DELAY_MS
}
