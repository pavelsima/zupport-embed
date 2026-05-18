# @answerlay/embed

All notable changes to this project will be documented in this file. This file is managed by [changesets](https://github.com/changesets/changesets).

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
