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

export type {
  AssistantConfig,
  PublishedConfig,
  ScenariosPayload,
  PublishedScenario,
  Tier,
} from './public/types'
