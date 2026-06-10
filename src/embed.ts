// CDN entry — registers <answerlay-chat> (legacy) AND <zupport-chat>
// (post-rebrand) tags backed by the same Lit component. The main app's
// templates use <zupport-chat>; pre-rebrand customer installs that use
// <answerlay-chat> keep working unchanged.
//
// Why we export the classes: Lit's `@customElement('foo')` decorator
// registers the tag at module-evaluation time, but rollup's tree-shaker
// can't see that as a side effect (the decoration looks like a pure
// `__decorate(...)` call). Re-exporting the classes pins them, which
// keeps the decorated module live in the bundle.

import { AnswerlayChat } from './elements/answerlay-chat'
export { AnswerlayChat }
export { AnswerlayTypewriter } from './elements/answerlay-typewriter'
import { injectFonts } from './styles/fonts'

// Alias the canonical class under the new brand tag. customElements rejects
// re-registering the same constructor under a second name, so we declare a
// trivial subclass — it inherits every property, slot, attribute, and
// shadow-DOM behaviour from the parent.
if (typeof customElements !== 'undefined' && !customElements.get('zupport-chat')) {
  class ZupportChat extends AnswerlayChat {}
  customElements.define('zupport-chat', ZupportChat)
}

export type {
  AssistantConfig,
  PublishedConfig,
  ScenariosPayload,
  PublishedScenario,
  EngineKind,
  RuntimeMode,
} from './public/types'

// Auto-inject <zupport-chat> when this script tag carries
// `data-assistant-id`. Lets customers drop a single <script> on the page and
// get the floating launcher rendered without writing the custom tag by hand.
// No-ops when the attribute is missing (preserves the manual-tag flow) or when
// either tag already exists in the DOM (idempotent across the rebrand).
function autoInject(): void {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    ([...document.scripts].pop() as HTMLScriptElement | undefined) ??
    null
  if (!script) return
  const id = script.dataset.assistantId
  if (!id) return
  if (document.querySelector('zupport-chat, answerlay-chat')) return

  injectFonts()

  const passthrough = [
    'assistantId',
    'configUrl',
    'configBaseUrl',
    'modeOverride',
    'engineOverride',
    'disableCache',
    'modelBaseUrl',
  ] as const

  const mount = (): void => {
    if (document.querySelector('zupport-chat, answerlay-chat')) return
    const el = document.createElement('zupport-chat')
    for (const k of passthrough) {
      const v = script.dataset[k]
      if (v != null) el.dataset[k] = v
    }
    document.body.appendChild(el)
  }

  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount, { once: true })
}
autoInject()
