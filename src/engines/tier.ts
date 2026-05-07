// Engine tiers used by the desktop capability probe. The widget always
// renders; the tier just decides how it answers.
//
// Tier A — Qwen3-0.6B on WebGPU (best, ~400 MB)
// Tier B — SmolLM2-360M wllama WASM (~270 MB)
// Tier C — SmolLM2-135M wllama WASM (~80 MB)
// Tier D — scenarios-only (no LLM, no download). Also the mobile path.

export type Tier = 'A' | 'B' | 'C' | 'D'

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
  C: 'SmolLM2-135M (WASM)',
  D: 'Scenarios',
}

export const TIER_APPROX_MB: Record<Tier, number> = {
  A: 400,
  B: 270,
  C: 80,
  D: 0,
}
