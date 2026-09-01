// Сравнение двух прогонов одного замера.
//
// Показываются ТОЛЬКО изменившиеся ячейки: у замера их бывает сорок и больше, и
// таблица, где сорок строк «без изменений» соседствуют с двумя важными, прячет
// ровно то, ради чего сравнение открывали.
import { useEffect, useMemo, useState } from 'react'
import { labApi } from '../../api/lab'
import type { LabHistoryEntry, LabProject, LabRunReport } from '../../types/lab'
import { diffRuns, hasChanges, CHANGE_LABEL, type LabCellChange } from './labDiff'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface Props {
  project: LabProject
  lab: string
}

const CHANGE_COLOR: Record<LabCellChange, string> = {
  improved: colors.green,
  regressed: colors.red,
  metric: colors.textSecondary,
  appeared: colors.accent,
  disappeared: colors.orange,
  same: colors.textTertiary,
}

function stampLabel(e: LabHistoryEntry): string {
  const iso = e.started_at || e.at
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? e.at : d.toLocaleString('ru-RU')
}

export function LabCompare({ project, lab }: Props) {
  const [history, setHistory] = useState<LabHistoryEntry[]>([])
  const [left, setLeft] = useState<string>('')
  const [right, setRight] = useState<string>('')
  const [reports, setReports] = useState<Record<string, LabRunReport>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    labApi.history(project.path, lab)
      .then(h => {
        if (!alive) return
        setHistory(h)
        // По умолчанию сравнивается последний прогон с предыдущим — вопрос
        // «что изменилось с прошлого раза» задают чаще любого другого.
        if (h.length >= 2) { setRight(h[0].at); setLeft(h[1].at) }
        else if (h.length === 1) { setRight(h[0].at); setLeft('') }
      })
      .catch(e => { if (alive) setError(String((e as Error).message ?? e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [project.path, lab])

  useEffect(() => {
    let alive = true
    for (const at of [left, right]) {
      if (!at || reports[at]) continue
      labApi.historyReport(project.path, lab, at)
        .then(r => { if (alive) setReports(prev => ({ ...prev, [at]: r })) })
        .catch(e => { if (alive) setError(String((e as Error).message ?? e)) })
    }
    return () => { alive = false }
  }, [left, right, project.path, lab, reports])

  const diff = useMemo(
    () => diffRuns(left ? reports[left] ?? null : null, right ? reports[right] ?? null : null),
    [left, right, reports]
  )
  const changed = diff.cells.filter(c => c.change !== 'same')

  if (loading) return <Note>читаю архив…</Note>
  if (error) return <Note tone={colors.red}>{error}</Note>
  if (history.length === 0) return <Note>архив пуст: прогонов этого замера ещё не видели</Note>
  if (history.length === 1) {
    return (
      <Note>
        в архиве один прогон ({stampLabel(history[0])}) — сравнивать не с чем.
        Архив пополняется при каждом прогоне и при открытии замера.
      </Note>
    )
  }

  return (
    <div style={{ padding: spacing.md, fontFamily: fonts.ui }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Picker value={left} onChange={setLeft} history={history} label="было" />
        <span style={{ color: colors.textTertiary }}>→</span>
        <Picker value={right} onChange={setRight} history={history} label="стало" />
      </div>

      {left === right && (
        <Note tone={colors.orange}>выбран один и тот же прогон</Note>
      )}

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm,
        fontSize: fontSizes.caption, color: colors.textSecondary,
      }}>
        {(['improved', 'regressed', 'metric', 'appeared', 'disappeared'] as LabCellChange[])
          .filter(k => diff.counts[k] > 0)
          .map(k => (
            <span key={k}>
              <b style={{ color: CHANGE_COLOR[k] }}>{diff.counts[k]}</b> {CHANGE_LABEL[k]}
            </span>
          ))}
        <span>без изменений {diff.counts.same}</span>
      </div>

      {Object.keys(diff.matched).length > 0 && (
        <div style={{
          marginTop: spacing.sm, fontSize: fontSizes.caption, color: colors.textSecondary,
        }}>
          {Object.entries(diff.matched).map(([variant, [b, a]]) => (
            <div key={variant}>
              {variant}: соответствие {b ?? '—'} → <b style={{
                color: (a ?? 0) > (b ?? 0) ? colors.green : (a ?? 0) < (b ?? 0) ? colors.red : colors.text,
              }}>{a ?? '—'}</b>
            </div>
          ))}
        </div>
      )}

      {!hasChanges(diff) ? (
        <Note tone={colors.green}>ячейки не изменились ни в одной</Note>
      ) : (
        <div style={{ marginTop: spacing.md }}>
          {changed.map(c => (
            <div
              key={`${c.caseId} ${c.variantId}`}
              style={{
                padding: spacing.sm, marginBottom: spacing.xs,
                background: colors.bgTertiary, boxShadow: shadows.neuSm,
                borderRadius: radii.sm, borderLeft: `3px solid ${CHANGE_COLOR[c.change]}`,
              }}
            >
              <div style={{ fontSize: fontSizes.caption, color: colors.text }}>
                <b>{c.caseId}</b>
                <span style={{ color: colors.textTertiary }}> · {c.variantId} · </span>
                <span style={{ color: CHANGE_COLOR[c.change], fontWeight: fontWeights.medium }}>
                  {CHANGE_LABEL[c.change]}
                </span>
              </div>
              {Object.entries(c.metrics).map(([k, [b, a]]) => (
                <div key={k} style={{
                  fontSize: fontSizes.caption, color: colors.textSecondary, marginTop: 2,
                }}>
                  {k}: {b} → <b style={{ color: colors.text }}>{a}</b>
                </div>
              ))}
              {(c.after?.judgeNote || c.before?.judgeNote) && (
                <div style={{
                  fontSize: fontSizes.caption, color: colors.textTertiary, marginTop: 2,
                }}>{c.after?.judgeNote || c.before?.judgeNote}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Picker({ value, onChange, history, label }: {
  value: string
  onChange: (v: string) => void
  history: LabHistoryEntry[]
  label: string
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: spacing.xs,
      fontSize: fontSizes.caption, color: colors.textTertiary,
    }}>
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: `2px ${spacing.xs}px`,
          background: colors.bgTertiary, boxShadow: shadows.neuInsetSm,
          border: 'none', borderRadius: radii.sm,
          color: colors.text, fontSize: fontSizes.caption, fontFamily: fonts.ui,
        }}
      >
        {history.map(h => (
          <option key={h.at} value={h.at}>
            {stampLabel(h)}{h.gate_failed ? ' · гейт не сошёлся' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

function Note({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div style={{
      padding: spacing.md, fontSize: fontSizes.caption,
      fontFamily: fonts.ui, color: tone ?? colors.textTertiary, lineHeight: 1.45,
    }}>{children}</div>
  )
}
