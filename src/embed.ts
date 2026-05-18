// CDN entry — auto-registers <answerlay-chat>. This is the entry referenced
// by `<script type="module" src="…/dist/embed.js">` on customer sites.
//
// Why we export the classes: Lit's `@customElement('foo')` decorator
// registers the tag at module-evaluation time, but rollup's tree-shaker
// can't see that as a side effect (the decoration looks like a pure
// `__decorate(...)` call). Re-exporting the classes pins them, which
// keeps the decorated module live in the bundle.

export { AnswerlayChat } from './elements/answerlay-chat'
export { AnswerlayTypewriter } from './elements/answerlay-typewriter'
import { injectFonts } from './styles/fonts'

export type {
  AssistantConfig,
  PublishedConfig,
  ScenariosPayload,
  PublishedScenario,
  Tier,
} from './public/types'

// Auto-inject <answerlay-chat> when this script tag carries
// `data-assistant-id`. Lets customers drop a single <script> on the page and
// get the floating launcher rendered without writing the custom tag by hand.
// No-ops when the attribute is missing (preserves the manual-tag flow) or when
// an <answerlay-chat> already exists in the DOM (idempotent).
function autoInject(): void {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    ([...document.scripts].pop() as HTMLScriptElement | undefined) ??
    null
  if (!script) return
  const id = script.dataset.assistantId
  if (!id) return
  if (document.querySelector('answerlay-chat')) return

  injectFonts()

  const passthrough = [
    'assistantId',
    'configUrl',
    'configBaseUrl',
    'modeOverride',
    'tierOverride',
    'disableCache',
    'modelBaseUrl',
  ] as const

  const mount = (): void => {
    if (document.querySelector('answerlay-chat')) return
    const el = document.createElement('answerlay-chat')
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
