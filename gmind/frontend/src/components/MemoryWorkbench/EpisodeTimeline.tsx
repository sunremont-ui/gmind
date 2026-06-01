// V6.0 Phase 4 — Episode Timeline.
// Chronological view of agent actions with filters (status, agent, recent).
// Click on episode → details modal with input/output JSON + skill candidate hint.
import { useMemo, useState } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import type { MASysEpisode } from '../../types/masys'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

type StatusFilter = 'all' | 'success' | 'error'
type TimeFilter = 'all' | '24h' | '7d'

interface Bucket {
  date: string  // YYYY-MM-DD
  episodes: MASysEpisode[]
}

const DAY_MS = 24 * 3600 * 1000

export function EpisodeTimeline() {
  const episodes = useMASysMemoryStore(s => s.episodes)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [agentFilter, setAgentFilter] = useState<string>('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [selected, setSelected] = useState<MASysEpisode | null>(null)

  // Distinct agents for the filter dropdown
  const agents = useMemo(() => {
    const set = new Set<string>()
    for (const ep of episodes) if (ep.agentId) set.add(ep.agentId)
    return Array.from(set).sort()
  }, [episodes])

  // Apply filters
  const filtered = useMemo(() => {
    const now = Date.now()
    const minTs =
      timeFilter === '24h' ? now - DAY_MS :
      timeFilter === '7d'  ? now - 7 * DAY_MS :
      0
    return episodes.filter(ep => {
      if (statusFilter === 'success' && ep.status !== 'success') return false
      if (statusFilter === 'error'   && ep.status !== 'error')   return false
      if (agentFilter && ep.agentId !== agentFilter) return false
      if (minTs > 0) {
        const t = Date.parse(ep.timestamp)
        if (!isNaN(t) && t < minTs) return false
      }
      return true
    })
  }, [episodes, statusFilter, agentFilter, timeFilter])

  // Bucket by day
  const buckets: Bucket[] = useMemo(() => {
    const map = new Map<string, MASysEpisode[]>()
    for (const ep of filtered) {
      const date = (ep.timestamp || '').slice(0, 10) || 'unknown'
      const arr = map.get(date) ?? []
      arr.push(ep)
      map.set(date, arr)
    }
    const result: Bucket[] = Array.from(map, ([date, episodes]) => ({ date, episodes }))
    result.sort((a, b) => b.date.localeCompare(a.date))
    for (const b of result) {
      b.episodes.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    }
    return result
  }, [filtered])

  // Skill candidate heuristic — recurring action patterns
  const skillCandidates = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ep of filtered) {
      if (ep.status === 'success') counts.set(ep.action, (counts.get(ep.action) || 0) + 1)
    }
    return Array.from(counts.entries())
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [filtered])

  return (
    <div style={{
      padding: spacing.lg,
      fontFamily: fonts.ui,
      display: 'flex', flexDirection: 'column', gap: spacing.md,
    }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: spacing.xs, flexWrap: 'wrap',
        padding: spacing.sm,
        background: colors.bgTertiary,
        boxShadow: shadows.neuInsetSm,
        borderRadius: radii.md,
      }}>
        <FilterChip active={statusFilter === 'all'}     onClick={() => setStatusFilter('all')}>All</FilterChip>
        <FilterChip active={statusFilter === 'success'} onClick={() => setStatusFilter('success')} color={colors.green}>✓ success</FilterChip>
        <FilterChip active={statusFilter === 'error'}   onClick={() => setStatusFilter('error')}   color={colors.red}>✗ error</FilterChip>
        <div style={{ width: 1, background: colors.separator, margin: `0 ${spacing.xs}px` }} />
        <FilterChip active={timeFilter === 'all'} onClick={() => setTimeFilter('all')}>∞</FilterChip>
        <FilterChip active={timeFilter === '24h'} onClick={() => setTimeFilter('24h')}>24h</FilterChip>
        <FilterChip active={timeFilter === '7d'}  onClick={() => setTimeFilter('7d')}>7d</FilterChip>
        {agents.length > 0 && (
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            style={{
              padding: `${spacing.xxs}px ${spacing.sm}px`,
              background: colors.bgTertiary,
              boxShadow: shadows.neuSm,
              border: 'none',
              borderRadius: radii.sm,
              color: colors.text,
              fontSize: fontSizes.caption,
              fontFamily: fonts.ui,
              marginLeft: 'auto',
            }}
          >
            <option value="">all agents ({agents.length})</option>
            {agents.map(a => <option key={a} value={a}>{a.slice(0, 8)}…</option>)}
          </select>
        )}
      </div>

      {/* Skill candidates */}
      {skillCandidates.length > 0 && (
        <div style={{
          padding: spacing.sm,
          background: '#fef3c715',
          borderRadius: radii.md,
          border: `1px solid #fef3c7`,
        }}>
          <div style={{
            fontSize: fontSizes.caption,
            fontWeight: fontWeights.semibold,
            color: colors.orange,
            marginBottom: 4,
          }}>💡 Skill candidates (повторяющиеся успешные действия)</div>
          {skillCandidates.map(([action, count]) => (
            <div key={action} style={{
              fontSize: fontSizes.caption,
              color: colors.text,
              padding: '2px 0',
            }}>
              <strong>{action}</strong>
              <span style={{ marginLeft: 8, color: colors.textSecondary }}>×{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {filtered.length === 0 && (
        <div style={{
          padding: spacing.xl,
          textAlign: 'center',
          color: colors.textQuaternary,
          fontSize: fontSizes.label,
        }}>Эпизоды не найдены — измените фильтры</div>
      )}

      {buckets.map(bucket => (
        <div key={bucket.date} style={{ position: 'relative' }}>
          <div style={{
            fontSize: fontSizes.caption,
            fontWeight: fontWeights.semibold,
            color: colors.textSecondary,
            margin: `${spacing.xs}px 0`,
            paddingLeft: spacing.lg,
          }}>
            {bucket.date} · {bucket.episodes.length}
          </div>
          <div style={{ position: 'relative', paddingLeft: spacing.lg }}>
            {/* vertical timeline line */}
            <div style={{
              position: 'absolute',
              left: 6,
              top: 0, bottom: 0,
              width: 2,
              background: colors.separator,
            }} />
            {bucket.episodes.slice(0, 20).map(ep => (
              <EpisodeRow key={ep.id} ep={ep} onClick={() => setSelected(ep)} />
            ))}
            {bucket.episodes.length > 20 && (
              <div style={{
                fontSize: fontSizes.caption,
                color: colors.textQuaternary,
                paddingLeft: spacing.lg,
              }}>+ {bucket.episodes.length - 20} more</div>
            )}
          </div>
        </div>
      ))}

      {selected && <EpisodeDetails ep={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function FilterChip({
  active, onClick, color, children,
}: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: `${spacing.xxs}px ${spacing.sm}px`,
        background: colors.bgTertiary,
        boxShadow: active ? shadows.neuInsetSm : shadows.neuSm,
        border: 'none',
        borderRadius: radii.sm,
        color: active ? (color ?? colors.accent) : colors.text,
        fontSize: fontSizes.caption,
        fontFamily: fonts.ui,
        cursor: 'pointer',
        transition: `box-shadow ${transitions.fast}`,
      }}
    >
      {children}
    </button>
  )
}

function EpisodeRow({ ep, onClick }: { ep: MASysEpisode; onClick: () => void }) {
  const isError = ep.status === 'error'
  const dotColor = isError ? colors.red : colors.green
  const time = (ep.timestamp || '').slice(11, 19) || '—:—:—'

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: `${spacing.xs}px ${spacing.sm}px`,
        margin: `${spacing.xxs}px 0`,
        background: colors.bgTertiary,
        boxShadow: shadows.neuSm,
        border: 'none',
        borderRadius: radii.sm,
        fontFamily: fonts.ui,
        cursor: 'pointer',
        transition: `box-shadow ${transitions.fast}`,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = shadows.neuMd}
      onMouseLeave={e => e.currentTarget.style.boxShadow = shadows.neuSm}
    >
      <span style={{
        position: 'absolute',
        left: -spacing.lg + 1,
        top: '50%',
        marginTop: -5,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: dotColor,
        boxShadow: `0 0 0 2px ${dotColor}30`,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{
          fontSize: fontSizes.label,
          color: colors.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 280,
        }}>{ep.action}</strong>
        <span style={{ fontSize: 10, color: colors.textQuaternary }}>{time}</span>
      </div>
      <div style={{
        fontSize: 10,
        color: colors.textSecondary,
        marginTop: 2,
        display: 'flex', gap: spacing.xs,
      }}>
        <span>{ep.agentId ? ep.agentId.slice(0, 12) + '…' : '—'}</span>
        {(ep.tags || []).slice(0, 3).map(t => (
          <span key={t} style={{
            padding: '0 4px',
            background: `${colors.accent}15`,
            borderRadius: 2,
            color: colors.accent,
          }}>{t}</span>
        ))}
      </div>
    </button>
  )
}

function EpisodeDetails({ ep, onClose }: { ep: MASysEpisode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing.xl,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 680,
          maxHeight: '85vh',
          background: colors.bgTertiary,
          borderRadius: radii.xl,
          boxShadow: shadows.lg,
          fontFamily: fonts.ui,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: `${spacing.md}px ${spacing.lg}px`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{
            fontSize: fontSizes.headline,
            fontWeight: fontWeights.semibold,
            color: colors.text,
          }}>⏱ {ep.action}</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textQuaternary, fontSize: fontSizes.body,
          }}>✕</button>
        </div>
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: `0 ${spacing.lg}px ${spacing.lg}px`,
          fontSize: fontSizes.caption,
          color: colors.textSecondary,
          fontFamily: fonts.mono,
        }}>
          <Meta label="ID" value={ep.id} />
          <Meta label="Status" value={ep.status || 'ok'} color={ep.status === 'error' ? colors.red : colors.green} />
          <Meta label="Agent" value={ep.agentId || '—'} />
          <Meta label="Pipeline" value={ep.pipelineId || '—'} />
          <Meta label="Namespace" value={ep.namespace} />
          <Meta label="Timestamp" value={ep.timestamp} />
          {(ep.tags || []).length > 0 && <Meta label="Tags" value={(ep.tags || []).join(', ')} />}
          {ep.input != null && <JsonBlock label="Input" value={ep.input} />}
          {ep.output != null && <JsonBlock label="Output" value={ep.output} />}
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '2px 0' }}>
      <span style={{ color: colors.textQuaternary, marginRight: 6 }}>{label}:</span>
      <span style={{ color: color ?? colors.text }}>{value}</span>
    </div>
  )
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={{ marginTop: spacing.sm }}>
      <div style={{ color: colors.textQuaternary, fontWeight: fontWeights.semibold, marginBottom: 4 }}>{label}</div>
      <pre style={{
        margin: 0,
        padding: spacing.sm,
        background: colors.bgTertiary,
        boxShadow: shadows.neuInsetSm,
        borderRadius: radii.sm,
        fontSize: 11,
        color: colors.text,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>{
        typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      }</pre>
    </div>
  )
}
