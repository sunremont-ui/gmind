// V6.0 Phase 2 — Layer Map: 6 karp model cards over 8 MASys raw layers.
import { useMemo, useState } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { aggregateLayers, healthColor, healthLabel, type AggregatedLayer, type KarpLayer } from './layerMapping'
import { LayerDrillDown } from './LayerDrillDown'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

export function LayerMap() {
  const s = useMASysMemoryStore()
  const [active, setActive] = useState<KarpLayer | null>(null)

  const layers: AggregatedLayer[] = useMemo(() => aggregateLayers({
    episodes: s.episodes,
    entities: s.entities,
    skills: s.skills,
    conversations: s.conversations,
    wiki: s.wiki,
    results: s.results,
    decisions: s.decisions,
    pending: s.pending,
  }), [s.episodes, s.entities, s.skills, s.conversations, s.wiki, s.results, s.decisions, s.pending])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: spacing.md,
      padding: spacing.lg,
    }}>
      {layers.map(layer => (
        <LayerCard key={layer.key} layer={layer} onOpen={() => setActive(layer.key)} />
      ))}
      {active && (
        <LayerDrillDown
          layerKey={active}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}

function LayerCard({ layer, onOpen }: { layer: AggregatedLayer; onOpen: () => void }) {
  const hcolor = healthColor(layer.health.level)
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left',
        padding: spacing.md,
        background: colors.bgTertiary,
        boxShadow: shadows.neuMd,
        borderRadius: radii.lg,
        border: 'none',
        fontFamily: fonts.ui,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
        transition: `box-shadow ${transitions.fast}, transform ${transitions.fast}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = shadows.neuLg
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = shadows.neuMd
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 22 }}>{layer.icon}</span>
        <span style={{
          fontSize: fontSizes.caption,
          color: hcolor,
          padding: `2px 6px`,
          background: `${hcolor}1c`,
          borderRadius: radii.sm,
        }}>
          {healthLabel(layer.health.level)}
        </span>
      </div>
      <div style={{
        fontSize: fontSizes.subhead,
        fontWeight: fontWeights.semibold,
        color: colors.text,
      }}>
        {layer.label}
      </div>
      <div style={{
        fontSize: 10, color: colors.textQuaternary,
        lineHeight: 1.3,
        minHeight: 26,
      }}>
        {layer.description}
      </div>

      {/* Parts */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        marginTop: spacing.xs,
      }}>
        {layer.parts.map((part, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: fontSizes.caption,
            color: colors.textSecondary,
          }}>
            <span>{part.label}</span>
            {part.count >= 0 && (
              <span style={{ color: colors.text, fontWeight: fontWeights.medium }}>
                {part.count}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Health notes */}
      {layer.health.notes.length > 0 && (
        <div style={{
          marginTop: spacing.xs,
          padding: spacing.xs,
          background: `${hcolor}10`,
          borderRadius: radii.sm,
          fontSize: 10,
          color: hcolor,
          lineHeight: 1.4,
        }}>
          {layer.health.notes.map((n, i) => <div key={i}>• {n}</div>)}
        </div>
      )}
    </button>
  )
}
