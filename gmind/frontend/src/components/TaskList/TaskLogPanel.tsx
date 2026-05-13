import { useState, useEffect, useRef } from 'react'
import type { TaskLogMessage } from '../../types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface TaskLogPanelProps {
  taskId: string
  onClose: () => void
}

type LogLevel = 'info' | 'debug' | 'warn' | 'error'

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: colors.accent,
  debug: colors.textQuaternary,
  warn: colors.orange,
  error: colors.red,
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: 'INFO',
  debug: 'DEBUG',
  warn: 'WARN',
  error: 'ERROR',
}

export function TaskLogPanel({ taskId, onClose }: TaskLogPanelProps) {
  const [logs, setLogs] = useState<TaskLogMessage[]>([])
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/v1/tasks/${taskId}/logs`)
      .then(res => res.json())
      .then(data => setLogs(data || []))
      .catch(() => {})

    const es = new EventSource(`/api/v1/tasks/${taskId}/stream`)
    eventSourceRef.current = es

    es.addEventListener('log', (event) => {
      try {
        const msg: TaskLogMessage = JSON.parse(event.data)
        setLogs(prev => [...prev, msg])
      } catch { /* ignore */ }
    })

    es.onopen = () => setConnected(true)
    es.onerror = () => { setConnected(false) }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [taskId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
    } catch {
      return ts
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: colors.scrim,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      fontFamily: fonts.ui,
    }}>
      <div style={{
        background: colors.bgSecondary,
        borderRadius: 16,
        padding: spacing.xxxl,
        width: 560, maxHeight: '80vh',
        boxShadow: shadows.neuLg,
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: spacing.lg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <h2 style={{
              fontSize: fontSizes.title, fontWeight: fontWeights.semibold,
              color: colors.text, margin: 0,
            }}>
              Task Logs
            </h2>
            <span style={{
              fontSize: fontSizes.caption, color: colors.textQuaternary,
              background: connected ? colors.greenLight : colors.redLight,
              padding: `${spacing.xxs}px ${spacing.sm}px`,
              borderRadius: radii.sm, fontWeight: fontWeights.medium,
            }}>
              {connected ? '● Live' : '○ Disconnected'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: `${spacing.xxs}px ${spacing.md}px`,
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textQuaternary,
              fontSize: fontSizes.bodyLarge,
              transition: `color ${'120ms'}`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = colors.text}
            onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
          >
            ✕
          </button>
        </div>

        <div style={{
          fontSize: fontSizes.caption, color: colors.textQuaternary,
          marginBottom: spacing.md,
        }}>
          {logs.length} log entry{logs.length !== 1 ? 'ies' : ''}
        </div>

        <div style={{
          flex: 1, overflow: 'auto',
          background: colors.bg,
          borderRadius: radii.md,
          padding: spacing.md,
          boxShadow: shadows.neuInsetSm,
        }}>
          {logs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: spacing.xl,
              color: colors.textQuaternary, fontSize: fontSizes.body,
            }}>
              {connected ? 'Waiting for logs...' : 'No logs available'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {logs.map((log, i) => {
                const level = (log.level || 'info') as LogLevel
                const color = LEVEL_COLORS[level] || colors.textQuaternary
                const label = LEVEL_LABELS[level] || 'INFO'
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', gap: spacing.sm,
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      borderRadius: radii.sm,
                      background: i === logs.length - 1 ? color + '12' : 'transparent',
                      fontFamily: fonts.mono,
                      fontSize: fontSizes.caption,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: colors.textQuaternary, flexShrink: 0, minWidth: 54 }}>
                      {formatTime(log.time)}
                    </span>
                    <span style={{
                      color, fontWeight: fontWeights.semibold,
                      flexShrink: 0, minWidth: 46,
                    }}>
                      [{label}]
                    </span>
                    <span style={{ color: colors.text, flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {log.step && `Step ${log.step}: `}
                      {log.tool_name && `[${log.tool_name}] `}
                      {log.message || log.content || log.result || '—'}
                    </span>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}