import { css } from 'lit'

// Warm-editorial design tokens scoped to the element host. Customers can
// override any token by setting the same custom property on `answerlay-chat`
// from their page or via the config's `brandColor` field (see
// answerlay-chat.ts, where `brandColor` writes `--answerlay-brand`).
export const tokens = css`
  :host {
    /* Surfaces — warm paper */
    --answerlay-bg: #f7f3ea;
    --answerlay-surface: #fffefb;
    --answerlay-surface-2: #efe9db;
    --answerlay-surface-3: #e5decc;

    /* Ink — deep forest near-black */
    --answerlay-fg: #131c18;
    --answerlay-ink-2: #3d4843;
    --answerlay-ink-3: #6e7873;
    --answerlay-ink-4: #a19f92;

    /* Brand — deep emerald */
    --answerlay-brand: #18553d;
    --answerlay-brand-fg: #fffefb;
    --answerlay-brand-hover: color-mix(in srgb, var(--answerlay-brand) 85%, black);
    --answerlay-brand-soft: #d6e4d8;
    --answerlay-brand-line: #b5cdb7;

    /* Accent — terracotta */
    --answerlay-accent: #b8552e;
    --answerlay-accent-soft: #f0d7c5;

    /* Status dot — soft mint (visible against the brand header) */
    --answerlay-status-dot: #6fd5a8;

    /* Semantic */
    --answerlay-line: #ddd5c4;
    --answerlay-line-strong: #c9c0ab;
    --answerlay-good: #2e7d5a;
    --answerlay-warn: #b58a3a;
    --answerlay-bad: #a23e2a;

    /* Legacy aliases kept for back-compat with any host page that already
       sets these. They forward to the new tokens. */
    --answerlay-muted-bg: var(--answerlay-surface-2);
    --answerlay-muted-fg: var(--answerlay-ink-3);
    --answerlay-border: var(--answerlay-line);

    /* Radii */
    --answerlay-radius: 18px;
    --answerlay-radius-panel: 18px;
    --answerlay-radius-bubble: 14px;

    /* Shadows — warm and soft */
    --answerlay-shadow:
      0 12px 32px rgba(24, 85, 61, 0.18),
      0 4px 12px rgba(0, 0, 0, 0.06);
    --answerlay-shadow-launcher:
      0 12px 32px rgba(24, 85, 61, 0.32),
      0 4px 12px rgba(0, 0, 0, 0.08);
    --answerlay-shadow-panel:
      0 24px 60px rgba(19, 28, 24, 0.22),
      0 8px 20px rgba(19, 28, 24, 0.08);

    /* Type */
    --answerlay-font-display: 'Fraunces', 'Times New Roman', serif;
    --answerlay-font-body:
      'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial,
      sans-serif;
    --answerlay-font-mono: 'JetBrains Mono', ui-monospace, monospace;
    /* Back-compat alias (existing host pages may set --answerlay-font). */
    --answerlay-font: var(--answerlay-font-body);
    --answerlay-font-size: 14px;

    /* Layout */
    --answerlay-z-index: 2147483000;
    --answerlay-panel-width: 384px;
    --answerlay-panel-height: min(560px, 80vh);

    color-scheme: light;
  }
`
