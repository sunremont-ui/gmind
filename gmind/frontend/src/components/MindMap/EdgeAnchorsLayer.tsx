// V5.0 — 4 edge anchors that appear on hover/select; drag from any starts a new relationship.
import type { LayoutNode } from '../../types'
import { useRelationshipsStore } from '../../store/relationships'
import type { AnchorSide } from '../../store/relationships'
import { colors } from '../../styles/tokens'

interface Props {
  node: LayoutNode | null
}

const ANCHOR_RADIUS = 6
const ANCHOR_FILL = colors.accent
const ANCHOR_STROKE = '#fff'

export function EdgeAnchorsLayer({ node }: Props) {
  const beginDrag = useRelationshipsStore(s => s.beginDrag)
  const isDragging = useRelationshipsStore(s => s.drag.isDragging)

  if (!node) return null
  // Hide during drag to avoid blocking pointer events on target nodes.
  if (isDragging) return null

  const { x, y, width, height } = node
  const topicId = node.topic.id

  const anchors: Array<{ side: AnchorSide; cx: number; cy: number }> = [
    { side: 'top',    cx: x + width / 2, cy: y },
    { side: 'right',  cx: x + width,     cy: y + height / 2 },
    { side: 'bottom', cx: x + width / 2, cy: y + height },
    { side: 'left',   cx: x,             cy: y + height / 2 },
  ]

  return (
    <g pointerEvents="all">
      {anchors.map(a => (
        <circle
          key={a.side}
          cx={a.cx}
          cy={a.cy}
          r={ANCHOR_RADIUS}
          fill={ANCHOR_FILL}
          stroke={ANCHOR_STROKE}
          strokeWidth={1.5}
          style={{ cursor: 'crosshair', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            beginDrag(topicId, a.side, a.cx, a.cy)
            try { (e.target as Element).releasePointerCapture(e.pointerId) } catch {}
          }}
          data-anchor-side={a.side}
        />
      ))}
    </g>
  )
}
