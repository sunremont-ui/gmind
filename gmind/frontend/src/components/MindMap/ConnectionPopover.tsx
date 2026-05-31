// V5.0 — popover that appears after dropping the phantom edge on a target node.
// Lets the user pick relationship type, direction, title before creating the edge.
import { useState } from 'react'
import { useRelationshipsStore } from '../../store/relationships'
import { RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_TYPE_COLORS } from '../../api/relationships'
import type { RelationshipType, RelationshipDirection } from '../../types/api'
import { colors, fonts, fontSizes, spacing, radii, shadows } from '../../styles/tokens'

interface Props {
  workbookId: string
}

const TYPE_OPTIONS: RelationshipType[] = [
  'relates_to', 'depends_on', 'supports', 'contradicts', 'references', 'blocks', 'custom'
]

export function ConnectionPopover({ workbookId }: Props) {
  const pending = useRelationshipsStore(s => s.pendingConnection)
  const closePopover = useRelationshipsStore(s => s.closePopover)
  const create = useRelationshipsStore(s => s.create)
  const [type, setType] = useState<RelationshipType>('relates_to')
  const [direction, setDirection] = useState<RelationshipDirection>('forward')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!pending) return null

  const handleSave = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await create(workbookId, {
        from_topic_id: pending.fromTopicId,
        to_topic_id: pending.toTopicId,
        type,
        direction,
        title: title.trim() || undefined,
      })
      // reset
      setType('relates_to')
      setDirection('forward')
      setTitle('')
      closePopover()
    } catch (err) {
      console.error('Create relationship failed:', err)
      setSubmitting(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePopover()
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: Math.max(8, Math.min(window.innerWidth - 310, pending.screenX + 12)),
        top: Math.max(8, Math.min(window.innerHeight - 280, pending.screenY + 12)),
        width: 300,
        background: colors.bgTertiary,
        borderRadius: radii.xl,
        boxShadow: shadows.neuLg,
        padding: spacing.lg,
        fontFamily: fonts.ui,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
      }}
      onKeyDown={handleKey}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ fontSize: fontSizes.subhead, fontWeight: 600, color: colors.text }}>
        🔗 Создать связь
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>Тип</span>
        <select
          value={type}
          onChange={e => setType(e.target.value as RelationshipType)}
          style={{
            padding: `${spacing.xs}px ${spacing.sm}px`,
            background: colors.bgTertiary,
            boxShadow: shadows.neuInsetSm,
            border: 'none',
            borderRadius: radii.sm,
            color: colors.text,
            fontSize: fontSizes.label,
            fontFamily: fonts.ui,
          }}
        >
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{RELATIONSHIP_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <span style={{ fontSize: 10, color: RELATIONSHIP_TYPE_COLORS[type] }}>
          ● {RELATIONSHIP_TYPE_COLORS[type]}
        </span>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>Направление</span>
        <div style={{ display: 'flex', gap: spacing.xs }}>
          {(['forward', 'bidirectional', 'undirected'] as RelationshipDirection[]).map(d => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              style={{
                flex: 1,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                background: colors.bgTertiary,
                boxShadow: direction === d ? shadows.neuInsetSm : shadows.neuSm,
                border: 'none',
                borderRadius: radii.sm,
                color: direction === d ? colors.accent : colors.text,
                fontSize: fontSizes.caption,
                fontFamily: fonts.ui,
                cursor: 'pointer',
              }}
            >
              {d === 'forward' ? '→' : d === 'bidirectional' ? '↔' : '—'}
              <div style={{ fontSize: 9, marginTop: 2 }}>{d}</div>
            </button>
          ))}
        </div>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>Метка (опционально)</span>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="например, 'требует', 'опирается на'…"
          autoFocus
          style={{
            padding: `${spacing.xs}px ${spacing.sm}px`,
            background: colors.bgTertiary,
            boxShadow: shadows.neuInsetSm,
            border: 'none',
            borderRadius: radii.sm,
            color: colors.text,
            fontSize: fontSizes.label,
            fontFamily: fonts.ui,
          }}
        />
      </label>

      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.xs }}>
        <button
          onClick={closePopover}
          style={{
            flex: 1,
            padding: `${spacing.xs}px ${spacing.md}px`,
            background: colors.bgTertiary,
            boxShadow: shadows.neuSm,
            border: 'none',
            borderRadius: radii.sm,
            color: colors.textSecondary,
            fontSize: fontSizes.label,
            fontFamily: fonts.ui,
            cursor: 'pointer',
          }}
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={submitting}
          style={{
            flex: 2,
            padding: `${spacing.xs}px ${spacing.md}px`,
            background: colors.accent,
            color: '#fff',
            border: 'none',
            borderRadius: radii.sm,
            fontSize: fontSizes.label,
            fontWeight: 600,
            fontFamily: fonts.ui,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Создание…' : 'Создать'}
        </button>
      </div>
    </div>
  )
}
