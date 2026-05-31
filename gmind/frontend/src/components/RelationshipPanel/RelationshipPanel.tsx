// V5.0 — sidebar to inspect / edit / delete a selected relationship.
import { useState, useEffect } from 'react'
import { useRelationshipsStore } from '../../store/relationships'
import { RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_TYPE_COLORS } from '../../api/relationships'
import type { RelationshipType, RelationshipDirection, RelationshipStyle } from '../../types/api'
import { colors, fonts, fontSizes, spacing, radii, shadows } from '../../styles/tokens'

const TYPE_OPTIONS: RelationshipType[] = [
  'relates_to', 'depends_on', 'supports', 'contradicts', 'references', 'blocks', 'custom'
]
const STYLE_OPTIONS: RelationshipStyle[] = ['solid', 'dashed', 'dotted']

export function RelationshipPanel() {
  const selectedRelId = useRelationshipsStore(s => s.selectedRelId)
  const relationships = useRelationshipsStore(s => s.relationships)
  const update = useRelationshipsStore(s => s.update)
  const remove = useRelationshipsStore(s => s.remove)
  const selectRel = useRelationshipsStore(s => s.selectRel)

  const rel = relationships.find(r => r.id === selectedRelId) || null
  const [type, setType] = useState<RelationshipType>('relates_to')
  const [direction, setDirection] = useState<RelationshipDirection>('forward')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [weight, setWeight] = useState(1)
  const [style, setStyle] = useState<RelationshipStyle>('solid')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!rel) return
    setType((rel.type as RelationshipType) || 'relates_to')
    setDirection((rel.direction as RelationshipDirection) || 'forward')
    setTitle(rel.title || '')
    setNotes(rel.notes || '')
    setWeight(rel.weight ?? 1)
    setStyle((rel.style as RelationshipStyle) || 'solid')
  }, [rel?.id])

  if (!rel) return null

  const save = async () => {
    setBusy(true)
    try {
      await update(rel.id, { type, direction, title: title || undefined, notes, weight, style })
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (!confirm('Удалить связь?')) return
    setBusy(true)
    try {
      await remove(rel.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: spacing.lg,
        top: 80,
        width: 320,
        background: colors.bgTertiary,
        borderRadius: radii.xl,
        boxShadow: shadows.neuLg,
        padding: spacing.lg,
        fontFamily: fonts.ui,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: fontSizes.subhead, fontWeight: 600, color: colors.text }}>
          🔗 Свойства связи
        </div>
        <button
          onClick={() => selectRel(null)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textQuaternary, fontSize: fontSizes.body,
          }}
        >✕</button>
      </div>

      <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>
        <div><strong>ID:</strong> <code style={{ fontSize: 10 }}>{rel.id.slice(0, 12)}…</code></div>
        <div>From: <code style={{ fontSize: 10 }}>{(rel.from_topic_id || rel.end1_id).slice(0, 8)}…</code></div>
        <div>To: <code style={{ fontSize: 10 }}>{(rel.to_topic_id || rel.end2_id).slice(0, 8)}…</code></div>
        {rel.created_by && <div>Кем: {rel.created_by}</div>}
      </div>

      <Section label="Тип">
        <select
          value={type}
          onChange={e => setType(e.target.value as RelationshipType)}
          style={selectStyle()}
        >
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{RELATIONSHIP_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <span style={{ fontSize: 10, color: RELATIONSHIP_TYPE_COLORS[type] }}>● {RELATIONSHIP_TYPE_COLORS[type]}</span>
      </Section>

      <Section label="Направление">
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
            >{d === 'forward' ? '→' : d === 'bidirectional' ? '↔' : '—'}</button>
          ))}
        </div>
      </Section>

      <Section label="Метка">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="опционально"
          style={selectStyle()}
        />
      </Section>

      <Section label={`Вес (${weight.toFixed(1)})`}>
        <input
          type="range"
          min={0.1} max={3} step={0.1}
          value={weight}
          onChange={e => setWeight(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </Section>

      <Section label="Стиль">
        <div style={{ display: 'flex', gap: spacing.xs }}>
          {STYLE_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              style={{
                flex: 1,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                background: colors.bgTertiary,
                boxShadow: style === s ? shadows.neuInsetSm : shadows.neuSm,
                border: 'none',
                borderRadius: radii.sm,
                color: style === s ? colors.accent : colors.text,
                fontSize: fontSizes.caption,
                cursor: 'pointer',
              }}
            >{s}</button>
          ))}
        </div>
      </Section>

      <Section label="Заметки">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          placeholder="обоснование связи…"
          style={{
            ...selectStyle(),
            resize: 'vertical',
            minHeight: 60,
          }}
        />
      </Section>

      <div style={{ display: 'flex', gap: spacing.sm }}>
        <button
          onClick={del}
          disabled={busy}
          style={btnStyle(colors.red, true)}
        >Удалить</button>
        <button
          onClick={save}
          disabled={busy}
          style={btnStyle(colors.accent)}
        >{busy ? 'Сохранение…' : 'Сохранить'}</button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
      <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>{label}</span>
      {children}
    </label>
  )
}

function selectStyle(): React.CSSProperties {
  return {
    padding: `${spacing.xs}px ${spacing.sm}px`,
    background: colors.bgTertiary,
    boxShadow: shadows.neuInsetSm,
    border: 'none',
    borderRadius: radii.sm,
    color: colors.text,
    fontSize: fontSizes.label,
    fontFamily: fonts.ui,
    width: '100%',
  }
}

function btnStyle(color: string, danger = false): React.CSSProperties {
  return {
    flex: 1,
    padding: `${spacing.xs}px ${spacing.md}px`,
    background: danger ? 'transparent' : color,
    color: danger ? color : '#fff',
    boxShadow: danger ? shadows.neuSm : 'none',
    border: danger ? `1px solid ${color}` : 'none',
    borderRadius: radii.sm,
    fontSize: fontSizes.label,
    fontWeight: 600,
    fontFamily: fonts.ui,
    cursor: 'pointer',
  }
}
