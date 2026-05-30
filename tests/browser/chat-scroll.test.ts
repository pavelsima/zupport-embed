import { afterEach, describe, expect, it } from 'vitest'
import {
  distFromBottom,
  getMessagesEl,
  mountChat,
  sendMessage,
  sleep,
  waitFor,
} from './_helpers'
import type { AnswerlayChat } from '../../src/elements/answerlay-chat'

// Scroll-follow rules (per the implementation in answerlay-chat.ts):
//   • If the user is anchored at the bottom (within 24px), every growth
//     (new message, typewriter reveal) pins to the bottom.
//   • If the user scrolls up while content keeps arriving, the view stays
//     where they left it — NOT yanked back to the bottom.
//   • Clicking a quick-reply (or Send) explicitly re-arms followStream=true,
//     so the next reply re-pins to the bottom even if they were scrolled up.

let mounted: { el: AnswerlayChat; dispose: () => void } | null = null

afterEach(() => {
  mounted?.dispose()
  mounted = null
})

const overflowChat = async (
  el: AnswerlayChat,
  rounds = 6,
): Promise<HTMLElement> => {
  const msgs = getMessagesEl(el)
  for (let i = 0; i < rounds; i++) {
    await sendMessage(el, `message number ${i}`)
  }
  await waitFor(() => msgs.scrollHeight > msgs.clientHeight + 50, {
    timeout: 4000,
    label: 'overflow',
  })
  return msgs
}

describe('scroll-follow when at the bottom', () => {
  it('pins to the bottom as new replies arrive', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios', height: 320 })
    const msgs = await overflowChat(mounted.el)
    // Each send awaited status:ready + we expect followStream stayed true.
    expect(distFromBottom(msgs)).toBeLessThan(8)
  })
})

describe('scroll-follow when the user scrolls up', () => {
  it('stays put — does not yank back to the bottom on next render', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios', height: 320 })
    const msgs = await overflowChat(mounted.el)
    // Scroll to top — this is the user reading earlier history.
    msgs.scrollTop = 0
    msgs.dispatchEvent(new Event('scroll'))
    await sleep(32)
    const distAfterScrollUp = distFromBottom(msgs)
    expect(distAfterScrollUp).toBeGreaterThan(40)

    // Force a render cycle (would have triggered the old <200px snap bug).
    mounted.el.requestUpdate()
    await mounted.el.updateComplete
    await sleep(64)
    // View must not have jumped — still scrolled near the top.
    expect(distFromBottom(msgs)).toBeGreaterThan(distAfterScrollUp - 8)
  })

  it('an in-flight typewriter resize event cannot override a fresh scroll-up', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios', height: 320 })
    const msgs = await overflowChat(mounted.el)

    // Start a send (assistant message will animate via the typewriter, firing
    // ResizeObserver callbacks for ~hundreds of ms).
    const sendPromise = sendMessage(mounted.el, 'while-streaming scroll up')
    // Tiny wait so the new message is pushed and the typewriter rAF starts.
    await sleep(48)
    // User scrolls up while the reveal is in flight.
    msgs.scrollTop = 0
    msgs.dispatchEvent(new Event('scroll'))
    await sendPromise
    // Even after the reveal finished, the view stays where the user left it.
    await sleep(80)
    expect(distFromBottom(msgs)).toBeGreaterThan(40)
  })
})

describe('explicit re-arm on Send', () => {
  it('Send while scrolled up re-pins to the bottom for the next reply', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios', height: 320 })
    const msgs = await overflowChat(mounted.el)
    // Scroll up.
    msgs.scrollTop = 0
    msgs.dispatchEvent(new Event('scroll'))
    await sleep(32)

    // Send (onSubmit sets followStream=true regardless of position).
    await sendMessage(mounted.el, 'follow me please')
    await sleep(64)
    expect(distFromBottom(msgs)).toBeLessThan(8)
  })
})
