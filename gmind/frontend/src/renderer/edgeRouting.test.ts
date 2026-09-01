import { describe, expect, it } from 'vitest'
import type { LayoutNode } from '../types'
import {
  routePortToPort,
  routeTreeEdge,
  sidePoint,
  treeEdgeEndpoints,
} from './edgeRouting'

const layoutNode = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parentAnchor?: string,
  childDir?: string,
): LayoutNode => ({
  topic: { id, title: id, folded: false, parent_anchor: parentAnchor, child_dir: childDir },
  x, y, width, height, children: [],
})

describe('four-port tree edge geometry', () => {
  const parent = layoutNode('parent', 100, 100, 120, 60)
  const expected = {
    top: { x: 160, y: 100 },
    right: { x: 220, y: 130 },
    bottom: { x: 160, y: 160 },
    left: { x: 100, y: 130 },
  }

  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    it(`starts at the exact ${side} port and enters the opposite child port`, () => {
      const child = layoutNode('child', 340, 260, 80, 40, side, 'down-right')
      const edge = treeEdgeEndpoints(parent, child)
      expect(edge.from).toEqual(expected[side])
      const opposite = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' } as const
      expect(edge.to).toEqual(sidePoint({ x: child.x, y: child.y, width: child.width, height: child.height }, opposite[side]))
    })
  }

  it('keeps diagonal placement independent from the clicked physical port', () => {
    const fromTop = treeEdgeEndpoints(parent, layoutNode('a', 0, 0, 80, 40, 'top', 'up-left'))
    const fromLeft = treeEdgeEndpoints(parent, layoutNode('b', 0, 0, 80, 40, 'left', 'up-left'))
    expect(fromTop.fromSide).toBe('top')
    expect(fromLeft.fromSide).toBe('left')
    expect(fromTop.from).not.toEqual(fromLeft.from)
  })
})

describe('shared port-to-port shape', () => {
  it('is the same four-point shape for relationship links', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 300, y: 200 }
    const route = routePortToPort(from, to, 'right', 'left', 1.5)

    expect(route).toHaveLength(4)
    expect(route[0]).toEqual(from)
    expect(route.at(-1)).toEqual(to)
    // Ножки строго горизонтальны и смотрят наружу из своих портов.
    expect(route[1]).toEqual({ x: 18.75, y: 0 })
    expect(route[2]).toEqual({ x: 281.25, y: 200 })
  })

  it('keeps coordinates finite on decimal input', () => {
    const route = routePortToPort({ x: 1.234, y: 81.567 }, { x: 331.234, y: 91.5 }, 'right', 'left', 7.5)
    expect(route.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
  })
})

describe('simple tree edge shape', () => {
  it('leaves both ports along their normals and runs straight in between', () => {
    const parent = layoutNode('parent', 300, 300, 120, 60)
    const child = layoutNode('child', 80, 80, 100, 80, 'top', 'up-left')
    const { route, fromSide, toSide } = routeTreeEdge(parent, child, 2)

    expect(fromSide).toBe('top')
    expect(toSide).toBe('bottom')
    expect(route).toHaveLength(4)
    expect(route[0]).toEqual(sidePoint(parent, 'top'))
    expect(route.at(-1)).toEqual(sidePoint(child, 'bottom'))
    // Обе ножки строго вертикальны (нормаль порта) и смотрят наружу.
    expect(route[1].x).toBe(route[0].x)
    expect(route[1].y).toBeLessThan(route[0].y)
    expect(route[2].x).toBe(route[3].x)
    expect(route[2].y).toBeGreaterThan(route[3].y)
  })

  it('goes through a blocker instead of detouring around it', () => {
    const parent = layoutNode('parent', 500, 500, 160, 80)
    const child = layoutNode('child', 20, 20, 180, 120, 'top', 'up-left')
    const { route } = routeTreeEdge(parent, child, 2)

    expect(route).toHaveLength(4)
    expect(route[0]).toEqual(sidePoint(parent, 'top'))
    expect(route.at(-1)).toEqual(sidePoint(child, 'bottom'))
  })

  it('shortens the stubs so a close child never gets a backward hook', () => {
    const parent = layoutNode('parent', 100, 100, 120, 60)
    // Порт ребёнка всего в 10px над портом родителя — полные ножки (18px)
    // перелетели бы друг друга.
    const child = layoutNode('child', 90, 50, 120, 40, 'top', 'up')
    const { route } = routeTreeEdge(parent, child, 2)

    const from = sidePoint(parent, 'top')
    const to = sidePoint(child, 'bottom')
    expect(to.y).toBe(from.y - 10)
    for (let index = 1; index < route.length; index++) {
      expect(route[index].y).toBeLessThanOrEqual(route[index - 1].y + 0.01)
    }
  })

  it('collapses to a plain straight line when the child sits behind the port', () => {
    const parent = layoutNode('parent', 100, 100, 120, 60)
    const child = layoutNode('child', 90, 200, 120, 40, 'top', 'up')
    const { route } = routeTreeEdge(parent, child, 2)

    expect(route).toEqual([sidePoint(parent, 'top'), sidePoint(child, 'bottom')])
  })
})
