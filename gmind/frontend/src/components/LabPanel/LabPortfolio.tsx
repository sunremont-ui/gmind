// Портфель: все зарегистрированные треки рядом, карточкой на проект.
//
// Состояние каждого трека тянется отдельным запросом и кладётся по мере
// прихода: один недоступный проект не должен задерживать остальные четыре.
import { useEffect, useState } from 'react'
import { labApi } from '../../api/lab'
import type { LabProject, LabTrackState } from '../../types/lab'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface Props {
  projects: LabProject[]
  onOpenProject: (project: LabProject) => void
  onOpenTrack: (project: LabProject) => void
  onOpenRuns: (project: LabProject) => void
  onRemove: (project: LabProject) => void
}

type StateMap = Record<string, { state?: LabTrackState; error?: string; loading: boolean }>

/** Давность в словах: «сегодня», «3 дня назад». Точная дата тут не нужна. */
function ago(iso: string | null | undefined): string {
  if (!iso) return 'записей нет'
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (!Number.isFinite(days)) return '—'
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 30) return `${days} дн. назад`
  const months = Math.floor(days / 30)
  return `${months} мес. назад`
}

export function LabPortfolio({ projects, onOpenProject, onOpenTrack, onOpenRuns, onRemove }: Props) {
  const [states, setStates] = useState<StateMap>({})

  useEffect(() => {
    let alive = true
    for (const p of projects) {
      if (!p.track) continue
      setStates(prev => ({ ...prev, [p.path]: { loading: true } }))
      labApi.track(p.track, p.namespace)
        .then(r => { if (alive) setStates(prev => ({ ...prev, [p.path]: { state: r.state, loading: false } })) })
        .catch(e => { if (alive) setStates(prev => ({ ...prev, [p.path]: { error: String(e.message ?? e), loading: false } })) })
    }
    return () => { alive = false }
  }, [projects])

  if (projects.length === 0) {
    return (
      <div style={{
        padding: spacing.lg, color: colors.textSecondary,
        fontSize: fontSizes.label, fontFamily: fonts.ui, lineHeight: 1.5,
      }}>
        Реестр пуст. Добавьте каталог проекта, в котором лежит <code>lab.config.json</code> —
        трек и namespace будут прочитаны оттуда.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, padding: spacing.lg }}>
      {projects.map(p => {
        const entry = states[p.path]
        const st = entry?.state
        const c = st?.counters
        return (
          <div
            key={p.path}
            style={{
              background: colors.bgTertiary,
              boxShadow: shadows.neuSm,
              borderRadius: radii.md,
              padding: spacing.md,
              fontFamily: fonts.ui,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm }}>
              <span style={{
                fontSize: fontSizes.label, fontWeight: fontWeights.bold,
                color: colors.accent, letterSpacing: 0.5,
              }}>{p.track || '—'}</span>
              <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>
                {p.label}
              </span>
              <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>
                {p.namespace}
              </span>
              <span style={{ flex: 1 }} />
              <button
                onClick={() => onRemove(p)}
                title="Убрать из реестра"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: colors.textQuaternary, fontSize: fontSizes.caption,
                }}
              >✕</button>
            </div>

            <div style={{ fontSize: fontSizes.caption, color: colors.textTertiary, marginTop: 2 }}>
              {p.path}
            </div>

            {p.error && (
              <div style={{ marginTop: spacing.sm, fontSize: fontSizes.caption, color: colors.red }}>
                {p.error}
              </div>
            )}
            {entry?.error && (
              <div style={{ marginTop: spacing.sm, fontSize: fontSizes.caption, color: colors.red }}>
                трек недоступен: {entry.error}
              </div>
            )}
            {entry?.loading && (
              <div style={{ marginTop: spacing.sm, fontSize: fontSizes.caption, color: colors.textTertiary }}>
                читаю трек…
              </div>
            )}

            {c && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                  <Stat label="записей" value={c.entries} />
                  <Stat label="принято" value={c.accepted} />
                  <Stat label="предложено" value={c.proposed} tone={c.proposed > 0 ? colors.orange : undefined} />
                  <Stat label="хвостов" value={c.openTails} tone={c.openTails > 0 ? colors.orange : undefined} />
                  <Stat label="drift" value={c.driftEntries} tone={c.driftEntries > 0 ? colors.red : colors.green} />
                  <Stat label="устарело" value={c.staleEntries} tone={c.staleEntries > 0 ? colors.orange : undefined} />
                  <Stat label="независимо" value={c.confirmed.independent} tone={colors.green} />
                </div>

                {st?.next && (
                  <div style={{
                    marginTop: spacing.sm, padding: spacing.sm,
                    background: colors.accentLight, borderRadius: radii.sm,
                    fontSize: fontSizes.caption, color: colors.text, lineHeight: 1.4,
                  }}>
                    <b>Следующий шаг:</b> {st.next.statement}
                  </div>
                )}

                {st?.foundElsewhere && st.foundElsewhere.length > 0 && (
                  // Пустой трек и «спросили не в том namespace» выглядят
                  // одинаково — MASys различает их, и различие надо показать.
                  <div style={{
                    marginTop: spacing.sm, fontSize: fontSizes.caption, color: colors.orange,
                  }}>
                    трек {p.track} есть также в namespace: {st.foundElsewhere.join(', ')}
                  </div>
                )}
              </>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              marginTop: spacing.sm, fontSize: fontSizes.caption, color: colors.textSecondary,
            }}>
              <button onClick={() => onOpenProject(p)} style={btn}>Проект</button>
              <button onClick={() => onOpenTrack(p)} disabled={!p.track} style={btn}>Трек</button>
              <button onClick={() => onOpenRuns(p)} style={btn}>
                Замеры{p.reports.length ? ` · ${p.reports.length}` : ''}
              </button>
              <span style={{ flex: 1 }} />
              <span>последняя запись: {ago(st?.lastEntryAt)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const btn: React.CSSProperties = {
  padding: `${spacing.xs}px ${spacing.md}px`,
  background: colors.bgTertiary,
  boxShadow: shadows.neuSm,
  border: 'none',
  borderRadius: radii.sm,
  color: colors.text,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  cursor: 'pointer',
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{
        fontSize: fontSizes.body, fontWeight: fontWeights.semibold,
        color: tone ?? colors.text,
      }}>{value}</span>
      <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>{label}</span>
    </div>
  )
}
