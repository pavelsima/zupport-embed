import { css } from 'lit'
import { reset } from './reset'
import { tokens } from './tokens'

export const chatStyles = css`
  ${tokens}
  ${reset}

  :host {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: var(--answerlay-z-index);
    font-family: var(--answerlay-font-body);
    font-size: var(--answerlay-font-size);
    line-height: 1.5;
    color: var(--answerlay-fg);
  }

  :host([data-preview]) {
    position: relative;
    inset: auto;
    pointer-events: auto;
    width: 100%;
    height: 100%;
  }

  .root {
    pointer-events: none;
    position: absolute;
    inset: 0;
  }

  :host([data-preview]) .root {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: stretch;
    pointer-events: auto;
  }

  /* ============================================================
     Logo mark (CSS-only — two overlapping rounded rectangles).
     The wrapping <span class="logo-mark"> sets --logo-size; the
     two squares are pseudo-elements. Reused at avatar / credit /
     hero sizes by changing --logo-size at the call site.
     ============================================================ */
  .logo-mark {
    display: inline-block;
    position: relative;
    width: var(--logo-size, 22px);
    height: var(--logo-size, 22px);
    flex-shrink: 0;
  }
  .logo-mark::before,
  .logo-mark::after {
    content: '';
    position: absolute;
    width: calc(var(--logo-size, 22px) * 0.65);
    height: calc(var(--logo-size, 22px) * 0.65);
    border-radius: calc(var(--logo-size, 22px) * 0.15);
    border-width: 1.5px;
    border-style: solid;
  }
  .logo-mark::before {
    top: 0;
    left: 0;
    background: var(--answerlay-brand-soft);
    border-color: var(--answerlay-brand);
  }
  .logo-mark::after {
    bottom: 0;
    right: 0;
    background: var(--answerlay-accent-soft);
    border-color: var(--answerlay-accent);
  }

  /* ============================================================
     Launcher — floating brand button with pulse ring + tooltip.
     ============================================================ */
  .launcher {
    pointer-events: auto;
    position: absolute;
    bottom: 24px;
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: var(--answerlay-brand);
    color: var(--answerlay-brand-fg);
    box-shadow: var(--answerlay-shadow-launcher);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      transform 250ms cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 250ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity 200ms ease,
      background 150ms ease;
    animation: answerlay-launcher-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .launcher::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--answerlay-brand);
    z-index: -1;
    animation: answerlay-launcher-pulse 2.4s ease-out infinite;
  }

  @keyframes answerlay-launcher-pulse {
    0% {
      transform: scale(1);
      opacity: 0.5;
    }
    100% {
      transform: scale(1.7);
      opacity: 0;
    }
  }

  .launcher:hover {
    background: var(--answerlay-brand-hover);
    transform: translateY(-2px);
    box-shadow:
      0 16px 36px rgba(24, 85, 61, 0.4),
      0 6px 16px rgba(0, 0, 0, 0.1);
  }

  .launcher:active {
    transform: translateY(0);
  }

  .launcher.position-right {
    right: 24px;
  }

  .launcher.position-left {
    left: 24px;
  }

  /* Tooltip — slides in from the side opposite the launcher. */
  .launcher-tip {
    position: absolute;
    top: 50%;
    background: var(--answerlay-fg);
    color: var(--answerlay-surface);
    font-family: var(--answerlay-font-body);
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 6px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .launcher.position-right .launcher-tip {
    right: calc(100% + 12px);
    transform: translateY(-50%) translateX(8px);
  }
  .launcher.position-left .launcher-tip {
    left: calc(100% + 12px);
    transform: translateY(-50%) translateX(-8px);
  }
  .launcher-tip::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    background: var(--answerlay-fg);
    transform: translateY(-50%) rotate(45deg);
  }
  .launcher.position-right .launcher-tip::after {
    right: -3px;
  }
  .launcher.position-left .launcher-tip::after {
    left: -3px;
  }
  .launcher:hover .launcher-tip,
  .launcher:focus-visible .launcher-tip {
    opacity: 1;
  }
  .launcher.position-right:hover .launcher-tip,
  .launcher.position-right:focus-visible .launcher-tip {
    transform: translateY(-50%) translateX(0);
  }
  .launcher.position-left:hover .launcher-tip,
  .launcher.position-left:focus-visible .launcher-tip {
    transform: translateY(-50%) translateX(0);
  }

  /* Auto-popup greeting bubble — sits above the launcher icon.
     Positioned at host bottom 24px + launcher height 56px + 12px gap = 92px. */
  .greeting-bubble {
    pointer-events: auto;
    position: absolute;
    bottom: 92px;
    max-width: 260px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px 10px 14px;
    background: var(--answerlay-surface);
    color: var(--answerlay-fg);
    border: 1px solid var(--answerlay-line);
    border-radius: 12px;
    box-shadow: var(--answerlay-shadow-panel);
    font-family: var(--answerlay-font-body);
    font-size: 13px;
    line-height: 1.4;
    animation: answerlay-greeting-bubble-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .greeting-bubble.position-right {
    right: 24px;
  }
  .greeting-bubble.position-left {
    left: 24px;
  }

  /* Pointer triangle aligned with the centre of the launcher icon (56/2 = 28px from its edge). */
  .greeting-bubble::after {
    content: '';
    position: absolute;
    bottom: -6px;
    width: 10px;
    height: 10px;
    background: var(--answerlay-surface);
    border-right: 1px solid var(--answerlay-line);
    border-bottom: 1px solid var(--answerlay-line);
    transform: rotate(45deg);
  }
  .greeting-bubble.position-right::after {
    right: 22px;
  }
  .greeting-bubble.position-left::after {
    left: 22px;
  }

  .greeting-bubble-text {
    flex: 1;
    min-width: 0;
  }

  .greeting-bubble-close {
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: transparent;
    color: var(--answerlay-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .greeting-bubble-close:hover {
    background: var(--answerlay-line);
    color: var(--answerlay-fg);
  }
  .greeting-bubble-close svg {
    width: 12px;
    height: 12px;
  }

  @keyframes answerlay-greeting-bubble-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Hide the bubble while the panel is open (defensive — render-side
     gating should already prevent this, but keep CSS in sync). */
  :host([open]) .greeting-bubble {
    display: none;
  }

  /* Retract the launcher visually when the panel is open. */
  :host([open]) .launcher {
    opacity: 0;
    transform: scale(0.5) rotate(-12deg);
    pointer-events: none;
  }
  :host([open]) .launcher::before {
    animation: none;
  }

  @keyframes answerlay-launcher-in {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  :host([data-preview]) .launcher {
    display: none;
  }

  /* ============================================================
     Panel — chat / loading container.
     ============================================================ */
  .panel {
    pointer-events: auto;
    position: absolute;
    bottom: 24px;
    width: var(--answerlay-panel-width);
    max-width: calc(100vw - 32px);
    height: var(--answerlay-panel-height);
    background: var(--answerlay-surface);
    color: var(--answerlay-fg);
    border: 1px solid var(--answerlay-line);
    border-radius: var(--answerlay-radius-panel);
    box-shadow: var(--answerlay-shadow-panel);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform-origin: bottom right;
    animation: answerlay-widget-in 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .panel.position-left {
    transform-origin: bottom left;
  }

  @keyframes answerlay-widget-in {
    from {
      opacity: 0;
      transform: scale(0.85) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .panel.position-right {
    right: 24px;
  }

  .panel.position-left {
    left: 24px;
  }

  :host([data-preview]) .panel {
    position: relative;
    bottom: auto;
    right: auto;
    left: auto;
    width: 100%;
    max-width: none;
    height: 100%;
  }

  /* Mobile fullscreen — panel fills the viewport. Driven by the
     reflected mobile property; .is-mobile is a synonym used when
     preview mode emulates a phone. */
  :host([open][mobile]:not([data-preview])) .panel,
  :host([open].is-mobile:not([data-preview])) .panel {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    max-width: none;
    border-radius: 0;
    border: none;
    bottom: 0;
    right: 0;
    left: 0;
  }

  /* ============================================================
     Header — brand surface with avatar (logo-mark), title, status,
     and close button. Mode toggle slot is preview-only.
     ============================================================ */
  .header {
    padding: 14px 16px;
    background: var(--answerlay-brand);
    color: var(--answerlay-brand-fg);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  :host([open][mobile]) .header,
  :host([open].is-mobile) .header {
    padding-top: 26px;
  }

  .header-avatar {
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--answerlay-brand-fg);
  }
  .header-avatar svg {
    width: 18px;
    height: 18px;
  }

  .head-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .head-title {
    font-family: var(--answerlay-font-body);
    font-size: 14px;
    font-weight: 500;
    color: inherit;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .head-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--answerlay-font-mono);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.02em;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--answerlay-status-dot);
    box-shadow: 0 0 0 0 rgba(111, 213, 168, 0.6);
    animation: answerlay-ring-pulse 2.2s ease-out infinite;
  }
  @keyframes answerlay-ring-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(111, 213, 168, 0.5);
    }
    70% {
      box-shadow: 0 0 0 8px rgba(111, 213, 168, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(111, 213, 168, 0);
    }
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.75);
    transition: background 120ms ease, color 120ms ease;
  }
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    color: var(--answerlay-surface);
  }

  /* ============================================================
     Messages list — white background, warm-cream assistant bubbles,
     brand user bubbles.
     ============================================================ */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 18px 18px 8px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--answerlay-surface);
    scrollbar-width: thin;
    scrollbar-color: var(--answerlay-line-strong) transparent;
  }
  .messages::-webkit-scrollbar {
    width: 6px;
  }
  .messages::-webkit-scrollbar-thumb {
    background: var(--answerlay-line-strong);
    border-radius: 3px;
  }

  .message {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 90%;
    opacity: 0;
    animation: answerlay-fade-up 450ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .message.user {
    align-self: flex-end;
    align-items: flex-end;
  }
  .message.assistant {
    align-self: flex-start;
    align-items: flex-start;
  }
  /* Stagger only the first batch of messages. Later messages still get
     the fade animation but without a delay, so streamed replies appear
     immediately. */
  .message:nth-of-type(1) {
    animation-delay: 0.08s;
  }
  .message:nth-of-type(2) {
    animation-delay: 0.18s;
  }
  .message:nth-of-type(3) {
    animation-delay: 0.3s;
  }
  .message:nth-of-type(4) {
    animation-delay: 0.42s;
  }
  .message:nth-of-type(5) {
    animation-delay: 0.55s;
  }
  .message:nth-of-type(6) {
    animation-delay: 0.7s;
  }

  @keyframes answerlay-fade-up {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .bubble {
    padding: 12px 16px;
    border-radius: 18px;
    font-family: var(--answerlay-font-body);
    font-size: 14px;
    line-height: 1.5;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .message.user .bubble {
    background: var(--answerlay-brand);
    color: var(--answerlay-brand-fg);
    border-bottom-right-radius: 6px;
  }
  .message.assistant .bubble {
    background: var(--answerlay-surface-2);
    color: var(--answerlay-fg);
    border-bottom-left-radius: 6px;
  }
  .message.assistant.error .bubble {
    background: var(--answerlay-accent-soft);
    color: var(--answerlay-bad);
  }

  .message-time {
    font-family: var(--answerlay-font-body);
    font-size: 11px;
    color: var(--answerlay-ink-4);
    padding: 0 4px;
  }

  /* Preview-only meta line above scenario / AI / fallback messages.
     Hidden on live; rendered only when data-preview is set. */
  .message-meta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--answerlay-font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--answerlay-ink-3);
    padding: 0 4px;
  }
  .message-meta.meta-scenario {
    color: var(--answerlay-brand);
  }
  .message-meta.meta-ai {
    color: var(--answerlay-accent);
  }
  .message-meta.meta-fallback {
    color: var(--answerlay-warn);
  }

  .quick-replies {
    margin-top: 2px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-width: 100%;
  }
  .quick-reply {
    font-family: var(--answerlay-font-body);
    font-size: 13px;
    font-weight: 500;
    padding: 7px 16px;
    border-radius: 999px;
    border: 1px solid var(--answerlay-line);
    background: var(--answerlay-surface);
    color: var(--answerlay-brand);
    white-space: nowrap;
    transition: background 120ms ease, border-color 120ms ease,
      transform 120ms ease;
  }
  .quick-reply:hover {
    background: var(--answerlay-brand-soft);
    border-color: var(--answerlay-brand-line);
    transform: translateY(-1px);
  }
  .quick-reply:active {
    transform: translateY(0);
  }

  .typing {
    display: inline-flex;
    gap: 3px;
    padding: 4px 0;
    color: var(--answerlay-brand);
  }
  .typing span {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 999px;
    opacity: 0.5;
    animation: answerlay-bounce 1s infinite ease-in-out;
  }
  .typing span:nth-child(2) {
    animation-delay: 0.15s;
  }
  .typing span:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes answerlay-bounce {
    0%,
    80%,
    100% {
      transform: scale(0.6);
      opacity: 0.4;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* ============================================================
     Form — pill input + rounded-square brand send button.
     ============================================================ */
  .form {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px 10px;
    background: var(--answerlay-surface);
    border-top: 1px solid var(--answerlay-line);
    flex-shrink: 0;
  }
  textarea.input {
    flex: 1;
    resize: none;
    min-height: 40px;
    max-height: 120px;
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid var(--answerlay-line);
    background: var(--answerlay-bg);
    color: var(--answerlay-fg);
    font-family: var(--answerlay-font-body);
    font-size: 14px;
    line-height: 1.4;
    outline: none;
    transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
  }
  textarea.input::placeholder {
    color: var(--answerlay-ink-4);
  }
  textarea.input:focus {
    border-color: var(--answerlay-brand);
    background: var(--answerlay-surface);
    box-shadow: 0 0 0 3px var(--answerlay-brand-soft);
  }
  textarea.input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .send {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--answerlay-brand);
    color: var(--answerlay-brand-fg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 120ms ease, transform 120ms ease;
  }
  .send svg {
    width: 18px;
    height: 18px;
  }
  .send:not(:disabled):hover {
    background: var(--answerlay-brand-hover);
    transform: translateY(-1px);
  }
  .send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ============================================================
     Bottom credit — soft attribution + brand-emphasised privacy line.
     ============================================================ */
  .credit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-family: var(--answerlay-font-body);
    font-size: 11px;
    color: var(--answerlay-ink-4);
    background: var(--answerlay-surface);
    padding: 6px 12px 12px;
    flex-shrink: 0;
  }
  .credit-soft {
    color: var(--answerlay-ink-4);
  }
  .credit-dot {
    color: var(--answerlay-ink-4);
    opacity: 0.65;
  }
  .credit-strong {
    color: var(--answerlay-brand);
    font-weight: 500;
  }

  /* ============================================================
     Loading panel — minimalist: animated logo mark, a single rotating
     friendly status line, and a thin aggregate progress bar.
     Technical stage details go to console.info, not to the user.
     ============================================================ */
  .loading-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
    background: var(--answerlay-bg);
    padding: 40px 32px;
  }

  /* Animated logo: the two squares orbit each other slowly. */
  .loading-logo {
    --logo-size: 64px;
    position: relative;
    width: var(--logo-size);
    height: var(--logo-size);
    flex-shrink: 0;
  }
  .loading-logo::before,
  .loading-logo::after {
    content: '';
    position: absolute;
    width: calc(var(--logo-size) * 0.55);
    height: calc(var(--logo-size) * 0.55);
    border-radius: calc(var(--logo-size) * 0.14);
    border-width: 1.5px;
    border-style: solid;
  }
  .loading-logo::before {
    top: 0;
    left: 0;
    background: var(--answerlay-brand-soft);
    border-color: var(--answerlay-brand);
    animation: answerlay-logo-a 3.2s cubic-bezier(0.42, 0, 0.58, 1) infinite;
  }
  .loading-logo::after {
    bottom: 0;
    right: 0;
    background: var(--answerlay-accent-soft);
    border-color: var(--answerlay-accent);
    animation: answerlay-logo-b 3.2s cubic-bezier(0.42, 0, 0.58, 1) infinite;
  }
  @keyframes answerlay-logo-a {
    0%, 100% {
      transform: translate(0, 0) rotate(-6deg);
    }
    50% {
      transform: translate(4px, 4px) rotate(6deg);
    }
  }
  @keyframes answerlay-logo-b {
    0%, 100% {
      transform: translate(0, 0) rotate(6deg);
    }
    50% {
      transform: translate(-4px, -4px) rotate(-6deg);
    }
  }

  .loading-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    min-height: 48px;
  }
  .loading-headline {
    font-family: var(--answerlay-font-display);
    font-size: 20px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--answerlay-fg);
    font-variation-settings: 'opsz' 144, 'SOFT' 50;
    margin: 0;
    transition: opacity 250ms ease;
  }
  .loading-headline.is-swapping {
    opacity: 0;
  }
  .loading-subline {
    font-family: var(--answerlay-font-body);
    font-size: 13px;
    color: var(--answerlay-ink-3);
    margin: 0;
  }

  .loading-bar {
    width: min(220px, 100%);
    height: 3px;
    background: var(--answerlay-line);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }
  .loading-bar-fill {
    height: 100%;
    background: var(--answerlay-brand);
    border-radius: inherit;
    transition: width 350ms ease;
    width: 0%;
  }
  /* When we have no useful aggregate progress yet, run a slim
     indeterminate sweep so the bar feels alive. */
  .loading-bar.is-indeterminate .loading-bar-fill {
    width: 30%;
    animation: answerlay-bar-sweep 1.4s ease-in-out infinite;
  }
  @keyframes answerlay-bar-sweep {
    0% {
      transform: translateX(-110%);
    }
    100% {
      transform: translateX(370%);
    }
  }

  .loading-retry {
    margin-top: 4px;
    padding: 8px 18px;
    border-radius: 999px;
    border: 1px solid var(--answerlay-line-strong);
    background: var(--answerlay-surface);
    color: var(--answerlay-fg);
    font-family: var(--answerlay-font-body);
    font-size: 13px;
    font-weight: 500;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .loading-retry:hover {
    background: var(--answerlay-surface-2);
    border-color: var(--answerlay-ink-3);
  }

  /* ============================================================
     Error banner shown above the form when status === 'error'.
     ============================================================ */
  .error-banner {
    padding: 8px 14px;
    background: var(--answerlay-accent-soft);
    color: var(--answerlay-bad);
    font-size: 12px;
    border-top: 1px solid var(--answerlay-line);
  }

  /* ============================================================
     Preview-only mode toggle (Desktop / Mobile) in the header.
     ============================================================ */
  .mode-toggle {
    display: inline-flex;
    margin-left: auto;
    background: rgba(255, 255, 255, 0.16);
    border-radius: 999px;
    padding: 2px;
  }
  .mode-toggle button {
    font-family: var(--answerlay-font-mono);
    padding: 4px 10px;
    font-size: 11px;
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.7);
    background: transparent;
    transition: background 120ms ease, color 120ms ease;
    letter-spacing: 0.02em;
  }
  .mode-toggle button[aria-pressed='true'] {
    background: var(--answerlay-surface);
    color: var(--answerlay-fg);
  }
  .mode-toggle button:not([aria-pressed='true']):hover {
    color: var(--answerlay-surface);
  }

  /* ============================================================
     Markdown rendering inside assistant bubbles (typewriter slot).
     ============================================================ */
  .markdown :is(p, ul, ol, pre) {
    margin: 0 0 6px;
  }
  .markdown :is(p, ul, ol, pre):last-child {
    margin-bottom: 0;
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

  /* ============================================================
     Reduced motion — disable animations & transitions; keep
     progress-bar width updates (informative, not animated).
     ============================================================ */
  @media (prefers-reduced-motion: reduce) {
    .launcher,
    .launcher::before,
    .launcher svg,
    .status-dot,
    .typing span,
    .loading-logo::before,
    .loading-logo::after,
    .loading-bar.is-indeterminate .loading-bar-fill,
    .message,
    .panel,
    .loading-bar-fill,
    .loading-headline {
      animation: none;
      transition: none;
    }
  }
`
