import { LitElement, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import './answerlay-typewriter'
import { ChatController } from '../core/controller'
import { parseMode, parseTier } from '../core/attributes'
import type { AssistantConfig } from '../public/types'
import {
  aggregateProgress,
  allReady,
  formatEta,
  formatMB,
  formatSpeed,
  hasStageError,
  isChatOpenable,
  liveEtaSeconds,
  type ChatMessage,
} from '../core/store'
import { chatStyles } from '../styles/component'
import {
  alertIcon,
  chatIcon,
  checkIcon,
  closeIcon,
  sendIcon,
  sparkleIcon,
} from './icons'
import { thumbsAvatarSvg, silhouetteAvatarSvg } from './dicebear-avatar'
import { formatRelativeTime } from '../core/store'
import {
  BUBBLE_AUTO_HIDE_MS,
  MOBILE_BUBBLE_DELAY_MS,
  shouldShowGreetingBubble,
} from '../core/greeting-bubble'

// Friendly status copy rotated in the loading panel. Avoids exposing
// technical pipeline detail (model names, vector DBs, etc.) — those are
// console.info'd from the controller for developers.
const LOADING_HEADLINES = [
  'Setting things up',
  'Warming up',
  'Almost ready',
  'Getting your assistant ready',
  'Tuning up',
  'Just a moment',
]
const LOADING_SUBLINES = [
  'Loading what we need…',
  'Polishing the details…',
  'Connecting the pieces…',
  'Getting everything in place…',
  'Doing a little bit of magic…',
]

const BUBBLE_LAST_SHOWN_KEY = (assistantId: string) =>
  `answerlay:greeting-bubble-last-shown:${assistantId}`
const BUBBLE_COOLDOWN_MS = 24 * 60 * 60 * 1000

// Returns true if the bubble was shown for this assistant within the
// cooldown window. localStorage (not sessionStorage) so the cooldown
// survives full tab close — without it visitors get the bubble on every
// pageview.
function readBubbleRecentlyShown(assistantId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(BUBBLE_LAST_SHOWN_KEY(assistantId))
    if (!raw) return false
    const ts = Number.parseInt(raw, 10)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < BUBBLE_COOLDOWN_MS
  } catch {
    return false
  }
}

function writeBubbleLastShown(assistantId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BUBBLE_LAST_SHOWN_KEY(assistantId), String(Date.now()))
  } catch {
    // best-effort — private mode / storage quota
  }
}

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

  // Reflected so CSS can target `:host([open][mobile])` for fullscreen.
  @property({ type: Boolean, reflect: true })
  mobile = false

  @property({ attribute: false })
  config: AssistantConfig | null = null

  @state() private input = ''
  @state() private loadingPhraseIndex = 0
  @state() private loadingPhraseSwapping = false
  @state() private bubbleVisible = false
  // Latch — once we've shown the bubble in this widget lifecycle, don't
  // re-show it even if status briefly drops out of `ready` (defensive).
  @state() private bubbleAlreadyShown = false

  @query('textarea.input') private inputEl?: HTMLTextAreaElement
  @query('.messages') private messagesEl?: HTMLElement
  @query('.close-btn') private closeBtnEl?: HTMLButtonElement
  @query('.loading-panel') private loadingPanelEl?: HTMLElement

  private loadingPhraseTimer: number | null = null
  private bubbleMobileTimer: number | null = null
  private bubbleAutoHideTimer: number | null = null
  // 1Hz tick while the LLM is downloading so the avatar tooltip's ETA
  // counts down between progress samples (the underlying smoothed speed
  // only updates when a new chunk lands).
  private llmTickTimer: number | null = null
  private configLoadedAt: number | null = null
  private bubbleDismissed = false

  private controller!: ChatController
  private followStream = true
  private lastScrollTop = 0
  private messagesResizeObserver: ResizeObserver | null = null
  private observedMessagesEl: HTMLElement | null = null
  // Saved value of document.body.style.overflow before we locked it for
  // mobile fullscreen; restored on close / disconnect.
  private savedBodyOverflow: string | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.assistantId) {
      this.bubbleDismissed = readBubbleRecentlyShown(this.assistantId)
    }
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
    document.addEventListener('keydown', this.onDocKey)
    this.startLoadingPhraseRotation()
  }

  private startLoadingPhraseRotation(): void {
    if (this.loadingPhraseTimer !== null) return
    // Rotate every ~3.6s with a short opacity crossfade. Stops rotating
    // automatically once we leave the loading panel (no work is wasted —
    // the render branch doesn't read the index).
    this.loadingPhraseTimer = window.setInterval(() => {
      this.loadingPhraseSwapping = true
      window.setTimeout(() => {
        this.loadingPhraseIndex = (this.loadingPhraseIndex + 1) % LOADING_HEADLINES.length
        this.loadingPhraseSwapping = false
      }, 250)
    }, 3600)
  }

  private stopLoadingPhraseRotation(): void {
    if (this.loadingPhraseTimer !== null) {
      window.clearInterval(this.loadingPhraseTimer)
      this.loadingPhraseTimer = null
    }
  }

  private syncLlmTickTimer(): void {
    const stage = this.controller?.state.stages.llm
    const shouldTick =
      !!stage &&
      stage.status !== 'done' &&
      stage.status !== 'skipped' &&
      stage.status !== 'error' &&
      !this.mobile
    if (shouldTick && this.llmTickTimer === null) {
      this.llmTickTimer = window.setInterval(() => this.requestUpdate(), 1000)
    } else if (!shouldTick && this.llmTickTimer !== null) {
      window.clearInterval(this.llmTickTimer)
      this.llmTickTimer = null
    }
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
    // Mirror the resolved tier mode onto the reflected `mobile` property so
    // CSS can swap to fullscreen layout. Preview always renders desktop
    // layout (the mode toggle inside the panel handles preview emulation).
    const tierMode = this.controller?.state.tier?.mode
    const nextMobile = !this.preview && tierMode === 'mobile'
    if (nextMobile !== this.mobile) {
      this.mobile = nextMobile
    }
    this.syncBodyScrollLock()
    this.manageFocus(changed)
    this.ensureScrollObservers()
    this.maybeAutoScroll()
    this.evaluateGreetingBubble()
    this.syncLlmTickTimer()
  }

  private evaluateGreetingBubble(): void {
    const state = this.controller?.state
    if (!state) return
    const cfg = state.config?.config
    const enabled = cfg?.showGreetingBubble === true

    if (cfg && this.configLoadedAt === null) {
      this.configLoadedAt = Date.now()
      // Both desktop and mobile now wait `BUBBLE_DELAY_MS` since config
      // load. We schedule a single re-evaluation; `shouldShowGreetingBubble`
      // does the actual gating.
      if (
        enabled &&
        this.bubbleMobileTimer === null &&
        !this.bubbleDismissed &&
        !this.bubbleAlreadyShown
      ) {
        this.bubbleMobileTimer = window.setTimeout(() => {
          this.bubbleMobileTimer = null
          this.requestUpdate()
        }, MOBILE_BUBBLE_DELAY_MS)
      }
    }

    const shouldShow = shouldShowGreetingBubble({
      enabled,
      status: state.status,
      tierMode: state.tier?.mode ?? null,
      configLoadedAt: this.configLoadedAt,
      now: Date.now(),
      open: this.open,
      dismissed: this.bubbleDismissed,
      alreadyShown: this.bubbleAlreadyShown,
    })

    if (shouldShow && !this.bubbleVisible) {
      this.bubbleVisible = true
      this.bubbleAlreadyShown = true
      if (this.bubbleAutoHideTimer === null) {
        this.bubbleAutoHideTimer = window.setTimeout(() => {
          this.bubbleAutoHideTimer = null
          this.bubbleVisible = false
          if (this.assistantId) writeBubbleLastShown(this.assistantId)
          this.bubbleDismissed = true
        }, BUBBLE_AUTO_HIDE_MS)
      }
    }
  }

  override disconnectedCallback(): void {
    this.messagesResizeObserver?.disconnect()
    this.messagesResizeObserver = null
    this.observedMessagesEl = null
    this.releaseBodyScrollLock()
    this.stopLoadingPhraseRotation()
    if (this.bubbleMobileTimer !== null) {
      window.clearTimeout(this.bubbleMobileTimer)
      this.bubbleMobileTimer = null
    }
    if (this.bubbleAutoHideTimer !== null) {
      window.clearTimeout(this.bubbleAutoHideTimer)
      this.bubbleAutoHideTimer = null
    }
    if (this.llmTickTimer !== null) {
      window.clearInterval(this.llmTickTimer)
      this.llmTickTimer = null
    }
    document.removeEventListener('keydown', this.onDocKey)
    super.disconnectedCallback()
  }

  private onDocKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open && !this.preview) {
      this.open = false
      this.controller.setOpen(false)
    }
  }

  private syncBodyScrollLock(): void {
    if (typeof document === 'undefined') return
    if (this.preview) return
    const shouldLock = this.open && this.mobile
    if (shouldLock && this.savedBodyOverflow === null) {
      this.savedBodyOverflow = document.body.style.overflow || ''
      document.body.style.overflow = 'hidden'
    } else if (!shouldLock) {
      this.releaseBodyScrollLock()
    }
  }

  private releaseBodyScrollLock(): void {
    if (typeof document === 'undefined') return
    if (this.savedBodyOverflow !== null) {
      document.body.style.overflow = this.savedBodyOverflow
      this.savedBodyOverflow = null
    }
  }

  private manageFocus(changed: PropertyValues): void {
    if (!changed.has('open') || !this.open) return
    requestAnimationFrame(() => {
      const state = this.controller?.state
      if (!state) return
      if (!allReady(state.stages)) {
        // Loading panel — move focus to its root so screen readers announce
        // the live region.
        this.loadingPanelEl?.focus()
        return
      }
      if (this.mobile) {
        // On phones, focus the close button so the keyboard doesn't pop up
        // immediately (the visitor may want to read the greeting first).
        this.closeBtnEl?.focus()
      } else {
        this.inputEl?.focus()
      }
    })
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
    if (this.bubbleVisible) this.dismissGreetingBubble()
    this.open = !this.open
    this.controller.setOpen(this.open)
  }

  private dismissGreetingBubble = (e?: Event): void => {
    e?.stopPropagation()
    this.bubbleVisible = false
    if (this.bubbleAutoHideTimer !== null) {
      window.clearTimeout(this.bubbleAutoHideTimer)
      this.bubbleAutoHideTimer = null
    }
    if (this.assistantId) writeBubbleLastShown(this.assistantId)
    this.bubbleDismissed = true
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
    // Don't write through to the `modeOverride` reactive property — that
    // attribute is reserved for the host page driving mode externally.
    // Clicking the in-panel toggle is a separate user action; calling
    // controller.setMode keeps the toggle visible for subsequent clicks.
    this.controller.setMode(mode)
    this.requestUpdate()
  }

  private onRetry = (): void => {
    void this.controller.retryFailedStages()
  }

  private renderLauncher() {
    const cfg = this.controller.state.config?.config
    const positionClass =
      cfg?.position === 'bottom-left' ? 'position-left' : 'position-right'
    const tooltip = cfg?.launcherTooltip || 'Chat with us'
    return html`
      ${this.renderGreetingBubble(positionClass)}
      <button
        class="launcher ${positionClass}"
        type="button"
        aria-label=${this.open ? 'Close chat' : 'Open chat'}
        aria-expanded=${this.open ? 'true' : 'false'}
        @click=${this.toggleOpen}
      >
        ${chatIcon}
        <span class="launcher-tip" aria-hidden="true">${tooltip}</span>
      </button>
    `
  }

  private renderGreetingBubble(positionClass: string) {
    if (!this.bubbleVisible) return nothing
    const cfg = this.controller.state.config?.config
    const greeting = cfg?.greeting ?? ''
    if (!greeting) return nothing
    return html`
      <aside class="greeting-bubble ${positionClass}" role="status" aria-live="polite">
        <span class="greeting-bubble-text">${greeting}</span>
        <button
          type="button"
          class="greeting-bubble-close"
          aria-label="Dismiss greeting"
          @click=${this.dismissGreetingBubble}
        >
          ${closeIcon}
        </button>
      </aside>
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

  private renderLoadingAvatar(progress: number) {
    const pct = Math.max(0, Math.min(1, progress))
    const r = 14
    const c = 2 * Math.PI * r
    const offset = c * (1 - pct)
    const label = `AI model loading ${Math.round(pct * 100)}%`
    return html`
      <span class="tooltip-wrap header-avatar-wrap">
        <span
          class="header-avatar header-avatar-loading"
          role="img"
          aria-label=${label}
          tabindex="0"
        >
          <svg class="ring" viewBox="0 0 32 32" aria-hidden="true">
            <circle class="ring-track" cx="16" cy="16" r=${r}></circle>
            <circle
              class="ring-fill"
              cx="16"
              cy="16"
              r=${r}
              stroke-dasharray=${c}
              stroke-dashoffset=${offset}
            ></circle>
          </svg>
          <span class="header-logo-mark" aria-hidden="true"></span>
        </span>
        <span class="tooltip tooltip-rich" role="tooltip">
          ${this.renderLoadingTooltipContent()}
        </span>
      </span>
    `
  }

  private renderThumbsAvatar(seed: string) {
    return html`
      <span class="header-avatar header-avatar-thumbs" aria-hidden="true"
        >${unsafeHTML(thumbsAvatarSvg(seed))}</span
      >
    `
  }

  private renderSilhouetteAvatar() {
    return html`
      <span class="header-avatar header-avatar-silhouette" aria-hidden="true"
        >${unsafeHTML(silhouetteAvatarSvg())}</span
      >
    `
  }

  // Rich, live-updating tooltip content for the loading avatar. Reads
  // from the latest state.downloadStats so the values tick with progress
  // samples and the 1 Hz `syncLlmTickTimer`.
  private renderLoadingTooltipContent() {
    const stats = this.controller.state.downloadStats
    if (!stats) {
      return html`<span class="tooltip-row tooltip-title"
        >Downloading AI assistant…</span
      >`
    }
    const liveEta = liveEtaSeconds(stats)
    return html`
      <span class="tooltip-row tooltip-title">Downloading AI assistant</span>
      <span class="tooltip-row tooltip-meta"
        >${formatMB(stats.downloadedMB)} / ${formatMB(stats.totalMB)}</span
      >
      <span class="tooltip-row tooltip-meta"
        >${formatSpeed(stats.speedMBs)} · ${formatEta(liveEta)} left</span
      >
    `
  }

  private renderHeader() {
    const state = this.controller.state
    const cfg = state.config?.config
    const llmStage = state.stages.llm
    // LLM is still downloading. Mobile never enters this state (tier D
    // skips the llm stage). Errors fall back to the standard header — the
    // engine silently downgrades to scenarios-only and the user can't act
    // on a persistent yellow warning.
    const llmLoading =
      !this.mobile &&
      llmStage.status !== 'done' &&
      llmStage.status !== 'skipped' &&
      llmStage.status !== 'error'
    const seed = cfg?.name ?? 'Answerlay'
    const avatarStyle = cfg?.avatarStyle ?? 'bottts'
    const shortStatus = llmLoading
      ? 'Limited mode · loading AI…'
      : cfg?.statusLabel || 'AI assistant ready'
    const fullStatus = llmLoading
      ? 'Limited knowledge available · full AI assistant is loading'
      : cfg?.statusLabel || 'AI assistant ready to answer'
    const renderAvatar = () => {
      if (llmLoading) return this.renderLoadingAvatar(llmStage.progress ?? 0)
      if (avatarStyle === 'none') return nothing
      if (avatarStyle === 'silhouette') return this.renderSilhouetteAvatar()
      return this.renderThumbsAvatar(seed)
    }
    return html`
      <header class="header">
        ${renderAvatar()}
        <div class="head-text">
          <h3 class="head-title">${cfg?.name ?? 'Chat'}</h3>
          <span class="tooltip-wrap head-status-wrap">
            <span class="head-status" tabindex="0">
              <span
                class=${llmLoading ? 'status-dot is-loading' : 'status-dot'}
                aria-hidden="true"
              ></span>
              <span class="head-status-text">${shortStatus}</span>
            </span>
            <span class="tooltip tooltip-plain" role="tooltip"
              >${fullStatus}</span
            >
          </span>
        </div>
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
    `
  }

  private metaForMessage(m: ChatMessage) {
    if (!this.preview) return nothing
    if (m.role !== 'assistant') return nothing
    if (!m.source) return nothing
    if (m.source === 'scenario') {
      return html`<div class="message-meta meta-scenario">
        ${checkIcon}
        <span>Matched scenario</span>
      </div>`
    }
    if (m.source === 'llm') {
      return html`<div class="message-meta meta-ai">
        ${sparkleIcon}
        <span>AI from your docs</span>
      </div>`
    }
    return html`<div class="message-meta meta-fallback">
      ${alertIcon}
      <span>No match · fallback</span>
    </div>`
  }

  private renderMessage(m: ChatMessage) {
    const cls = `message ${m.role}${m.status === 'error' ? ' error' : ''}`
    const showTimestamp =
      m.role === 'assistant' && m.status !== 'streaming' && m.createdAt !== undefined
    return html`
      <li class=${cls}>
        ${this.metaForMessage(m)}
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
        </div>
        ${m.quickReplies && m.quickReplies.length > 0
          ? html`
              <div class="quick-replies" role="group" aria-label="Suggested questions">
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
        ${showTimestamp
          ? html`<time class="message-time">${formatRelativeTime(m.createdAt!)}</time>`
          : nothing}
      </li>
    `
  }

  private renderCredit() {
    const cfg = this.controller.state.config?.config
    if (cfg?.hideCredit) return nothing
    return html`
      <div class="credit">
        <span class="credit-soft">Powered by Answerlay</span>
        <span class="credit-dot" aria-hidden="true">·</span>
        <span class="credit-strong">Runs locally in your browser</span>
      </div>
    `
  }

  private renderLoadingPanel() {
    const state = this.controller.state
    const cfg = state.config?.config
    const positionClass =
      cfg?.position === 'bottom-left' ? 'position-left' : 'position-right'
    const errored = hasStageError(state.stages)
    const progress = aggregateProgress(state.stages)
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)))
    // Indeterminate sweep until we have any meaningful progress to show.
    const indeterminate = !errored && progress < 0.02
    const headline = errored
      ? 'Something went wrong'
      : LOADING_HEADLINES[this.loadingPhraseIndex % LOADING_HEADLINES.length]
    const subline = errored
      ? 'We couldn’t finish loading. Try again?'
      : LOADING_SUBLINES[this.loadingPhraseIndex % LOADING_SUBLINES.length]
    return html`
      <div
        class="panel ${positionClass}"
        role="dialog"
        aria-modal=${this.mobile ? 'true' : 'false'}
        aria-label=${cfg?.name ?? 'Chat'}
      >
        ${this.renderHeader()}
        <div
          class="loading-panel"
          role="status"
          aria-live="polite"
          tabindex="-1"
        >
          <span class="loading-logo" aria-hidden="true"></span>
          <div class="loading-copy">
            <h3
              class=${
                this.loadingPhraseSwapping
                  ? 'loading-headline is-swapping'
                  : 'loading-headline'
              }
            >
              ${headline}
            </h3>
            <p class="loading-subline">${subline}</p>
          </div>
          <div
            class=${
              indeterminate
                ? 'loading-bar is-indeterminate'
                : 'loading-bar'
            }
            aria-hidden="true"
          >
            <span
              class="loading-bar-fill"
              style=${indeterminate ? '' : `width: ${pct}%`}
            ></span>
          </div>
          ${errored
            ? html`
                <button
                  type="button"
                  class="loading-retry"
                  @click=${this.onRetry}
                >
                  Retry
                </button>
              `
            : nothing}
        </div>
      </div>
    `
  }

  private renderPanel() {
    const state = this.controller.state
    const cfg = state.config?.config
    const positionClass =
      cfg?.position === 'bottom-left' ? 'position-left' : 'position-right'

    const isBusy = state.status === 'thinking' || state.status === 'streaming'
    const inputDisabled: boolean = isBusy || state.status === 'error'

    return html`
      <div
        class="panel ${positionClass}"
        role="dialog"
        aria-modal=${this.mobile ? 'true' : 'false'}
        aria-label=${cfg?.name ?? 'Chat'}
      >
        ${this.renderHeader()}

        <ol class="messages" role="log" aria-live="polite">
          ${state.messages.map((m) => this.renderMessage(m))}
        </ol>

        ${state.errorMessage && state.status === 'error'
          ? html`<div class="error-banner" role="alert">${state.errorMessage}</div>`
          : nothing}

        <form class="form" @submit=${this.onSubmit}>
          <textarea
            class="input"
            rows="1"
            placeholder="Ask a question…"
            aria-label="Message"
            .value=${this.input}
            ?disabled=${inputDisabled}
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

        ${this.renderCredit()}
      </div>
    `
  }

  override render() {
    const state = this.controller.state
    const openable = isChatOpenable(state.stages)
    return html`
      <div class="root">
        ${this.renderLauncher()}
        ${this.open || this.preview
          ? openable
            ? this.renderPanel()
            : this.renderLoadingPanel()
          : nothing}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'answerlay-chat': AnswerlayChat
  }
}
