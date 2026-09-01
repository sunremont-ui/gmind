import { describe, it, expect } from 'vitest'
import { layoutRadialFamily, isRadialKind, RADIAL_KINDS, type RadialKind } from './radialLayout'
import type { LayoutNode, Topic } from '../types'

function node(id: string, w: number, h: number, children: LayoutNode[] = []): LayoutNode {
  return { topic: { id, title: id } as Topic, x: 0, y: 0, width: w, height: h, children }
}

/** Габарит поддерева — для проверки, что ветки целиком не пересекаются. */
function box(n: LayoutNode) {
  let minX = n.x, minY = n.y, maxX = n.x + n.width, maxY = n.y + n.height
  for (const c of n.children ?? []) {
    const b = box(c)
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY)
  }
  return { minX, minY, maxX, maxY }
}

function overlaps(a: ReturnType<typeof box>, b: ReturnType<typeof box>, eps = 0.5): boolean {
  const penX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const penY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  return penX > eps && penY > eps
}

/** Все попарные наложения поддеревьев после раскладки. */
function collisions(children: LayoutNode[]): string[] {
  const boxes = children.map(box)
  const out: string[] = []
  for (let i = 0; i < children.length; i++) {
    for (let j = i + 1; j < children.length; j++) {
      if (overlaps(boxes[i], boxes[j])) {
        out.push(`${children[i].topic.id} ↔ ${children[j].topic.id}`)
      }
    }
  }
  return out
}

const KINDS = RADIAL_KINDS.map(k => k.id)
const opts = { levelGap: 100, siblingGap: 24 }

describe('радиальные раскладки: узлы не закрывают друг друга', () => {
  it.each(KINDS)('%s — одинаковые дети не пересекаются', kind => {
    for (const count of [1, 2, 3, 5, 8, 13, 21, 40]) {
      const children = Array.from({ length: count }, (_, i) => node(`c${i}`, 120, 40))
      layoutRadialFamily(kind, node('root', 140, 44), children, opts)
      expect(collisions(children), `${kind}, ${count} детей`).toEqual([])
    }
  })

  it.each(KINDS)('%s — дети очень разного размера не пересекаются', kind => {
    const children = [
      node('tiny', 60, 30),
      node('wide', 320, 40),
      node('tall', 80, 220),
      node('huge', 300, 260),
      node('small', 70, 34),
      node('mid', 180, 90),
    ]
    layoutRadialFamily(kind, node('root', 140, 44), children, opts)
    expect(collisions(children)).toEqual([])
  })

  it.each(KINDS)('%s — поддеревья с потомками не пересекаются', kind => {
    const withKids = (id: string, k: number) =>
      node(id, 140, 40, Array.from({ length: k }, (_, i) => {
        const c = node(`${id}.${i}`, 110, 36)
        // Имитируем уже разложенное поддерево: дети смещены вправо-вниз.
        c.x = 200
        c.y = i * 60
        return c
      }))

    const children = [withKids('a', 3), withKids('b', 1), withKids('c', 5), node('d', 90, 40)]
    layoutRadialFamily(kind, node('root', 140, 44), children, opts)
    expect(collisions(children)).toEqual([])
  })

  it.each(KINDS)('%s — нулевой зазор всё равно без наложений', kind => {
    const children = Array.from({ length: 9 }, (_, i) => node(`c${i}`, 120, 40))
    layoutRadialFamily(kind, node('root', 100, 40), children, { levelGap: 40, siblingGap: 0 })
    expect(collisions(children)).toEqual([])
  })
})

describe('радиальные раскладки: геометрия', () => {
  it('родитель остаётся в начале координат', () => {
    const root = node('root', 140, 44)
    root.x = 999
    root.y = -50
    layoutRadialFamily('radial-packed', root, [node('a', 100, 40)], opts)
    expect({ x: root.x, y: root.y }).toEqual({ x: 0, y: 0 })
  })

  it('равные секторы: дети равноудалены от центра родителя', () => {
    const root = node('root', 140, 44)
    const children = Array.from({ length: 6 }, (_, i) => node(`c${i}`, 100, 40))
    layoutRadialFamily('radial-even', root, children, opts)

    const pcx = root.width / 2
    const pcy = root.height / 2
    const dists = children.map(c => Math.hypot(
      c.x + c.width / 2 - pcx,
      c.y + c.height / 2 - pcy,
    ))
    const min = Math.min(...dists)
    const max = Math.max(...dists)
    expect(max - min).toBeLessThan(1)
  })

  it('равные секторы делят круг на равные углы', () => {
    const root = node('root', 100, 40)
    const children = Array.from({ length: 4 }, (_, i) => node(`c${i}`, 100, 40))
    layoutRadialFamily('radial-even', root, children, opts)

    const pcx = root.width / 2
    const pcy = root.height / 2
    const angles = children
      .map(c => Math.atan2(c.y + c.height / 2 - pcy, c.x + c.width / 2 - pcx))
      .map(a => (a + Math.PI * 2) % (Math.PI * 2))
      .sort((a, b) => a - b)

    const steps = angles.slice(1).map((a, i) => a - angles[i])
    for (const s of steps) expect(Math.abs(s - Math.PI / 2)).toBeLessThan(0.01)
  })

  it('веер 180° держит детей в правой полуплоскости', () => {
    const root = node('root', 100, 40)
    const children = Array.from({ length: 5 }, (_, i) => node(`c${i}`, 100, 40))
    layoutRadialFamily('radial-sector', root, children, opts)
    for (const c of children) {
      expect(c.x + c.width / 2).toBeGreaterThan(root.width / 2 - 1)
    }
  })

  it('кольцами: при многих детях появляется больше одного радиуса', () => {
    const root = node('root', 100, 40)
    const children = Array.from({ length: 30 }, (_, i) => node(`c${i}`, 140, 44))
    layoutRadialFamily('radial-rings', root, children, opts)

    const pcx = root.width / 2
    const pcy = root.height / 2
    const radii = new Set(children.map(c => Math.round(
      Math.hypot(c.x + c.width / 2 - pcx, c.y + c.height / 2 - pcy) / 10,
    )))
    expect(radii.size).toBeGreaterThan(1)
  })

  it('циферблат: углы кратны шагу часов', () => {
    const root = node('root', 100, 40)
    const children = Array.from({ length: 12 }, (_, i) => node(`c${i}`, 90, 36))
    layoutRadialFamily('radial-clock', root, children, { ...opts, clockSlots: 12 })

    const pcx = root.width / 2
    const pcy = root.height / 2
    const step = (Math.PI * 2) / 12
    for (const c of children) {
      const a = Math.atan2(c.y + c.height / 2 - pcy, c.x + c.width / 2 - pcx)
      // Ближайшая кратная шагу позиция должна почти совпасть с фактическим углом.
      const k = Math.round(a / step)
      expect(Math.abs(a - k * step)).toBeLessThan(0.01)
    }
  })

  it('плотная упаковка компактнее равносекторной на разнородных детях', () => {
    const make = () => [
      node('tiny', 60, 30), node('tiny2', 60, 30), node('tiny3', 60, 30),
      node('huge', 300, 240),
    ]
    const spread = (children: LayoutNode[], root: LayoutNode) => {
      const pcx = root.width / 2, pcy = root.height / 2
      return Math.max(...children.map(c => Math.hypot(
        c.x + c.width / 2 - pcx, c.y + c.height / 2 - pcy)))
    }
    const evenRoot = node('r', 120, 40)
    const evenKids = make()
    layoutRadialFamily('radial-even', evenRoot, evenKids, opts)

    const packedRoot = node('r', 120, 40)
    const packedKids = make()
    layoutRadialFamily('radial-packed', packedRoot, packedKids, opts)

    expect(spread(packedKids, packedRoot)).toBeLessThanOrEqual(spread(evenKids, evenRoot))
  })

  it('пустой список детей не ломает раскладку', () => {
    const root = node('root', 100, 40)
    expect(() => layoutRadialFamily('radial-packed', root, [], opts)).not.toThrow()
  })

  it('внутренняя раскладка поддерева сохраняется при переносе', () => {
    const child = node('a', 140, 40)
    const grand = node('a.1', 100, 36)
    grand.x = 200
    grand.y = 10
    child.children = [grand]
    const beforeDx = grand.x - child.x
    const beforeDy = grand.y - child.y

    layoutRadialFamily('radial-packed', node('root', 100, 40), [child], opts)
    expect(grand.x - child.x).toBeCloseTo(beforeDx, 6)
    expect(grand.y - child.y).toBeCloseTo(beforeDy, 6)
  })
})

describe('isRadialKind', () => {
  it('узнаёт все виды семейства', () => {
    for (const k of KINDS) expect(isRadialKind(k)).toBe(true)
  })

  it('не считает радиальными древовидные структуры', () => {
    for (const s of ['mindmap', 'tree-right', 'org-chart', 'fishbone', 'radial']) {
      expect(isRadialKind(s)).toBe(false)
    }
  })

  it('в таблице видов нет дублей и все id радиальные', () => {
    const ids = RADIAL_KINDS.map(k => k.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const k of RADIAL_KINDS) {
      expect(k.label.length).toBeGreaterThan(3)
      expect(k.hint.length).toBeGreaterThan(10)
    }
  })
})

// Тип-гарантия: список видов покрывает union RadialKind целиком.
const _exhaustive: Record<RadialKind, true> = {
  'radial-even': true,
  'radial-packed': true,
  'radial-rings': true,
  'radial-clock': true,
  'radial-sector': true,
}
void _exhaustive
