// Проект целиком: четыре стороны одной работы на одном экране.
//
// Трек говорит, чем работа держится; замеры — чем она подтверждена; память
// MASys — что от неё осталось; каталог — из чего она состоит. По отдельности
// каждая сторона уже видна в других видах, и смысл этого экрана в том, что
// расхождение между сторонами (живой трек при пустой памяти, замеры без
// принятых фактов) заметно только когда они рядом.
import { useEffect, useState } from 'react'
import { labApi } from '../../api/lab'
import { projectsApi, type ProjectScanResult } from '../../api/projects'
import { useMindMapStore } from '../../store/mindmap'
import { requestWorkbookOpen } from '../../utils/openTopicLink'
import type { LabMemoryLayer, LabProject, LabRunSummary, LabTrackState } from '../../types/lab'
import { KIND_GLYPH, KIND_LABEL } from './labVisual'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface Props {
  project: LabProject
  onOpenTrack: () => void
  onOpenRuns: () => void
}

export function LabProjectView({ project, onOpenTrack, onOpenRuns }: Props) {
  const setWorkbook = useMindMapStore(s => s.setWorkbook)

  const [state, setState] = useState<LabTrackState | null>(null)
  const [trackError, setTrackError] = useState<string | null>(null)
  const [runs, setRuns] = useState<LabRunSummary[]>([])
  const [runsError, setRunsError] = useState<string | null>(null)
  const [layers, setLayers] = useState<LabMemoryLayer[]>([])
  const [memoryError, setMemoryError] = useState<string | null>(null)
  const [scan, setScan] = useState<ProjectScanResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Четыре стороны читаются независимо: недоступный MASys не должен прятать
  // замеры с диска, а отключённый диск — состояние трека.
  useEffect(() => {
    let alive = true
    if (project.track) {
      labApi.track(project.track, project.namespace)
        .then(r => { if (alive) setState(r.state) })
        .catch(e => { if (alive) setTrackError(String((e as Error).message ?? e)) })
    }
    labApi.runs(project.path)
      .then(r => { if (alive) setRuns(r) })
      .catch(e => { if (alive) setRunsError(String((e as Error).message ?? e)) })
    labApi.memory(project.namespace)
      .then(r => { if (alive) setLayers(r) })
      .catch(e => { if (alive) setMemoryError(String((e as Error).message ?? e)) })
    return () => { alive = false }
  }, [project.path, project.track, project.namespace])

  const scanDir = async () => {
    setBusy(true)
    setScanError(null)
    try {
      setScan(await projectsApi.scan(project.path, { max_depth: 4, docs_only: false }))
    } catch (e) {
      setScanError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const buildMap = async () => {
    setBusy(true)
    setScanError(null)
    try {
      const result = await projectsApi.import(project.path, project.label, { max_depth: 4 })
      if (!requestWorkbookOpen(result.workbook, 'project-import', project.path)) setWorkbook(result.workbook)
      setStatus(`Карта построена: ${result.stats.nodes} узлов`)
    } catch (e) {
      setScanError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const withReport = runs.filter(r => r.has_report)
  const failedGate = runs.filter(r => r.gate_failed)
  const lastRun = withReport
    .map(r => r.started_at)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1)
  const c = state?.counters

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      <div style={{ fontSize: fontSizes.caption, color: colors.textTertiary, lineHeight: 1.6 }}>
        <div>{project.path}</div>
        <div>
          трек <b style={{ color: colors.accent }}>{project.track || '—'}</b>
          {' · '}namespace <b style={{ color: colors.text }}>{project.namespace}</b>
        </div>
        {project.oracle && <div>оракул: <code>{project.oracle}</code></div>}
        {project.export_path && <div>книга трека: <code>{project.export_path}</code></div>}
      </div>

      <Section
        title="Трек"
        action={project.track ? { label: 'Открыть записи', onClick: onOpenTrack } : undefined}
      >
        {trackError && <Line tone={colors.red}>трек недоступен: {trackError}</Line>}
        {!trackError && !c && <Line>читаю трек…</Line>}
        {c && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
              <Num value={c.entries} label="записей" />
              <Num value={c.accepted} label="принято" />
              <Num value={c.proposed} label="предложено" tone={c.proposed ? colors.orange : undefined} />
              <Num value={c.openTails} label="хвостов" tone={c.openTails ? colors.orange : undefined} />
              <Num value={c.driftEntries} label="drift" tone={c.driftEntries ? colors.red : colors.green} />
              <Num value={c.staleEntries} label="устарело" tone={c.staleEntries ? colors.orange : undefined} />
            </div>
            {state?.next && (
              <div style={{
                marginTop: spacing.sm, padding: spacing.sm,
                background: colors.accentLight, borderRadius: radii.sm,
                fontSize: fontSizes.caption, lineHeight: 1.4, color: colors.text,
              }}>
                <b>{KIND_GLYPH.next} {KIND_LABEL.next}:</b> {state.next.statement}
              </div>
            )}
            {state?.openTails && state.openTails.length > 0 && (
              <div style={{ marginTop: spacing.sm }}>
                {state.openTails.map(t => (
                  <div key={t.id} style={{
                    fontSize: fontSizes.caption, color: colors.textSecondary,
                    lineHeight: 1.45, marginTop: 2,
                  }}>
                    {KIND_GLYPH.tail} {t.statement}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Замеры" action={{ label: 'Открыть матрицы', onClick: onOpenRuns }}>
        {runsError && <Line tone={colors.red}>{runsError}</Line>}
        {!runsError && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
              <Num value={runs.length} label="замеров" />
              <Num value={withReport.length} label="с отчётом" />
              <Num
                value={failedGate.length}
                label="гейт не пройден"
                tone={failedGate.length ? colors.red : colors.green}
              />
            </div>
            <Line>
              последний прогон: {lastRun ? new Date(lastRun).toLocaleDateString('ru-RU') : 'не было'}
            </Line>
          </>
        )}
      </Section>

      <Section title={`Память MASys · ${project.namespace}`}>
        {memoryError && <Line tone={colors.red}>MASys недоступен: {memoryError}</Line>}
        {!memoryError && layers.length === 0 && <Line>читаю слои…</Line>}
        {layers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
            {layers.map(l => (
              <Num
                key={l.key}
                // Упершееся в потолок число — нижняя граница, и знак «≥» об этом
                // говорит; точное количество слой не отдавал.
                value={l.error ? '—' : `${l.capped ? '≥' : ''}${l.count}`}
                label={l.label}
                tone={l.error ? colors.textQuaternary : l.count === 0 ? colors.textTertiary : undefined}
                title={l.error || (l.capped ? 'выборка упёрлась в потолок' : '')}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Каталог">
        {scanError && <Line tone={colors.red}>{scanError}</Line>}
        {status && <Line tone={colors.green}>{status}</Line>}
        {scan && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
            <Num value={scan.stats.dirs} label="папок" />
            <Num value={scan.stats.files} label="файлов" />
            <Num value={scan.stats.markdown} label=".md" />
            <Num value={scan.stats.xmind} label=".xmind" />
            <Num value={scan.stats.nodes} label="узлов будет" />
          </div>
        )}
        {scan?.stats.truncated && (
          <Line tone={colors.orange}>схема усечена потолком узлов</Line>
        )}
        <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
          <button onClick={() => void scanDir()} disabled={busy} style={btn}>Посчитать</button>
          <button onClick={() => void buildMap()} disabled={busy} style={btn}>Построить карту</button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, action, children }: {
  title: string
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}) {
  return (
    <div style={{
      marginTop: spacing.md, padding: spacing.md,
      background: colors.bgTertiary, boxShadow: shadows.neuSm, borderRadius: radii.md,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.sm }}>
        <span style={{
          fontSize: fontSizes.caption, fontWeight: fontWeights.semibold,
          color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6,
        }}>{title}</span>
        <span style={{ flex: 1 }} />
        {action && (
          <button onClick={action.onClick} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.accent, fontSize: fontSizes.caption, fontFamily: fonts.ui,
          }}>{action.label} →</button>
        )}
      </div>
      {children}
    </div>
  )
}

function Num({ value, label, tone, title }: {
  value: number | string; label: string; tone?: string; title?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }} title={title}>
      <span style={{
        fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: tone ?? colors.text,
      }}>{value}</span>
      <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>{label}</span>
    </div>
  )
}

function Line({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div style={{
      marginTop: spacing.xs, fontSize: fontSizes.caption,
      color: tone ?? colors.textTertiary, lineHeight: 1.45,
    }}>{children}</div>
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
