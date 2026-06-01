import { describe, it, expect } from 'vitest'
import { buildTrace, formatDuration, coerceRunEvent, nodeStatusColor } from './runTrace'
import type { MASysRunEvent } from '../../types/masys'

const ev = (nodeId: string, type: string, t: string): MASysRunEvent => ({
  runId: 'r1', nodeId, type, timestamp: t,
})

describe('buildTrace', () => {
  it('handles an empty event list', () => {
    const tr = buildTrace([])
    expect(tr.nodes).toHaveLength(0)
    expect(tr.totalMs).toBe(1)
    expect(tr.counts).toEqual({ completed: 0, failed: 0, running: 0 })
  })

  it('derives a completed node lifecycle with duration', () => {
    const tr = buildTrace([
      ev('n1', 'node.started', '2026-06-01T10:00:00.000Z'),
      ev('n1', 'node.completed', '2026-06-01T10:00:02.000Z'),
    ])
    expect(tr.nodes).toHaveLength(1)
    expect(tr.nodes[0].status).toBe('completed')
    expect(tr.nodes[0].durationMs).toBe(2000)
    expect(tr.counts.completed).toBe(1)
  })

  it('marks a node failed and counts it', () => {
    const tr = buildTrace([
      ev('n1', 'node.started', '2026-06-01T10:00:00.000Z'),
      ev('n1', 'node.failed', '2026-06-01T10:00:01.000Z'),
    ])
    expect(tr.nodes[0].status).toBe('failed')
    expect(tr.counts.failed).toBe(1)
  })

  it('treats a started-only node as running', () => {
    const tr = buildTrace([ev('n1', 'node.started', '2026-06-01T10:00:00.000Z')])
    expect(tr.nodes[0].status).toBe('running')
    expect(tr.counts.running).toBe(1)
  })

  it('sorts events ascending and orders nodes by start', () => {
    const tr = buildTrace([
      ev('late', 'node.started', '2026-06-01T10:00:05.000Z'),
      ev('early', 'node.started', '2026-06-01T10:00:01.000Z'),
    ])
    expect(tr.events[0].nodeId).toBe('early')
    expect(tr.nodes[0].nodeId).toBe('early')
  })

  it('ignores events without a nodeId for node grouping but keeps them in the log', () => {
    const tr = buildTrace([
      { runId: 'r1', type: 'pipeline.cancelled', timestamp: '2026-06-01T10:00:00.000Z' },
    ])
    expect(tr.nodes).toHaveLength(0)
    expect(tr.events).toHaveLength(1)
  })
})

describe('formatDuration', () => {
  it('formats ms / s / m', () => {
    expect(formatDuration(undefined)).toBe('—')
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(65000)).toBe('1m 5s')
  })
})

describe('coerceRunEvent', () => {
  it('returns null for non-objects or missing type', () => {
    expect(coerceRunEvent(null, 'r1')).toBeNull()
    expect(coerceRunEvent({ nodeId: 'n' }, 'r1')).toBeNull()
  })
  it('fills runId and timestamp defaults', () => {
    const e = coerceRunEvent({ type: 'node.started', nodeId: 'n1' }, 'r9')
    expect(e?.runId).toBe('r9')
    expect(e?.type).toBe('node.started')
    expect(typeof e?.timestamp).toBe('string')
  })
})

describe('nodeStatusColor', () => {
  it('maps statuses to colours', () => {
    expect(nodeStatusColor('completed')).toBe('#22c55e')
    expect(nodeStatusColor('failed')).toBe('#ef4444')
    expect(nodeStatusColor('unknown')).toBe('#94a3b8')
  })
})
