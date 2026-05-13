import { useState } from 'react'
import { LumenX, LumenEdit2 } from '../UI/LumenIcon'
import type { PresenceUser } from '../../types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

interface PresencePanelProps {
  users: PresenceUser[]
  userName: string
  userColor: string
  broadcastCursor: boolean
  showRemoteCursors: boolean
  onToggleBroadcast: () => void
  onToggleShowCursors: () => void
  onChangeName: (name: string) => void
  onClose: () => void
}

export function PresencePanel({
  users, userName, userColor,
  broadcastCursor, showRemoteCursors,
  onToggleBroadcast, onToggleShowCursors,
  onChangeName, onClose,
}: PresencePanelProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(userName)

  const toggleBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
    padding: `${spacing.sm}px ${spacing.md}px`,
    border: 'none', borderRadius: radii.sm, cursor: 'pointer',
    fontSize: fontSizes.body, fontFamily: fonts.ui,
    background: 'transparent', color: colors.text,
    transition: `background ${transitions.fast}`,
  }

  return (
    <div style={{
      position: 'fixed', top: 64, right: spacing.xl, width: 240,
      background: colors.bgSecondary,
      border: 'none',
      borderRadius: radii.lg,
      boxShadow: shadows.neuMd,
      zIndex: 100, padding: spacing.lg,
      fontFamily: fonts.ui,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>
          Users ({users.length + 1})
        </span>
        <button
          onClick={onClose}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex',
            color: colors.textQuaternary, padding: 0,
            transition: `color ${transitions.fast}`,
          }}
          onMouseEnter={e => e.currentTarget.style.color = colors.text}
          onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
        ><LumenX size={16} strokeWidth={1.8} /></button>
      </div>

      {/* My identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, padding: `${spacing.xs}px ${spacing.sm}px`, background: colors.bgTertiary, borderRadius: radii.sm }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: userColor, flexShrink: 0 }} />
        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={() => { onChangeName(nameDraft); setEditingName(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { onChangeName(nameDraft); setEditingName(false) } }}
            style={{ flex: 1, border: 'none', background: 'transparent', color: colors.text, fontSize: fontSizes.body, fontFamily: fonts.ui, outline: 'none' }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: fontSizes.body, color: colors.text }}>{userName}</span>
        )}
        <button onClick={() => { setNameDraft(userName); setEditingName(true) }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textQuaternary, padding: 0, display: 'flex' }}
        ><LumenEdit2 size={14} /></button>
      </div>

      <div style={{ height: 1, background: colors.separator, marginBottom: spacing.sm }} />

      {/* Toggles */}
      <button onClick={onToggleBroadcast} style={toggleBase}
        onMouseEnter={e => e.currentTarget.style.background = colors.bgTertiary}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span>Broadcast cursor</span>
        <span style={{ fontSize: fontSizes.label, color: broadcastCursor ? colors.green : colors.textQuaternary }}>
          {broadcastCursor ? 'ON' : 'OFF'}
        </span>
      </button>

      <button onClick={onToggleShowCursors} style={toggleBase}
        onMouseEnter={e => e.currentTarget.style.background = colors.bgTertiary}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span>Show others' cursors</span>
        <span style={{ fontSize: fontSizes.label, color: showRemoteCursors ? colors.green : colors.textQuaternary }}>
          {showRemoteCursors ? 'ON' : 'OFF'}
        </span>
      </button>

      <div style={{ height: 1, background: colors.separator, margin: `${spacing.sm}px 0` }} />

      {/* User list */}
      {users.length === 0 ? (
        <div style={{ fontSize: fontSizes.body, color: colors.textQuaternary, textAlign: 'center', padding: `${spacing.md}px 0` }}>
          No other users connected
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {users.map(u => (
            <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: u.user_color || colors.accent, flexShrink: 0 }} />
              <span style={{ fontSize: fontSizes.body, color: colors.text }}>{u.user_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
