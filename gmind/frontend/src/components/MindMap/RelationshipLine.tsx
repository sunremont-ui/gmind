// V5.0 — typed/directional relationship rendering.
// Supports forward (one arrow), bidirectional (two arrows), undirected (no arrow).
// Multi-edge: parallel offsets when several edges connect the same pair.
// Self-loop: dome arc to the right of the node.
import type { Relationship } from '../../types'
import { RELATIONSHIP_TYPE_COLORS, RELATIONSHIP_TYPE_STYLES } from '../../api/relationships'
import { relationshipDirection, relationshipFromId, relationshipToId, relationshipType, useRelationshipsStore } from '../../store/relationships'
import { colors, fontSizes } from '../../styles/tokens'

interface Props {
  relationship: Relationship
  fromX: number
  fromY: number
  toX: number
  toY: number
  offsetIndex?: number   // for multi-edge offset (0 = center)
  offsetCount?: number   // total parallel edges in the bundle
  selfLoopRadius?: number // when from === to (self-loop)
  nodeWidth?: number
  nodeHeight?: number
}

const STROKE_COLOR_BY_TYPE = RELATIONSHIP_TYPE_COLORS
const PAR_OFFSET = 8     // pixels between parallel multi-edges

function dashForStyle(s: string): string | undefined {
  switch (s) {
    case 'dashed': return '6,3'
    case 'dotted': return '2,4'
    default: return undefined
  }
}

export function RelationshipLine({
  relationship,
  fromX, fromY, toX, toY,
  offsetIndex = 0,
  offsetCount = 1,
  selfLoopRadius = 36,
  nodeWidth = 0,
  nodeHeight = 0,
}: Props) {
  const type = relationshipType(relationship)
  const direction = relationshipDirection(relationship)
  const baseColor = relationship.color || STROKE_COLOR_BY_TYPE[type] || colors.orange
  const baseStyle = relationship.style || RELATIONSHIP_TYPE_STYLES[type]?.style || 'solid'
  const weight = relationship.weight ?? RELATIONSHIP_TYPE_STYLES[type]?.weight ?? 1.5

  const selected = useRelationshipsStore(s => s.selectedRelId === relationship.id)
  const highlight = useRelationshipsStore(s => s.highlightTopicId)
  const visibleTypes = useRelationshipsStore(s => s.visibleTypes)
  const selectRel = useRelationshipsStore(s => s.selectRel)

  if (!visibleTypes.has(type)) return null

  const fromId = relationshipFromId(relationship)
  const toId = relationshipToId(relationship)
  const dimmed = highlight != null && highlight !== fromId && highlight !== toId

  const markerId =
    direction === 'forward' ? `rel-arrow-${type}` :
    direction === 'bidirectional' ? `rel-arrow-${type}` : ''

  const stroke = baseColor
  const opacity = selected ? 1 : dimmed ? 0.18 : 0.78
  const strokeWidth = selected ? weight * 1.7 : weight
  const dash = dashForStyle(baseStyle)

  // Self-loop branch
  if (fromId === toId) {
    const r = selfLoopRadius
    const startX = fromX + (nodeWidth || 0)
    const startY = fromY + (nodeHeight || 0) / 2
    const path = `M ${startX} ${startY}
      C ${startX + r * 1.4} ${startY - r}, ${startX + r * 1.4} ${startY + r}, ${startX} ${startY + 2}`
    return (
      <g pointerEvents="auto" onClick={(e) => { e.stopPropagation(); selectRel(relationship.id) }}>
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          markerEnd={markerId ? `url(#${markerId})` : undefined}
          opacity={opacity}
        />
        {relationship.title && (
          <text
            x={startX + r * 1.4 + 4}
            y={startY}
            fontSize={fontSizes.caption}
            fill={stroke}
            fontStyle="italic"
            opacity={opacity}
          >
            {relationship.title}
          </text>
        )}
      </g>
    )
  }

  // Compute parallel offset perpendicular to the line
  const dx = toX - fromX
  const dy = toY - fromY
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy))
  const nx = -dy / len // unit normal
  const ny = dx / len
  // offsetIndex 0..count-1 → centered fan: (-count/2 .. +count/2) * PAR_OFFSET
  const ofs = (offsetIndex - (offsetCount - 1) / 2) * PAR_OFFSET
  const ox = nx * ofs
  const oy = ny * ofs

  const sx = fromX + ox
  const sy = fromY + oy
  const ex = toX + ox
  const ey = toY + oy

  const midX = (sx + ex) / 2

  const path = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ey}, ${ex} ${ey}`

  return (
    <g
      pointerEvents="auto"
      onClick={(e) => { e.stopPropagation(); selectRel(relationship.id) }}
      style={{ cursor: 'pointer' }}
    >
      {/* Wider invisible hit area for easier clicking */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        markerStart={direction === 'bidirectional' ? `url(#${markerId}-rev)` : undefined}
        markerEnd={direction === 'undirected' ? undefined : `url(#${markerId})`}
        opacity={opacity}
      />
      {relationship.title && (
        <text
          x={midX}
          y={(sy + ey) / 2 - 8}
          textAnchor="middle"
          fontSize={fontSizes.caption}
          fill={stroke}
          fontStyle="italic"
          opacity={opacity}
        >
          {relationship.title}
        </text>
      )}
    </g>
  )
}

// Inject SVG arrow markers for all relationship types (used by RelationshipLine).
export function RelationshipMarkers() {
  const types = Object.keys(STROKE_COLOR_BY_TYPE)
  return (
    <defs>
      {types.map(t => (
        <g key={t}>
          <marker
            id={`rel-arrow-${t}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE_COLOR_BY_TYPE[t]} />
          </marker>
          <marker
            id={`rel-arrow-${t}-rev`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE_COLOR_BY_TYPE[t]} />
          </marker>
        </g>
      ))}
    </defs>
  )
}
