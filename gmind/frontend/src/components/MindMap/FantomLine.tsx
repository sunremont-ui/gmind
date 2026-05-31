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
      <circle
        cx={currentX}
        cy={currentY}
        r={6}
        fill={snapping ? colors.green : colors.accent}
        stroke="#fff"
        strokeWidth={1.5}
        opacity={0.9}
      />
    </g>
  )
}
