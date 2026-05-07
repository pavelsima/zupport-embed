import { describe, expect, it } from 'vitest'
import { parseBool, parseMode, parseTier } from '../../src/core/attributes'

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

describe('parseTier', () => {
  it('accepts A/B/C/D', () => {
    for (const t of ['A', 'B', 'C', 'D']) {
      expect(parseTier(t)).toBe(t)
    }
  })
  it('returns null on garbage', () => {
    expect(parseTier('E')).toBeNull()
    expect(parseTier('a')).toBeNull()
    expect(parseTier(null)).toBeNull()
  })
})
