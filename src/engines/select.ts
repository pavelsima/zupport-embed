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
  const cores = hardwareConcurrency

  // Tier A — WebGPU + sufficient RAM + ≥4 cores.
  if (webgpu && (ram ?? 8) >= 4 && (cores ?? 8) >= 4) {
    return {
      tier: 'A',
      mode: 'desktop',
      reason: null,
      webgpu: true,
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  // Tier B — at least 2 GB-ish, can handle SmolLM2-360M.
  if ((ram ?? 4) >= 2) {
    return {
      tier: 'B',
      mode: 'desktop',
      reason: webgpu ? 'low-memory' : 'no-webgpu',
      webgpu,
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  // Tier C — squeeze 135M GGUF onto low-RAM machines.
  if ((ram ?? 2) >= 1) {
    return {
      tier: 'C',
      mode: 'desktop',
      reason: 'low-memory',
      webgpu,
      deviceMemoryGB,
      hardwareConcurrency,
    }
  }

  // Tier D — scenarios-only, anything still works.
  return {
    tier: 'D',
    mode: 'desktop',
    reason: 'unsupported',
    webgpu,
    deviceMemoryGB,
    hardwareConcurrency,
  }
}

// Step the tier down one rung. Used when an engine fails to init at runtime.
export const stepDownTier = (tier: Tier): Tier | null => {
  const order: Tier[] = ['A', 'B', 'C', 'D']
  const i = order.indexOf(tier)
  return i >= 0 && i < order.length - 1 ? order[i + 1]! : null
}
