// V6.0 Phase 7 — Pipeline Trace Map (+ live SSE).
// Lists recent MASys runs, draws a per-node waterfall for the selected run, and
// — when the run is still executing — subscribes to the SSE bridge to append
// node events live.
import { useEffect, useMemo, useRef, useState } from 'react'
import { masysApi } from '../../api/masys'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'
import {
  buildTrace, nodeStatusColor, formatDuration, coerceRunEvent,
} from './runTrace'
import type { MASysRun, MASysRunEvent } from '../../types/masys'

// SSE event names the bridge can emit (mirror of MASys WS `type` values).
const SSE_EVENTS = [
  'node.started', 'node.completed', 'node.failed',
  'agent.task.started', 'agent.task.completed', 'agent.task.failed',
  'pipeline.completed', 'pipeline.failed', 'pipeline.cancelled', 'message',
]

export function PipelineTrace() {
  const [runs, setRuns] = useState<MASysRun[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [events, setEvents] = useState<MASysRunEvent[]>([])
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  // Load run list.
  const loadRuns = async () => {
    try {
      const r = await masysApi.listRuns(20)
      setRuns(Array.isArray(r) ? r : [])
      setError(null)
      if (!selected && r.length) setSelected(r[0].id)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    }
  }
  useEffect(() => { loadRuns() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load events for the selected run + open SSE if running.
  useEffect(() => {
    esRef.current?.close()
    esRef.current = null
    setLive(false)
    if (!selected) { setEvents([]); return }

    let cancelled = false
    const run = runs.find(r => r.id === selected)

    masysApi.getRunEvents(selected)
      .then(evs => { if (!cancelled) setEvents(Array.isArray(evs) ? evs : []) })
      .catch(e => { if (!cancelled) setError(e?.message ?? String(e)) })

    if (run?.status === 'running' || run?.status === 'pending') {
      const es = masysApi.streamRun(selected)
      esRef.current = es
      setLive(true)
      const onEvent = (e: MessageEvent) => {
        try {
          const parsed = coerceRunEvent(JSON.parse(e.data), selected)
          if (parsed) setEvents(prev => [...prev, parsed])
        } catch { /* ignore non-JSON keepalives */ }
      }
      SSE_EVENTS.forEach(name => es.addEventListener(name, onEvent as EventListener))
      es.addEventListener('error', () => { setLive(false) })
    }

    return () => {
      cancelled = true
      esRef.current?.close()
      esRef.current = null
    }
  }, [selected, runs])

  const trace = useMemo(() => buildTrace(events), [events])
  const selectedRun = runs.find(r => r.id === selected)

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      {/* Run selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>Run:</span>
        <select
          value={selected ?? ''}
          onChange={e => setSelected(e.target.value || null)}
          style={{
            flex: 1, padding: `${spacing.xs}px ${spacing.sm}px`,
            background: colors.bgTertiary, boxShadow: shadows.neuInsetSm,
            border: 'none', borderRadius: radii.sm, color: colors.text,
            fontSize: fontSizes.label, fontFamily: fonts.mono,
          }}
        >
          {runs.length === 0 && <option value="">нет запусков</option>}
          {runs.map(r => (
            <option key={r.id} value={r.id}>
              {statusIcon(r.status)} {r.id.slice(0, 8)} · {r.pipelineId?.slice(0, 16) ?? '—'}
            </option>
          ))}
        </select>
        <button
          onClick={loadRuns}
          style={{
            padding: `${spacing.xs}px ${spacing.md}px`,
            background: colors.bgTertiary, boxShadow: shadows.neuSm,
            border: 'none', borderRadius: radii.sm, color: colors.text,
            fontSize: fontSizes.caption, cursor: 'pointer',
          }}
        >↻</button>
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: fontSizes.caption, marginBottom: spacing.sm }}>{error}</div>
      )}

      {!selected ? (
        <div style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textTertiary, fontSize: fontSizes.caption }}>
          Выберите запуск пайплайна
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, flexWrap: 'wrap' }}>
            {live && <LiveBadge />}
            <Pill color="#22c55e" label={`✓ ${trace.counts.completed}`} />
            <Pill color="#ef4444" label={`✗ ${trace.counts.failed}`} />
            <Pill color="#5B6CFF" label={`▶ ${trace.counts.running}`} />
            <span style={{ marginLeft: 'auto', fontSize: fontSizes.caption, color: colors.textSecondary, fontFamily: fonts.mono }}>
              {statusIcon(selectedRun?.status)} {formatDuration(selectedRun?.durationMs ?? (trace.startedAt && trace.endedAt ? trace.endedAt - trace.startedAt : undefined))}
            </span>
          </div>

          {/* Waterfall */}
          {trace.nodes.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textTertiary, fontSize: fontSizes.caption }}>
              {events.length === 0 ? 'Нет событий' : 'События без node id (см. лог ниже)'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: spacing.lg }}>
              {trace.nodes.map(n => {
                const offset = n.startedAt != null && trace.startedAt != null
                  ? (n.startedAt - trace.startedAt) / trace.totalMs : 0
                const width = n.durationMs != null ? Math.max(0.02, n.durationMs / trace.totalMs) : 0.02
                const color = nodeStatusColor(n.status)
                return (
                  <div key={n.nodeId} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{
                      width: 96, fontSize: 11, color: colors.text, fontFamily: fonts.mono,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{n.nodeId}</span>
                    <div style={{ flex: 1, position: 'relative', height: 14, background: colors.bgTertiary, boxShadow: shadows.neuInsetSm, borderRadius: 4 }}>
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${offset * 100}%`, width: `${width * 100}%`,
                        minWidth: 3, background: color, borderRadius: 4,
                        opacity: n.status === 'running' ? 0.7 : 0.9,
                      }} />
                    </div>
                    <span style={{ width: 56, textAlign: 'right', fontSize: 10, fontFamily: fonts.mono, color }}>
                      {formatDuration(n.durationMs)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Event log */}
          <div style={{ fontSize: 10, color: colors.textTertiary, marginBottom: spacing.xs, fontFamily: fonts.ui }}>
            Event log ({trace.events.length})
          </div>
          <div style={{
            maxHeight: 180, overflow: 'auto',
            background: colors.bgTertiary, boxShadow: shadows.neuInsetSm,
            borderRadius: radii.sm, padding: spacing.sm,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {trace.events.slice(-60).map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: spacing.sm, fontSize: 10, fontFamily: fonts.mono }}>
                <span style={{ color: colors.textQuaternary, flexShrink: 0 }}>
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
                <span style={{ color: nodeStatusColor(statusOf(e.type)), flexShrink: 0 }}>{e.type}</span>
                {e.nodeId && <span style={{ color: colors.textSecondary }}>{e.nodeId}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function statusOf(type: string): 'running' | 'completed' | 'failed' | 'unknown' {
  const t = type.toLowerCase()
  if (t.endsWith('failed') || t.includes('error')) return 'failed'
  if (t.endsWith('completed') || t.endsWith('finished')) return 'completed'
  if (t.endsWith('started') || t.endsWith('running')) return 'running'
  return 'unknown'
}

function statusIcon(status?: string): string {
  switch (status) {
    case 'completed': return '✓'
    case 'failed': return '✗'
    case 'running': return '▶'
    case 'pending': return '⏳'
    default: return '•'
  }
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      fontSize: fontSizes.caption, fontFamily: fonts.mono, color,
      padding: `${spacing.xxs}px ${spacing.sm}px`,
      background: colors.bgTertiary, boxShadow: shadows.neuInsetSm, borderRadius: radii.sm,
    }}>{label}</span>
  )
}

function LiveBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: fontSizes.caption, fontWeight: fontWeights.semibold, color: '#ef4444',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: '#ef4444', animation: 'pulse 1.2s infinite' }} />
      LIVE
    </span>
  )
}
