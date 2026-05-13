import type { Relationship } from '../../types'
import { colors, fontSizes } from '../../styles/tokens'

interface RelationshipLineProps {
  relationship: Relationship
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export function RelationshipLine({
  relationship,
  fromX,
  fromY,
  toX,
  toY,
}: RelationshipLineProps) {
  const midX = (fromX + toX) / 2

  return (
    <g pointerEvents="none">
      <path
        d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
        fill="none"
        stroke={colors.orange}
        strokeWidth="2"
        strokeDasharray="6,3"
        markerEnd="url(#arrowhead)"
      />
      {relationship.title && (
        <text
          x={midX}
          y={(fromY + toY) / 2 - 8}
          textAnchor="middle"
          fontSize={fontSizes.label}
          fill={colors.orange}
          fontStyle="italic"
          opacity={0.8}
        >
          {relationship.title}
        </text>
      )}
    </g>
  )
}
