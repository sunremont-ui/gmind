import { describe, it, expect } from 'vitest'
import { estimateBudget, formatTokens, type BudgetInputs } from './budgetEstimate'

const empty: BudgetInputs = {
  episodes: [], entities: [], skills: [], conversations: [],
  wiki: [], results: [], decisions: [], pending: [],
}

function withWiki(content: string): BudgetInputs {
  return { ...empty, wiki: [{ slug: 's', namespace: 'default', title: 'T', content }] }
}

describe('estimateBudget', () => {
  it('returns an empty estimate with no data', () => {
    const e = estimateBudget(empty, 8000)
    expect(e.totalTokens).toBe(0)
    expect(e.layers).toHaveLength(0)
    expect(e.withinBudget).toBe(true)
    expect(e.overflowTokens).toBe(0)
  })

  it('drops zero-token layers and keeps non-empty ones', () => {
    const e = estimateBudget(withWiki('x'.repeat(400)), 8000)
    expect(e.layers).toHaveLength(1)
    expect(e.layers[0].key).toBe('semantic')
    // 400 chars title+content ≈ 100+ tokens
    expect(e.layers[0].tokens).toBeGreaterThan(90)
    expect(e.layers[0].pct).toBeCloseTo(1, 5)
  })

  it('flags overflow when footprint exceeds the cap', () => {
    const big = withWiki('y'.repeat(80000)) // ~20k tokens
    const e = estimateBudget(big, 8000)
    expect(e.totalTokens).toBeGreaterThan(8000)
    expect(e.withinBudget).toBe(false)
    expect(e.fitsTokens).toBe(8000)
    expect(e.overflowTokens).toBe(e.totalTokens - 8000)
  })

  it('uses summaryTokens for compressed conversations', () => {
    const e = estimateBudget({
      ...empty,
      conversations: [{ sessionId: 's', namespace: 'default', summary: 'sum', summaryTokens: 500, messageCount: 999 }],
    }, 8000)
    // summary present → raw turns excluded, only summaryTokens count
    expect(e.totalTokens).toBe(500)
    expect(e.layers[0].key).toBe('working')
  })

  it('estimates raw turns when no summary exists', () => {
    const e = estimateBudget({
      ...empty,
      conversations: [{ sessionId: 's', namespace: 'default', messageCount: 10 }],
    }, 8000)
    expect(e.totalTokens).toBe(10 * 60)
  })

  it('pct shares sum to 1 across layers', () => {
    const e = estimateBudget({
      ...empty,
      wiki: [{ slug: 'a', namespace: 'default', title: 'A', content: 'a'.repeat(400) }],
      skills: [{ id: 'k', name: 'skill', trigger: 'when', body: { steps: ['a'.repeat(400)] } }],
    }, 100000)
    expect(e.layers.length).toBe(2)
    const sum = e.layers.reduce((s, l) => s + l.pct, 0)
    expect(sum).toBeCloseTo(1, 5)
  })
})

describe('formatTokens', () => {
  it('formats below 1k as-is', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(999)).toBe('999')
  })
  it('formats thousands compactly', () => {
    expect(formatTokens(1500)).toBe('1.5k')
    expect(formatTokens(32000)).toBe('32k')
  })
})
