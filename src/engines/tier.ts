// Engine tiers used by the desktop capability probe. The widget always
// renders; the tier just decides how it answers.
//
// Tier A — SmolLM2-1.7B-Instruct on WebGPU via transformers.js (~1.0 GB, English-only)
// Tier B — SmolLM2-360M-Instruct wllama WASM (~230 MB, 2 GB+ RAM, English-only)
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
  A: 'SmolLM2-1.7B (WebGPU)',
  B: 'SmolLM2-360M (WASM)',
  D: 'Scenarios',
}

export const TIER_APPROX_MB: Record<Tier, number> = {
  A: 1000,
  B: 230,
  D: 0,
}
