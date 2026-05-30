import { afterEach, describe, expect, it } from 'vitest'
import { isAndroid, isIOS, isMobile, selectRuntime } from '../../src/engines/select'

// Pure-logic tests for the runtime probe. Node has a built-in `navigator`
// global since v21 (a minimal one), so we override it with our own stub
// for each scenario and restore it afterwards. Same for `window` (needed
// for `matchMedia(pointer: coarse)`).

const orig = {
  navigator: globalThis.navigator,
  window: (globalThis as { window?: unknown }).window,
}

const setGlobal = (key: 'navigator' | 'window', value: unknown): void => {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  setGlobal('navigator', orig.navigator)
  setGlobal('window', orig.window)
})

interface NavStubOpts {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  deviceMemory?: number
  hardwareConcurrency?: number
  gpu?: { requestAdapter: () => Promise<unknown> } | undefined
}

const stubNavigator = (opts: NavStubOpts = {}): void => {
  setGlobal('navigator', {
    userAgent: opts.userAgent ?? 'Mozilla/5.0 (Macintosh)',
    platform: opts.platform ?? 'MacIntel',
    maxTouchPoints: opts.maxTouchPoints ?? 0,
    deviceMemory: opts.deviceMemory,
    hardwareConcurrency: opts.hardwareConcurrency ?? 8,
    gpu: opts.gpu,
  })
}

const stubWindowCoarsePointer = (coarse: boolean): void => {
  setGlobal('window', {
    matchMedia: (q: string) => ({
      matches: q.includes('coarse') ? coarse : false,
    }),
  })
}

const gpuAdapterStub = (resolves: unknown = { name: 'mock-adapter' }) => ({
  requestAdapter: () => Promise.resolve(resolves),
})

describe('selectRuntime', () => {
  it('detected-mobile → scenarios engine with reason "mobile"', async () => {
    stubNavigator({
      userAgent: 'Mozilla/5.0 (iPhone)',
      platform: 'iPhone',
      maxTouchPoints: 5,
      deviceMemory: 4,
    })
    stubWindowCoarsePointer(true)
    const r = await selectRuntime()
    expect(r.mode).toBe('mobile')
    expect(r.engine).toBe('scenarios')
    expect(r.webgpu).toBe(false)
    expect(r.reason).toBe('mobile')
  })

  it('desktop + webgpu adapter → llm + reason null', async () => {
    stubNavigator({ deviceMemory: 8, gpu: gpuAdapterStub() })
    stubWindowCoarsePointer(false)
    const r = await selectRuntime()
    expect(r.mode).toBe('desktop')
    expect(r.engine).toBe('llm')
    expect(r.webgpu).toBe(true)
    expect(r.reason).toBeNull()
  })

  it('desktop without webgpu (no navigator.gpu) → llm + reason "no-webgpu"', async () => {
    stubNavigator({ deviceMemory: 8 })
    stubWindowCoarsePointer(false)
    const r = await selectRuntime()
    expect(r.engine).toBe('llm')
    expect(r.webgpu).toBe(false)
    expect(r.reason).toBe('no-webgpu')
  })

  it('low-memory desktop (deviceMemory < 2 GB) → scenarios + reason "low-memory"', async () => {
    stubNavigator({ deviceMemory: 1 })
    stubWindowCoarsePointer(false)
    const r = await selectRuntime()
    expect(r.mode).toBe('desktop')
    expect(r.engine).toBe('scenarios')
    expect(r.reason).toBe('low-memory')
  })

  it('absent deviceMemory → treated as capable (defaults to llm)', async () => {
    stubNavigator({}) // deviceMemory undefined
    stubWindowCoarsePointer(false)
    const r = await selectRuntime()
    expect(r.engine).toBe('llm')
    expect(r.deviceMemoryGB).toBeNull()
  })

  it('engineOverride="scenarios" on capable desktop → scenarios + reason null', async () => {
    stubNavigator({ deviceMemory: 8, gpu: gpuAdapterStub() })
    stubWindowCoarsePointer(false)
    const r = await selectRuntime({ engineOverride: 'scenarios' })
    expect(r.engine).toBe('scenarios')
    expect(r.webgpu).toBe(false)
    expect(r.reason).toBeNull()
  })

  it('engineOverride="llm" on low-memory desktop → llm anyway (override beats RAM check)', async () => {
    stubNavigator({ deviceMemory: 1 }) // would normally go to scenarios
    stubWindowCoarsePointer(false)
    const r = await selectRuntime({ engineOverride: 'llm' })
    expect(r.engine).toBe('llm')
    expect(r.webgpu).toBe(false)
    expect(r.reason).toBe('no-webgpu')
  })

  it('modeOverride="mobile" beats engineOverride="llm" (mobile is always scenarios)', async () => {
    stubNavigator({ deviceMemory: 8, gpu: gpuAdapterStub() })
    stubWindowCoarsePointer(false)
    const r = await selectRuntime({ modeOverride: 'mobile', engineOverride: 'llm' })
    expect(r.mode).toBe('mobile')
    expect(r.engine).toBe('scenarios')
    expect(r.reason).toBe('mobile')
  })

  it('modeOverride="desktop" forces desktop even when UA + coarse pointer say mobile', async () => {
    stubNavigator({
      userAgent: 'Mozilla/5.0 (iPhone)',
      maxTouchPoints: 5,
      deviceMemory: 4,
      gpu: gpuAdapterStub(),
    })
    stubWindowCoarsePointer(true)
    const r = await selectRuntime({ modeOverride: 'desktop' })
    expect(r.mode).toBe('desktop')
    expect(r.engine).toBe('llm')
  })

  it('webgpu probe that rejects → treated as no adapter', async () => {
    stubNavigator({
      deviceMemory: 4,
      gpu: { requestAdapter: () => Promise.reject(new Error('denied')) },
    })
    stubWindowCoarsePointer(false)
    const r = await selectRuntime()
    expect(r.webgpu).toBe(false)
    expect(r.engine).toBe('llm')
    expect(r.reason).toBe('no-webgpu')
  })

  it('webgpu probe that returns null adapter → no webgpu', async () => {
    stubNavigator({ deviceMemory: 4, gpu: gpuAdapterStub(null) })
    stubWindowCoarsePointer(false)
    const r = await selectRuntime()
    expect(r.webgpu).toBe(false)
    expect(r.reason).toBe('no-webgpu')
  })

  it('engineOverride="scenarios" works on mobile too (just confirms mobile path)', async () => {
    stubNavigator({
      userAgent: 'Mozilla/5.0 (Android)',
      deviceMemory: 4,
    })
    stubWindowCoarsePointer(true)
    const r = await selectRuntime({ engineOverride: 'scenarios' })
    expect(r.mode).toBe('mobile')
    expect(r.engine).toBe('scenarios')
  })

  it('carries deviceMemoryGB + hardwareConcurrency through unchanged', async () => {
    stubNavigator({ deviceMemory: 6, hardwareConcurrency: 12, gpu: gpuAdapterStub() })
    stubWindowCoarsePointer(false)
    const r = await selectRuntime()
    expect(r.deviceMemoryGB).toBe(6)
    expect(r.hardwareConcurrency).toBe(12)
  })
})

describe('isIOS / isAndroid / isMobile', () => {
  it('detects iPhone UA as iOS', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0 (iPhone)' })
    expect(isIOS()).toBe(true)
  })

  it('detects iPadOS-style (MacIntel + touch points > 1) as iOS', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 5 })
    expect(isIOS()).toBe(true)
  })

  it('plain macOS desktop is NOT iOS', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 0 })
    expect(isIOS()).toBe(false)
  })

  it('detects Android UA', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' })
    expect(isAndroid()).toBe(true)
  })

  it('isMobile requires BOTH mobile UA and coarse pointer', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0 (iPhone)' })
    stubWindowCoarsePointer(false)
    expect(isMobile()).toBe(false)
    stubWindowCoarsePointer(true)
    expect(isMobile()).toBe(true)
  })

  it('isMobile false on desktop UA even with coarse pointer (rare touch monitor)', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0 (Macintosh)', maxTouchPoints: 0 })
    stubWindowCoarsePointer(true)
    expect(isMobile()).toBe(false)
  })
})
