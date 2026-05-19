import { describe, expect, it } from 'vitest'
import { shouldShowGreetingBubble, type BubbleDecisionInput } from '../../src/core/greeting-bubble'

const base: BubbleDecisionInput = {
  enabled: true,
  status: 'loading',
  tierMode: 'desktop',
  configLoadedAt: null,
  now: 1000,
  open: false,
  dismissed: false,
  alreadyShown: false,
}

describe('shouldShowGreetingBubble', () => {
  it('returns false when feature is disabled', () => {
    expect(shouldShowGreetingBubble({ ...base, enabled: false, status: 'ready' })).toBe(false)
  })

  it('returns false when chat is open', () => {
    expect(shouldShowGreetingBubble({ ...base, status: 'ready', open: true })).toBe(false)
  })

  it('returns false when dismissed in session', () => {
    expect(shouldShowGreetingBubble({ ...base, status: 'ready', dismissed: true })).toBe(false)
  })

  it('returns false when already shown this lifecycle (latched off)', () => {
    expect(shouldShowGreetingBubble({ ...base, status: 'ready', alreadyShown: true })).toBe(false)
  })

  it('desktop: returns true when status flips to ready', () => {
    expect(shouldShowGreetingBubble({ ...base, status: 'ready' })).toBe(true)
  })

  it('desktop: returns false while still loading', () => {
    expect(shouldShowGreetingBubble({ ...base, status: 'loading' })).toBe(false)
  })

  it('desktop: returns false on error', () => {
    expect(shouldShowGreetingBubble({ ...base, status: 'error' })).toBe(false)
  })

  it('mobile: returns false before configLoadedAt is set', () => {
    expect(shouldShowGreetingBubble({ ...base, tierMode: 'mobile', configLoadedAt: null })).toBe(false)
  })

  it('mobile: returns false before 5 s elapsed since config load', () => {
    expect(
      shouldShowGreetingBubble({ ...base, tierMode: 'mobile', configLoadedAt: 1000, now: 5999 }),
    ).toBe(false)
  })

  it('mobile: returns true after 5 s elapsed since config load', () => {
    expect(
      shouldShowGreetingBubble({ ...base, tierMode: 'mobile', configLoadedAt: 1000, now: 6000 }),
    ).toBe(true)
  })

  it('mobile: ignores status (does not require ready)', () => {
    expect(
      shouldShowGreetingBubble({
        ...base,
        tierMode: 'mobile',
        status: 'loading',
        configLoadedAt: 1000,
        now: 6500,
      }),
    ).toBe(true)
  })
})
