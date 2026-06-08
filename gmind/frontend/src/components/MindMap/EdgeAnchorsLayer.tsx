// V5.0 — 4 edge anchors that appear on hover/select.
// Наведение на точку → точка превращается в «крестик» (+). От крестика можно:
//   • потянуть на другой узел → создать связь;
//   • потянуть в пустоту → создать дочерний узел в направлении драга (ghost);
//   • кликнуть → сразу создать дочерний узел в направлении точки;
//   • правый клик → меню выбора направления.
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
  const openAnchorMenu = useRelationshipsStore(s => s.openAnchorMenu)
  const isDragging = useRelationshipsStore(s => s.drag.isDragging)
  const [hovered, setHovered] = useState<AnchorSide | null>(null)

  if (!node) return null
  // Hide during drag to avoid blocking pointer events on target nodes.
  if (isDragging) return null

  const { x, y, width, height } = node
  const topicId = node.topic.id

  // Count existing children per direction (by their laid-out position relative
  // to this node's centre) so each anchor can show its branch count.
  const counts: Record<AnchorSide, number> = { top: 0, right: 0, bottom: 0, left: 0 }
  const ncx = x + width / 2, ncy = y + height / 2
  for (const ch of node.children ?? []) {
    const dx = (ch.x + ch.width / 2) - ncx
    const dy = (ch.y + ch.height / 2) - ncy
    if (Math.abs(dx) >= Math.abs(dy)) counts[dx >= 0 ? 'right' : 'left']++
    else counts[dy >= 0 ? 'bottom' : 'top']++
  }

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
        const count = counts[a.side]
        // Enlarge a little when carrying a count so the digit stays legible.
        const baseR = count > 0 ? 9 : ANCHOR_RADIUS
        const r = isHover ? ANCHOR_HOVER_RADIUS : baseR
        const tick = r * 0.5
        return (
          <g
            key={a.side}
            onPointerEnter={() => setHovered(a.side)}
            onPointerLeave={() => setHovered(prev => (prev === a.side ? null : prev))}
            onPointerDown={(e) => {
              // Только левая кнопка тянет/создаёт; правую отдаём onContextMenu.
              if (e.button !== 0) return
              e.stopPropagation()
              beginDrag(topicId, a.side, a.cx, a.cy)
              try { (e.target as Element).releasePointerCapture(e.pointerId) } catch {}
            }}
            onContextMenu={(e) => {
              // Правый клик по якорю → меню выбора направления.
              e.preventDefault()
              e.stopPropagation()
              openAnchorMenu(topicId, a.side, e.clientX, e.clientY)
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
            {/* Наведение → «крестик» (создать). Иначе — число детей в этом
                направлении внутри кружочка. */}
            {isHover ? (
              <g stroke={ANCHOR_STROKE} strokeWidth={2} strokeLinecap="round" pointerEvents="none">
                <line x1={a.cx - tick} y1={a.cy} x2={a.cx + tick} y2={a.cy} />
                <line x1={a.cx} y1={a.cy - tick} x2={a.cx} y2={a.cy + tick} />
              </g>
            ) : count > 0 ? (
              <text x={a.cx} y={a.cy} textAnchor="middle" dominantBaseline="central"
                fontSize={11} fontWeight={700} fill={ANCHOR_STROKE} pointerEvents="none"
                style={{ userSelect: 'none' }}>
                {count}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
