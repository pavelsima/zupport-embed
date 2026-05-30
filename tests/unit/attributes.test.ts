import { describe, expect, it } from 'vitest'
import { parseBool, parseMode, parseEngine } from '../../src/core/attributes'

describe('parseBool', () => {
  it('treats null as false', () => {
    expect(parseBool(null)).toBe(false)
  })
  it('treats empty string as true (HTML boolean attribute)', () => {
    expect(parseBool('')).toBe(true)
  })
  it('treats "true" / "1" as true', () => {
    expect(parseBool('true')).toBe(true)
    expect(parseBool('1')).toBe(true)
  })
  it('treats other strings as false', () => {
    expect(parseBool('false')).toBe(false)
    expect(parseBool('0')).toBe(false)
    expect(parseBool('foo')).toBe(false)
  })
})

describe('parseMode', () => {
  it('accepts mobile and desktop', () => {
    expect(parseMode('mobile')).toBe('mobile')
    expect(parseMode('desktop')).toBe('desktop')
  })
  it('returns null on garbage', () => {
    expect(parseMode('foo')).toBeNull()
    expect(parseMode(null)).toBeNull()
  })
})

describe('parseEngine', () => {
  it('accepts llm and scenarios', () => {
    expect(parseEngine('llm')).toBe('llm')
    expect(parseEngine('scenarios')).toBe('scenarios')
  })
  it('returns null for legacy tiers and other garbage', () => {
    expect(parseEngine('A')).toBeNull()
    expect(parseEngine('D')).toBeNull()
    expect(parseEngine('LLM')).toBeNull()
    expect(parseEngine(null)).toBeNull()
  })
})
