import { describe, it, expect } from 'vitest'
import { buildSkillForest, flattenForest, successColor } from './skillForest'
import type { MASysSkill } from '../../types/masys'

const sk = (id: string, derivedFrom?: string[], extra: Partial<MASysSkill> = {}): MASysSkill => ({
  id, name: id, derivedFrom, ...extra,
})

describe('buildSkillForest', () => {
  it('returns empty forest for no skills', () => {
    const f = buildSkillForest([])
    expect(f.roots).toHaveLength(0)
    expect(f.stats.total).toBe(0)
  })

  it('treats parentless skills as roots', () => {
    const f = buildSkillForest([sk('a'), sk('b')])
    expect(f.stats.roots).toBe(2)
    expect(f.stats.derived).toBe(0)
  })

  it('nests derived skills under their parent', () => {
    const f = buildSkillForest([sk('parent'), sk('child', ['parent'])])
    expect(f.stats.roots).toBe(1)
    expect(f.stats.derived).toBe(1)
    expect(f.roots[0].skill.id).toBe('parent')
    expect(f.roots[0].children).toHaveLength(1)
    expect(f.roots[0].children[0].skill.id).toBe('child')
    expect(f.stats.maxDepth).toBe(1)
  })

  it('resolves derivedFrom by name when id misses', () => {
    const parent = sk('id-1', undefined, { name: 'BaseSkill' })
    const child = sk('id-2', ['BaseSkill'], { name: 'Derived' })
    const f = buildSkillForest([parent, child])
    expect(f.roots[0].children[0].skill.id).toBe('id-2')
    expect(f.stats.orphanRefs).toBe(0)
  })

  it('counts unknown parent refs as orphans and keeps the skill as root', () => {
    const f = buildSkillForest([sk('x', ['ghost'])])
    expect(f.stats.orphanRefs).toBe(1)
    expect(f.stats.roots).toBe(1)
  })

  it('survives a derivation cycle without infinite recursion', () => {
    const f = buildSkillForest([sk('a', ['b']), sk('b', ['a'])])
    // both have a parent → no roots; build is still bounded
    expect(f.stats.total).toBe(2)
    expect(Array.isArray(f.roots)).toBe(true)
  })

  it('flattenForest yields pre-order rows', () => {
    const f = buildSkillForest([sk('p'), sk('c1', ['p']), sk('c2', ['p'])])
    const rows = flattenForest(f.roots).map(n => n.skill.id)
    expect(rows[0]).toBe('p')
    expect(rows.slice(1).sort()).toEqual(['c1', 'c2'])
  })
})

describe('successColor', () => {
  it('is slate for unused skills', () => {
    expect(successColor(sk('a', undefined, { usageCount: 0, successRate: 1 }))).toBe('#94a3b8')
  })
  it('is green for high success', () => {
    expect(successColor(sk('a', undefined, { usageCount: 5, successRate: 0.9 }))).toBe('#22c55e')
  })
  it('is red for low success', () => {
    expect(successColor(sk('a', undefined, { usageCount: 5, successRate: 0.2 }))).toBe('#ef4444')
  })
})
