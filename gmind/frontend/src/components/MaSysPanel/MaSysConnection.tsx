// Состояние связи с MASys: подключение находится автоматически, но адрес
// можно задать руками — тогда он сохраняется на бэкенде и переживает рестарт.
import { useState } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, transitions } from '../../styles/tokens'

export function MaSysConnection() {
  const health = useMASysMemoryStore(s => s.health)
  const healthError = useMASysMemoryStore(s => s.health_error)
  const checkHealth = useMASysMemoryStore(s => s.checkHealth)
  const setBaseUrl = useMASysMemoryStore(s => s.setBaseUrl)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const reachable = !!health?.reachable
  const baseUrl = health?.base_url ?? '—'

  const apply = async () => {
    const url = draft.trim()
    if (!url) return
    setBusy(true)
    try {
      await setBaseUrl(url)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    setBusy(true)
    try {
      await checkHealth(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      padding: `${spacing.sm}px ${spacing.md}px`,
      border: `1px solid ${colors.separator}`,
      borderRadius: radii.md,
      background: colors.bgSecondary,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.xs,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: reachable ? colors.green : colors.red,
        }} />
        <span style={{ fontSize: fontSizes.caption, fontWeight: fontWeights.semibold, color: colors.text }}>
          {reachable ? 'MASys подключён' : 'MASys недоступен'}
        </span>
        {reachable && health?.latency_ms !== undefined && (
          <span style={{ fontSize: 10, color: colors.textTertiary }}>{health.latency_ms} мс</span>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={refresh} disabled={busy} style={linkButtonStyle}>↻</button>
        <button onClick={() => { setDraft(health?.base_url ?? ''); setEditing(e => !e) }} style={linkButtonStyle}>
          адрес
        </button>
      </div>

      <div style={{ fontSize: 11, color: colors.textTertiary, wordBreak: 'break-all', fontFamily: fonts.mono }}>
        {baseUrl}{health?.discovered ? ' (найден автоматически)' : ''}
      </div>

      {!reachable && (health?.error || healthError) && (
        <div style={{ fontSize: 10, color: colors.red, wordBreak: 'break-word' }}>
          {health?.error ?? healthError}
        </div>
      )}

      {!reachable && !!health?.candidates?.length && (
        <div style={{ fontSize: 10, color: colors.textTertiary }}>
          Проверены: {health.candidates.join(', ')}
        </div>
      )}

      {editing && (
        <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.xxs }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') apply() }}
            placeholder="http://localhost:5010"
            style={{
              flex: 1, minWidth: 0,
              padding: `${spacing.xxs}px ${spacing.sm}px`,
              border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
              background: colors.bgTertiary, color: colors.text,
              fontSize: fontSizes.caption, fontFamily: fonts.ui, outline: 'none',
            }}
          />
          <button onClick={apply} disabled={busy || !draft.trim()} style={{
            padding: `${spacing.xxs}px ${spacing.md}px`,
            border: 'none', borderRadius: radii.sm,
            background: colors.accent, color: colors.white,
            fontSize: fontSizes.caption, fontFamily: fonts.ui, cursor: 'pointer',
          }}>
            OK
          </button>
        </div>
      )}
    </div>
  )
}

const linkButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: colors.textQuaternary,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  transition: `color ${transitions.fast}`,
  padding: 0,
}
