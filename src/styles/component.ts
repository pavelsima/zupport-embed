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
    font-family: var(--answerlay-font);
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

  .launcher {
    pointer-events: auto;
    position: absolute;
    bottom: 16px;
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: var(--answerlay-brand);
    color: var(--answerlay-brand-fg);
    box-shadow: var(--answerlay-shadow);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease, background 0.15s ease;
    animation: answerlay-launcher-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .launcher:hover {
    background: var(--answerlay-brand-hover);
    transform: translateY(-1px) scale(1.04);
  }

  .launcher:active {
    transform: translateY(0) scale(0.96);
  }

  .launcher svg {
    transition: transform 0.2s ease;
  }

  :host([open]) .launcher svg {
    transform: rotate(90deg);
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

  @media (prefers-reduced-motion: reduce) {
    .launcher,
    .launcher svg {
      animation: none;
      transition: none;
    }
  }

  .launcher.position-right {
    right: 16px;
  }

  .launcher.position-left {
    left: 16px;
  }

  :host([data-preview]) .launcher {
    display: none;
  }

  .panel {
    pointer-events: auto;
    position: absolute;
    bottom: 84px;
    width: var(--answerlay-panel-width);
    max-width: calc(100vw - 32px);
    height: var(--answerlay-panel-height);
    background: var(--answerlay-bg);
    color: var(--answerlay-fg);
    border: 1px solid var(--answerlay-border);
    border-radius: var(--answerlay-radius);
    box-shadow: var(--answerlay-shadow);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform-origin: bottom right;
    animation: answerlay-panel-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .panel.position-left {
    transform-origin: bottom left;
  }

  @keyframes answerlay-panel-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }

  .panel.position-right {
    right: 16px;
  }

  .panel.position-left {
    left: 16px;
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

  .header {
    padding: 12px 14px;
    background: var(--answerlay-brand);
    color: var(--answerlay-brand-fg);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    flex: 1;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--answerlay-brand-fg);
    opacity: 0.85;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    opacity: 1;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .message {
    display: flex;
  }

  .message.user {
    justify-content: flex-end;
  }

  .message.assistant {
    justify-content: flex-start;
  }

  .bubble {
    max-width: 85%;
    padding: 8px 12px;
    border-radius: var(--answerlay-radius-bubble);
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }

  .message.user .bubble {
    background: var(--answerlay-brand);
    color: var(--answerlay-brand-fg);
    border-bottom-right-radius: 4px;
  }

  .message.assistant .bubble {
    background: var(--answerlay-muted-bg);
    color: var(--answerlay-fg);
    border-bottom-left-radius: 4px;
  }

  .message.assistant.error .bubble {
    border: 1px solid #ef4444;
  }

  .quick-replies {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .quick-reply {
    text-align: left;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--answerlay-border);
    background: var(--answerlay-bg);
    color: var(--answerlay-fg);
    transition: background 0.1s ease;
  }

  .quick-reply:hover {
    background: var(--answerlay-muted-bg);
  }

  .typing {
    display: inline-flex;
    gap: 3px;
    padding: 4px 0;
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
    0%, 80%, 100% {
      transform: scale(0.6);
      opacity: 0.4;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .typing span {
      animation: none;
    }
  }

  .loader {
    padding: 8px 12px;
    background: var(--answerlay-muted-bg);
    border-top: 1px solid var(--answerlay-border);
    font-size: 12px;
    color: var(--answerlay-muted-fg);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .loader-bar {
    flex: 1;
    height: 4px;
    background: var(--answerlay-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .loader-fill {
    height: 100%;
    background: var(--answerlay-brand);
    transition: width 0.2s ease;
  }

  .form {
    border-top: 1px solid var(--answerlay-border);
    padding: 8px;
    display: flex;
    gap: 8px;
    align-items: end;
  }

  textarea.input {
    flex: 1;
    resize: none;
    min-height: 36px;
    max-height: 120px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--answerlay-border);
    background: var(--answerlay-bg);
    color: var(--answerlay-fg);
    outline: none;
  }

  textarea.input:focus {
    border-color: var(--answerlay-brand);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--answerlay-brand) 30%, transparent);
  }

  .send {
    height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    background: var(--answerlay-brand);
    color: var(--answerlay-brand-fg);
    font-weight: 600;
    transition: background 0.1s ease;
  }

  .send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send:not(:disabled):hover {
    background: var(--answerlay-brand-hover);
  }

  .error-banner {
    padding: 8px 12px;
    background: #fee2e2;
    color: #991b1b;
    font-size: 12px;
    border-top: 1px solid #fecaca;
  }

  .mode-toggle {
    display: inline-flex;
    margin-left: auto;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    padding: 2px;
  }

  .mode-toggle button {
    padding: 4px 8px;
    font-size: 11px;
    border-radius: 4px;
    color: var(--answerlay-brand-fg);
    opacity: 0.85;
  }

  .mode-toggle button[aria-pressed='true'] {
    background: var(--answerlay-bg);
    color: var(--answerlay-fg);
    opacity: 1;
  }

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
    font-family: ui-monospace, SFMono-Regular, monospace;
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
