import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FALLBACK_MESSAGE,
  resolveScenarioFallbackMessage,
} from '../../src/rag/scenarios-types'

describe('resolveScenarioFallbackMessage', () => {
  it('prefers config over scenarios.json', () => {
    expect(
      resolveScenarioFallbackMessage('From config', 'From scenarios'),
    ).toBe('From config')
  })

  it('falls back to scenarios.json when config is empty', () => {
    expect(resolveScenarioFallbackMessage('  ', 'From scenarios')).toBe('From scenarios')
    expect(resolveScenarioFallbackMessage(undefined, 'From scenarios')).toBe('From scenarios')
  })

  it('uses built-in default when both are empty', () => {
    expect(resolveScenarioFallbackMessage('', '')).toBe(DEFAULT_FALLBACK_MESSAGE)
    expect(resolveScenarioFallbackMessage()).toBe(DEFAULT_FALLBACK_MESSAGE)
  })

  it('trims whitespace from config and scenarios values', () => {
    expect(resolveScenarioFallbackMessage('  trimmed  ', 'other')).toBe('trimmed')
    expect(resolveScenarioFallbackMessage(undefined, '  scenarios  ')).toBe('scenarios')
  })
})
