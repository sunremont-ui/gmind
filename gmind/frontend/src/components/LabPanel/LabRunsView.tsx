// Замеры проекта: список прогонов, а выбранный раскрывается матрицей
// кейсы×варианты — той самой, в которой замер и получал свои числа.
import { useEffect, useMemo, useRef, useState } from 'react'
import { labApi } from '../../api/lab'
import type { LabProject, LabRunReport, LabRunSummary } from '../../types/lab'
import { buildMatrix, cellMatched, cellLabel } from './labMatrix'
import { LabCompare } from './LabCompare'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface Props { project: LabProject }

export function LabRunsView({ project }: Props) {
  const [runs, setRuns] = useState<LabRunSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [report, setReport] = useState<LabRunReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runningLab, setRunningLab] = useState<string | null>(null)
  const [output, setOutput] = useState<string[]>([])
  const [runFinished, setRunFinished] = useState<string | null>(null)
  const [comparing, setComparing] = useState<string | null>(null)
  const sourceRef = useRef<EventSource | null>(null)

  // Поток закрывается вместе с панелью: EventSource, оставшийся жить, держал бы
  // соединение до перезагрузки окна.
  useEffect(() => () => { sourceRef.current?.close() }, [])

  const reloadRuns = () => {
    labApi.runs(project.path).then(setRuns).catch(e => setError(String((e as Error).message ?? e)))
  }

  const start = async (lab: string) => {
    setError(null)
    setOutput([])
    setRunFinished(null)
    try {
      const proc = await labApi.startRun(project.path, lab)
      setRunningId(proc.id)
      setRunningLab(lab)
      sourceRef.current?.close()
      const es = new EventSource(labApi.streamUrl(proc.id))
      sourceRef.current = es
      es.addEventListener('line', (ev) => {
        setOutput(prev => [...prev, (ev as MessageEvent<string>).data])
      })
      es.addEventListener('done', (ev) => {
        es.close()
        sourceRef.current = null
        setRunningId(null)
        let note = 'прогон завершён'
        try {
          const st = JSON.parse((ev as MessageEvent<string>).data) as { exit_code?: number }
          // Ненулевой код — это результат замера (гейт не сошёлся), а не сбой моста.
          if (st.exit_code) note = `прогон завершён с кодом ${st.exit_code} — гейт не сошёлся`
        } catch { /* статус нечитаем — сообщения достаточно */ }
        setRunFinished(note)
        reloadRuns()
        // Отчёт перечитывается, только если открыт именно этот замер.
        if (selected === lab) labApi.run(project.path, lab).then(setReport).catch(() => {})
      })
      es.onerror = () => {
        es.close()
        sourceRef.current = null
        setRunningId(null)
        setError('поток вывода прервался')
      }
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  const stop = async () => {
    if (!runningId) return
    try { await labApi.stopRun(runningId) } catch (e) { setError(String((e as Error).message ?? e)) }
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    labApi.runs(project.path)
      .then(r => { if (alive) { setRuns(r); setError(null) } })
      .catch(e => { if (alive) setError(String((e as Error).message ?? e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [project.path])

  useEffect(() => {
    if (!selected) { setReport(null); return }
    let alive = true
    labApi.run(project.path, selected)
      .then(r => { if (alive) setReport(r) })
      .catch(e => { if (alive) setError(String((e as Error).message ?? e)) })
    return () => { alive = false }
  }, [project.path, selected])

  if (loading) return <Note>читаю замеры…</Note>
  if (error && runs.length === 0) return <Note tone={colors.red}>{error}</Note>
  if (runs.length === 0) return <Note>в проекте нет ни одного замера (labs/*.lab.mjs)</Note>

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      {runs.map(run => {
        const open = selected === run.lab
        return (
          <div key={run.lab} style={{
            background: colors.bgTertiary, boxShadow: shadows.neuSm,
            borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm,
          }}>
            <div
              onClick={() => setSelected(open ? null : run.lab)}
              style={{ cursor: run.has_report ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm }}>
                <span style={{
                  fontSize: fontSizes.label, fontWeight: fontWeights.semibold, color: colors.text,
                }}>{run.lab}</span>
                {!run.has_report && (
                  <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>
                    прогона не было
                  </span>
                )}
                {!run.has_script && run.has_report && (
                  <span style={{ fontSize: fontSizes.caption, color: colors.orange }}>
                    отчёт есть, скрипта нет
                  </span>
                )}
                {run.gate_failed && (
                  <span style={{ fontSize: fontSizes.caption, color: colors.red }}>гейт не пройден</span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>
                  {run.started_at ? new Date(run.started_at).toLocaleDateString('ru-RU') : ''}
                  {run.estimate_rub ? ` · ${run.estimate_rub} ₽` : ''}
                </span>
                {run.has_report && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setComparing(comparing === run.lab ? null : run.lab) }}
                    title="сравнить с прошлым прогоном"
                    style={{
                      padding: `2px ${spacing.sm}px`,
                      background: comparing === run.lab ? colors.accentLight : colors.bgTertiary,
                      boxShadow: comparing === run.lab ? shadows.neuInsetSm : shadows.neuSm,
                      border: 'none', borderRadius: radii.sm,
                      color: comparing === run.lab ? colors.accent : colors.text,
                      fontSize: fontSizes.caption, fontFamily: fonts.ui, cursor: 'pointer',
                    }}
                  >Сравнить</button>
                )}
                {run.has_script && (
                  <button
                    onClick={(e) => { e.stopPropagation(); void (runningId && runningLab === run.lab ? stop() : start(run.lab)) }}
                    disabled={!!runningId && runningLab !== run.lab}
                    title={runningId && runningLab === run.lab ? 'остановить прогон' : 'прогнать замер'}
                    style={{
                      padding: `2px ${spacing.sm}px`,
                      background: colors.bgTertiary, boxShadow: shadows.neuSm,
                      border: 'none', borderRadius: radii.sm,
                      color: runningId && runningLab === run.lab ? colors.red : colors.text,
                      fontSize: fontSizes.caption, fontFamily: fonts.ui,
                      cursor: !!runningId && runningLab !== run.lab ? 'default' : 'pointer',
                      opacity: !!runningId && runningLab !== run.lab ? 0.4 : 1,
                    }}
                  >{runningId && runningLab === run.lab ? 'Стоп' : 'Прогнать'}</button>
                )}
              </div>

              {run.question && (
                <div style={{
                  marginTop: spacing.xs, fontSize: fontSizes.caption,
                  color: colors.textSecondary, lineHeight: 1.45,
                }}>{run.question}</div>
              )}

              {run.summaries && run.summaries.length > 0 && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: spacing.md,
                  marginTop: spacing.sm, fontSize: fontSizes.caption, color: colors.textTertiary,
                }}>
                  {run.summaries.map(s => (
                    <span key={s.variantId}>
                      <b style={{ color: colors.text }}>{s.variantId}</b>
                      {' '}{s.ok}/{s.total}
                      {s.expected ? ` · соответствие ${s.matched ?? 0}/${s.expected}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {runningLab === run.lab && (output.length > 0 || runningId) && (
              <pre style={{
                marginTop: spacing.sm, marginBottom: 0, padding: spacing.sm,
                maxHeight: 220, overflow: 'auto',
                background: colors.bgTertiary, boxShadow: shadows.neuInsetSm,
                borderRadius: radii.sm, fontSize: fontSizes.caption,
                color: colors.textSecondary, whiteSpace: 'pre-wrap', lineHeight: 1.4,
              }}>{output.join('\n') || 'запуск…'}</pre>
            )}
            {runningLab === run.lab && runFinished && (
              <div style={{
                marginTop: spacing.xs, fontSize: fontSizes.caption,
                color: runFinished.includes('кодом') ? colors.orange : colors.green,
              }}>{runFinished}</div>
            )}

            {comparing === run.lab && <LabCompare project={project} lab={run.lab} />}

            {open && report && <Matrix report={report} />}
          </div>
        )
      })}
    </div>
  )
}

function Matrix({ report }: { report: LabRunReport }) {
  const m = useMemo(() => buildMatrix(report), [report])
  const [picked, setPicked] = useState<{ c: string; v: string } | null>(null)
  const row = picked ? m.cell(picked.c, picked.v) : undefined

  if (m.cases.length === 0) return <Note>в отчёте нет строк</Note>

  return (
    <div style={{ marginTop: spacing.md }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: fontSizes.caption }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>кейс</th>
              {m.variants.map(v => <th key={v} style={th}>{v}</th>)}
            </tr>
          </thead>
          <tbody>
            {m.cases.map(c => (
              <tr key={c}>
                <td style={{ ...td, textAlign: 'left', color: colors.textSecondary, whiteSpace: 'nowrap' }}>{c}</td>
                {m.variants.map(v => {
                  const cell = m.cell(c, v)
                  const matched = cellMatched(cell)
                  const active = picked?.c === c && picked?.v === v
                  return (
                    <td
                      key={v}
                      onClick={() => setPicked(active ? null : { c, v })}
                      title={cell?.judgeNote || cell?.note || ''}
                      style={{
                        ...td,
                        cursor: cell ? 'pointer' : 'default',
                        // Цвет несёт СООТВЕТСТВИЕ ожидаемому, а не «прогон не упал»:
                        // зелёная ячейка у прогона без вердикта была бы враньём.
                        background: active ? colors.accentLight
                          : matched === true ? colors.greenLight
                          : matched === false ? colors.redLight
                          : 'transparent',
                        color: cell ? colors.text : colors.textQuaternary,
                      }}
                    >{cellLabel(cell, m.metricKeys)}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {row && (
        <div style={{
          marginTop: spacing.sm, padding: spacing.md,
          background: colors.bgTertiary, boxShadow: shadows.neuInsetSm,
          borderRadius: radii.sm, fontSize: fontSizes.caption,
          color: colors.textSecondary, lineHeight: 1.5,
        }}>
          <div style={{ color: colors.text, fontWeight: fontWeights.medium }}>
            {row.caseId} · {row.variantId}
          </div>
          {row.metrics && (
            <div style={{ marginTop: spacing.xs, display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
              {Object.entries(row.metrics).map(([k, v]) => (
                <span key={k}>{k}: <b style={{ color: colors.text }}>{String(v)}</b></span>
              ))}
            </div>
          )}
          {row.note && <div style={{ marginTop: spacing.xs }}>{row.note}</div>}
          {row.judgeNote && (
            <div style={{ marginTop: spacing.xs, color: colors.text }}>{row.judgeNote}</div>
          )}
          {row.error && <div style={{ marginTop: spacing.xs, color: colors.red }}>{row.error}</div>}
        </div>
      )}

      {report.skipped && report.skipped.length > 0 && (
        <div style={{ marginTop: spacing.sm, fontSize: fontSizes.caption, color: colors.orange }}>
          пропущено: {report.skipped.join(', ')}
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  padding: `${spacing.xs}px ${spacing.sm}px`,
  color: colors.textTertiary,
  fontWeight: fontWeights.medium,
  borderBottom: `1px solid ${colors.separator}`,
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: `${spacing.xs}px ${spacing.sm}px`,
  textAlign: 'center',
  borderBottom: `1px solid ${colors.separator}`,
  borderRadius: radii.sm,
}

function Note({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div style={{
      padding: spacing.lg, fontSize: fontSizes.label,
      fontFamily: fonts.ui, color: tone ?? colors.textTertiary,
    }}>{children}</div>
  )
}
