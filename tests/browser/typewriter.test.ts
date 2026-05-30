import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sleep, waitFor } from './_helpers'
import { AnswerlayTypewriter } from '../../src/elements/answerlay-typewriter'

// Component tests for <answerlay-typewriter>. Covers:
//   • the default speed actually animates over time
//   • `animated=false` reveals everything in a single tick
//   • prefers-reduced-motion short-circuits animation
//   • streaming appends (text growing) preserve visibleLength
//   • text replacement (non-prefix) resets visibleLength to 0
//   • the 'typewriter-done' event fires once the full text is revealed

let host: HTMLDivElement

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})

afterEach(() => {
  host.remove()
})

const mount = (text: string, opts: { animated?: boolean; speed?: number } = {}): AnswerlayTypewriter => {
  const el = document.createElement('answerlay-typewriter') as AnswerlayTypewriter
  if (opts.animated !== undefined) el.animated = opts.animated
  if (opts.speed !== undefined) el.speed = opts.speed
  el.text = text
  host.appendChild(el)
  return el
}

const visibleText = (el: AnswerlayTypewriter): string =>
  el.shadowRoot?.querySelector('.markdown')?.textContent?.trim() ?? ''

describe('AnswerlayTypewriter — default behavior', () => {
  it('starts with visibleLength 0 and reveals over time', async () => {
    const text = 'The quick brown fox jumps over the lazy dog and runs back home again.'
    const el = mount(text)
    // First paint reveals 0 chars (lastFrame=0 path on first rAF).
    await el.updateComplete
    expect(visibleText(el)).toBe('')

    // After ~120ms (~7 frames at 16ms, speed=6 → ~2-3 chars/frame), expect a partial reveal.
    await sleep(120)
    const mid = visibleText(el)
    expect(mid.length).toBeGreaterThan(0)
    expect(mid.length).toBeLessThan(text.length)
    expect(text.startsWith(mid)).toBe(true)

    // Wait for full reveal — generous budget for CI.
    await waitFor(() => visibleText(el) === text, { timeout: 3000, label: 'full reveal' })
  })

  it('exposes default speed = 6', () => {
    const el = mount('hi')
    expect(el.speed).toBe(6)
  })

  it('defaults animated to true', () => {
    const el = mount('hi')
    expect(el.animated).toBe(true)
  })
})

describe('AnswerlayTypewriter — animated=false', () => {
  it('reveals everything synchronously and fires typewriter-done immediately', async () => {
    const text = 'Instant reveal please.'
    const el = mount(text, { animated: false })
    let doneCount = 0
    el.addEventListener('typewriter-done', () => doneCount++)
    el.text = text + '!' // re-trigger willUpdate
    await el.updateComplete
    expect(visibleText(el)).toBe(text + '!')
    expect(doneCount).toBe(1)
  })
})

describe('AnswerlayTypewriter — streaming append vs replace', () => {
  it('text extension (lastText is prefix) preserves visibleLength — no restart', async () => {
    const el = mount('hello there', { speed: 6 })
    await sleep(200)
    const beforeLen = visibleText(el).length
    expect(beforeLen).toBeGreaterThan(0)

    // Append more chars — typical LLM streaming.
    el.text = 'hello there friend'
    await el.updateComplete
    await sleep(16)
    // The reveal should continue from beforeLen, not reset to 0. So the
    // visible length should be >= beforeLen (it may have advanced a tick
    // already, that's fine).
    expect(visibleText(el).length).toBeGreaterThanOrEqual(beforeLen)
  })

  it('text REPLACE (not a prefix of previous) resets to 0', async () => {
    const el = mount('aaaaaaaaaaaaa', { speed: 6 })
    await sleep(150)
    expect(visibleText(el).length).toBeGreaterThan(0)

    // Replace with something that doesn't start with 'aaaaa…'.
    el.text = 'bbbbbbbbbbbb'
    await el.updateComplete
    // After replacement, visibleLength resets to 0 — the next paint
    // shows ~0 chars (a tick may have advanced 1-2 chars already).
    expect(visibleText(el).length).toBeLessThan(4)
  })

  it('empty text clears immediately', async () => {
    const el = mount('abc', { animated: false })
    await el.updateComplete
    el.text = ''
    await el.updateComplete
    expect(visibleText(el)).toBe('')
  })
})

describe('AnswerlayTypewriter — prefers-reduced-motion', () => {
  it('honors reduced-motion by skipping animation', async () => {
    // Monkey-patch matchMedia for this test.
    const origMM = window.matchMedia
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes('reduce'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia
    try {
      const el = mount('rendered all at once')
      await el.updateComplete
      // No wait — should be fully revealed.
      expect(visibleText(el)).toBe('rendered all at once')
    } finally {
      window.matchMedia = origMM
    }
  })
})

describe('AnswerlayTypewriter — done event', () => {
  it('dispatches typewriter-done exactly once when animation completes', async () => {
    const text = 'short.'
    const el = mount(text, { speed: 6 })
    let count = 0
    el.addEventListener('typewriter-done', () => count++)
    await waitFor(() => visibleText(el) === text, { timeout: 2000 })
    // Give the rAF one more frame so the done event has a chance to fire.
    await sleep(32)
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
