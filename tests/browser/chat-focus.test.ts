import { afterEach, describe, expect, it } from 'vitest'
import { mountChat, sendMessage, waitFor } from './_helpers'
import type { AnswerlayChat } from '../../src/elements/answerlay-chat'

// Focus management covers two distinct moments:
//   1. The chat panel just opened (or rendered in preview mode) — the
//      textarea should be focused so the visitor can type immediately.
//   2. A reply just finished (status transitioned thinking|streaming → ready)
//      — refocus the input so they can ask a follow-up.

let mounted: { el: AnswerlayChat; dispose: () => void } | null = null

afterEach(() => {
  mounted?.dispose()
  mounted = null
})

const activeInShadow = (el: AnswerlayChat): Element | null =>
  el.shadowRoot?.activeElement ?? null

describe('focus on open', () => {
  it('focuses the textarea once the chat panel renders', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios' })
    // mountChat already waits an extra frame for manageFocus's rAF.
    expect(activeInShadow(mounted.el)?.tagName).toBe('TEXTAREA')
  })

  it('survives a loading→openable transition (focus lands when the input first appears)', async () => {
    // Same as above — preview + inline config means the chat is openable
    // essentially immediately. The loading→openable code path is exercised
    // every time mountChat runs (the first updated() with stages still
    // booting → manageFocus stores wasOpenable; subsequent update with
    // openable=true → focus the input).
    mounted = await mountChat({ engineOverride: 'scenarios' })
    expect(activeInShadow(mounted.el)?.tagName).toBe('TEXTAREA')
  })
})

describe('refocus after a reply', () => {
  it('returns focus to the input after the assistant message lands', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios' })
    const ta = mounted.el.shadowRoot!.querySelector(
      'textarea.input',
    ) as HTMLTextAreaElement
    // Steal focus away.
    ta.blur()
    expect(activeInShadow(mounted.el)?.tagName).not.toBe('TEXTAREA')

    await sendMessage(mounted.el, 'hello there')
    // Wait for the busy→idle rAF refocus.
    await waitFor(() => activeInShadow(mounted!.el)?.tagName === 'TEXTAREA', {
      timeout: 1000,
      label: 'refocus after send',
    })
    expect(activeInShadow(mounted.el)?.tagName).toBe('TEXTAREA')
  })

  it('focuses the input again on the next reply, not just the first', async () => {
    // Catches a regression where wasBusy gets stuck — making only the very
    // first reply refocus the input.
    mounted = await mountChat({ engineOverride: 'scenarios' })
    await sendMessage(mounted.el, 'first')
    await waitFor(() => activeInShadow(mounted!.el)?.tagName === 'TEXTAREA', {
      timeout: 1000,
      label: 'refocus after reply 1',
    })
    const ta = mounted.el.shadowRoot!.querySelector('textarea.input') as HTMLTextAreaElement
    ta.blur()
    await sendMessage(mounted.el, 'second')
    await waitFor(() => activeInShadow(mounted!.el)?.tagName === 'TEXTAREA', {
      timeout: 1000,
      label: 'refocus after reply 2',
    })
    expect(activeInShadow(mounted.el)?.tagName).toBe('TEXTAREA')
  })
})
