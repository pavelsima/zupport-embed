# @answerlay/embed

Embeddable chat widget for [Answerlay](https://github.com/answerlay) — a Lit web component that renders an AI-powered support chat on your website. MIT licensed.

- **Mobile (phones / tablets):** instant scenario matching from a published `scenarios.json`. No LLM, no big download.
- **Desktop:** runs an in-browser LLM (SmolLM2-1.7B on WebGPU, SmolLM2-360M via WASM) over your knowledge-base vectors, with a scenario short-circuit that returns curated answers when confidence is high. English-only.
- **Tier auto-fallback:** capability probe picks the best engine for the device; falls back to scenarios-only on weak hardware. Always works.
- **Style-isolated:** Shadow DOM. No CSS leaks, customisable via CSS custom properties.

## Install

### Drop-in `<script>` (recommended)

```html
<script
  src="https://github.com/pavelsima/Answerlay-embed/releases/latest/download/embed.js"
  data-assistant-id="YOUR_ASSISTANT_ID"
  defer
></script>
```

That's it — the script auto-injects the floating launcher button in the page corner. The bundle is a self-contained classic IIFE: no `type="module"`, no separate worker chunks, no CORS gymnastics on the host page. The widget derives the config URL from your assistant ID using the default Firebase Storage bucket. Override the bucket with `data-config-base-url`, or pass a fully custom URL via `data-config-url`. All `data-*` attributes documented below can be placed on the `<script>` tag.

To pin a specific version, swap `latest` for a tag — e.g. `releases/download/v0.2.0/embed.js`.

### npm

```sh
npm i @answerlay/embed
```

```ts
// Auto-registers <answerlay-chat>
import '@answerlay/embed/embed'
```

## Attributes

| Attribute | Type | Default | Purpose |
| --- | --- | --- | --- |
| `data-assistant-id` | string | required | Identifier used to derive the default config URL |
| `data-config-base-url` | string | bundled bucket | Override the Firebase Storage bucket base URL |
| `data-config-url` | string | derived | Fully custom URL (skips the assistant-id derivation) |
| `data-mode-override` | `mobile \| desktop` | auto | Skip auto-detection |
| `data-tier-override` | `A \| B \| C \| D` | auto | Force engine tier |
| `data-preview` | boolean | `false` | Enable in-app preview UI (mode toggle) |
| `data-disable-cache` | boolean | `false` | Bypass IndexedDB |
| `data-model-base-url` | string | Hugging Face | Self-host model weights |

## Customisation

Set CSS custom properties on the host element:

```css
answerlay-chat {
  --answerlay-brand: #6f42c1;
  --answerlay-radius: 12px;
  --answerlay-z-index: 9999;
  --answerlay-font: 'Inter', system-ui, sans-serif;
}
```

## Browser support

- Chrome/Edge 113+ (Tier A — WebGPU)
- Safari 17+ macOS (Tier B — WASM)
- Safari iOS 17+ (mobile / Tier D — scenarios)
- Firefox 130+ (Tier B — WASM)
- Android Chrome (mobile / Tier D)

## Privacy

The widget makes outbound network calls only to:

1. The `data-config-url` you supply (your own server).
2. Hugging Face CDN, on first model use (cached in IndexedDB).
3. IndexedDB writes (local only).

No telemetry. No third-party analytics. No cookies.

## Development

```sh
npm install
npm run dev          # vite dev server with examples
npm run build        # builds dist/embed.js + dist/index.js
npm run test         # vitest
npm run typecheck
npm run size         # bundle size budget
```

## License

[MIT](LICENSE) © Answerlay contributors
