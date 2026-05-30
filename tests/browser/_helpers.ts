import type { AnswerlayChat } from '../../src/elements/answerlay-chat'
import type { AssistantConfig } from '../../src/public/types'
import { isChatOpenable } from '../../src/core/store'

// Side-effect imports — these register the custom elements.
import '../../src/elements/answerlay-chat'
import '../../src/elements/answerlay-typewriter'

/** Poll an async condition every 16ms; resolve once it returns true. */
export const waitFor = async (
  cond: () => boolean,
  { timeout = 2000, label }: { timeout?: number; label?: string } = {},
): Promise<void> => {
  const start = performance.now()
  while (performance.now() - start < timeout) {
    if (cond()) return
    await new Promise((r) => setTimeout(r, 16))
  }
  throw new Error(`waitFor timeout${label ? ` (${label})` : ''}`)
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

export const minimalConfig: AssistantConfig = {
  name: 'Test Assistant',
  greeting: 'Hi! Ask me anything.',
  brandColor: '#6f42c1',
  position: 'bottom-right',
  topK: 4,
  maxTokens: 256,
}

export interface MountOptions {
  config?: AssistantConfig
  engineOverride?: 'scenarios' | 'llm'
  modeOverride?: 'desktop' | 'mobile'
  /** Pixel height for the host element. Default 480. Needed for scroll tests. */
  height?: number
  /** Use data-preview, which forces the panel open inline. */
  preview?: boolean
}

/**
 * Mount an answerlay-chat with an inline config so it boots without any
 * network calls. The scenarios + vectors public URLs come back null, which
 * makes those stages skip — handy for fast, offline tests.
 *
 * The element is appended to document.body and registered for teardown by
 * the caller (return value `.dispose()`).
 */
export const mountChat = async (
  opts: MountOptions = {},
): Promise<{ el: AnswerlayChat; dispose: () => void }> => {
  const el = document.createElement('answerlay-chat') as AnswerlayChat
  el.assistantId = 'test'
  el.config = opts.config ?? minimalConfig
  if (opts.preview ?? true) el.setAttribute('data-preview', '')
  if (opts.engineOverride) {
    el.setAttribute('data-engine-override', opts.engineOverride)
  }
  if (opts.modeOverride) {
    el.setAttribute('data-mode-override', opts.modeOverride)
  }
  // Constrain height so the messages list can actually overflow for the
  // scroll tests. preview mode renders inline (no launcher), filling the
  // host element.
  const h = opts.height ?? 480
  el.style.cssText = `display:block;width:380px;height:${h}px;`
  document.body.appendChild(el)

  // Wait until the chat panel (not the loading panel) is rendered. That
  // means the controller has the runtime + config stages settled.
  await waitFor(() => isChatOpenable(el['controller'].state.stages), {
    label: 'chat openable',
  })
  // One extra frame so manageFocus's rAF lands focus.
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))

  return {
    el,
    dispose: () => {
      el.remove()
    },
  }
}

/** Send a user message through the form path (exercises onSubmit). */
export const sendMessage = async (
  el: AnswerlayChat,
  text: string,
): Promise<void> => {
  const sr = el.shadowRoot!
  const ta = sr.querySelector('textarea.input') as HTMLTextAreaElement
  ta.value = text
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  await el.updateComplete
  const form = sr.querySelector('form.form') as HTMLFormElement
  form.requestSubmit()
  // Wait until status flips back to 'ready' (assistant message landed).
  // Bracket-access bypasses the `private` modifier on `controller` —
  // intentional for tests; we don't want to widen the public surface.
  await waitFor(() => el['controller'].state.status === 'ready', {
    label: 'send→ready',
  })
  // Flush one extra animation frame so the maybeAutoScroll rAF (which is
  // scheduled inside updated() after the final state mutation) actually
  // runs before the test makes its assertions.
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

export const getMessagesEl = (el: AnswerlayChat): HTMLElement =>
  el.shadowRoot!.querySelector('.messages') as HTMLElement

export const getInputEl = (el: AnswerlayChat): HTMLTextAreaElement =>
  el.shadowRoot!.querySelector('textarea.input') as HTMLTextAreaElement

export const distFromBottom = (msgs: HTMLElement): number =>
  msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight
