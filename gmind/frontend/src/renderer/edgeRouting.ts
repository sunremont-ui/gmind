import {
  defaultPortForDirection,
  isChildDirection,
  isNodeSide,
  oppositeNodeSide,
  type NodeSide,
} from '../components/MindMap/nodeDirections'
import type { LayoutNode } from '../types'

export interface Point { x: number; y: number }
export interface NodeObstacle { id: string; x: number; y: number; width: number; height: number }

/** Длина «ножки», которой ребро выходит строго по нормали порта. */
export const PORT_STUB = 18

export function sidePoint(rect: Pick<NodeObstacle, 'x' | 'y' | 'width' | 'height'>, side: NodeSide): Point {
  switch (side) {
    case 'top': return { x: rect.x + rect.width / 2, y: rect.y }
    case 'right': return { x: rect.x + rect.width, y: rect.y + rect.height / 2 }
    case 'bottom': return { x: rect.x + rect.width / 2, y: rect.y + rect.height }
    case 'left': return { x: rect.x, y: rect.y + rect.height / 2 }
  }
}

export function sideVector(side: NodeSide): Point {
  switch (side) {
    case 'top': return { x: 0, y: -1 }
    case 'right': return { x: 1, y: 0 }
    case 'bottom': return { x: 0, y: 1 }
    case 'left': return { x: -1, y: 0 }
  }
}

function geometricSide(parent: LayoutNode, child: LayoutNode): NodeSide {
  const dx = child.x + child.width / 2 - (parent.x + parent.width / 2)
  const dy = child.y + child.height / 2 - (parent.y + parent.height / 2)
  return Math.abs(dx) >= Math.abs(dy)
    ? (dx >= 0 ? 'right' : 'left')
    : (dy >= 0 ? 'bottom' : 'top')
}

/** Exact four-port endpoints for a parent/child tree edge. */
export function treeEdgeEndpoints(parent: LayoutNode, child: LayoutNode) {
  const fromSide = isNodeSide(child.topic?.parent_anchor)
    ? child.topic.parent_anchor
    : isChildDirection(child.topic?.child_dir)
      ? defaultPortForDirection(child.topic.child_dir)
      : child.placedDir
        ? defaultPortForDirection(child.placedDir)
        : geometricSide(parent, child)
  const toSide = oppositeNodeSide(fromSide)
  return {
    from: sidePoint({ x: parent.x, y: parent.y, width: parent.width, height: parent.height }, fromSide),
    to: sidePoint({ x: child.x, y: child.y, width: child.width, height: child.height }, toSide),
    fromSide,
    toSide,
  }
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01
}

function compact(points: Point[]): Point[] {
  const result: Point[] = []
  for (const point of points) {
    if (!result.length || !samePoint(result[result.length - 1], point)) result.push(point)
  }
  for (let i = result.length - 2; i > 0; i--) {
    const a = result[i - 1], b = result[i], c = result[i + 1]
    const ab = { x: b.x - a.x, y: b.y - a.y }
    const bc = { x: c.x - b.x, y: c.y - b.y }
    const cross = ab.x * bc.y - ab.y * bc.x
    const dot = ab.x * bc.x + ab.y * bc.y
    if (Math.abs(cross) < 0.01 && dot >= 0) result.splice(i, 1)
  }
  return result
}

/**
 * Единственная форма ребра на холсте: короткая ножка по нормали порта на обоих
 * концах и прямой перегон между ними.
 *
 * Обход узлов и чужих линий здесь сознательно не делается. Раскладка уже
 * гарантирует, что сами узлы не перекрываются, а пересечение линии с соседней
 * веткой читается несравнимо легче, чем крюк в объезд: по крюку невозможно
 * понять, из какого луча веера вышел ребёнок, а ради этого веер и существует.
 */
export function routePortToPort(
  from: Point,
  to: Point,
  fromSide: NodeSide,
  toSide: NodeSide,
  strokeWidth = 2,
): Point[] {
  const fv = sideVector(fromSide)
  const tv = sideVector(toSide)
  // Обе ножки съедают один и тот же зазор по нормали порта, поэтому на близком
  // соседе их надо укоротить — иначе концы «перелетают» друг друга и вместо
  // прямого перегона получается крючок.
  const gap = (to.x - from.x) * fv.x + (to.y - from.y) * fv.y
  const stub = Math.max(0, Math.min(PORT_STUB + strokeWidth / 2, gap / 2))
  return compact([
    from,
    { x: from.x + fv.x * stub, y: from.y + fv.y * stub },
    { x: to.x + tv.x * stub, y: to.y + tv.y * stub },
    to,
  ])
}

/** Tree edge: exact four-port endpoints plus the shared simple shape. */
export function routeTreeEdge(
  parent: LayoutNode,
  child: LayoutNode,
  strokeWidth = 2,
): ReturnType<typeof treeEdgeEndpoints> & { route: Point[] } {
  const endpoints = treeEdgeEndpoints(parent, child)
  return {
    ...endpoints,
    route: routePortToPort(
      endpoints.from, endpoints.to, endpoints.fromSide, endpoints.toSide, strokeWidth,
    ),
  }
}

export function routeToPath(points: Point[], style = 'curved'): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (style === 'straight' && points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }
  if (style === 'angled' || style === 'straight') {
    return `M ${points[0].x} ${points[0].y} ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`
  }

  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], point = points[i], next = points[i + 1]
    const inLen = Math.hypot(point.x - prev.x, point.y - prev.y)
    const outLen = Math.hypot(next.x - point.x, next.y - point.y)
    const radius = Math.min(12, inLen / 2, outLen / 2)
    const before = {
      x: point.x + (prev.x - point.x) * radius / Math.max(1, inLen),
      y: point.y + (prev.y - point.y) * radius / Math.max(1, inLen),
    }
    const after = {
      x: point.x + (next.x - point.x) * radius / Math.max(1, outLen),
      y: point.y + (next.y - point.y) * radius / Math.max(1, outLen),
    }
    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`
  }
  const last = points[points.length - 1]
  return `${path} L ${last.x} ${last.y}`
}

export function pointHalfway(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    lengths.push(length)
    total += length
  }
  let remaining = total / 2
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] === 0 ? 0 : remaining / lengths[i]
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      }
    }
    remaining -= lengths[i]
  }
  return points[points.length - 1]
}
