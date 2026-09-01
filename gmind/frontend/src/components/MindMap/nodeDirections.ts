export type ChildDirection =
  | 'up-left' | 'up' | 'up-right'
  | 'right' | 'down-right'
  | 'down' | 'down-left' | 'left'

/** One of the four physical connection ports on a node. */
export type NodeSide = 'top' | 'right' | 'bottom' | 'left'

export interface DirectionVector {
  x: -1 | 0 | 1
  y: -1 | 0 | 1
}

export const DIRECTION_VECTORS: Record<ChildDirection, DirectionVector> = {
  'up-left': { x: -1, y: -1 },
  up: { x: 0, y: -1 },
  'up-right': { x: 1, y: -1 },
  right: { x: 1, y: 0 },
  'down-right': { x: 1, y: 1 },
  down: { x: 0, y: 1 },
  'down-left': { x: -1, y: 1 },
  left: { x: -1, y: 0 },
}

export const CHILD_DIRECTIONS = Object.keys(DIRECTION_VECTORS) as ChildDirection[]

/** The three 45-degree rays which may leave each physical node port. */
export const DIRECTIONS_BY_PORT: Record<NodeSide, readonly ChildDirection[]> = {
  top: ['up-left', 'up', 'up-right'],
  right: ['up-right', 'right', 'down-right'],
  bottom: ['down-right', 'down', 'down-left'],
  left: ['down-left', 'left', 'up-left'],
}

const CENTRAL_DIRECTION_BY_PORT: Record<NodeSide, ChildDirection> = {
  top: 'up',
  right: 'right',
  bottom: 'down',
  left: 'left',
}

export function isChildDirection(value: string | undefined): value is ChildDirection {
  return !!value && value in DIRECTION_VECTORS
}

export function isDiagonalDirection(value: string | undefined): value is ChildDirection {
  if (!isChildDirection(value)) return false
  const vector = DIRECTION_VECTORS[value]
  return vector.x !== 0 && vector.y !== 0
}

export function isNodeSide(value: string | undefined): value is NodeSide {
  return value === 'top' || value === 'right' || value === 'bottom' || value === 'left'
}

export function isDirectionCompatibleWithPort(side: NodeSide, direction: ChildDirection): boolean {
  return DIRECTIONS_BY_PORT[side].includes(direction)
}

/**
 * Select the allowed ray closest to the child's current geometric bearing.
 * A zero-length/non-finite vector and exact angular ties intentionally use the
 * port's central ray so dragging an endpoint never produces an arbitrary turn.
 */
export function closestDirectionForPort(side: NodeSide, dx: number, dy: number): ChildDirection {
  const central = CENTRAL_DIRECTION_BY_PORT[side]
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length < 1e-6) return central

  const nx = dx / length
  const ny = dy / length
  let best = central
  let bestScore = -Infinity
  let tied = false

  for (const direction of DIRECTIONS_BY_PORT[side]) {
    const vector = DIRECTION_VECTORS[direction]
    const vectorLength = Math.hypot(vector.x, vector.y)
    const score = nx * (vector.x / vectorLength) + ny * (vector.y / vectorLength)
    if (score > bestScore + 1e-9) {
      best = direction
      bestScore = score
      tied = false
    } else if (Math.abs(score - bestScore) <= 1e-9) {
      tied = true
    }
  }

  return tied ? central : best
}

export function oppositeNodeSide(side: NodeSide): NodeSide {
  switch (side) {
    case 'top': return 'bottom'
    case 'right': return 'left'
    case 'bottom': return 'top'
    case 'left': return 'right'
  }
}

/**
 * Default port for keyboard/legacy creation where there is no clicked fan.
 * Mouse creation always supplies the actual physical port separately.
 */
export function defaultPortForDirection(direction: ChildDirection): NodeSide {
  switch (direction) {
    case 'up-left':
    case 'up':
    case 'up-right': return 'top'
    case 'right': return 'right'
    case 'down-right':
    case 'down':
    case 'down-left': return 'bottom'
    case 'left': return 'left'
  }
}

export function directionLabel(direction: ChildDirection): string {
  const labels: Record<ChildDirection, string> = {
    'up-left': 'Вверх-влево', up: 'Вверх', 'up-right': 'Вверх-вправо',
    right: 'Вправо', 'down-right': 'Вниз-вправо', down: 'Вниз',
    'down-left': 'Вниз-влево', left: 'Влево',
  }
  return labels[direction]
}
