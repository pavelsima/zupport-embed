# How embedding works

This is the architectural companion to the [README](../README.md) — it
explains the *why* behind the install snippet, the runtime data flow, and
how the same bundle is reused inside the Answerlay Nuxt app.

## The 30-second mental model

```
┌────────────────────────┐    classic <script src=…/embed.js>
│  Customer site         │ ─────────────────────────────────────►  GitHub Releases
│  (any origin, any FW)  │                                         (latest IIFE artefact)
│                        │
│  <answerlay-chat       │ ◄─── auto-registers <answerlay-chat> on script eval
│    data-assistant-id> │
│                        │
│  ┌──────────────────┐  │
│  │ Lit Web Component│  │ ─── boot() ──►  config.json   (Firebase Storage, public)
│  │  Shadow DOM      │  │             ──►  scenarios.json
│  │                  │  │             ──►  vectors.json (cached in IndexedDB)
│  │  ChatController  │  │             ──►  capability probe → tier A/B/C/D
│  └──────────────────┘  │             ──►  inlined Worker → transformers.js (jsDelivr)
│                        │                                  + model weights (HF Hub)
└────────────────────────┘
```

One classic `<script>` tag → one custom element → an entire chat runtime
that runs the LLM in-browser. No server-side proxy, no per-customer CDN
config.

## Why a classic IIFE bundle, not an ES module

The release artefact (`dist/embed.js`) is built as a **classic IIFE**:

```js
var Answerlay = (function (k) { "use strict";  /* Lit + components + workers */ })();
```

We did briefly ship it as ESM (`<script type="module">`), but loading
modules cross-origin from `github.com/.../releases/latest/download/embed.js`
fails: GitHub redirects asset downloads to `objects.githubusercontent.com`,
which doesn't return the CORS headers a *module* script (or worker)
requires. Classic scripts execute regardless of CORS state, so flipping
to IIFE makes the bundle a true drop-in include from any origin —
including straight off GitHub Releases, no CDN proxy in the middle.

Two consequences cascade from that choice:

- **`import.meta.url` doesn't exist in IIFE.** The two `new Worker(new
  URL('../workers/x.worker.ts', import.meta.url))` call sites had to go.
- **Workers can't be loaded as separate cross-origin chunks** for the same
  CORS reason. So both workers are inlined into the bundle as base64
  Blob URLs (Vite's `?worker&inline` suffix). When the chat instantiates
  a worker, it spins up from a same-origin `blob:` URL — no network fetch,
  no CORS check.

The lib build (`dist/index.js`, used if anyone imports
`@answerlay/embed` from npm into their own bundler) stays ESM — that path
runs through a downstream bundler that doesn't share these constraints.

See [vite.config.ts](../vite.config.ts) for the format split.

## How a customer page loads it

```html
<script src="https://github.com/pavelsima/Answerlay-embed/releases/latest/download/embed.js"></script>
<answerlay-chat data-assistant-id="YOUR_ASSISTANT_ID"></answerlay-chat>
```

Order of events on the host page:

1. Browser fetches `embed.js` as a classic script.
2. The IIFE runs. Lit's `@customElement('answerlay-chat')` decorator
   registers the tag with `customElements.define()`.
3. Whenever an `<answerlay-chat>` element exists in the DOM (now, or
   inserted later), `connectedCallback` runs and calls
   `ChatController.boot()` ([src/core/controller.ts](../src/core/controller.ts:110)).

To pin a version: swap `latest` for a tag, e.g. `releases/download/v0.1.0/embed.js`.

## Configuration loading

The host page only supplies an **assistant ID**. The embed turns that
into a URL using a fixed pattern in
[src/core/defaults.ts](../src/core/defaults.ts:29):

```
{configBaseUrl}/public%2Fassistants%2F{assistantId}%2Fconfig.json?alt=media
```

`configBaseUrl` defaults to `fincalc-prod.firebasestorage.app`'s public
v0 endpoint. Customers can override it via `data-config-base-url`
(different bucket) or skip the derivation entirely with a fully-qualified
`data-config-url`.

The fetched `config.json` is a **PublishedConfig** record — `assistantId`,
the runtime `AssistantConfig` (greeting, system prompt, etc.), plus
`scenariosPublicUrl` and `vectorsPublicUrl` pointing to the two siblings
that drive RAG/scenario matching. See
[src/public/types.ts](../src/public/types.ts) for the schema.

## Boot sequence

From [src/core/controller.ts](../src/core/controller.ts):

1. **`config-loading`** — fetch `config.json` (or use `inlineConfig` /
   `data-config-url` if supplied). Seed the greeting message.
2. **`probing`** — capability probe (WebGPU, WASM SIMD, RAM heuristic)
   picks one of:
   - **A** — Qwen3-0.6B on WebGPU (`QwenEngine`)
   - **B** — SmolLM2 via WASM (`WllamaEngine`)
   - **C** — same as B but reduced
   - **D** — scenarios-only fallback (`ScenariosEngine`)
3. **`scenarios-loading`** — fetch `scenarios.json` (used both as the
   short-circuit source for tiers A–C and the only answer source for D).
   Scenario matching is lexical (Fuse) — no embedder load on Tier D.
4. **`ready`** — UI usable. Engines and vectors load lazily on first send.

`data-tier-override` skips the probe; `data-mode-override` forces
mobile/desktop layout independently of the tier.

## Workers and models

Two web workers, both inlined into the bundle:

- **Embedder** ([src/workers/embedder.worker.ts](../src/workers/embedder.worker.ts))
  — `multilingual-e5-small` (q8 ONNX, WASM). Used **only for RAG
  retrieval** on tiers A/B/C: the user's query is embedded and matched
  against the pre-computed `vectors.json`. Tier D (mobile / iOS) does
  not load this model.
- **Qwen** ([src/workers/qwen.worker.ts](../src/workers/qwen.worker.ts)) —
  ONNX Qwen3-0.6B for tier A. Streams tokens back via `postMessage`.

Scenario short-circuit matching (intent recognition against
`scenarios.json`) is **lexical-only** — Fuse over `question` + `variants`,
no embedder load required. Old `scenarios.json` payloads that still ship
pre-computed `embeddings` / `embeddingModel` / `embeddingDim` fields are
silently ignored.

Both workers `import()` `transformers.js` from jsDelivr at runtime —
that ~25 MB ONNX Runtime payload would balloon the embed otherwise.
jsDelivr serves CORS headers, so the dynamic import works from a Blob URL
worker. Model weights themselves come from the Hugging Face Hub (or
`data-model-base-url` if self-hosted) and are cached in IndexedDB
across sessions.

## Reuse inside the Answerlay Nuxt app

The Answerlay dashboard renders the same chat in a "preview" tab so we
have a single source of truth:

```vue
<!-- Answerlay/app/pages/dashboard/assistants/[id]/chat.vue -->
<answerlay-chat
  data-preview
  :data-assistant-id="assistantId"
  :data-config-base-url="configBaseUrl"
/>
```

The Nuxt app loads the embed by **environment**:

- **Dev** — a Nuxt alias points `@answerlay/embed` at this repo's
  `src/embed.ts`. The page does `if (import.meta.dev) await
  import('@answerlay/embed')`. Vite resolves the source through its dev
  server, so editing embed source HMR-reloads the chat in the running
  Nuxt page. Both repos must be checked out side-by-side.
- **Prod** — `nuxt.config.ts` injects a head `<script src=…>` pointing
  at the same GitHub Releases URL the public install snippet uses. The
  Nuxt build ships **no embed code at all** — just the script tag.

```ts
// Answerlay/nuxt.config.ts (excerpt)
const EMBED_SCRIPT_URL =
  'https://github.com/pavelsima/Answerlay-embed/releases/latest/download/embed.js'

app: {
  head: {
    script: process.env.NODE_ENV === 'production'
      ? [{ src: EMBED_SCRIPT_URL, tagPosition: 'head' }]
      : [],
  },
},

vue: {
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('answerlay-'),
    },
  },
},
```

To upgrade the in-app chat, cut a new embed release — the Nuxt app picks
it up on the next page load (no Nuxt rebuild required).

## Release pipeline

`.github/workflows/release.yml` runs on every push to `main`:

1. Lint, typecheck, test, build, size budget.
2. Read `version` from `package.json`, tag `v{version}` if absent.
3. Upload `dist/embed.js` and `dist/embed.js.map` to a GitHub Release
   matching that tag.

Because the workflow short-circuits when the tag already exists, **bump
`package.json` version on every change you want consumers to receive.**
Otherwise the build runs but no new release artefacts are published.

## Privacy & network calls

The embed makes outbound calls to:

1. The configured `configUrl` (Firebase Storage, your project's bucket).
2. `cdn.jsdelivr.net` for `transformers.js` (workers only, on first use).
3. The Hugging Face Hub for model weights (or your `data-model-base-url`).
4. IndexedDB writes (local).

No telemetry, no third-party analytics, no cookies. The chat itself
never leaves the browser — generation runs against the in-browser LLM.
