import { describe, it, expect } from 'vitest'
import { buildComparison, COMPARE_LAYERS, type NsCounts } from './nsCompare'

describe('buildComparison', () => {
  it('handles no namespaces', () => {
    const c = buildComparison([], {})
    expect(c.rows).toHaveLength(COMPARE_LAYERS.length)
    expect(c.grandTotal).toBe(0)
    expect(c.rows[0].counts).toEqual({})
    expect(c.rows[0].leaders).toEqual([])
  })

  it('treats missing layer values as zero', () => {
    const data: Record<string, NsCounts> = { a: { episodes: 5 } }
    const c = buildComparison(['a'], data)
    const ep = c.rows.find(r => r.key === 'episodes')!
    const ent = c.rows.find(r => r.key === 'entities')!
    expect(ep.counts.a).toBe(5)
    expect(ent.counts.a).toBe(0)
  })

  it('computes per-row max, total and leaders', () => {
    const data: Record<string, NsCounts> = {
      a: { episodes: 10, entities: 2 },
      b: { episodes: 3, entities: 2 },
    }
    const c = buildComparison(['a', 'b'], data)
    const ep = c.rows.find(r => r.key === 'episodes')!
    expect(ep.max).toBe(10)
    expect(ep.total).toBe(13)
    expect(ep.leaders).toEqual(['a'])
    // tie → both namespaces are leaders
    const ent = c.rows.find(r => r.key === 'entities')!
    expect(ent.leaders).toEqual(['a', 'b'])
  })

  it('does not mark leaders when the whole row is zero', () => {
    const c = buildComparison(['a', 'b'], { a: {}, b: {} })
    expect(c.rows.every(r => r.leaders.length === 0)).toBe(true)
  })

  it('sums per-namespace totals and grand total', () => {
    const data: Record<string, NsCounts> = {
      a: { episodes: 10, skills: 5 },
      b: { episodes: 1 },
    }
    const c = buildComparison(['a', 'b'], data)
    expect(c.totals.a).toBe(15)
    expect(c.totals.b).toBe(1)
    expect(c.grandTotal).toBe(16)
  })
})
