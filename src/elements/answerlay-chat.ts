import { LitElement, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import './answerlay-typewriter'
import { ChatController } from '../core/controller'
import { parseMode, parseTier } from '../core/attributes'
import type { AssistantConfig } from '../public/types'
import type { ChatMessage } from '../core/store'
import { chatStyles } from '../styles/component'
import { chatIcon, closeIcon, sendIcon } from './icons'

@customElement('answerlay-chat')
export class AnswerlayChat extends LitElement {
  static override styles = chatStyles

  @property({ type: String, attribute: 'data-assistant-id', reflect: true })
  assistantId = ''

  @property({ type: String, attribute: 'data-config-url' })
  configUrl: string | null = null

  @property({ type: String, attribute: 'data-config-base-url' })
  configBaseUrl: string | null = null

  @property({ type: String, attribute: 'data-mode-override' })
  modeOverride: string | null = null

  @property({ type: String, attribute: 'data-tier-override' })
  tierOverride: string | null = null

  @property({ type: Boolean, attribute: 'data-preview', reflect: true })
  preview = false

  @property({ type: Boolean, attribute: 'data-disable-cache' })
  disableCache = false

  @property({ type: String, attribute: 'data-model-base-url' })
  modelBaseUrl: string | null = null

  @property({ type: Boolean, reflect: true })
  open = false

  @property({ attribute: false })
  config: AssistantConfig | null = null

  @state() private input = ''

  @query('textarea.input') private inputEl?: HTMLTextAreaElement
  @query('.messages') private messagesEl?: HTMLElement

  private controller!: ChatController
  private followStream = true
  private lastScrollTop = 0
  private messagesResizeObserver: ResizeObserver | null = null
  private observedMessagesEl: HTMLElement | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    this.controller = new ChatController(this, {
      assistantId: this.assistantId,
      configUrl: this.configUrl,
      configBaseUrl: this.configBaseUrl,
      modeOverride: parseMode(this.modeOverride),
      tierOverride: parseTier(this.tierOverride),
      disableCache: this.disableCache,
      modelBaseUrl: this.modelBaseUrl,
      inlineConfig: this.config,
      emit: (name, detail) => this.emit(name, detail),
    })
    if (this.preview) this.open = true
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('modeOverride') && this.controller) {
      const mode = parseMode(this.modeOverride)
      if (mode) this.controller.setMode(mode)
    }
    const cfg = this.controller?.state.config?.config
    if (cfg) {
      this.style.setProperty('--answerlay-brand', cfg.brandColor)
    }
    if (changed.has('open') && this.open) {
      requestAnimationFrame(() => this.inputEl?.focus())
    }
    this.ensureScrollObservers()
    this.maybeAutoScroll()
  }

  override disconnectedCallback(): void {
    this.messagesResizeObserver?.disconnect()
    this.messagesResizeObserver = null
    this.observedMessagesEl = null
    super.disconnectedCallback()
  }

  private ensureScrollObservers(): void {
    const el = this.messagesEl
    if (!el || el === this.observedMessagesEl) return
    if (this.observedMessagesEl) {
      this.messagesResizeObserver?.disconnect()
    }
    this.observedMessagesEl = el
    this.lastScrollTop = el.scrollTop
    el.addEventListener('scroll', this.onMessagesScroll, { passive: true })
    // The typewriter grows the bubble between renders — re-pin on that growth
    // so the streamed text stays in view.
    this.messagesResizeObserver = new ResizeObserver(() => this.maybeAutoScroll())
    this.messagesResizeObserver.observe(el)
    for (const child of Array.from(el.children)) {
      this.messagesResizeObserver.observe(child)
    }
  }

  private onMessagesScroll = (): void => {
    const el = this.messagesEl
    if (!el) return
    const isStreaming = this.controller?.state.messages.some((m) => m.status === 'streaming')
    if (isStreaming && el.scrollTop < this.lastScrollTop - 20) {
      this.followStream = false
    }
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distFromBottom < 40) this.followStream = true
    this.lastScrollTop = el.scrollTop
  }

  private maybeAutoScroll(): void {
    const el = this.messagesEl
    if (!el) return
    const isStreaming = this.controller?.state.messages.some((m) => m.status === 'streaming')
    if (isStreaming && this.followStream) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
        this.lastScrollTop = el.scrollTop
      })
      return
    }
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distFromBottom < 200) {
      el.scrollTop = el.scrollHeight
      this.lastScrollTop = el.scrollTop
    }
  }

  private emit(
    name: 'answerlay-ready' | 'answerlay-message' | 'answerlay-error' | 'answerlay-tier-change',
    detail: unknown,
  ): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }

  private toggleOpen = (): void => {
    this.open = !this.open
    this.controller.setOpen(this.open)
  }

  // Public API for the dashboard test panel: re-fetch config/scenarios/vectors
  // (optionally bypassing the IDB cache) and optionally reset the conversation.
  refresh(opts: { clearMessages?: boolean; bypassCache?: boolean } = {}): Promise<void> {
    this.followStream = true
    return this.controller.refresh(opts)
  }

  private onSubmit = (e: Event): void => {
    e.preventDefault()
    const text = this.input.trim()
    if (!text) return
    this.input = ''
    this.followStream = true
    void this.controller.send(text)
  }

  private onInputKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.onSubmit(e)
    }
  }

  private onQuickReply = (label: string): void => {
    this.followStream = true
    void this.controller.send(label)
  }

  private onModeSwitch = (mode: 'mobile' | 'desktop'): void => {
    this.modeOverride = mode
    this.controller.setMode(mode)
  }

  private renderLauncher() {
    const positionClass =
      this.controller.state.config?.config.position === 'bottom-left'
        ? 'position-left'
        : 'position-right'
    return html`
      <button
        class="launcher ${positionClass}"
        type="button"
        aria-label=${this.open ? 'Close chat' : 'Open chat'}
        aria-expanded=${this.open ? 'true' : 'false'}
        @click=${this.toggleOpen}
      >
        ${this.open ? closeIcon : chatIcon}
      </button>
    `
  }

  private renderModeToggle() {
    if (!this.preview) return nothing
    // Host page is driving mode via data-mode-override — suppress the
    // in-panel toggle so the two don't fight.
    if (this.modeOverride) return nothing
    const current = this.controller.state.tier?.mode ?? 'desktop'
    return html`
      <div class="mode-toggle" role="group" aria-label="Preview mode">
        <button
          type="button"
          aria-pressed=${current === 'desktop'}
          @click=${() => this.onModeSwitch('desktop')}
        >
          Desktop
        </button>
        <button
          type="button"
          aria-pressed=${current === 'mobile'}
          @click=${() => this.onModeSwitch('mobile')}
        >
          Mobile
        </button>
      </div>
    `
  }

  private renderMessage(m: ChatMessage) {
    const cls = `message ${m.role}${m.status === 'error' ? ' error' : ''}`
    return html`
      <li class=${cls}>
        <div class="bubble">
          ${m.role === 'assistant' && m.status === 'streaming' && !m.content
            ? html`<span class="typing"
                ><span></span><span></span><span></span
              ></span>`
            : m.role === 'assistant'
              ? html`<answerlay-typewriter
                  .text=${m.content}
                  .animate=${m.status === 'streaming' || m.source !== 'fallback'}
                ></answerlay-typewriter>`
              : html`<span>${m.content}</span>`}
          ${m.quickReplies && m.quickReplies.length > 0
            ? html`
                <div class="quick-replies">
                  ${m.quickReplies.map(
                    (qr) => html`
                      <button
                        class="quick-reply"
                        type="button"
                        @click=${() => this.onQuickReply(qr.label)}
                      >
                        ${qr.label}
                      </button>
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>
      </li>
    `
  }

  private renderLoader() {
    const p = this.controller.state.loadingProgress
    if (this.controller.state.status !== 'engine-loading' || !p) return nothing
    const pct = typeof p.progress === 'number' ? Math.round(p.progress * 100) : null
    return html`
      <div class="loader" role="status" aria-live="polite">
        <span>Loading model${p.file ? ` · ${p.file}` : ''}…</span>
        <div class="loader-bar">
          <div class="loader-fill" style=${`width: ${pct ?? 0}%`}></div>
        </div>
        ${pct !== null ? html`<span>${pct}%</span>` : nothing}
      </div>
    `
  }

  private renderPanel() {
    const state = this.controller.state
    const cfg = state.config?.config
    const positionClass =
      cfg?.position === 'bottom-left' ? 'position-left' : 'position-right'

    const isBusy = state.status === 'thinking' || state.status === 'streaming'

    return html`
      <div class="panel ${positionClass}" role="dialog" aria-label="${cfg?.name ?? 'Chat'}">
        <header class="header">
          <h3>${cfg?.name ?? 'Chat'}</h3>
          ${this.renderModeToggle()}
          ${!this.preview
            ? html`
                <button
                  class="close-btn"
                  type="button"
                  aria-label="Close chat"
                  @click=${this.toggleOpen}
                >
                  ${closeIcon}
                </button>
              `
            : nothing}
        </header>

        <ol class="messages" role="log" aria-live="polite">
          ${state.messages.map((m) => this.renderMessage(m))}
        </ol>

        ${this.renderLoader()}
        ${state.errorMessage && state.status === 'error'
          ? html`<div class="error-banner" role="alert">${state.errorMessage}</div>`
          : nothing}
        ${state.errorMessage && state.status === 'config-error'
          ? html`<div class="error-banner" role="alert">${state.errorMessage}</div>`
          : nothing}

        <form class="form" @submit=${this.onSubmit}>
          <textarea
            class="input"
            rows="1"
            placeholder="Ask a question…"
            aria-label="Message"
            .value=${this.input}
            ?disabled=${isBusy || state.status === 'config-loading' || state.status === 'config-error'}
            @input=${(e: Event) => (this.input = (e.target as HTMLTextAreaElement).value)}
            @keydown=${this.onInputKey}
          ></textarea>
          <button
            class="send"
            type="submit"
            aria-label="Send"
            ?disabled=${isBusy || !this.input.trim()}
          >
            ${sendIcon}
          </button>
        </form>
      </div>
    `
  }

  override render() {
    return html`
      <div class="root">
        ${this.renderLauncher()}
        ${this.open || this.preview ? this.renderPanel() : nothing}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'answerlay-chat': AnswerlayChat
  }
}
