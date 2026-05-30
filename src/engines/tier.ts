// Runtime selection model. The widget always renders; this decides how it
// answers: an in-browser LLM on capable desktops, or scenarios-only on
// mobile / low-memory devices. WebGPU-vs-WASM is an internal LLM backend
// detail chosen inside the worker — not user-facing.

export type RuntimeMode = 'desktop' | 'mobile'

export type EngineKind = 'llm' | 'scenarios'

export type DowngradeReason =
  | 'no-webgpu'
  | 'low-memory'
  | 'mobile'
  | 'engine-init-failed'
  | null

export interface RuntimeSelection {
  mode: RuntimeMode
  engine: EngineKind
  // Internal LLM backend hint: true → q4f16 on WebGPU, false → q4 on WASM.
  // Always false when engine is 'scenarios'.
  webgpu: boolean
  reason: DowngradeReason
  deviceMemoryGB: number | null
  hardwareConcurrency: number | null
}

// Approximate download size (MB) of the desktop LLM (Qwen3-0.6B, q4f16 on
// WebGPU / q4 on WASM). Used for the download progress + ETA tooltip.
export const LLM_APPROX_MB = 570
export const LLM_LABEL = 'Qwen3-0.6B'
