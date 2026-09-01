export interface SpatialNode {
  cx: number
  cy: number
}

export type NavigationDirection = 'up' | 'right' | 'down' | 'left'

/**
 * Ищет ближайший визуальный узел в заданной полуплоскости. Поперечное
 * отклонение штрафуется сильнее продольного, поэтому стрелка продолжает
 * текущую ветвь, а не прыгает к случайному близкому узлу сбоку.
 */
export function nearestNodeInDirection(
  nodes: ReadonlyMap<string, SpatialNode>,
  fromId: string,
  direction: NavigationDirection,
): string | null {
  const origin = nodes.get(fromId)
  if (!origin) return null

  let bestId: string | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const [id, node] of nodes) {
    if (id === fromId) continue
    const dx = node.cx - origin.cx
    const dy = node.cy - origin.cy
    const primary = direction === 'right' ? dx
      : direction === 'left' ? -dx
        : direction === 'down' ? dy : -dy
    if (primary <= 1) continue
    const cross = direction === 'right' || direction === 'left' ? Math.abs(dy) : Math.abs(dx)
    const score = primary + cross * 1.8
    if (score < bestScore) {
      bestScore = score
      bestId = id
    }
  }
  return bestId
}
