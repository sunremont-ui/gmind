// V6.0 — Memory Workbench panel (skeleton with layer summary).
// Phase 1 just renders: connection status, namespace switcher, 8 layer counters.
// Detailed views (Layer Map, Timeline, KG Canvas, etc.) come in Phase 2-7.
import { useEffect } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import type { ModulePanelProps } from '../../modules/types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

interface LayerStat {
  key: string
  label: string
  icon: string
  count: number
  loading?: boolean
}

export function MemoryWorkbenchPanel({ onClose }: ModulePanelProps) {
  const {
    health, health_error, namespaces, activeNamespace,
    episodes, entities, skills, conversations, wiki, results, decisions, pending,
    loading,
    checkHealth, fetchNamespaces, setActiveNamespace, refreshAll,
  } = useMASysMemoryStore()

  useEffect(() => {
    checkHealth()
    fetchNamespaces()
  }, [checkHealth, fetchNamespaces])

  useEffect(() => {
    if (health?.reachable) {
      refreshAll()
    }
  }, [health?.reachable, activeNamespace, refreshAll])

  const reachable = !!health?.reachable

  const layers: LayerStat[] = [
    { key: 'episodes', label: 'Эпизоды', icon: '⏱', count: episodes.length, loading: !!loading.episodes },
    { key: 'entities', label: 'Сущности', icon: '👤', count: entities.length, loading: !!loading.entities },
    { key: 'skills', label: 'Навыки', icon: '⚡', count: skills.length, loading: !!loading.skills },
    { key: 'conversations', label: 'Диалоги', icon: '💬', count: conversations.length, loading: !!loading.conversations },
    { key: 'wiki', label: 'Wiki', icon: '📖', count: wiki.length, loading: !!loading.wiki },
    { key: 'results', label: 'Артефакты', icon: '📦', count: results.length, loading: !!loading.results },
    { key: 'decisions', label: 'Решения', icon: '🧠', count: decisions.length, loading: !!loading.decisions },
    { key: 'pending', label: 'Очередь', icon: '⏳', count: pending.length, loading: !!loading.pending },
  ]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: colors.bgTertiary,
      boxShadow: shadows.lg,
      borderTopLeftRadius: radii.xl,
      borderBottomLeftRadius: radii.xl,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing.md}px ${spacing.lg}px`,
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: fontSizes.headline,
          fontWeight: fontWeights.semibold,
          color: colors.text,
          fontFamily: fonts.ui,
        }}>
          📊 Memory Workbench
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textQuaternary, fontSize: fontSizes.body,
          }}
        >✕</button>
      </div>

      {/* Reachability */}
      <div style={{
        margin: `0 ${spacing.lg}px`,
        padding: spacing.md,
        background: colors.bgTertiary,
        boxShadow: shadows.neuInsetSm,
        borderRadius: radii.md,
        fontSize: fontSizes.caption,
        color: reachable ? colors.green : colors.red,
        fontFamily: fonts.ui,
      }}>
        {reachable
          ? <>✓ MASys reachable @ <code>{health?.base_url}</code></>
          : <>✗ MASys unreachable {health_error ? <span style={{color: colors.textSecondary}}>({health_error})</span> : null}</>
        }
      </div>

      {/* Namespace switcher */}
      <div style={{
        margin: `${spacing.md}px ${spacing.lg}px 0`,
        display: 'flex', alignItems: 'center', gap: spacing.sm,
      }}>
        <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>Namespace:</span>
        <select
          value={activeNamespace}
          onChange={(e) => setActiveNamespace(e.target.value)}
          disabled={!reachable}
          style={{
            flex: 1,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            background: colors.bgTertiary,
            boxShadow: shadows.neuInsetSm,
            border: 'none',
            borderRadius: radii.sm,
            color: colors.text,
            fontSize: fontSizes.label,
            fontFamily: fonts.ui,
          }}
        >
          <option value="default">default</option>
          {namespaces.filter(n => n !== 'default').map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button
          onClick={() => refreshAll()}
          disabled={!reachable}
          style={{
            padding: `${spacing.xs}px ${spacing.md}px`,
            background: colors.bgTertiary,
            boxShadow: shadows.neuSm,
            border: 'none',
            borderRadius: radii.sm,
            color: colors.text,
            fontSize: fontSizes.caption,
            fontFamily: fonts.ui,
            cursor: reachable ? 'pointer' : 'not-allowed',
          }}
        >↻ Refresh</button>
      </div>

      {/* 8 layer cards grid */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: spacing.lg,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: spacing.md,
      }}>
        {layers.map(layer => (
          <div
            key={layer.key}
            style={{
              padding: spacing.md,
              background: colors.bgTertiary,
              boxShadow: shadows.neuMd,
              borderRadius: radii.lg,
              fontFamily: fonts.ui,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.xs,
              transition: `box-shadow ${transitions.fast}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = shadows.neuLg }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = shadows.neuMd }}
          >
            <div style={{ fontSize: 20 }}>{layer.icon}</div>
            <div style={{ fontSize: fontSizes.subhead, fontWeight: fontWeights.semibold, color: colors.text }}>
              {layer.label}
            </div>
            <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>
              {layer.loading ? 'Загрузка…' : `${layer.count} элементов`}
            </div>
          </div>
        ))}
      </div>

      {/* Future expansion footer */}
      <div style={{
        padding: `${spacing.sm}px ${spacing.lg}px`,
        fontSize: fontSizes.caption,
        color: colors.textQuaternary,
        textAlign: 'center',
        fontFamily: fonts.ui,
      }}>
        V6.0 Phase 1 · Phase 2 (Layer Map) → Phase 7 (Pipeline Trace) — coming
      </div>
    </div>
  )
}
