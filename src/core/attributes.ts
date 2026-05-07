import type { Tier } from '../engines/tier'

// Attribute → property reflection helpers. Lit handles attribute → property
// for declared reactive properties, but we keep the parsing here so the
// custom element accepts both kebab-case attributes (HTML markup) and
// camelCase properties (JS) consistently.

export const parseBool = (v: string | null): boolean => {
  if (v === null) return false
  if (v === '' || v === 'true' || v === '1') return true
  return false
}

export const parseMode = (v: string | null): 'mobile' | 'desktop' | null => {
  if (v === 'mobile' || v === 'desktop') return v
  return null
}

export const parseTier = (v: string | null): Tier | null => {
  if (v === 'A' || v === 'B' || v === 'C' || v === 'D') return v
  return null
}

export const deriveDefaultConfigUrl = (assistantId: string): string => {
  // No safe default — customers must always supply data-config-url so the
  // widget knows where to fetch their bot's published JSON. This is a
  // placeholder for self-host docs; we throw in config-loader if neither
  // configUrl nor inlineConfig is provided.
  return `/assistants/${encodeURIComponent(assistantId)}/config.json`
}
