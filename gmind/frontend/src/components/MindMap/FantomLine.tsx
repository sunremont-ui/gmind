// V5.0 — animated phantom edge that follows the cursor during anchor drag.
import { useRelationshipsStore } from '../../store/relationships'
import { colors } from '../../styles/tokens'

export function FantomLine() {
  const drag = useRelationshipsStore(s => s.drag)
  if (!drag.isDragging) return null
  const { startX, startY, currentX, currentY, hoverTopicId } = drag
  const midX = (startX + currentX) / 2
  const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${currentY}, ${currentX} ${currentY}`
  const snapping = hoverTopicId != null && hoverTopicId !== drag.fromTopicId
  // Призрак будущего узла, пока курсор в пустоте (не примагничен к узлу).
  const GHOST_W = 96
  const GHOST_H = 40
  return (
    <g pointerEvents="none">
      <path
        d={path}
        fill="none"
        stroke={snapping ? colors.green : colors.accent}
        strokeWidth={2}
        strokeDasharray="6,4"
        opacity={0.85}
      />
      {snapping ? (
        <circle
          cx={currentX}
          cy={currentY}
          r={6}
          fill={colors.green}
          stroke="#fff"
          strokeWidth={1.5}
          opacity={0.9}
        />
      ) : (
        <rect
          x={currentX - GHOST_W / 2}
          y={currentY - GHOST_H / 2}
          width={GHOST_W}
          height={GHOST_H}
          rx={10}
          fill={colors.accentLight}
          stroke={colors.accent}
          strokeWidth={2}
          strokeDasharray="6,4"
          opacity={0.9}
        />
      )}
    </g>
  )
}
