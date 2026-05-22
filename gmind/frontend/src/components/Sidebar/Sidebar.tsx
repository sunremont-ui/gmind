import { useState, useEffect, useRef } from 'react'
import { LumenPlus, LumenUpload, LumenMap, LumenInbox, LumenTrash2 } from '../UI/LumenIcon'
import { api } from '../../api/client'
import { offlineStorage, offlineSettings } from '../../utils/offline'
import type { Workbook } from '../../types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, sizes } from '../../styles/tokens'
import { Button, Text, Input } from '../UI/Box'

const INBOX_WB_KEY = 'inbox_workbook_id'

interface SidebarProps {
  activeWorkbookId: string | null
  onSelectWorkbook: (id: string) => void
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ activeWorkbookId, onSelectWorkbook, collapsed = false, onToggle }: SidebarProps) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([])
  const [inboxId, setInboxId] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadWorkbooks = async () => {
    try {
      const list = await api.listWorkbooks()
      setWorkbooks(list)
      list.forEach(wb => offlineStorage.saveWorkbook(wb).catch(() => {}))
    } catch {
      const cached = await offlineStorage.listWorkbooks()
      if (cached.length > 0) setWorkbooks(cached)
    }
  }

  useEffect(() => { loadWorkbooks() }, [])

  useEffect(() => {
    offlineSettings.get<string>(INBOX_WB_KEY).then(id => {
      if (id) setInboxId(id)
    })
  }, [workbooks])

  const createWorkbook = async () => {
    const title = newTitle.trim() || 'Untitled mind map'
    try {
      const wb = await api.createWorkbook(title)
      setWorkbooks(prev => [wb, ...prev])
      onSelectWorkbook(wb.id)
      setShowNewDialog(false)
      setNewTitle('')
    } catch (err) {
      console.error('Failed to create workbook:', err)
    }
  }

  const deleteWorkbook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this workbook?')) return
    try {
      await api.deleteWorkbook(id)
      setWorkbooks(prev => prev.filter(w => w.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const regularWbs = workbooks.filter(w => !inboxId || w.id !== inboxId)
  const inboxWb = inboxId ? workbooks.find(w => w.id === inboxId) : null

  return (
    <div style={{
      width: collapsed ? sizes.sidebarCollapsed : sizes.sidebar,
      background: colors.bgTertiary,
      borderRight: 'none',
      boxShadow: shadows.neuInset,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: fonts.ui,
      flexShrink: 0,
      overflow: 'hidden',
      transition: `width ${transitions.fast}`,
    }}>
      {!collapsed && (
        <>
          {/* Header actions */}
          <div style={{
            padding: `${spacing.lg}px ${spacing.lg}px ${spacing.md}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
            flexShrink: 0,
          }}>
            <button
              onClick={() => setShowNewDialog(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                width: '100%', padding: `${spacing.md}px`,
                background: colors.accent, color: colors.textInverse,
                border: 'none', borderRadius: 12,
                fontSize: fontSizes.body, fontWeight: fontWeights.medium,
                fontFamily: fonts.ui, cursor: 'pointer',
                boxShadow: shadows.neuMd,
                transition: `all ${transitions.fast}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = colors.accentHover; e.currentTarget.style.boxShadow = 'none' }}
              onMouseLeave={e => { e.currentTarget.style.background = colors.accent; e.currentTarget.style.boxShadow = shadows.neuMd }}
              onMouseDown={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm; e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              <LumenPlus size={15} strokeWidth={1.8} />
              New mind map
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xmind"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const formData = new FormData()
                  formData.append('file', file)
                  const res = await fetch('/api/v1/workbooks/import', { method: 'POST', body: formData })
                  if (!res.ok) {
                    const errText = await res.text().catch(() => '')
                    throw new Error(`Import failed${errText ? `: ${errText}` : ''}`)
                  }
                  const text = await res.text()
                  if (!text) throw new Error('Import returned empty response')
                  const wb: Workbook = JSON.parse(text)
                  setWorkbooks(prev => [wb, ...prev])
                  onSelectWorkbook(wb.id)
                } catch (err) {
                  console.error('Import failed:', err)
                  alert('Failed to import .xmind file')
                }
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                width: '100%', padding: `${spacing.sm + 1}px`,
                background: 'transparent', color: colors.textSecondary,
                border: 'none', borderRadius: 12,
                fontSize: fontSizes.body, fontWeight: fontWeights.medium,
                fontFamily: fonts.ui, cursor: 'pointer',
                boxShadow: shadows.neuSm,
                transition: `all ${transitions.fast}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = shadows.neuSm }}
            >
              <LumenUpload size={13} strokeWidth={1.8} />
              Import .xmind
            </button>
          </div>

          {/* Workbook list */}
          <div style={{ flex: 1, overflow: 'auto', padding: `${spacing.sm}px ${spacing.md}px` }}>
            {/* Inbox */}
            {inboxWb && (
              <div style={{ marginBottom: spacing.lg }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing.xs,
                  fontSize: fontSizes.caption, fontWeight: fontWeights.semibold,
                  color: colors.textTertiary, textTransform: 'uppercase',
                  letterSpacing: '0.06em', padding: `${spacing.md}px ${spacing.md}px ${spacing.xs}px`,
                }}>
                  <LumenInbox size={12} strokeWidth={2} />
                  Inbox
                </div>
                <WorkbookItem
                  wb={inboxWb}
                  active={activeWorkbookId === inboxWb.id}
                  icon={<LumenInbox size={14} strokeWidth={1.8} />}
                  onSelect={() => onSelectWorkbook(inboxWb.id)}
                  onDelete={null}
                  accent
                />
              </div>
            )}

            {/* Workbooks section */}
            {regularWbs.length > 0 && (
              <div style={{
                fontSize: fontSizes.caption, fontWeight: fontWeights.semibold,
                color: colors.textTertiary, textTransform: 'uppercase',
                letterSpacing: '0.06em', padding: `${spacing.md}px ${spacing.md}px ${spacing.xs}px`,
              }}>
                Workbooks
              </div>
            )}

            {regularWbs.length === 0 && !inboxWb && (
              <div style={{ padding: `${spacing.xxl}px ${spacing.xl}px`, textAlign: 'center' }}>
                <Text size={fontSizes.body} color={colors.textTertiary}>No workbooks yet.</Text>
              </div>
            )}

            {regularWbs.map(wb => (
              <WorkbookItem
                key={wb.id}
                wb={wb}
                active={activeWorkbookId === wb.id}
                icon={<LumenMap size={14} strokeWidth={1.8} />}
                onSelect={() => onSelectWorkbook(wb.id)}
                onDelete={(e) => deleteWorkbook(wb.id, e)}
                accent={false}
              />
            ))}
          </div>
        </>
      )}

      {/* New dialog */}
      {showNewDialog && (
        <div style={{
          position: 'fixed', inset: 0,
          background: colors.scrim,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: colors.white,
            borderRadius: radii.xl,
            padding: spacing.xxxl,
            width: 360,
            boxShadow: shadows.modal,
            border: `1px solid ${colors.separator}`,
          }}>
            <Text
              size={fontSizes.title}
              weight={fontWeights.semibold}
              color={colors.text}
              style={{ marginBottom: spacing.xl, display: 'block' }}
            >
              New mind map
            </Text>
            <div style={{ marginBottom: spacing.xl }}>
              <Input
                autoFocus
                placeholder="Mind map title"
                value={newTitle}
                onChange={setNewTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') createWorkbook()
                  if (e.key === 'Escape') setShowNewDialog(false)
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowNewDialog(false)}>Cancel</Button>
              <Button variant="primary" onClick={createWorkbook}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface WorkbookItemProps {
  wb: Workbook
  active: boolean
  icon: React.ReactNode
  onSelect: () => void
  onDelete: ((e: React.MouseEvent) => void) | null
  accent: boolean
}

function WorkbookItem({ wb, active, icon, onSelect, onDelete, accent }: WorkbookItemProps) {
  const activeBg = accent ? colors.accentLight : 'transparent'
  const activeColor = accent ? colors.inboxText : colors.text
  const iconColor = active ? (accent ? colors.accent : colors.text) : colors.textTertiary

  return (
    <div
      onClick={onSelect}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = colors.fill; e.currentTarget.style.boxShadow = shadows.neuSm } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' } }}
      style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        marginBottom: spacing.xxs,
        borderRadius: radii.md,
        cursor: 'pointer',
        background: active ? activeBg : 'transparent',
        boxShadow: active ? shadows.neuSm : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        transition: `background ${transitions.fast}, box-shadow ${transitions.fast}`,
        position: 'relative',
      }}
    >
      <span style={{ color: iconColor, flexShrink: 0, display: 'flex' }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: fontSizes.body, fontWeight: active ? fontWeights.medium : fontWeights.regular,
          color: activeColor,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: fonts.ui,
        }}>
          {wb.title}
        </div>
        <div style={{
          fontSize: fontSizes.caption,
          color: colors.textTertiary,
          fontFamily: fonts.ui,
          marginTop: 1,
        }}>
          {new Date(wb.updated_at).toLocaleDateString()} · {wb.sheets.length} sheet{wb.sheets.length !== 1 ? 's' : ''}
        </div>
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          title="Delete"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: colors.textQuaternary, padding: spacing.xxs,
            borderRadius: radii.sm, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            transition: `color ${transitions.fast}, background ${transitions.fast}`,
          }}
          onMouseEnter={e => {
            e.stopPropagation()
            e.currentTarget.style.background = colors.redLight
            e.currentTarget.style.color = colors.red
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = colors.textQuaternary
          }}
        >
          <LumenTrash2 size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}
