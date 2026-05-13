import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { colors, fonts, fontSizes, fontWeights as fw, spacing, radii, shadows, transitions } from '../../styles/tokens'
import { LumenX, LumenCheckCircle, LumenTrash2 } from '../UI/LumenIcon'

interface ShareDialogProps {
  workbookId: string
  ownerId: string
  isPrivate: boolean
  accessMode?: string
  currentUserId: string
  onClose: () => void
  onTogglePrivate: (v: boolean) => void
  onChangeAccessMode: (mode: string) => void
}

const ACCESS_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'public', label: 'Public', desc: 'Anyone can connect and edit' },
  { value: 'collaborators', label: 'Collaborators only', desc: 'Only invited users can connect' },
  { value: 'agents', label: 'Agents only', desc: 'Only AI agents can connect' },
  { value: 'private', label: 'Private', desc: 'Nobody can connect, not even agents' },
]

export function ShareDialog({ workbookId, ownerId, isPrivate, accessMode, currentUserId, onClose, onTogglePrivate, onChangeAccessMode }: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<string[]>([])
  const [inviteId, setInviteId] = useState('')
  const [msg, setMsg] = useState('')
  const [selectedMode, setSelectedMode] = useState(accessMode || (isPrivate ? 'collaborators' : 'public'))
  const isOwner = currentUserId === ownerId

  useEffect(() => {
    setSelectedMode(accessMode || (isPrivate ? 'collaborators' : 'public'))
  }, [accessMode, isPrivate])

  const load = async () => {
    try {
      const res = await api.listCollaborators(workbookId)
      setCollaborators(res.users)
    } catch { setCollaborators([]) }
  }

  useEffect(() => { load() }, [workbookId])

  const handleInvite = async () => {
    if (!inviteId.trim()) return
    try {
      await api.addCollaborator(workbookId, inviteId.trim())
      setMsg(`Added ${inviteId.trim()}`)
      setInviteId('')
      load()
    } catch { setMsg('Failed to add collaborator') }
  }

  const handleRemove = async (uid: string) => {
    try {
      await api.removeCollaborator(workbookId, uid)
      load()
    } catch { setMsg('Failed to remove') }
  }

  const handleModeChange = (mode: string) => {
    setSelectedMode(mode)
    onChangeAccessMode(mode)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: colors.white, borderRadius: radii.lg,
        boxShadow: shadows.lg, width: 420, maxHeight: '80vh', overflow: 'auto',
        fontFamily: fonts.ui,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing.lg}px ${spacing.xl}px`, borderBottom: `1px solid ${colors.separator}` }}>
          <span style={{ fontWeight: fw.semibold, fontSize: fontSizes.body }}>Share Workbook</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: colors.textQuaternary }}>
            <LumenX size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Access mode selector */}
        <div style={{ padding: `${spacing.lg}px ${spacing.xl}px`, borderBottom: `1px solid ${colors.separator}` }}>
          <div style={{ fontSize: fontSizes.caption, fontWeight: fw.semibold, color: colors.textSecondary, marginBottom: spacing.md }}>
            Access
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {ACCESS_OPTIONS.map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: spacing.md,
                cursor: 'pointer',
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radii.md,
                  background: selectedMode === opt.value ? colors.accentLight : 'transparent',
                transition: `background ${transitions.fast}`,
              }}>
                <input
                  type="radio"
                  name="access-mode"
                  value={opt.value}
                  checked={selectedMode === opt.value}
                  onChange={() => handleModeChange(opt.value)}
                  style={{ accentColor: colors.accent, marginTop: 2, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: fontSizes.body, fontWeight: fw.medium, color: colors.text }}>{opt.label}</div>
                  <div style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Invite input — only for collaborators mode */}
        {selectedMode === 'collaborators' && isOwner && (
          <div style={{ padding: `${spacing.lg}px ${spacing.xl}px`, borderBottom: `1px solid ${colors.separator}` }}>
            <div style={{ fontSize: fontSizes.caption, fontWeight: fw.semibold, color: colors.textSecondary, marginBottom: spacing.sm }}>
              Invite by User ID
            </div>
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <input
                value={inviteId}
                onChange={e => setInviteId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                placeholder="Enter user ID..."
                style={{
                  flex: 1, padding: `${spacing.sm}px ${spacing.md}px`,
                  fontSize: fontSizes.body, border: `1px solid ${colors.separator}`,
                  borderRadius: radii.md, outline: 'none', fontFamily: fonts.ui,
                }}
              />
              <button onClick={handleInvite} style={{
                padding: `${spacing.sm}px ${spacing.xl}px`,
                background: colors.accent, color: colors.white,
                border: 'none', borderRadius: radii.md, cursor: 'pointer',
                fontWeight: fw.semibold, fontSize: fontSizes.body, fontFamily: fonts.ui,
              }}>Invite</button>
            </div>
            {msg && <div style={{ fontSize: fontSizes.caption, color: colors.accent, marginTop: spacing.xs }}>{msg}</div>}
          </div>
        )}

        {/* Owner info */}
        <div style={{ padding: `${spacing.md}px ${spacing.xl}px`, borderBottom: `1px solid ${colors.separator}`, display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <LumenCheckCircle size={16} color={colors.accent} />
          <span style={{ fontSize: fontSizes.body }}>
            <strong>{ownerId}</strong>
            <span style={{ color: colors.textTertiary, marginLeft: spacing.sm }}>(owner)</span>
          </span>
        </div>

        {/* Collaborators list */}
        {selectedMode === 'collaborators' && (
          <div style={{ padding: `${spacing.md}px ${spacing.xl}px` }}>
            <div style={{ fontSize: fontSizes.caption, fontWeight: fw.semibold, color: colors.textSecondary, marginBottom: spacing.sm }}>
              Collaborators ({collaborators.length})
            </div>
            {collaborators.length === 0 ? (
              <div style={{ fontSize: fontSizes.body, color: colors.textTertiary, padding: `${spacing.md}px 0` }}>
                No collaborators yet
              </div>
            ) : (
              collaborators.map(uid => (
                <div key={uid} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `${spacing.sm}px 0`, fontSize: fontSizes.body,
                }}>
                  <span>{uid}</span>
                  {isOwner && (
                    <button onClick={() => handleRemove(uid)} style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      display: 'flex', color: colors.textQuaternary,
                      transition: `color ${transitions.fast}`,
                    }}                      onMouseEnter={e => e.currentTarget.style.color = colors.red}
                     onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}>
                      <LumenTrash2 size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Self User ID */}
        <div style={{ padding: `${spacing.md}px ${spacing.xl}px`, borderTop: `1px solid ${colors.separator}`, fontSize: fontSizes.caption, color: colors.textTertiary }}>
          Your User ID: <strong>{currentUserId}</strong>
        </div>
      </div>
    </div>
  )
}
