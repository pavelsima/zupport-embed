# @answerlay/embed

All notable changes to this project will be documented in this file. This file is managed by [changesets](https://github.com/changesets/changesets).

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
