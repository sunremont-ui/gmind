// V6.0 Phase 7 — Pipeline Trace Map.
// Reduces a flat MASys run-event stream into per-node lifecycles (started →
// completed/failed) plus an overall timespan, so the UI can draw a waterfall.
import type { MASysRunEvent } from '../../types/masys'

export type NodeStatus = 'running' | 'completed' | 'failed' | 'unknown'

export interface TraceNode {
  nodeId: string
  status: NodeStatus
  startedAt?: number  // ms epoch
  endedAt?: number
  durationMs?: number
  events: MASysRunEvent[]
}

export interface Trace {
  nodes: TraceNode[]
  events: MASysRunEvent[]      // sorted ascending by timestamp
  startedAt?: number
  endedAt?: number
  totalMs: number
  counts: { completed: number; failed: number; running: number }
}

function ts(e: MASysRunEvent): number {
  const t = Date.parse(e.timestamp)
  return isNaN(t) ? 0 : t
}

function statusFromType(type: string): NodeStatus | null {
  const t = type.toLowerCase()
  if (t.endsWith('failed') || t.includes('error')) return 'failed'
  if (t.endsWith('completed') || t.endsWith('finished') || t.endsWith('success')) return 'completed'
  if (t.endsWith('started') || t.endsWith('running')) return 'running'
  return null
}

export function buildTrace(rawEvents: MASysRunEvent[]): Trace {
  const events = [...rawEvents].sort((a, b) => ts(a) - ts(b))

  const byNode = new Map<string, MASysRunEvent[]>()
  for (const e of events) {
    if (!e.nodeId) continue
    if (!byNode.has(e.nodeId)) byNode.set(e.nodeId, [])
    byNode.get(e.nodeId)!.push(e)
  }

  const nodes: TraceNode[] = []
  for (const [nodeId, evs] of byNode) {
    let status: NodeStatus = 'unknown'
    let startedAt: number | undefined
    let endedAt: number | undefined
    for (const e of evs) {
      const s = statusFromType(e.type)
      const t = ts(e)
      if (s === 'running' && startedAt === undefined) startedAt = t
      if (s === 'completed' || s === 'failed') { endedAt = t; status = s }
    }
    if (status === 'unknown' && startedAt !== undefined && endedAt === undefined) status = 'running'
    if (startedAt === undefined) startedAt = ts(evs[0])
    const durationMs = endedAt !== undefined && startedAt !== undefined ? endedAt - startedAt : undefined
    nodes.push({ nodeId, status, startedAt, endedAt, durationMs, events: evs })
  }

  nodes.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))

  const startedAt = events.length ? ts(events[0]) : undefined
  const endedAt = events.length ? ts(events[events.length - 1]) : undefined
  const totalMs = startedAt !== undefined && endedAt !== undefined ? Math.max(1, endedAt - startedAt) : 1

  const counts = {
    completed: nodes.filter(n => n.status === 'completed').length,
    failed: nodes.filter(n => n.status === 'failed').length,
    running: nodes.filter(n => n.status === 'running').length,
  }

  return { nodes, events, startedAt, endedAt, totalMs, counts }
}

export function nodeStatusColor(status: NodeStatus): string {
  switch (status) {
    case 'completed': return '#22c55e'
    case 'failed': return '#ef4444'
    case 'running': return '#5B6CFF'
    default: return '#94a3b8'
  }
}

export function formatDuration(ms?: number): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

// Coerce an SSE payload (raw WS message) into a MASysRunEvent shape.
export function coerceRunEvent(raw: unknown, runId: string): MASysRunEvent | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const type = typeof o.type === 'string' ? o.type : undefined
  if (!type) return null
  return {
    runId: typeof o.runId === 'string' ? o.runId : runId,
    type,
    nodeId: typeof o.nodeId === 'string' ? o.nodeId : undefined,
    payload: o.payload,
    timestamp: typeof o.timestamp === 'string' ? o.timestamp : new Date().toISOString(),
  }
}
