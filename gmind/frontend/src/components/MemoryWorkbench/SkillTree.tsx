// V6.0 Phase 6 — Skill Evolution Tree.
// Renders the skill derivation forest (parent → distilled child) as an indented
// tree, annotated with success-rate health, usage counts and active state.
import { useMemo, useState } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'
import { buildSkillForest, flattenForest, successColor, type SkillNode } from './skillForest'
import type { MASysSkill } from '../../types/masys'

export function SkillTree() {
  const skills = useMASysMemoryStore(s => s.skills)
  const [selected, setSelected] = useState<MASysSkill | null>(null)

  const forest = useMemo(() => buildSkillForest(skills), [skills])
  const rows = useMemo(() => flattenForest(forest.roots), [forest])

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', marginBottom: spacing.md }}>
        <Stat label="навыков" value={forest.stats.total} />
        <Stat label="корней" value={forest.stats.roots} />
        <Stat label="derived" value={forest.stats.derived} />
        <Stat label="глубина" value={forest.stats.maxDepth} />
        {forest.stats.orphanRefs > 0 && (
          <Stat label="⚠ orphan refs" value={forest.stats.orphanRefs} warn />
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{
          padding: spacing.xxl, textAlign: 'center',
          color: colors.textTertiary, fontSize: fontSizes.caption,
        }}>
          Нет навыков в этом namespace
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map(node => (
            <SkillRow
              key={`${node.skill.id}-${node.depth}`}
              node={node}
              onClick={() => setSelected(node.skill)}
            />
          ))}
        </div>
      )}

      {selected && <SkillDetails skill={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: `${spacing.xs}px ${spacing.md}px`,
      background: colors.bgTertiary, boxShadow: shadows.neuInsetSm, borderRadius: radii.sm,
    }}>
      <span style={{
        fontSize: fontSizes.subhead, fontWeight: fontWeights.bold, fontFamily: fonts.mono,
        color: warn ? '#f59e0b' : colors.text,
      }}>{value}</span>
      <span style={{ fontSize: 10, color: colors.textTertiary }}>{label}</span>
    </div>
  )
}

function SkillRow({ node, onClick }: { node: SkillNode; onClick: () => void }) {
  const s = node.skill
  const color = successColor(s)
  const used = (s.usageCount ?? 0) > 0
  const pct = s.successRate != null ? `${Math.round(s.successRate * 100)}%` : '—'
  const inactive = s.active === false

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing.sm,
        marginLeft: node.depth * 18,
        padding: `${spacing.xs}px ${spacing.sm}px`,
        background: colors.bgTertiary, boxShadow: shadows.neuSm,
        borderRadius: radii.sm, cursor: 'pointer',
        opacity: inactive ? 0.55 : 1,
      }}
    >
      {node.depth > 0 && (
        <span style={{ color: colors.textQuaternary, fontFamily: fonts.mono, fontSize: 11 }}>↳</span>
      )}
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: fontSizes.caption, color: colors.text,
        fontWeight: node.depth === 0 ? fontWeights.semibold : fontWeights.regular,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {s.name || s.id}
        {inactive && <span style={{ color: colors.textQuaternary }}> · off</span>}
      </span>
      <span style={{
        fontSize: 10, fontFamily: fonts.mono, color,
        minWidth: 34, textAlign: 'right',
      }}>{used ? pct : 'new'}</span>
      <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textTertiary, minWidth: 28, textAlign: 'right' }}>
        ×{s.usageCount ?? 0}
      </span>
    </div>
  )
}

function SkillDetails({ skill, onClose }: { skill: MASysSkill; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: colors.scrim, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, maxHeight: '70vh', overflow: 'auto',
          background: colors.bgTertiary, boxShadow: shadows.neuLg, borderRadius: radii.lg,
          padding: spacing.lg, fontFamily: fonts.ui,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <span style={{ fontSize: fontSizes.subhead, fontWeight: fontWeights.semibold, color: colors.text }}>
            ⚡ {skill.name || skill.id}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textQuaternary }}>✕</button>
        </div>
        <DetailRow label="ID" value={skill.id} mono />
        {skill.trigger && <DetailRow label="Trigger" value={skill.trigger} />}
        <DetailRow label="Success" value={skill.successRate != null ? `${Math.round(skill.successRate * 100)}%` : '—'} />
        <DetailRow label="Usage" value={`${skill.usageCount ?? 0} (${skill.successCount ?? 0} ✓)`} />
        <DetailRow label="Active" value={skill.active === false ? 'no' : 'yes'} />
        {skill.derivedFrom?.length ? <DetailRow label="Derived from" value={skill.derivedFrom.join(', ')} mono /> : null}
        {skill.body != null && (
          <pre style={{
            marginTop: spacing.sm, padding: spacing.sm,
            background: colors.bgTertiary, boxShadow: shadows.neuInsetSm, borderRadius: radii.sm,
            fontSize: 11, fontFamily: fonts.mono, color: colors.textSecondary,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto',
          }}>
            {typeof skill.body === 'string' ? skill.body : JSON.stringify(skill.body, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: spacing.sm, padding: `${spacing.xxs}px 0`, fontSize: fontSizes.caption }}>
      <span style={{ color: colors.textTertiary, minWidth: 90 }}>{label}</span>
      <span style={{ color: colors.text, fontFamily: mono ? fonts.mono : fonts.ui, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
