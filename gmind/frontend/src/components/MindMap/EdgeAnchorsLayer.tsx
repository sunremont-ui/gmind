// V5.0 — 4 edge anchors that appear on hover/select.
// Наведение на точку → точка превращается в «крестик» (+). От крестика можно:
//   • потянуть на другой узел → создать связь;
//   • потянуть в пустоту → создать дочерний узел в направлении драга (ghost);
//   • кликнуть → меню выбора направления.
import { useState } from 'react'
import type { LayoutNode } from '../../types'
import { useRelationshipsStore } from '../../store/relationships'
import type { AnchorSide } from '../../store/relationships'
import { colors } from '../../styles/tokens'

interface Props {
  node: LayoutNode | null
}

const ANCHOR_RADIUS = 7
const ANCHOR_HOVER_RADIUS = 11
const ANCHOR_FILL = colors.accent
const ANCHOR_STROKE = '#fff'

export function EdgeAnchorsLayer({ node }: Props) {
  const beginDrag = useRelationshipsStore(s => s.beginDrag)
  const isDragging = useRelationshipsStore(s => s.drag.isDragging)
  const [hovered, setHovered] = useState<AnchorSide | null>(null)

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
      {anchors.map(a => {
        const isHover = hovered === a.side
        const r = isHover ? ANCHOR_HOVER_RADIUS : ANCHOR_RADIUS
        const tick = r * 0.5
        return (
          <g
            key={a.side}
            onPointerEnter={() => setHovered(a.side)}
            onPointerLeave={() => setHovered(prev => (prev === a.side ? null : prev))}
            onPointerDown={(e) => {
              e.stopPropagation()
              beginDrag(topicId, a.side, a.cx, a.cy)
              try { (e.target as Element).releasePointerCapture(e.pointerId) } catch {}
            }}
            data-anchor-side={a.side}
            style={{ cursor: 'crosshair' }}
          >
            <circle
              cx={a.cx}
              cy={a.cy}
              r={r}
              fill={ANCHOR_FILL}
              stroke={ANCHOR_STROKE}
              strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))', transition: 'r 80ms ease' }}
            />
            {/* «Крестик»: появляется при наведении на точку. */}
            {isHover && (
              <g stroke={ANCHOR_STROKE} strokeWidth={2} strokeLinecap="round" pointerEvents="none">
                <line x1={a.cx - tick} y1={a.cy} x2={a.cx + tick} y2={a.cy} />
                <line x1={a.cx} y1={a.cy - tick} x2={a.cx} y2={a.cy + tick} />
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}
