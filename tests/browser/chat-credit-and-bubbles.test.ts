import { afterEach, describe, expect, it } from 'vitest'
import { mountChat, sendMessage } from './_helpers'
import type { AnswerlayChat } from '../../src/elements/answerlay-chat'

// Smaller surface tests for the credit link and bubble parity.

let mounted: { el: AnswerlayChat; dispose: () => void } | null = null

afterEach(() => {
  mounted?.dispose()
  mounted = null
})

describe('credit bar', () => {
  it('renders an Answerlay link to https://answerlay.com', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios' })
    const link = mounted.el.shadowRoot!.querySelector(
      '.credit a.credit-link',
    ) as HTMLAnchorElement | null
    expect(link).toBeTruthy()
    expect(link!.href).toBe('https://answerlay.com/')
    expect(link!.textContent?.trim()).toBe('Answerlay')
    expect(link!.target).toBe('_blank')
    expect(link!.rel).toContain('noopener')
  })

  it('hides the credit when config.hideCredit is true', async () => {
    mounted = await mountChat({
      engineOverride: 'scenarios',
      config: {
        name: 'X',
        greeting: 'Hi',
        brandColor: '#000',
        position: 'bottom-right',
        topK: 4,
        maxTokens: 256,
        hideCredit: true,
      },
    })
    const credit = mounted.el.shadowRoot!.querySelector('.credit')
    expect(credit).toBeNull()
  })
})

describe('bubble vertical padding', () => {
  it('user and assistant bubbles have matching top/bottom padding', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios' })
    await sendMessage(mounted.el, 'a quick hello')
    const sr = mounted.el.shadowRoot!
    const userB = sr.querySelector('.message.user .bubble') as HTMLElement
    const asstB = sr.querySelector('.message.assistant .bubble') as HTMLElement
    expect(userB).toBeTruthy()
    expect(asstB).toBeTruthy()
    const ub = getComputedStyle(userB)
    const ab = getComputedStyle(asstB)
    expect(ab.paddingTop).toBe(ub.paddingTop)
    expect(ab.paddingBottom).toBe(ub.paddingBottom)
  })

  it('assistant markdown paragraphs do not add their own browser-default margin (no <p>{1em}…</p>)', async () => {
    // The markdown rules live inside the typewriter's shadow root — if
    // they're absent the default ~14px top + 14px bottom margin would
    // make the assistant bubble noticeably taller than the user one.
    mounted = await mountChat({ engineOverride: 'scenarios' })
    await sendMessage(mounted.el, 'hi')
    const sr = mounted.el.shadowRoot!
    const userB = sr.querySelector('.message.user .bubble') as HTMLElement
    const asstB = sr.querySelector('.message.assistant .bubble') as HTMLElement
    // Allow a tiny ±2px drift for sub-pixel rendering / different content
    // widths; the bug we're guarding against is 20+ px.
    const diff = Math.abs(asstB.getBoundingClientRect().height - userB.getBoundingClientRect().height)
    expect(diff).toBeLessThan(6)
  })
})

describe('engine override surface', () => {
  it('data-engine-override="scenarios" forces scenarios engine on desktop', async () => {
    mounted = await mountChat({ engineOverride: 'scenarios' })
    // Bracket access bypasses the `private` modifier — tests are allowed.
    expect(mounted.el['controller'].state.runtime?.engine).toBe('scenarios')
    expect(mounted.el['controller'].state.runtime?.mode).toBe('desktop')
  })
})
