import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../../src/core/config-loader'
import { DEFAULT_CONFIG } from '../../src/public/types'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const stubFetch = (response: { ok: boolean; status?: number; body?: unknown }) => {
  globalThis.fetch = vi.fn(async () =>
    ({
      ok: response.ok,
      status: response.status ?? 200,
      json: async () => response.body,
    }) as Response,
  )
}

describe('loadConfig', () => {
  it('returns inline config without a fetch', async () => {
    globalThis.fetch = vi.fn()
    const result = await loadConfig({
      assistantId: 'a',
      inlineConfig: { ...DEFAULT_CONFIG, name: 'Inline' },
    })
    expect(result.config.name).toBe('Inline')
    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('throws when neither configUrl nor inlineConfig is provided', async () => {
    await expect(loadConfig({ assistantId: 'a' })).rejects.toThrow()
  })

  it('throws on non-2xx HTTP', async () => {
    stubFetch({ ok: false, status: 404 })
    await expect(
      loadConfig({ assistantId: 'a', configUrl: 'https://x/config.json' }),
    ).rejects.toThrow('404')
  })

  it('throws on malformed schema', async () => {
    stubFetch({ ok: true, body: { schema: 99 } })
    await expect(
      loadConfig({ assistantId: 'a', configUrl: 'https://x/config.json' }),
    ).rejects.toThrow('schema:1')
  })

  it('applies defaults for missing config fields', async () => {
    stubFetch({
      ok: true,
      body: {
        schema: 1,
        assistantId: 'a',
        config: { name: 'Custom' },
        scenariosPublicUrl: null,
        vectorsPublicUrl: null,
        builtAt: '2026-01-01',
      },
    })
    const result = await loadConfig({
      assistantId: 'a',
      configUrl: 'https://x/config.json',
    })
    expect(result.config.name).toBe('Custom')
    expect(result.config.brandColor).toBe(DEFAULT_CONFIG.brandColor)
    expect(result.config.position).toBe(DEFAULT_CONFIG.position)
  })
})
