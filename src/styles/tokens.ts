import { css } from 'lit'

// Default design tokens scoped to the element host. Customers override by
// setting the same custom properties on `answerlay-chat` from their page.
export const tokens = css`
  :host {
    --answerlay-brand: #1d9e75;
    --answerlay-brand-fg: #ffffff;
    --answerlay-brand-hover: color-mix(in srgb, var(--answerlay-brand) 88%, black);
    --answerlay-bg: #ffffff;
    --answerlay-fg: #18181b;
    --answerlay-muted-bg: #f4f4f5;
    --answerlay-muted-fg: #52525b;
    --answerlay-border: #e4e4e7;
    --answerlay-radius: 12px;
    --answerlay-radius-bubble: 16px;
    --answerlay-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
    --answerlay-font:
      system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    --answerlay-font-size: 14px;
    --answerlay-z-index: 2147483000;
    --answerlay-panel-width: 380px;
    --answerlay-panel-height: min(560px, 80vh);

    color-scheme: light;
  }
`
