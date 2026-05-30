import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Second vitest project — runs component-level tests in a real
// (headless) Chromium via @vitest/browser + Playwright. These cover the
// behaviors that don't survive a jsdom shim:
//   • focus management on the chat element (real activeElement)
//   • scroll-follow logic (real scrollTop / ResizeObserver / rAF)
//   • typewriter reveal timing
// Node-only unit tests (pure logic) still run via the default vitest.config.ts.

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    include: ['tests/browser/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      name: 'chromium',
    },
  },
})
