import { describe, it, expect } from 'vitest'
import type { Topic } from '../types'
import { buildLayout, computeTreeLayout } from './layout'

function makeTopic(id: string, title: string, overrides: Partial<Topic> = {}): Topic {
  return { id, title, folded: false, children: [], ...overrides }
}

describe('buildLayout', () => {
  it('creates a leaf node', () => {
    const t = makeTopic('1', 'hello')
    const n = buildLayout(t)
    expect(n.topic.id).toBe('1')
    expect(n.children).toEqual([])
    expect(n.width).toBeGreaterThan(0)
    expect(n.height).toBeGreaterThan(0)
  })

  it('creates parent with children', () => {
    const t = makeTopic('1', 'root', {
      children: [makeTopic('2', 'child a'), makeTopic('3', 'child b')],
    })
    const n = buildLayout(t)
    expect(n.children).toHaveLength(2)
    expect(n.children[0].topic.id).toBe('2')
    expect(n.children[1].topic.id).toBe('3')
  })

  it('keeps children in buildLayout when folded (folding is handled in computeTreeLayout)', () => {
    const t = makeTopic('1', 'root', { folded: true, children: [makeTopic('2', 'child')] })
    const n = buildLayout(t)
    expect(n.children).toHaveLength(1)
    expect(n.children[0].topic.id).toBe('2')
  })
})

describe('layout result integrity', () => {
  it('leaf node has x=0 y=0 after build', () => {
    const n = buildLayout(makeTopic('1', 'leaf'))
    expect(n.x).toBe(0)
    expect(n.y).toBe(0)
  })

  it('parent has positive width and height', () => {
    const root = makeTopic('1', 'root', {
      children: [makeTopic('2', 'a'), makeTopic('3', 'b')],
    })
    const n = buildLayout(root)
    expect(n.width).toBeGreaterThan(0)
  })
})

describe('computeTreeLayout', () => {
  it('tree-right places children to the right', () => {
    const root = makeTopic('1', 'root', {
      children: [makeTopic('2', 'a')],
    })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'tree-right', new Map())
    expect(result.root.children[0].x).toBeGreaterThan(result.root.x)
  })

  it('tree-left places children to the left', () => {
    const root = makeTopic('1', 'root', {
      children: [makeTopic('2', 'a')],
    })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'tree-left', new Map())
    expect(result.root.children[0].x).toBeLessThan(result.root.x)
  })

  it('tree-down places children below', () => {
    const root = makeTopic('1', 'root', {
      children: [makeTopic('2', 'a')],
    })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'tree-down', new Map())
    expect(result.root.children[0].y).toBeGreaterThan(result.root.y)
  })

  it('tree-up places children above', () => {
    const root = makeTopic('1', 'root', {
      children: [makeTopic('2', 'a')],
    })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'tree-up', new Map())
    expect(result.root.children[0].y).toBeLessThan(result.root.y)
  })

  it('fishbone places children diagonally from root', () => {
    const root = makeTopic('1', 'effect', {
      children: [makeTopic('2', 'cause1'), makeTopic('3', 'cause2')],
    })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'fishbone', new Map())
    expect(result.root.children[0].x).toBeLessThan(result.root.x)
    expect(result.root.children[0].y).toBeLessThan(result.root.y)
    expect(result.root.children[1].y).toBeGreaterThan(result.root.y)
  })

  it('collapses children of folded parent to parent position', () => {
    const child = makeTopic('2', 'child')
    const root = makeTopic('1', 'root', { folded: true, children: [child] })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'tree-right', new Map())
    expect(result.root.children[0].x).toBe(result.root.x)
    expect(result.root.children[0].y).toBe(result.root.y)
  })
})
