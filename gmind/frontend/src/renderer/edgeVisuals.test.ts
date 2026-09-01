import { describe, it, expect } from 'vitest'
import { weightToColor, thicknessForSubtree, sideOf } from './edgeVisuals'
import type { LayoutNode } from '../types'

const node = (x: number, y: number, w = 40, h = 40): LayoutNode =>
  ({ topic: { id: 'n', title: '' } as any, x, y, width: w, height: h, children: [] })

describe('weightToColor', () => {
  it('cold (low weight) → blue hue ~220', () => {
    expect(weightToColor(1)).toBe('hsl(220, 78%, 52%)')
  })
  it('hot (max weight) → red hue ~0', () => {
    expect(weightToColor(16)).toBe('hsl(0, 78%, 52%)')
  })
  it('clamps below/above the 1..16 domain', () => {
    expect(weightToColor(-5)).toBe('hsl(220, 78%, 52%)')
    expect(weightToColor(999)).toBe('hsl(0, 78%, 52%)')
  })
  it('is monotonic: heavier ⇒ warmer (smaller hue)', () => {
    const hue = (s: string) => parseInt(s.slice(4))
    expect(hue(weightToColor(8))).toBeLessThan(hue(weightToColor(2)))
  })
})

describe('thicknessForSubtree', () => {
  it('leaf (size 1) is thinnest', () => {
    expect(thicknessForSubtree(1)).toBeCloseTo(1.5)
  })
  it('grows with subtree size and caps around 7.5px', () => {
    expect(thicknessForSubtree(11)).toBeCloseTo(3.0)
    expect(thicknessForSubtree(41)).toBeCloseTo(7.5)
    expect(thicknessForSubtree(1000)).toBeCloseTo(7.5) // clamped
  })
})

describe('sideOf', () => {
  const parent = node(100, 100) // centre (120,120)
  it('detects right/left/top/bottom by child centre', () => {
    expect(sideOf(parent, node(300, 110))).toBe('right')
    expect(sideOf(parent, node(-200, 110))).toBe('left')
    expect(sideOf(parent, node(110, -200))).toBe('top')
    expect(sideOf(parent, node(110, 400))).toBe('bottom')
  })
  it('horizontal wins ties (|dx| >= |dy|)', () => {
    // equal offset → right
    expect(sideOf(parent, node(220, 220))).toBe('right')
  })
  it('uses the persisted physical port instead of diagonal geometry', () => {
    const child = node(-200, -200)
    child.topic.parent_anchor = 'top'
    expect(sideOf(parent, child)).toBe('top')
  })
})
