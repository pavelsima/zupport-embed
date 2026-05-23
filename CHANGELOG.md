# @answerlay/embed

All notable changes to this project will be documented in this file. This file is managed by [changesets](https://github.com/changesets/changesets).

## 0.12.0

Stop auto-selecting Tier B. One model (Qwen3-0.6B), one tier on desktop, WebGPU/WASM picked inside the worker.

- `selectTier()` no longer returns Tier B. Any desktop with ≥2 GB RAM now routes to Tier A regardless of WebGPU support; the worker decides at init time whether to use `q4f16` on WebGPU or `q4` on WASM. WebGPU-less desktops get a `reason: 'no-webgpu'` annotation so the UI can surface that they're on the slower path, but they still get Qwen3-0.6B quality instead of being downgraded to a smaller model.
- Removed the prior Tier A gating (`webgpu && RAM≥4 && cores≥4`) — the threshold is now just RAM≥2. Below that, still Tier D (scenarios-only).
- Tier B kept **dormant** in the type system and engine routing: `tierOverride='B'` from URL/attribute still works, and `stepDownTier` still considers it as a last-resort failover if Tier A's engine init fails. The wllama engine and `@wllama/wllama` dependency remain in place. Future cleanup (delete wllama, drop the dep, simplify `Tier` to `'A' | 'D'`) is a separate refactor.
- `TIER_APPROX_MB.A` updated `450` → `570` to match observed q4f16 download size.
- **UX caveat:** WebGPU-less desktops now download ~570 MB (instead of Tier B's ~230 MB) and generate at maybe ~5-8 tok/s instead of wllama's ~20 tok/s. Quality is materially better; speed and bandwidth are worse. Accepted as a deliberate trade.

## 0.11.0

Tier A switched to Qwen3-0.6B (~450 MB). Quality of a 1.7B-class model at a third of the download.

- 1.0 GB SmolLM2-1.7B was too large; SmolLM2-360M too weak. Qwen3-0.6B at q4f16 lands in the ~450 MB sweet spot and is significantly stronger than SmolLM2-360M on grounded RAG (Qwen3 model card benchmarks).
- Qwen3's "thinking mode" is **disabled** via `enable_thinking: false` in `apply_chat_template`. Reasoning prefixes (`<think>...</think>`) would waste tokens for support-style replies. As a safety net the worker still strips any residual `<think>...</think>` (and unterminated trailing `<think>`) spans from the final output before posting `done`.
- Generation params updated to Qwen3's non-thinking defaults: `temperature 0.3` (lowered from HF's 0.7 because grounded RAG benefits from CONTEXT adherence), `top_p 0.8`, `top_k 20`, `repetition_penalty 1.0`. SmolLM2-era anti-loop bumps no longer needed.
- `TIER_LABELS.A` → `'Qwen3-0.6B (WebGPU)'`; `TIER_APPROX_MB.A` → `450`. Tier B remains SmolLM2-360M via wllama (different model family on the WASM path is fine — Tier B is a no-WebGPU fallback, not a quality-equivalent mirror).
- **Known minor risk:** streaming may briefly flash a `<think>` artifact before the final-output strip catches it. With `enable_thinking: false` this should not happen in practice; if it does, a per-token filter can be added.

## 0.10.0

Tier A upgraded to SmolLM2-**1.7B**-Instruct. Quality > download size.

- After exhaustive tuning of SmolLM2-360M on Tier A (v0.9.5–v0.9.8 worked through sampling params, prompt structure, escape stripping, topK and maxTokens caps), the 360M model still hallucinated facts and rambled on basic RAG questions. The honest conclusion: 360M is too small to follow grounded-RAG instructions reliably. Tier A now ships `HuggingFaceTB/SmolLM2-1.7B-Instruct` at `dtype: 'q4f16'` (~1.0 GB download). Tier B stays on SmolLM2-360M via wllama WASM for the no-WebGPU fallback.
- Download size is back to ~1 GB — the project decided to handle this with UI-side messaging/progress instead of model-size compromises.
- Caps from v0.9.8 reverted: `topK` default `5` (no Math.min ceiling), `maxTokens` default `256`. 1.7B handles longer contexts and longer answers reliably.
- `repetition_penalty` reduced `1.1` → `1.05`. The aggressive anti-loop value was a 360M-era band-aid; 1.7B doesn't degenerate at the tail.
- Prompt loosened from "3-4 short sentences" to "concisely — aim for 2-5 short sentences and stop when the question is answered." The bigger model self-regulates length better.
- `TIER_LABELS.A` → `'SmolLM2-1.7B (WebGPU)'`; `TIER_APPROX_MB.A` → `1000`.

## 0.9.8

Hard caps on topK and maxTokens — published configs can no longer push past the SmolLM2-360M sweet spot.

- `topK` is now `Math.min(config.topK ?? 3, 3)`. Previously v0.9.7's `?? 3` only lowered the default; a published config with `topK: 5` would still pull 5 chunks (and was, per the latest prompt log). The hard cap means clients always send at most 3 chunks to the model regardless of dashboard config, because SmolLM2-360M's effective attention falls off past ~1.5k chars of CONTEXT and extra chunks hurt more than they help.
- `maxTokens` hard-capped at `Math.min(config.maxTokens ?? 120, 160)`. Default fallback lowered `160` → `120` to force shorter, less rambly answers; the upper cap of `160` prevents any future config from re-enabling the original 256-token rambling regime.
- These caps are model-size choices, not policy. If a future Tier A model swap reintroduces a stronger LLM, raise both caps in `controller.ts` and remove the `Math.min` ceiling.

## 0.9.7

Tighter answer length, lower topK, harder anti-loop penalty.

- Prompt updated from "1-2 short sentences" to "3-4 short sentences" with explicit `Stop when the question is answered — do not pad` and `Do not repeat the same sentence` directives. After v0.9.6's escape fix SmolLM2 produces coherent answers but kept padding toward the max-token limit (last sentences degenerate into "The data key is also stored... The data key").
- `topK` default lowered `5` → `3` in `controller.ts`. Earlier prompt log showed unrelated chunks (TanStack Query) leaking into Cache Invalidation answers; trimming to top-3 cuts noise and shrinks the prompt by ~40 %, leaving SmolLM2 more effective attention budget. User-set `topK` in published config still wins.
- `repetition_penalty` bumped `1.05` → `1.1` to break the late-generation "X ... X ... X" loops without hurting accurate reuse of CONTEXT strings (1.15 in v0.9.3 was too aggressive; 1.1 is the SmolLM2 sweet spot for RAG).

## 0.9.6

Strip Markdown backslash-escapes from RAG chunks before they hit the LLM.

- Discovered via the v0.9.5 prompt log: chunks stored in `vectors.json` arrive pre-escaped for Markdown rendering — `5\.2`, `\(`, `Cache\_TTL`, etc. SmolLM2-360M cannot see through the escaping; it reads garbled tokens and falls back to generic "I'd be happy to help but..." replies instead of answering from CONTEXT.
- `buildSystemPrompt()` now runs each chunk heading and text through an `unescapeMarkdown()` pass that removes `\` only when followed by a known Markdown special (`` \`*_{}[]()#+-.!|>~ ``). Leaves real `\n`/`\t` escapes in code untouched.
- **Upstream fix needed:** the dashboard publish pipeline should store raw chunk text in `vectors.json` and escape only at render time. The embed-side strip is a defence-in-depth shim; future Markdown specials added by the dashboard will need the regex updated here too.

## 0.9.5

Tune generation params for SmolLM2; conversational system prompt; full-prompt logging.

- v0.9.4's numbered-rules prompt backfired: SmolLM2-360M started narrating *about* the rules ("I can provide some additional details", "if there was any confusion regarding what I said earlier") instead of answering from CONTEXT. Replaced with a single short directive: "You are <shop>'s customer support assistant. Use the information below to answer the customer's question in 1-2 short sentences..." — conversational, one paragraph, no `Rules:` header.
- Generation params changed to SmolLM2's officially recommended values per the HF model card: `temperature: 0.2` (was 0.7), `repetition_penalty: 1.05` (was 1.15). `top_p: 0.9` and `do_sample: true` retained. Low temperature anchors the model to CONTEXT instead of free-associating; the gentler repetition penalty allows accurate reuse of exact strings from the information block.
- Added `[answerlay] llm.worker: prompt sent to model` console log of the fully rendered chat-template string immediately before generation. Pairs with the existing chunk-summary log so you can see both what was retrieved and how it was framed for the model.

## 0.9.4

Stronger support-assistant persona + shorter, less rambly answers.

- Rewrote `buildSystemPrompt()` in `src/engines/prompt.ts` for sub-1B models. New prompt opens with a friendly customer-support persona, then four numbered rules: 1–3 sentences, no bullet lists, no narration, no hallucinated facts, fall through to "contact human support" when CONTEXT is empty. SmolLM2-360M follows numbered rules and explicit length caps far more reliably than paragraph instructions.
- Default `maxTokens` lowered from `256` → `160` in both `controller.ts` and `llm.worker.ts`. Users who set `maxTokens` in their published config keep their value; only the fallback changed. Combined with the rule "Reply in 1-3 short sentences" this stops the model from filling a 256-token budget with garbage when it has a 60-token answer.
- Removed the duplicated system prompt from `llm.worker.ts` — the worker now imports `buildSystemPrompt` from `../engines/prompt`, so Tier A (ONNX) and Tier B (wllama) cannot drift apart again. Bundle size unchanged (the function inlines).

## 0.9.3

Greeting bubble: 24h cooldown instead of one-shot-per-tab.

- The bubble was latched to "already shown" the moment it first appeared, via a sessionStorage flag written at show-time. Effect: after any single appearance, every subsequent page load in the same tab silently suppressed the bubble (and many tests in the dashboard never saw it again). Now the latch fires at hide-time (auto-hide completion or × dismiss) and uses a 24-hour cooldown stored in `localStorage` instead of a permanent sessionStorage flag.
- Storage key renamed `answerlay:greeting-bubble-dismissed:<id>` → `answerlay:greeting-bubble-last-shown:<id>` (stores `Date.now()`). Old sessionStorage entries are simply ignored after upgrade.
- The pure `shouldShowGreetingBubble()` decision in `src/core/greeting-bubble.ts` is unchanged; only the storage-layer wiring in `src/elements/answerlay-chat.ts` moved.

## 0.9.2

Tier A switched from Qwen2.5-0.5B to SmolLM2-360M (same model as Tier B, just on WebGPU).

- Qwen2.5-0.5B at q4f16 produced incoherent output on Tier A (word salad, repeated fragments) even after 0.9.1's sampling+repetition_penalty fix. The q4f16 quantization is too aggressive for the 0.5B body. Switched Tier A's LLM to `HuggingFaceTB/SmolLM2-360M-Instruct`, the same model Tier B already runs successfully under wllama WASM. Download drops from ~480 MB observed (Qwen) to ~230 MB.
- `TIER_LABELS.A` is now `SmolLM2-360M (WebGPU)`; `TIER_APPROX_MB.A` is `230`. Tier A and Tier B now share a model — Tier A just runs it on WebGPU for speed.
- Added a `[answerlay] llm.worker: rag chunks` console log right before each generation, listing retrieved chunk headings and text lengths. Helps diagnose whether bad answers are RAG retrieval problems or generation problems.
- Sampling params from 0.9.1 (`temperature: 0.7`, `top_p: 0.9`, `repetition_penalty: 1.15`) are retained — harmless for SmolLM2 and provide a safety net.

## 0.9.1

Fix Qwen2.5-0.5B degenerate output on Tier A.

- Tier A generation switched from greedy (`do_sample: false`) to sampling with `temperature: 0.7`, `top_p: 0.9`, and `repetition_penalty: 1.15`. Greedy decoding caused Qwen2.5-0.5B to collapse into loops (e.g. `"The - The - The..."`) or echo the user's question back. Llama-3.2-1B was large enough to stay coherent under greedy; Qwen2.5-0.5B is not.

## 0.9.0

Smaller Tier A download: swap Llama-3.2-1B for Qwen2.5-0.5B.

- Tier A LLM changed from `onnx-community/Llama-3.2-1B-Instruct` to `onnx-community/Qwen2.5-0.5B-Instruct`. WebGPU download drops from ~700 MB to ~350 MB (`dtype: 'q4f16'`), shrinking first-load time roughly 2× on average connections. Tier B (SmolLM2-360M via wllama WASM) is unchanged.
- `TIER_LABELS.A` is now `Qwen2.5-0.5B (WebGPU)`; `TIER_APPROX_MB.A` is `350`.
- Qwen2.5 uses standard ChatML; the existing `apply_chat_template` path is unchanged. No `<think>` handling needed (that's Qwen3-only).
- Expect a small quality drop vs. Llama-3.2-1B on edge-case RAG questions; baseline grounded answering remains solid for shop-support use cases.

## 0.7.0

Lexical-only scenario matching; embedder retained for RAG only.

- Scenario short-circuit (intent recognition) is now **lexical-only** (Fuse over `question` + `variants`) on every tier — the multilingual-e5-small embedder is no longer used for intent matching. Variants act as authored synonyms; thresholds and recall behaviour for `lexicalMatch` are unchanged.
- Tier D (mobile / iOS) now loads **zero models** for the chat itself. The embedder stage is marked `skipped` at boot, and the warm-on-launcher-tap path was removed. This unblocks iOS Safari, which struggled to load the ~118 MB q8 ONNX.
- `multilingual-e5-small` stays as the RAG query embedder on tiers A/B/C — only loaded when the LLM path runs.
- `STAGE_LABELS.embedder` relabeled to `Loading retrieval model` (it now exclusively serves RAG).
- `requiredStagesForTier('D')` reduced to `['scenarios']`.
- **Breaking (package consumers only):** the named exports `embeddingMatch`, `mergeSuggestions`, `cosine`, and `EMBEDDING_CONFIDENT` are removed from `src/index.ts`. `lexicalMatch` and `LEXICAL_CONFIDENT` remain. `ScenariosEngine` constructor no longer accepts an `embed` callback or `matchThreshold`. `shortCircuit()` no longer accepts `embed`, `embeddingModel`, or `matchThreshold`.
- Legacy fields kept for back-compat: `scenarios.json` may still ship `embeddings` / `embeddingModel` / `embeddingDim`, and `AssistantConfig.scenarioMatchThreshold` is still accepted — all silently ignored.

## 0.6.0

Opt-in greeting bubble above the launcher.

- New optional `AssistantConfig.showGreetingBubble` boolean (default: off). When enabled, the widget pops a small bubble with the greeting text above the launcher icon.
- Desktop: bubble appears the moment every model stage flips to `ready`/`skipped`. Mobile (tier D): bubble appears 5 s after `config.json` loads, since loading is deferred until the visitor opens the chat.
- Bubble auto-hides after 8 s; visitors can dismiss it with the × button; clicking the launcher also hides it. Once shown in a tab session, it does not reappear (sessionStorage per `assistantId`).
- New pure helper `shouldShowGreetingBubble()` in `src/core/greeting-bubble.ts` encodes the trigger truth table (covered by 11 unit tests).

## 0.5.0

Warm-editorial visual refactor and parallel load orchestration.

- Visual redesign aligned with the new Answerlay design system (cream surfaces, deep emerald brand, terracotta accent, Fraunces display + DM Sans body served from Google Fonts).
- New stages state machine. Boot now dispatches config, scenarios, vectors, embedder, and LLM in parallel; each transition is logged to `console.info` for developers.
- Minimalist loading panel: animated two-square logo, single rotating friendly status line (no technical stage names), aggregate progress bar.
- Embedder pre-warms on launch (desktop) or on first launcher tap (mobile tier D); progress is forwarded from the worker.
- Mobile devices get a fullscreen panel with body scroll lock and `100dvh` sizing.
- New optional config fields: `launcherTooltip`, `statusLabel`, `hideCredit`. All schema 1, backwards-compatible.
- Per-message `createdAt` plus a friendly relative-time label under assistant bubbles.
- Quick replies render as horizontal pills with brand-emerald copy.
- Send button is now a 40×40 rounded square; input is a pill with brand focus ring.
- Preview-only meta lines (`Matched scenario`, `AI from your docs`, `No match · fallback`) — hidden on live.
- Public event payloads (`answerlay-ready`, `answerlay-message`, `answerlay-error`, `answerlay-tier-change`) unchanged.
- Fix: `refresh({ clearMessages: true })` no longer appends a duplicate greeting on top of the existing thread.
- Fix: clicking the preview Desktop/Mobile toggle no longer hides itself after the first switch.
