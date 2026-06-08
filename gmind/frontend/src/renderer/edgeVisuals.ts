// Pure helpers for tree-edge visuals (extracted from renderer for testing).
import type { LayoutNode } from '../types'

export type Side = 'top' | 'right' | 'bottom' | 'left'

// Edge weight → colour on a cold→hot scale (blue = light, red = heavy).
// Domain ~1..16 (matches the Edge Weight control); clamps outside it.
export function weightToColor(w: number): string {
  const t = Math.max(0, Math.min(1, (w - 1) / 15))
  const hue = 220 - t * 220 // 220° blue → 0° red
  return `hsl(${Math.round(hue)}, 78%, 52%)`
}

// Edge thickness from the size of the subtree it carries, like a tree branch:
// the trunk (many descendants) is thick, twigs (leaves) are thin.
export function thicknessForSubtree(size: number): number {
  return 1.5 + Math.min(size - 1, 40) * 0.15 // 1.5px (leaf) → ~7.5px
}

// Which side of `node` the `child` sits on, by laid-out geometry.
export function sideOf(node: LayoutNode, child: LayoutNode): Side {
  const dx = (child.x + child.width / 2) - (node.x + node.width / 2)
  const dy = (child.y + child.height / 2) - (node.y + node.height / 2)
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top')
}
