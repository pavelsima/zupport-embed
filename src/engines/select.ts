import type { EngineKind, RuntimeSelection } from './tier'

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
  gpu?: { requestAdapter: () => Promise<unknown> }
}

export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export const isAndroid = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

const isCoarsePointer = (): boolean => {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches
  }
  return 'ontouchstart' in window
}

export const isMobile = (): boolean => (isIOS() || isAndroid()) && isCoarsePointer()

const probeWebGPU = async (timeoutMs = 1500): Promise<boolean> => {
  const nav = navigator as NavigatorWithMemory
  if (!nav.gpu) return false
  try {
    const adapter = await Promise.race([
      nav.gpu.requestAdapter(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
    return !!adapter
  } catch {
    return false
  }
}

export interface SelectOptions {
  modeOverride?: 'mobile' | 'desktop' | null
  engineOverride?: EngineKind | null
}

export const selectRuntime = async (opts: SelectOptions = {}): Promise<RuntimeSelection> => {
  const nav = navigator as NavigatorWithMemory
  const deviceMemoryGB = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
  const hardwareConcurrency =
    typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null

  const detectedMobile = isMobile()
  const mode = opts.modeOverride ?? (detectedMobile ? 'mobile' : 'desktop')

  // Mobile is always scenarios-only — no LLM, no big download.
  if (mode === 'mobile') {
    return {
      mode: 'mobile',
      engine: 'scenarios',
      webgpu: false,
      reason: 'mobile',
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  // Explicit engine override (dashboard escape hatch).
  if (opts.engineOverride) {
    if (opts.engineOverride === 'scenarios') {
      return {
        mode: 'desktop',
        engine: 'scenarios',
        webgpu: false,
        reason: null,
        deviceMemoryGB,
        hardwareConcurrency,
      }
    }
    const webgpu = await probeWebGPU()
    return {
      mode: 'desktop',
      engine: 'llm',
      webgpu,
      reason: webgpu ? null : 'no-webgpu',
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  const webgpu = await probeWebGPU()
  const ram = deviceMemoryGB

  // The LLM worker picks the backend internally (q4f16 on WebGPU, q4 on
  // WASM). Any reasonable desktop with ≥2 GB RAM runs the LLM; the
  // `no-webgpu` annotation lets the UI surface the slower WASM path.
  if ((ram ?? 4) >= 2) {
    return {
      mode: 'desktop',
      engine: 'llm',
      webgpu,
      reason: webgpu ? null : 'no-webgpu',
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  // Low-RAM (<2 GB) desktop — scenarios-only.
  return {
    mode: 'desktop',
    engine: 'scenarios',
    webgpu,
    reason: 'low-memory',
    deviceMemoryGB,
    hardwareConcurrency,
  }
}
