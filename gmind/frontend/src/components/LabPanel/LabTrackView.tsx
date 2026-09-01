// Вид трека: все записи проекта, сгруппированные по виду.
//
// Цвет несёт вердикт оракула, форма — вид записи, а не наоборот: спрашивают у
// экрана чаще всего «что разошлось», и ответ должен быть виден без чтения.
import { useEffect, useMemo, useState } from 'react'
import { labApi } from '../../api/lab'
import type { LabEntry, LabKind, LabProject, LabStatus, LabTrackState } from '../../types/lab'
import {
  KIND_LABEL, KIND_GLYPH, KIND_ORDER, STATUS_LABEL, VERDICT_LABEL, LEVEL_LABEL,
  verdictColor, formatSourceRef,
} from './labVisual'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface Props { project: LabProject }

const STATUS_FILTERS: LabStatus[] = ['accepted', 'proposed', 'superseded', 'revoked']

export function LabTrackView({ project }: Props) {
  const [state, setState] = useState<LabTrackState | null>(null)
  const [entries, setEntries] = useState<LabEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [kinds, setKinds] = useState<LabKind[]>([])
  const [statuses, setStatuses] = useState<LabStatus[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    labApi.track(project.track, project.namespace, true)
      .then(r => {
        if (!alive) return
        setState(r.state)
        setEntries(r.entries ?? [])
        setError(null)
      })
      .catch(e => { if (alive) setError(String((e as Error).message ?? e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [project.track, project.namespace])

  const visible = useMemo(() => entries.filter(e =>
    (kinds.length === 0 || kinds.includes(e.kind))
    && (statuses.length === 0 || statuses.includes(e.status))
  ), [entries, kinds, statuses])

  const grouped = useMemo(() => {
    const map = new Map<LabKind, LabEntry[]>()
    for (const kind of KIND_ORDER) map.set(kind, [])
    for (const e of visible) {
      const bucket = map.get(e.kind)
      if (bucket) bucket.push(e)
    }
    return KIND_ORDER.map(kind => [kind, map.get(kind) ?? []] as const).filter(([, list]) => list.length > 0)
  }, [visible])

  // Записи, отменённые этой: показываем «что заменила», а не только «что заменило».
  const supersededBy = useMemo(() => {
    const map = new Map<string, LabEntry>()
    for (const e of entries) if (e.supersedesId) map.set(e.supersedesId, e)
    return map
  }, [entries])

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) =>
    set(list.includes(value) ? list.filter(v => v !== value) : [...list, value])

  if (loading) {
    return <Note>читаю трек {project.track}…</Note>
  }
  if (error) {
    return <Note tone={colors.red}>трек недоступен: {error}</Note>
  }

  const c = state?.counters

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      {c && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: spacing.md,
          fontSize: fontSizes.caption, color: colors.textSecondary,
        }}>
          <span>записей <b style={{ color: colors.text }}>{c.entries}</b></span>
          <span>принято <b style={{ color: colors.text }}>{c.accepted}</b></span>
          <span>хвостов <b style={{ color: c.openTails ? colors.orange : colors.text }}>{c.openTails}</b></span>
          <span>drift <b style={{ color: c.driftEntries ? colors.red : colors.green }}>{c.driftEntries}</b></span>
          <span>устарело <b style={{ color: c.staleEntries ? colors.orange : colors.text }}>{c.staleEntries}</b></span>
          <span>независимо <b style={{ color: colors.green }}>{c.confirmed.independent}</b></span>
        </div>
      )}

      {state?.next && (
        <div style={{
          marginTop: spacing.md, padding: spacing.md,
          background: colors.accentLight, borderRadius: radii.sm,
          fontSize: fontSizes.label, color: colors.text, lineHeight: 1.4,
        }}>
          <b>Следующий разрешённый шаг:</b> {state.next.statement}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md }}>
        {KIND_ORDER.map(kind => (
          <Chip
            key={kind}
            active={kinds.includes(kind)}
            onClick={() => toggle(kinds, kind, setKinds)}
          >{KIND_GLYPH[kind]} {KIND_LABEL[kind]}</Chip>
        ))}
        <span style={{ width: spacing.md }} />
        {STATUS_FILTERS.map(s => (
          <Chip
            key={s}
            active={statuses.includes(s)}
            onClick={() => toggle(statuses, s, setStatuses)}
          >{STATUS_LABEL[s]}</Chip>
        ))}
      </div>

      {grouped.length === 0 && <Note>по этим фильтрам записей нет</Note>}

      {grouped.map(([kind, list]) => (
        <div key={kind} style={{ marginTop: spacing.lg }}>
          <div style={{
            fontSize: fontSizes.caption, fontWeight: fontWeights.semibold,
            color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            {KIND_GLYPH[kind]} {KIND_LABEL[kind]} · {list.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginTop: spacing.sm }}>
            {list.map(e => {
              const replacedBy = supersededBy.get(e.id)
              const expanded = !!open[e.id]
              return (
                <div
                  key={e.id}
                  onClick={() => setOpen(prev => ({ ...prev, [e.id]: !prev[e.id] }))}
                  style={{
                    background: colors.bgTertiary,
                    boxShadow: shadows.neuSm,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    cursor: e.body ? 'pointer' : 'default',
                    borderLeft: `3px solid ${verdictColor(e.lastVerdict)}`,
                  }}
                >
                  <div style={{
                    fontSize: fontSizes.label, color: colors.text, lineHeight: 1.4,
                    fontWeight: e.status === 'accepted' ? fontWeights.medium : fontWeights.regular,
                    opacity: e.status === 'revoked' || e.status === 'superseded' ? 0.55 : 1,
                    textDecoration: e.status === 'revoked' ? 'line-through' : 'none',
                  }}>
                    {e.statement}
                  </div>

                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: spacing.sm,
                    marginTop: spacing.xs, fontSize: fontSizes.caption, color: colors.textTertiary,
                  }}>
                    <span style={{ color: e.status === 'accepted' ? colors.green : colors.orange }}>
                      {STATUS_LABEL[e.status]}
                    </span>
                    {e.lastVerdict && (
                      <span style={{ color: verdictColor(e.lastVerdict) }}>
                        {VERDICT_LABEL[e.lastVerdict]}
                        {e.lastVerdictLevel ? ` · ${LEVEL_LABEL[e.lastVerdictLevel]}` : ''}
                      </span>
                    )}
                    {e.oracleKind !== 'none' && <span>оракул: {e.oracleQuery || e.oracleKind}</span>}
                    {e.sourceRef && <span title={e.sourceRef}>{formatSourceRef(e.sourceRef)}</span>}
                    {e.tags.map(t => <span key={t}>#{t}</span>)}
                  </div>

                  {replacedBy && (
                    <div style={{ marginTop: spacing.xs, fontSize: fontSizes.caption, color: colors.purple }}>
                      заменена записью: {replacedBy.statement}
                    </div>
                  )}

                  {expanded && e.body && (
                    <div style={{
                      marginTop: spacing.sm, fontSize: fontSizes.caption,
                      color: colors.textSecondary, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    }}>{e.body}</div>
                  )}
                  {!expanded && e.body && (
                    <div style={{ marginTop: 2, fontSize: fontSizes.caption, color: colors.textQuaternary }}>
                      ▾ обоснование
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Note({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div style={{
      padding: spacing.lg, fontSize: fontSizes.label, fontFamily: fonts.ui,
      color: tone ?? colors.textTertiary,
    }}>{children}</div>
  )
}

function Chip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: `2px ${spacing.sm}px`,
        background: active ? colors.accentLight : colors.bgTertiary,
        boxShadow: active ? shadows.neuInsetSm : shadows.neuSm,
        border: 'none', borderRadius: radii.sm,
        color: active ? colors.accent : colors.textSecondary,
        fontSize: fontSizes.caption, fontFamily: fonts.ui, cursor: 'pointer',
      }}
    >{children}</button>
  )
}
