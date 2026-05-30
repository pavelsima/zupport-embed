import { LitElement, html, css, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { renderMarkdown } from '../chat/render-markdown'

// Streaming-markdown renderer. Animates a character-at-a-time reveal,
// re-renders the visible slice as markdown each frame. Used for assistant
// messages whether they're being streamed by the LLM or already-complete
// scenario answers.

@customElement('answerlay-typewriter')
export class AnswerlayTypewriter extends LitElement {
  @property({ type: String }) text = ''
  @property({ type: Number }) speed = 6
  // Named `animated` instead of `animate` to avoid clobbering
  // HTMLElement.animate(). Keep the attribute kebab-case for HTML.
  @property({ type: Boolean, attribute: 'data-animated' }) animated = true

  @state() private visibleLength = 0

  private rafId: number | null = null
  private lastFrame = 0
  private lastText = ''

  // Markdown styles live here (in the typewriter's own shadow root)
  // because that's where the rendered `<p>/<ul>/<pre>` actually exist —
  // styles defined in the parent chat element don't pierce this boundary.
  static override styles = css`
    :host {
      display: block;
    }
    .markdown :is(p, ul, ol, pre) {
      margin: 0 0 6px;
    }
    .markdown :is(p, ul, ol, pre):last-child {
      margin-bottom: 0;
    }
    .markdown :is(p, ul, ol, pre):first-child {
      margin-top: 0;
    }
    .markdown ul,
    .markdown ol {
      padding-left: 18px;
      list-style: revert;
    }
    .markdown code {
      font-family: var(--answerlay-font-mono);
      font-size: 0.9em;
      padding: 1px 4px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.06);
    }
    .markdown pre {
      padding: 8px;
      background: rgba(0, 0, 0, 0.06);
      border-radius: 6px;
      overflow-x: auto;
    }
    .markdown a {
      color: var(--answerlay-brand);
      text-decoration: underline;
    }
  `

  override willUpdate(changed: PropertyValues): void {
    if (changed.has('text')) {
      this.start()
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.stop()
  }

  private stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private start(): void {
    this.stop()
    if (!this.text) {
      this.visibleLength = 0
      this.lastText = ''
      return
    }
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!this.animated || reduceMotion) {
      this.visibleLength = this.text.length
      this.lastText = this.text
      this.dispatchEvent(new CustomEvent('typewriter-done'))
      return
    }
    // When text grows (streaming token appended), keep visibleLength so the
    // animation continues from where it was instead of restarting from zero.
    // Only reset when text is genuinely replaced (not an extension).
    if (!this.text.startsWith(this.lastText)) {
      this.visibleLength = 0
    }
    this.lastText = this.text
    this.lastFrame = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  private tick = (now: number): void => {
    if (this.visibleLength >= this.text.length) {
      this.rafId = null
      this.dispatchEvent(new CustomEvent('typewriter-done'))
      return
    }
    if (this.lastFrame === 0) this.lastFrame = now
    const elapsed = now - this.lastFrame
    const advance = Math.max(1, Math.floor(elapsed / this.speed))
    this.visibleLength = Math.min(this.text.length, this.visibleLength + advance)
    this.lastFrame = now
    this.dispatchEvent(new CustomEvent('typewriter-tick'))
    this.rafId = requestAnimationFrame(this.tick)
  }

  override render() {
    const slice = this.text.slice(0, this.visibleLength)
    return html`<div class="markdown">${unsafeHTML(renderMarkdown(slice))}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'answerlay-typewriter': AnswerlayTypewriter
  }
}
