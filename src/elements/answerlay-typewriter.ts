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
  @property({ type: Number }) speed = 12
  // Named `animated` instead of `animate` to avoid clobbering
  // HTMLElement.animate(). Keep the attribute kebab-case for HTML.
  @property({ type: Boolean, attribute: 'data-animated' }) animated = true

  @state() private visibleLength = 0

  private rafId: number | null = null
  private lastFrame = 0

  static override styles = css`
    :host {
      display: block;
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
      return
    }
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!this.animated || reduceMotion) {
      this.visibleLength = this.text.length
      this.dispatchEvent(new CustomEvent('typewriter-done'))
      return
    }
    this.visibleLength = 0
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
