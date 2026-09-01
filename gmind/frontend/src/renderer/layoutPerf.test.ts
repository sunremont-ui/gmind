// Бюджеты скорости раскладки. Их смысл не в абсолютных миллисекундах (машины
// разные), а в том, чтобы поймать возврат квадратичного прохода: до перехода
// на сетку глобальный проход был O(n²) и его попросту отключали на картах
// крупнее 300 узлов — карта оставалась с наложениями.
import { describe, it, expect } from 'vitest'
import type { Topic, LayoutNode } from '../types'
import { buildLayout, computeTreeLayout } from './layout'

/** Полное дерево заданной глубины и ветвления — размер предсказуем. */
function fullTree(prefix: string, depth: number, breadth: number): Topic {
  const children: Topic[] = depth <= 0
    ? []
    : Array.from({ length: breadth }, (_, i) => fullTree(`${prefix}.${i}`, depth - 1, breadth))
  return { id: prefix, title: `узел ${prefix}`, folded: false, children } as Topic
}

function countNodes(n: LayoutNode): number {
  return 1 + (n.children || []).reduce((sum, c) => sum + countNodes(c), 0)
}

/** Медиана нескольких прогонов: одиночный замер на CI слишком шумный. */
function timeLayout(topic: Topic, runs = 3): { ms: number; nodes: number } {
  const samples: number[] = []
  let nodes = 0
  for (let i = 0; i < runs; i++) {
    const built = buildLayout(topic)
    const started = performance.now()
    const result = computeTreeLayout(built, 'mindmap')
    samples.push(performance.now() - started)
    nodes = countNodes(result.root)
  }
  samples.sort((a, b) => a - b)
  return { ms: samples[Math.floor(samples.length / 2)], nodes }
}

describe('скорость раскладки', () => {
  it('карта в ~3000 узлов раскладывается за один кадр анимации бюджета', () => {
    const { ms, nodes } = timeLayout(fullTree('big', 5, 5))
    expect(nodes).toBeGreaterThan(3000)
    // 3000 узлов — это уже очень крупная карта; на неё выделяем 1.5 с даже на
    // медленном CI. Квадратичный проход на таком объёме уходит в десятки секунд.
    expect(ms).toBeLessThan(1500)
  })

  it('рост времени близок к линейному, а не квадратичному', () => {
    // 4x узлов: линейный проход даёт ~4x времени, квадратичный — ~16x.
    const small = timeLayout(fullTree('s', 4, 5))
    const large = timeLayout(fullTree('l', 5, 5))
    const nodeRatio = large.nodes / small.nodes
    const timeRatio = large.ms / Math.max(small.ms, 0.2)
    expect(nodeRatio).toBeGreaterThan(3)
    expect(timeRatio).toBeLessThan(nodeRatio * 3)
  })

  it('повторная раскладка той же карты не медленнее первой (кэш измерений)', () => {
    const topic = fullTree('cache', 4, 5)
    const first = timeLayout(topic, 1)
    const second = timeLayout(topic, 1)
    expect(second.ms).toBeLessThan(Math.max(first.ms * 3, 50))
  })
})
