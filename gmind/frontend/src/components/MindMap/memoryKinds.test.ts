import { describe, it, expect } from 'vitest'
import { MEMORY_KINDS, KARP_LAYERS, kindDef, kindColor, normalizeKind } from './memoryKinds'

describe('memoryKinds', () => {
  it('has all six karp layers', () => {
    expect(KARP_LAYERS).toHaveLength(6)
    for (const l of KARP_LAYERS) expect(MEMORY_KINDS[l]).toBeDefined()
  })

  it('maps finer MASys types onto a layer colour', () => {
    // person/concept share the semantic colour
    expect(kindColor('person')).toBe(kindColor('semantic'))
    expect(kindColor('skill')).toBe(kindColor('procedural'))
    expect(kindDef('decision')!.layer).toBe('meta')
  })

  it('is case-insensitive and tolerant of unknown kinds', () => {
    expect(kindDef('SEMANTIC')!.label).toBe('Semantic')
    expect(kindDef('totally-unknown')).toBeNull()
    expect(kindColor(undefined)).toBeNull()
    expect(normalizeKind('Skill')).toBe('skill')
  })
})
