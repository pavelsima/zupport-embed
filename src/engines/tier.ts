// Engine tiers used by the desktop capability probe. The widget always
// renders; the tier just decides how it answers.
//
// Tier A — Qwen3-0.6B via transformers.js, picks WebGPU or WASM backend
//          inside the worker (~570 MB q4f16 / ~450 MB q4, thinking disabled, English-only).
// Tier B — DORMANT. SmolLM2-360M-Instruct via wllama WASM (~230 MB).
//          No longer auto-selected by the probe (v0.12). Kept for back-compat:
//          tierOverride='B' still routes here, and stepDownTier still considers
//          it on Tier A engine-init failure as a last-resort failover.
// Tier D — scenarios-only (no LLM, no download). Also the mobile path and
//           the fallback for low-RAM (<2 GB) devices.

export type Tier = 'A' | 'B' | 'D'

export type EngineMode = 'generation' | 'retrieval' | 'scenarios'

export type DowngradeReason =
  | 'no-webgpu'
  | 'low-memory'
  | 'mobile'
  | 'unsupported'
  | 'engine-init-failed'
  | null

export interface TierSelection {
  tier: Tier
  mode: 'mobile' | 'desktop'
  reason: DowngradeReason
  webgpu: boolean
  deviceMemoryGB: number | null
  hardwareConcurrency: number | null
}

export const TIER_LABELS: Record<Tier, string> = {
  A: 'Qwen3-0.6B (WebGPU)',
  B: 'SmolLM2-360M (WASM)',
  D: 'Scenarios',
}

export const TIER_APPROX_MB: Record<Tier, number> = {
  A: 570,
  B: 230,
  D: 0,
}
