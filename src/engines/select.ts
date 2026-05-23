import type { Tier, TierSelection } from './tier'

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
  tierOverride?: Tier | null
}

export const selectTier = async (opts: SelectOptions = {}): Promise<TierSelection> => {
  const nav = navigator as NavigatorWithMemory
  const deviceMemoryGB = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
  const hardwareConcurrency =
    typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null

  const detectedMobile = isMobile()
  const mode = opts.modeOverride ?? (detectedMobile ? 'mobile' : 'desktop')

  if (mode === 'mobile') {
    return {
      tier: opts.tierOverride ?? 'D',
      mode: 'mobile',
      reason: 'mobile',
      webgpu: false,
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  if (opts.tierOverride) {
    const webgpu = opts.tierOverride === 'A' ? await probeWebGPU() : false
    return {
      tier: opts.tierOverride,
      mode: 'desktop',
      reason: null,
      webgpu,
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  const webgpu = await probeWebGPU()
  const ram = deviceMemoryGB

  // Tier A handles both WebGPU and WASM internally — the worker picks the
  // backend (q4f16 on WebGPU, q4 on WASM). Any reasonable desktop with
  // ≥2 GB RAM lands on Tier A; the `reason: 'no-webgpu'` annotation lets
  // the UI surface the slower WASM path without dropping to a smaller
  // model. Tier B is kept in the Tier type and in the Engine routing for
  // back-compat (tierOverride='B' still works), but is no longer
  // auto-selected.
  if ((ram ?? 4) >= 2) {
    return {
      tier: 'A',
      mode: 'desktop',
      reason: webgpu ? null : 'no-webgpu',
      webgpu,
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  // Tier D — scenarios-only for low-RAM (<2 GB) devices.
  return {
    tier: 'D',
    mode: 'desktop',
    reason: 'low-memory',
    webgpu,
    deviceMemoryGB,
    hardwareConcurrency,
  }
}

// Step the tier down one rung. Used when an engine fails to init at runtime.
export const stepDownTier = (tier: Tier): Tier | null => {
  const order: Tier[] = ['A', 'B', 'D']
  const i = order.indexOf(tier)
  return i >= 0 && i < order.length - 1 ? order[i + 1]! : null
}
