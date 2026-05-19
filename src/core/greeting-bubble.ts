import type { Status } from './store'

export const MOBILE_BUBBLE_DELAY_MS = 5000
export const BUBBLE_AUTO_HIDE_MS = 8000

export interface BubbleDecisionInput {
  /** `config.showGreetingBubble === true`. */
  enabled: boolean
  /** Overall controller status. Desktop fires when this is `'ready'`. */
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
 * Desktop: shows the moment `status === 'ready'`.
 * Mobile : shows once `MOBILE_BUBBLE_DELAY_MS` has elapsed since config load,
 *          regardless of model status (mobile defers the embedder anyway).
 */
export function shouldShowGreetingBubble(input: BubbleDecisionInput): boolean {
  if (!input.enabled) return false
  if (input.open) return false
  if (input.dismissed) return false
  if (input.alreadyShown) return false

  if (input.tierMode === 'mobile') {
    if (input.configLoadedAt === null) return false
    return input.now - input.configLoadedAt >= MOBILE_BUBBLE_DELAY_MS
  }
  return input.status === 'ready'
}
