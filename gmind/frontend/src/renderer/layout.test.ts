import { describe, it, expect } from 'vitest'
import type { Topic } from '../types'
import { buildLayout, computeTreeLayout, MIN_EDGE_CORRIDOR } from './layout'
import { measureNodeSize, nodePad } from './measure'
import { shapeTextInset } from './shapes'
import { fonts } from '../styles/tokens'

function makeTopic(id: string, title: string, overrides: Partial<Topic> = {}): Topic {
  return { id, title, folded: false, children: [], ...overrides }
}

// Собирает видимые узлы и проверяет, что нет пар с реальным наложением AABB.
function noOverlaps(root: import('../types').LayoutNode): boolean {
  const nodes: import('../types').LayoutNode[] = []
  const collect = (n: import('../types').LayoutNode) => {
    nodes.push(n)
    if (n.topic?.folded) return
    for (const c of n.children || []) collect(c)
  }
  collect(root)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const penX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const penY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (penX > 1 && penY > 1) return false
    }
  }
  return true
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

  it.each(['rounded', 'pill', 'ellipse', 'diamond', 'triangle', 'hexagon', 'parallelogram', 'note', 'cloud'])(
    'fits long title and body inside the %s text area without clipping',
    shape => {
      const topic = makeTopic('fit', 'Длинный заголовок узла для проверки', {
        shape,
        body: 'Первая длинная строка тела с переносом.\nВторая строка тоже должна быть видна целиком.',
      })
      const node = buildLayout(topic)
      const inset = shapeTextInset(shape, node.width, node.height)
      const { padH, padV } = nodePad(10)
      const required = measureNodeSize({
        title: topic.title,
        body: topic.body,
        fontSize: 14,
        fontFamily: fonts.ui,
        padH,
        padV,
        maxContentWidth: 252,
        minWidth: 60,
        minHeight: 40,
        fixedWidth: inset.w,
      })

      expect(inset.w).toBeGreaterThanOrEqual(required.width)
      expect(inset.h).toBeGreaterThanOrEqual(required.height)
    },
  )

  // Регрессия: форму узлу может дать корпус вида памяти (decision → ромб).
  // Если layout мерит такой узел как прямоугольник, врезка ромба срежет текст.
  it('учитывает форму от вида памяти, когда shape не задана явно', () => {
    const topic = makeTopic('kind', 'Решение контроллера памяти о судьбе записи', {
      memory_kind: 'decision',
      body: 'Что запомнить, что забыть и почему именно так.',
    })
    const node = buildLayout(topic)
    const inset = shapeTextInset('diamond', node.width, node.height)
    const { padH, padV } = nodePad(10)
    const required = measureNodeSize({
      title: topic.title,
      body: topic.body,
      fontSize: 14,
      fontFamily: fonts.ui,
      padH,
      padV,
      maxContentWidth: 252,
      minWidth: 60,
      minHeight: 40,
      fixedWidth: inset.w,
    })

    expect(inset.w).toBeGreaterThanOrEqual(required.width)
    expect(inset.h).toBeGreaterThanOrEqual(required.height)
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

  it('no overlap between sibling subtrees in mindmap', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'a', { children: [makeTopic('4', 'a1'), makeTopic('5', 'a2')] }),
        makeTopic('3', 'b', { children: [makeTopic('6', 'b1'), makeTopic('7', 'b2')] }),
      ],
    })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'mindmap', new Map())
    expect(noOverlaps(result.root)).toBe(true)
  })

  it('no overlap with mixed child directions (one branch grows down)', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'a', {
          structure_class: 'tree-down',
          children: [makeTopic('4', 'a1'), makeTopic('5', 'a2'), makeTopic('8', 'a3')],
        }),
        makeTopic('3', 'b', { children: [makeTopic('6', 'b1'), makeTopic('7', 'b2')] }),
      ],
    })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'mindmap', new Map())
    expect(noOverlaps(result.root)).toBe(true)
  })

  it('per-child child_dir: only the tagged child flips side, others stay', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'a'),                              // default → right
        makeTopic('3', 'b'),                              // default → right
        makeTopic('4', 'c', { child_dir: 'left' }),       // explicit → left
      ],
    })
    const n = buildLayout(root)
    const result = computeTreeLayout(n, 'mindmap', new Map())
    const byId = (id: string) => result.root.children.find(c => c.topic.id === id)!
    expect(byId('2').x).toBeGreaterThan(result.root.x) // right
    expect(byId('3').x).toBeGreaterThan(result.root.x) // right (unchanged)
    expect(byId('4').x).toBeLessThan(result.root.x)    // left (only this one)
    expect(noOverlaps(result.root)).toBe(true)
  })

  it('places diagonal child directions in their 45-degree quadrants', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'up-right', { child_dir: 'up-right' }),
        makeTopic('3', 'down-left', { child_dir: 'down-left' }),
      ],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map())
    const rootCx = result.root.x + result.root.width / 2
    const rootCy = result.root.y + result.root.height / 2
    const byId = (id: string) => result.root.children.find(child => child.topic.id === id)!
    const upRight = byId('2')
    const downLeft = byId('3')

    expect(upRight.x + upRight.width / 2).toBeGreaterThan(rootCx)
    expect(upRight.y + upRight.height / 2).toBeLessThan(rootCy)
    expect(downLeft.x + downLeft.width / 2).toBeLessThan(rootCx)
    expect(downLeft.y + downLeft.height / 2).toBeGreaterThan(rootCy)
    expect(Math.abs(upRight.x + upRight.width / 2 - rootCx))
      .toBeCloseTo(Math.abs(upRight.y + upRight.height / 2 - rootCy), 5)
    expect(Math.abs(downLeft.x + downLeft.width / 2 - rootCx))
      .toBeCloseTo(Math.abs(downLeft.y + downLeft.height / 2 - rootCy), 5)
    expect(noOverlaps(result.root)).toBe(true)
  })

  it('orders diagonal siblings on non-crossing lanes while keeping the selected quadrant', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'near', { child_dir: 'up-left' }),
        makeTopic('3', 'far', { child_dir: 'up-left' }),
      ],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map())
    const rcx = result.root.x + result.root.width / 2
    const rcy = result.root.y + result.root.height / 2
    const offsets = result.root.children.map(child => {
      const dx = child.x + child.width / 2 - rcx
      const dy = child.y + child.height / 2 - rcy
      expect(dx).toBeLessThan(0)
      expect(dy).toBeLessThan(0)
      return { dx, dy }
    })
    expect(Math.abs(offsets[0].dx)).toBeCloseTo(Math.abs(offsets[0].dy), 5)
    // For top -> up-left the safe child-entry lanes have increasing x-y.
    // They are intentionally one-sided: mirroring siblings around the ray
    // makes their branches cross before entering the child's bottom port.
    expect(offsets[1].dx - offsets[1].dy).toBeGreaterThan(offsets[0].dx - offsets[0].dy)
    expect(noOverlaps(result.root)).toBe(true)
  })

  it('centres a straight-up child on the parent and keeps the plain level gap', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'A deliberately wide straight-up child', { child_dir: 'up' }),
        makeTopic('3', 'diagonal neighbour', { child_dir: 'up-right' }),
      ],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map(), {
      levelGap: 100, siblingGap: 24, childGap: 16,
    })
    const child = result.root.children.find(c => c.topic.id === '2')!
    const rootCx = result.root.x + result.root.width / 2
    const childCx = child.x + child.width / 2

    expect(childCx).toBeCloseTo(rootCx, 5)
    expect(result.root.y - (child.y + child.height)).toBeCloseTo(116, 5)
  })

  it('keeps a child on its chosen side even when its own subtree grows backwards', () => {
    // Ребёнок уходит вправо, а его собственная ветка — влево. Раньше носитель
    // отсчитывался от габарита поддерева и уезжал от родителя на его ширину.
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'right carrier', {
          children: [makeTopic('3', 'a branch that grows back to the left', { child_dir: 'left' })],
        }),
      ],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map(), {
      levelGap: 100, siblingGap: 24, childGap: 16,
    })
    const carrier = result.root.children[0]
    expect(carrier.x - (result.root.x + result.root.width)).toBeCloseTo(116, 5)
    expect(carrier.y + carrier.height / 2).toBeCloseTo(result.root.y + result.root.height / 2, 5)
  })

  it('puts a lone down-child straight under the parent regardless of its subtree width', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'down carrier', {
          child_dir: 'down',
          children: [
            makeTopic('3', 'wide left branch', { child_dir: 'left' }),
            makeTopic('4', 'wide right branch', { child_dir: 'right' }),
          ],
        }),
      ],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map())
    const carrier = result.root.children[0]
    expect(carrier.x + carrier.width / 2).toBeCloseTo(result.root.x + result.root.width / 2, 5)
  })

  it('keeps every child within a few level gaps of its parent', () => {
    // Регрессия «проход через всю карту»: ветка не должна улетать на габарит
    // соседних поддеревьев — ни по прямому лучу, ни по диагонали.
    const bigChild = (id: string, dir: string) => makeTopic(id, `branch ${id}`, {
      child_dir: dir,
      children: [
        makeTopic(`${id}a`, 'a fairly long grandchild title here'),
        makeTopic(`${id}b`, 'another fairly long grandchild title'),
      ],
    })
    const root = makeTopic('1', 'root', {
      children: [
        bigChild('2', 'right'), bigChild('3', 'left'),
        bigChild('4', 'up'), bigChild('5', 'down'),
        bigChild('6', 'up-left'), bigChild('7', 'up-right'),
        bigChild('8', 'down-left'), bigChild('9', 'down-right'),
      ],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map(), {
      levelGap: 100, siblingGap: 24, childGap: 16,
    })
    const rcx = result.root.x + result.root.width / 2
    const rcy = result.root.y + result.root.height / 2
    for (const child of result.root.children) {
      const d = Math.hypot(child.x + child.width / 2 - rcx, child.y + child.height / 2 - rcy)
      expect(d).toBeLessThan(600)
    }
  })

  it('keeps the plain level gap when no diagonal sibling shares the parent', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'a', { children: [makeTopic('4', 'a1'), makeTopic('5', 'a2')] }),
        makeTopic('3', 'b', { children: [makeTopic('6', 'b1'), makeTopic('7', 'b2')] }),
      ],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map(), {
      levelGap: 100, siblingGap: 24, childGap: 16,
    })
    // levelGap + childGap, independent of how tall the children group is.
    for (const child of result.root.children) {
      expect(child.x - (result.root.x + result.root.width)).toBeCloseTo(116, 5)
    }
  })

  it('honours a sibling gap below the port corridor', () => {
    const root = makeTopic('1', 'root', {
      children: [makeTopic('2', 'a'), makeTopic('3', 'b')],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map(), {
      levelGap: 100, siblingGap: 24, childGap: 16,
    })
    const [first, second] = result.root.children
    expect(second.y - (first.y + first.height)).toBeCloseTo(24, 5)
  })

  it('keeps a wide up-branch above the parent and the right group beside it', () => {
    const root = makeTopic('1', 'root', {
      children: [
        makeTopic('2', 'right branch', { children: [makeTopic('4', 'r1'), makeTopic('5', 'r2')] }),
        makeTopic('3', 'up branch', {
          child_dir: 'up',
          children: [makeTopic('6', 'a deliberately wide up child')],
        }),
      ],
    })
    const result = computeTreeLayout(buildLayout(root), 'mindmap', new Map())
    const byId = (id: string) => result.root.children.find(c => c.topic.id === id)!
    const up = byId('3')
    const right = byId('2')

    expect(up.y + up.height).toBeLessThanOrEqual(result.root.y)
    expect(right.x).toBeGreaterThanOrEqual(result.root.x + result.root.width)
    expect(noOverlaps(result.root)).toBe(true)
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
