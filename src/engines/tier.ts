// Engine tiers used by the desktop capability probe. The widget always
// renders; the tier just decides how it answers.
//
// Tier A — Qwen3-0.6B on WebGPU (best, ~400 MB)
// Tier B — Qwen3-0.6B wllama WASM (~400 MB, 2 GB+ RAM)
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
  B: 'Qwen3-0.6B (WASM)',
  D: 'Scenarios',
}

export const TIER_APPROX_MB: Record<Tier, number> = {
  A: 400,
  B: 400,
  D: 0,
}
