// V6.1 — Memory maintenance (write-back to MASys).
// Namespace-level cleanup/consolidation actions. The Workbench was read-only
// through V6.0; these are the first mutating operations, each gated by a
// confirmation and reporting its outcome.
import { useState } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; msg: string } | { kind: 'err'; msg: string }

export function MaintenancePanel() {
  const { activeNamespace, results, skills, deleteExpiredResults, forgetSkills, acquireSkills } =
    useMASysMemoryStore()

  // forget criteria
  const [minSuccess, setMinSuccess] = useState(0.5)
  const [unusedDays, setUnusedDays] = useState(30)
  // acquire criteria
  const [minOcc, setMinOcc] = useState(3)

  const expiredCount = results.filter(r => {
    if (!r.expiresAt) return false
    const t = Date.parse(r.expiresAt)
    return !isNaN(t) && t < Date.now()
  }).length

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      <div style={{
        padding: spacing.sm, fontSize: fontSizes.caption, color: colors.textSecondary,
        background: colors.bgTertiary, boxShadow: shadows.neuInsetSm, borderRadius: radii.sm,
      }}>
        ⚠️ Действия ниже <b>изменяют</b> память MASys в namespace <code>{activeNamespace}</code>. Необратимо.
      </div>

      <ActionCard
        icon="📦"
        title="Удалить просроченные артефакты"
        desc={`Result store: удалить все с истёкшим TTL${expiredCount > 0 ? ` (сейчас ${expiredCount})` : ''}.`}
        confirm={`Удалить просроченные артефакты в «${activeNamespace}»?`}
        run={() => deleteExpiredResults()}
        format={(n) => `Удалено артефактов: ${n}`}
        disabled={expiredCount === 0}
      />

      <ActionCard
        icon="⚡"
        title="Забыть слабые навыки"
        desc={`Деприкейт навыков с successRate < ${minSuccess} и неиспользуемых > ${unusedDays} дн.`}
        confirm={`Деприкейтнуть слабые навыки в «${activeNamespace}»? (всего навыков: ${skills.length})`}
        run={() => forgetSkills({ minSuccessRate: minSuccess, unusedDays })}
        format={(n) => `Деприкейтнуто навыков: ${n}`}
      >
        <Field label="min success" value={minSuccess} step={0.1} min={0} max={1} onChange={setMinSuccess} />
        <Field label="unused, дн" value={unusedDays} step={1} min={1} max={365} onChange={setUnusedDays} />
      </ActionCard>

      <ActionCard
        icon="🧪"
        title="Извлечь навыки из эпизодов"
        desc={`Дистилляция новых навыков из ≥ ${minOcc}× повторяющихся успешных действий.`}
        confirm={`Запустить acquisition в «${activeNamespace}»?`}
        run={async () => { await acquireSkills({ minOccurrences: minOcc }); return undefined }}
        format={() => 'Acquisition выполнена'}
      >
        <Field label="min повторов" value={minOcc} step={1} min={1} max={50} onChange={setMinOcc} />
      </ActionCard>
    </div>
  )
}

function ActionCard<T>({ icon, title, desc, confirm, run, format, disabled, children }: {
  icon: string
  title: string
  desc: string
  confirm: string
  run: () => Promise<T>
  format: (result: T) => string
  disabled?: boolean
  children?: React.ReactNode
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const onClick = async () => {
    if (status.kind === 'busy') return
    if (!window.confirm(confirm)) return
    setStatus({ kind: 'busy' })
    try {
      const res = await run()
      setStatus({ kind: 'ok', msg: format(res) })
    } catch (e: any) {
      setStatus({ kind: 'err', msg: e?.message ?? String(e) })
    }
  }

  return (
    <div style={{
      padding: spacing.md, background: colors.bgTertiary, boxShadow: shadows.neuMd,
      borderRadius: radii.lg, display: 'flex', flexDirection: 'column', gap: spacing.sm,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: fontSizes.subhead, fontWeight: fontWeights.semibold, color: colors.text }}>{title}</span>
      </div>
      <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>{desc}</span>
      {children && <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>{children}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        <button
          onClick={onClick}
          disabled={disabled || status.kind === 'busy'}
          style={{
            padding: `${spacing.xs}px ${spacing.md}px`,
            background: disabled ? colors.bgTertiary : '#ef4444',
            color: disabled ? colors.textQuaternary : '#fff',
            boxShadow: disabled ? shadows.neuSm : 'none',
            border: 'none', borderRadius: radii.sm,
            fontSize: fontSizes.caption, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
            cursor: disabled || status.kind === 'busy' ? 'not-allowed' : 'pointer',
          }}
        >
          {status.kind === 'busy' ? 'Выполняю…' : 'Выполнить'}
        </button>
        {status.kind === 'ok' && <span style={{ fontSize: fontSizes.caption, color: colors.green }}>✓ {status.msg}</span>}
        {status.kind === 'err' && <span style={{ fontSize: fontSizes.caption, color: '#ef4444' }}>✗ {status.msg}</span>}
      </div>
    </div>
  )
}

function Field({ label, value, step, min, max, onChange }: {
  label: string; value: number; step: number; min: number; max: number; onChange: (n: number) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: colors.textTertiary }}>
      {label}
      <input
        type="number" value={value} step={step} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: 80, padding: `${spacing.xxs}px ${spacing.xs}px`,
          background: colors.bgTertiary, boxShadow: shadows.neuInsetSm,
          border: 'none', borderRadius: radii.sm, color: colors.text,
          fontSize: fontSizes.caption, fontFamily: fonts.mono,
        }}
      />
    </label>
  )
}
