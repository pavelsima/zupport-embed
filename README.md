# @answerlay/embed

Embeddable chat widget for [Answerlay](https://github.com/answerlay) — a Lit web component that renders an AI-powered support chat on your website. MIT licensed.

- **Mobile (phones / tablets):** instant scenario matching from a published `scenarios.json`. No LLM, no big download.
- **Desktop:** runs an in-browser LLM (Qwen3-0.6B on WebGPU, or SmolLM2 via WASM) over your knowledge-base vectors, with a scenario short-circuit that returns curated answers when confidence is high.
- **Tier auto-fallback:** capability probe picks the best engine for the device; falls back to scenarios-only on weak hardware. Always works.
- **Style-isolated:** Shadow DOM. No CSS leaks, customisable via CSS custom properties.

## Install

### CDN (recommended)

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@answerlay/embed@1/dist/embed.js"></script>
<answerlay-chat
  data-assistant-id="YOUR_ASSISTANT_ID"
  data-config-url="https://your-bucket.example.com/assistants/YOUR_ASSISTANT_ID/config.json"
></answerlay-chat>
```

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
| `data-config-url` | string | derived | Override URL (e.g. local dev, self-host) |
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
