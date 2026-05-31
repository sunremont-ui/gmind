// V5.0 Phase 5 — filter toolbar for relationship types.
// Floats at top-right of the canvas, lets user toggle visibility per type.
import { useRelationshipsStore } from '../../store/relationships'
import { RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_TYPE_COLORS } from '../../api/relationships'
import type { RelationshipType } from '../../types/api'
import { colors, fonts, fontSizes, spacing, radii, shadows } from '../../styles/tokens'

const TYPES: RelationshipType[] = [
  'relates_to', 'depends_on', 'supports', 'contradicts', 'references', 'blocks', 'custom'
]

export function RelationshipFilter() {
  const visibleTypes = useRelationshipsStore(s => s.visibleTypes)
  const toggleType = useRelationshipsStore(s => s.toggleType)
  const setAllVisible = useRelationshipsStore(s => s.setAllTypesVisible)
  const relationships = useRelationshipsStore(s => s.relationships)

  if (relationships.length === 0) return null

  const countsByType = new Map<string, number>()
  for (const rel of relationships) {
    const t = rel.type || 'relates_to'
    countsByType.set(t, (countsByType.get(t) || 0) + 1)
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: spacing.md,
        bottom: spacing.lg,
        background: colors.bgTertiary,
        borderRadius: radii.lg,
        boxShadow: shadows.neuMd,
        padding: spacing.sm,
        fontFamily: fonts.ui,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xxs,
        zIndex: 50,
        maxWidth: 200,
      }}
    >
      <div style={{
        fontSize: fontSizes.caption,
        fontWeight: 600,
        color: colors.text,
        marginBottom: 4,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>🔗 Связи</span>
        <button
          onClick={setAllVisible}
          title="Показать все"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textQuaternary, fontSize: 10,
          }}
        >все</button>
      </div>
      {TYPES.map(t => {
        const count = countsByType.get(t) ?? 0
        if (count === 0) return null
        const visible = visibleTypes.has(t)
        return (
          <button
            key={t}
            onClick={() => toggleType(t)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              padding: `${spacing.xxs}px ${spacing.sm}px`,
              background: 'transparent',
              border: 'none',
              borderRadius: radii.sm,
              cursor: 'pointer',
              opacity: visible ? 1 : 0.4,
              fontSize: fontSizes.caption,
              color: colors.text,
              textAlign: 'left',
              fontFamily: fonts.ui,
            }}
          >
            <span
              style={{
                width: 10, height: 10, borderRadius: 5,
                background: RELATIONSHIP_TYPE_COLORS[t],
              }}
            />
            <span style={{ flex: 1 }}>{RELATIONSHIP_TYPE_LABELS[t]}</span>
            <span style={{ color: colors.textQuaternary, fontSize: 10 }}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
