import { describe, expect, it } from 'vitest'
import { requiredStagesForEngine } from '../../src/core/store'

// The stages the controller waits on before flipping `status: ready`
// depend on which engine the runtime picked. Mobile / low-memory desktop
// only needs the scenarios payload (lexical Fuse matching, no models);
// the desktop LLM additionally needs vectors + embedder + the LLM weights.

describe('requiredStagesForEngine', () => {
  it('engine="scenarios" needs only the scenarios stage', () => {
    expect(requiredStagesForEngine('scenarios')).toEqual(['scenarios'])
  })

  it('null engine (boot-time default before the probe runs) → scenarios stage only', () => {
    expect(requiredStagesForEngine(null)).toEqual(['scenarios'])
  })

  it('engine="llm" needs scenarios + vectors + embedder + llm, in that order', () => {
    expect(requiredStagesForEngine('llm')).toEqual([
      'scenarios',
      'vectors',
      'embedder',
      'llm',
    ])
  })
})
