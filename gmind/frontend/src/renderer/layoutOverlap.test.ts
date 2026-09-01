// Инварианты «карта читается»: видимые узлы не наезжают друг на друга ни при
// каких направлениях веток, ни на картах любого размера. Раньше глобальный
// проход отключался на картах крупнее 300 узлов, а смешанные направления
// (прямые + диагональные группы одного родителя) накладывались всегда.
import { describe, it, expect } from 'vitest'
import type { Topic, LayoutNode, StructureClass } from '../types'
import { buildLayout, computeTreeLayout } from './layout'
import { routeTreeEdge } from './edgeRouting'

const DIRS = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right']

/** Детерминированный ГПСЧ: тест обязан падать одинаково на любой машине. */
function makeRandom(seed: number) {
  let state = seed >>> 0
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296
}

function randomTopic(
  rnd: () => number,
  prefix: string,
  depth: number,
  breadth: number,
  foldChance = 0.07,
): Topic {
  const children: Topic[] = depth <= 0
    ? []
    : Array.from({ length: Math.floor(rnd() * breadth) + 1 }, (_, i) =>
      randomTopic(rnd, `${prefix}.${i}`, depth - 1, breadth, foldChance))
  return {
    id: prefix,
    title: `узел ${prefix}${rnd() > 0.7 ? ' с довольно длинным заголовком' : ''}`,
    folded: rnd() < foldChance,
    children,
    child_dir: rnd() > 0.5 ? DIRS[Math.floor(rnd() * DIRS.length)] : undefined,
  } as Topic
}

function visibleNodes(root: LayoutNode): LayoutNode[] {
  const out: LayoutNode[] = []
  const walk = (n: LayoutNode) => {
    out.push(n)
    if (n.topic?.folded) return
    for (const child of n.children || []) walk(child)
  }
  walk(root)
  return out
}

/** Пары видимых узлов с реальным (не касательным) пересечением. */
function overlappingPairs(root: LayoutNode): string[] {
  const nodes = visibleNodes(root)
  const bad: string[] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const penX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const penY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (penX > 1 && penY > 1) bad.push(`${a.topic.id}~${b.topic.id}`)
    }
  }
  return bad
}

function topic(id: string, title: string, o: Partial<Topic> = {}): Topic {
  return { id, title, folded: false, children: [], ...o }
}

function layoutOf(root: Topic, structure: StructureClass = 'mindmap') {
  return computeTreeLayout(buildLayout(root), structure).root
}

describe('раскладка без наложений', () => {
  it('все восемь направлений у одного родителя расходятся', () => {
    const children = DIRS.flatMap((dir, i) => [
      topic(`d${i}a`, `${dir} A`, {
        child_dir: dir,
        children: [topic(`d${i}a1`, 'внук A1'), topic(`d${i}a2`, 'внук A2')],
      }),
      topic(`d${i}b`, `${dir} B`, { child_dir: dir }),
    ])
    expect(overlappingPairs(layoutOf(topic('root', 'смешанные направления', { children })))).toEqual([])
  })

  it('ветка, растущая назад, не накрывает своего предка', () => {
    const root = topic('root', 'корень', {
      children: [
        topic('left', 'ветка влево', {
          child_dir: 'left',
          children: [topic('back', 'внук, растущий вправо', { child_dir: 'right' })],
        }),
      ],
    })
    expect(overlappingPairs(layoutOf(root))).toEqual([])
  })

  it.each([
    ['mindmap', 101],
    ['tree-right', 202],
    ['radial', 303],
    ['fishbone', 404],
    ['org-chart', 505],
  ] as Array<[StructureClass, number]>)('%s: случайная карта (seed %i) без наложений', (structure, seed) => {
    const rnd = makeRandom(seed)
    expect(overlappingPairs(layoutOf(randomTopic(rnd, 'r', 4, 4), structure))).toEqual([])
  })

  it('карта крупнее порога старого прохода (>300 узлов) тоже чистая', () => {
    const rnd = makeRandom(7)
    // Ничего не сворачиваем: проверяем именно объём одновременно видимых узлов.
    const root = layoutOf(randomTopic(rnd, 'L', 7, 4, 0), 'mindmap')
    expect(visibleNodes(root).length).toBeGreaterThan(300)
    expect(overlappingPairs(root)).toEqual([])
  })

  it('свёрнутый узел прячет поддерево и не считается наложением', () => {
    const root = topic('root', 'корень', {
      children: [
        topic('folded', 'свёрнутая ветка', {
          folded: true,
          children: [topic('hidden1', 'скрытый 1'), topic('hidden2', 'скрытый 2')],
        }),
        topic('plain', 'обычная ветка'),
      ],
    })
    const laid = layoutOf(root)
    expect(overlappingPairs(laid)).toEqual([])
    const folded = laid.children.find(c => c.topic.id === 'folded')!
    expect(folded.children.every(c => c.x === folded.x && c.y === folded.y)).toBe(true)
  })
})

describe('рёбра дерева', () => {
  it('ножки ребра не заходят внутрь ни родителя, ни ребёнка', () => {
    const children = DIRS.map((dir, i) =>
      topic(`c${i}`, `${dir} ветка`, { child_dir: dir, children: [topic(`g${i}`, 'внук')] }))
    const laid = layoutOf(topic('root', 'корень карты', { children }))
    const inside = (p: { x: number; y: number }, n: LayoutNode) =>
      p.x > n.x + 0.5 && p.x < n.x + n.width - 0.5 && p.y > n.y + 0.5 && p.y < n.y + n.height - 0.5

    const problems: string[] = []
    const walk = (parent: LayoutNode) => {
      for (const child of parent.children || []) {
        for (const point of routeTreeEdge(parent, child, 2).route) {
          if (inside(point, parent)) problems.push(`${parent.topic.id}->${child.topic.id}: точка внутри родителя`)
          if (inside(point, child)) problems.push(`${parent.topic.id}->${child.topic.id}: точка внутри ребёнка`)
        }
        walk(child)
      }
    }
    walk(laid)
    expect(problems).toEqual([])
  })
})
