// V6.0 Phase 5 — Context Budget Sankey.
// Visualises the estimated token footprint of each memory layer flowing into a
// fixed context window. Bands converge from per-layer source nodes (left) into
// a single window node (right); a dashed cap line marks the budget, and the
// region beyond it is shaded to show what must be evicted / selectively recalled.
import { useMemo, useState } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'
import {
  estimateBudget, formatTokens, BUDGET_PRESETS, DEFAULT_CAP,
  type LayerBudget,
} from './budgetEstimate'

const OVERFLOW_COLOR = '#ef4444'

export function ContextBudget() {
  const { episodes, entities, skills, conversations, wiki, results, decisions, pending } =
    useMASysMemoryStore()
  const [cap, setCap] = useState<number>(DEFAULT_CAP)

  const est = useMemo(
    () => estimateBudget(
      { episodes, entities, skills, conversations, wiki, results, decisions, pending },
      cap,
    ),
    [episodes, entities, skills, conversations, wiki, results, decisions, pending, cap],
  )

  const usedPct = est.capTokens > 0 ? est.fitsTokens / est.capTokens : 0

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      {/* Cap selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
        <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>Window:</span>
        {BUDGET_PRESETS.map(p => (
          <button
            key={p}
            onClick={() => setCap(p)}
            style={{
              padding: `${spacing.xxs}px ${spacing.sm}px`,
              background: colors.bgTertiary,
              boxShadow: cap === p ? shadows.neuInsetSm : shadows.neuSm,
              border: 'none',
              borderRadius: radii.sm,
              color: cap === p ? colors.accent : colors.text,
              fontSize: fontSizes.caption,
              fontWeight: fontWeights.medium,
              fontFamily: fonts.mono,
              cursor: 'pointer',
            }}
          >{formatTokens(p)}</button>
        ))}
      </div>

      {/* Summary line */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: spacing.sm,
        marginBottom: spacing.sm,
      }}>
        <span style={{ fontSize: fontSizes.title, fontWeight: fontWeights.bold, color: colors.text, fontFamily: fonts.mono }}>
          {formatTokens(est.totalTokens)}
        </span>
        <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>
          footprint · cap {formatTokens(est.capTokens)}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: fontSizes.caption,
          fontWeight: fontWeights.semibold,
          color: est.withinBudget ? colors.green : OVERFLOW_COLOR,
        }}>
          {est.withinBudget
            ? `✓ ${(usedPct * 100).toFixed(0)}% of window`
            : `✗ +${formatTokens(est.overflowTokens)} over budget`}
        </span>
      </div>

      {/* Budget bar */}
      <div style={{
        position: 'relative',
        height: 14,
        borderRadius: 7,
        background: colors.bgTertiary,
        boxShadow: shadows.neuInsetSm,
        overflow: 'hidden',
        marginBottom: spacing.lg,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          width: `${Math.min(100, usedPct * 100)}%`,
          background: est.withinBudget ? colors.accent : OVERFLOW_COLOR,
          opacity: 0.85,
        }} />
      </div>

      {est.totalTokens === 0 ? (
        <div style={{
          padding: spacing.xxl, textAlign: 'center',
          color: colors.textTertiary, fontSize: fontSizes.caption,
        }}>
          Нет данных памяти в этом namespace
        </div>
      ) : (
        <>
          <Sankey est={est} />
          <Legend layers={est.layers} total={est.totalTokens} />
        </>
      )}
    </div>
  )
}

function Sankey({ est }: { est: ReturnType<typeof estimateBudget> }) {
  const layers = est.layers
  const n = layers.length
  const total = est.totalTokens

  // Geometry (viewBox units).
  const W = 440
  const pad = 12
  const labelW = 78
  const nodeW = 14
  const gap = 10
  const H = 2 * pad + Math.max(150, n * 26) + (n - 1) * gap

  const leftNodeX = labelW
  const rightNodeX = W - pad - nodeW
  const x0 = leftNodeX + nodeW
  const x1 = rightNodeX
  const xMid = (x0 + x1) / 2

  const hAvail = H - 2 * pad
  const barsHeight = Math.max(1, hAvail - (n - 1) * gap)
  const scale = total > 0 ? barsHeight / total : 0

  // Right window block, vertically centred within the available area.
  const rightStart = pad + ((n - 1) * gap) / 2

  // Cap line position within the window block.
  const capFrac = total > 0 ? Math.min(1, est.capTokens / total) : 1
  const capY = rightStart + capFrac * barsHeight

  const bands: React.ReactNode[] = []
  const leftRects: React.ReactNode[] = []
  const leftLabels: React.ReactNode[] = []

  let ly = pad
  let ry = rightStart
  layers.forEach((l) => {
    const h = Math.max(0.5, l.tokens * scale)
    const lyTop = ly
    const ryTop = ry
    const lyBot = lyTop + h
    const ryBot = ryTop + h

    bands.push(
      <path
        key={`band-${l.key}`}
        d={`M ${x0} ${lyTop} C ${xMid} ${lyTop}, ${xMid} ${ryTop}, ${x1} ${ryTop} L ${x1} ${ryBot} C ${xMid} ${ryBot}, ${xMid} ${lyBot}, ${x0} ${lyBot} Z`}
        fill={l.color}
        opacity={0.32}
      />,
    )
    leftRects.push(
      <rect
        key={`node-${l.key}`}
        x={leftNodeX} y={lyTop} width={nodeW} height={h}
        rx={3} fill={l.color}
      />,
    )
    leftLabels.push(
      <text
        key={`lbl-${l.key}`}
        x={leftNodeX - 6} y={lyTop + h / 2}
        textAnchor="end" dominantBaseline="middle"
        fontSize={10} fill={colors.textSecondary} fontFamily={fonts.ui}
      >
        {l.icon} {l.label}
      </text>,
    )

    ly = lyBot + gap
    ry = ryBot
  })

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', maxHeight: 320 }}
    >
      {bands}
      {leftRects}
      {leftLabels}

      {/* Window node: fits region + overflow region */}
      <rect
        x={rightNodeX} y={rightStart} width={nodeW} height={capFrac * barsHeight}
        rx={3} fill={colors.accent} opacity={0.9}
      />
      {!est.withinBudget && (
        <rect
          x={rightNodeX} y={capY} width={nodeW} height={(1 - capFrac) * barsHeight}
          rx={3} fill={OVERFLOW_COLOR} opacity={0.6}
        />
      )}

      {/* Cap line */}
      {!est.withinBudget && (
        <>
          <line
            x1={rightNodeX - 6} y1={capY} x2={rightNodeX + nodeW + 4} y2={capY}
            stroke={OVERFLOW_COLOR} strokeWidth={1} strokeDasharray="3 2"
          />
          <text
            x={rightNodeX + nodeW + 6} y={capY}
            dominantBaseline="middle" fontSize={9}
            fill={OVERFLOW_COLOR} fontFamily={fonts.mono}
          >
            cap
          </text>
        </>
      )}

      {/* Window label */}
      <text
        x={rightNodeX + nodeW / 2} y={rightStart - 4}
        textAnchor="middle" fontSize={9}
        fill={colors.textTertiary} fontFamily={fonts.ui}
      >
        context
      </text>
    </svg>
  )
}

function Legend({ layers, total }: { layers: LayerBudget[]; total: number }) {
  return (
    <div style={{ marginTop: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
      {layers.map(l => (
        <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <span style={{
            width: 10, height: 10, borderRadius: 3,
            background: l.color, flexShrink: 0,
          }} />
          <span style={{ fontSize: fontSizes.caption, color: colors.text, minWidth: 84 }}>
            {l.icon} {l.label}
          </span>
          {/* mini bar */}
          <div style={{
            flex: 1, height: 6, borderRadius: 3,
            background: colors.bgTertiary, boxShadow: shadows.neuInsetSm, overflow: 'hidden',
          }}>
            <div style={{ width: `${l.pct * 100}%`, height: '100%', background: l.color, opacity: 0.8 }} />
          </div>
          <span style={{
            fontSize: fontSizes.caption, color: colors.textSecondary,
            fontFamily: fonts.mono, minWidth: 70, textAlign: 'right',
          }}>
            {formatTokens(l.tokens)} · {(l.pct * 100).toFixed(0)}%
          </span>
        </div>
      ))}
      <div style={{
        marginTop: spacing.xs, paddingTop: spacing.xs,
        borderTop: `1px solid ${colors.separator}`,
        display: 'flex', justifyContent: 'space-between',
        fontSize: fontSizes.caption, color: colors.textSecondary, fontFamily: fonts.mono,
      }}>
        <span>Σ footprint</span>
        <span>{formatTokens(total)} tokens</span>
      </div>
    </div>
  )
}
