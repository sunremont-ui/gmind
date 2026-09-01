import { useState, useEffect, useRef } from 'react'
import { LumenPlus, LumenUpload, LumenMap, LumenInbox, LumenTrash2 } from '../UI/LumenIcon'
import { api } from '../../api/client'
import { API_BASE } from '../../api/base'
import { offlineStorage, offlineSettings } from '../../utils/offline'
import type { Workbook } from '../../types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, sizes } from '../../styles/tokens'
import { Button, Text, Input } from '../UI/Box'
import { ProjectTree } from './ProjectTree'
import type { ProjectRootContext } from '../../utils/documentNavigation'

const INBOX_WB_KEY = 'inbox_workbook_id'
const SIDEBAR_WIDTH_KEY = 'gmind_sidebar_width'
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 560
const SIDEBAR_KEYBOARD_STEP = 16

function clampSidebarWidth(width: number): number {
  const viewportMax = typeof window === 'undefined'
    ? SIDEBAR_MAX_WIDTH
    : Math.max(SIDEBAR_MIN_WIDTH, Math.floor(window.innerWidth * 0.55))
  return Math.min(Math.max(Math.round(width), SIDEBAR_MIN_WIDTH), Math.min(SIDEBAR_MAX_WIDTH, viewportMax))
}

function readSidebarWidth(): number {
  try {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
    return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : sizes.sidebar
  } catch {
    return sizes.sidebar
  }
}

function persistSidebarWidth(width: number) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width))
  } catch {
    // В приватном режиме ширина просто не переживёт перезапуск.
  }
}

interface SidebarProps {
  activeWorkbookId: string | null
  onSelectWorkbook: (id: string) => void
  collapsed?: boolean
  onToggle?: () => void
  projectRoot?: ProjectRootContext | null
  activeSourcePath?: string
  onOpenProjectDocument?: (path: string) => void
  onProjectChanged?: (workbook: Workbook, deletedPath?: string, deletedWorkbookIds?: string[]) => void
}

export function Sidebar({
  activeWorkbookId,
  onSelectWorkbook,
  collapsed = false,
  projectRoot = null,
  activeSourcePath,
  onOpenProjectDocument,
  onProjectChanged,
}: SidebarProps) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([])
  const [inboxId, setInboxId] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth)
  const [isResizing, setIsResizing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resizeStartRef = useRef({ x: 0, width: sizes.sidebar })
  const sidebarWidthRef = useRef(sidebarWidth)

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

  useEffect(() => {
    if (!isResizing) return

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (event: PointerEvent) => {
      const next = clampSidebarWidth(
        resizeStartRef.current.width + event.clientX - resizeStartRef.current.x,
      )
      sidebarWidthRef.current = next
      setSidebarWidth(next)
    }
    const finishResize = () => {
      persistSidebarWidth(sidebarWidthRef.current)
      setIsResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishResize, { once: true })
    window.addEventListener('pointercancel', finishResize, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isResizing])

  const setAndPersistSidebarWidth = (width: number) => {
    const next = clampSidebarWidth(width)
    sidebarWidthRef.current = next
    setSidebarWidth(next)
    persistSidebarWidth(next)
  }

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
      width: collapsed ? sizes.sidebarCollapsed : sidebarWidth,
      background: colors.bgTertiary,
      borderRight: 'none',
      boxShadow: shadows.neuInset,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: fonts.ui,
      flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
      transition: isResizing ? 'none' : `width ${transitions.fast}`,
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
                  const res = await fetch(`${API_BASE}/workbooks/import`, { method: 'POST', body: formData })
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
            {projectRoot && onOpenProjectDocument && onProjectChanged && (
              <ProjectTree
                key={projectRoot.path}
                projectRoot={projectRoot}
                activeWorkbookId={activeWorkbookId}
                activeSourcePath={activeSourcePath}
                onOpenRoot={() => onSelectWorkbook(projectRoot.workbookId)}
                onOpenDocument={onOpenProjectDocument}
                onProjectChanged={onProjectChanged}
              />
            )}

            <details key={projectRoot?.path ?? 'all-workbooks'} open={projectRoot ? undefined : true}>
              <summary style={projectRoot ? otherWorkbooksSummaryStyle : hiddenSummaryStyle}>
                Другие карты
              </summary>
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
            </details>
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

      {!collapsed && (
        <div
          role="separator"
          aria-label="Изменить ширину боковой панели"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          title="Потяните, чтобы изменить ширину · двойной щелчок — сбросить"
          onPointerDown={event => {
            if (event.button !== 0) return
            event.preventDefault()
            event.currentTarget.setPointerCapture?.(event.pointerId)
            resizeStartRef.current = { x: event.clientX, width: sidebarWidth }
            sidebarWidthRef.current = sidebarWidth
            setIsResizing(true)
          }}
          onDoubleClick={() => setAndPersistSidebarWidth(sizes.sidebar)}
          onKeyDown={event => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              setAndPersistSidebarWidth(sidebarWidth - SIDEBAR_KEYBOARD_STEP)
            } else if (event.key === 'ArrowRight') {
              event.preventDefault()
              setAndPersistSidebarWidth(sidebarWidth + SIDEBAR_KEYBOARD_STEP)
            } else if (event.key === 'Home') {
              event.preventDefault()
              setAndPersistSidebarWidth(sizes.sidebar)
            }
          }}
          style={{ ...resizeHandleStyle, ...(isResizing ? resizeHandleActiveStyle : {}) }}
        >
          <span aria-hidden="true" style={resizeGripStyle} />
        </div>
      )}
    </div>
  )
}

const resizeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  width: 9,
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'col-resize',
  touchAction: 'none',
  outline: 'none',
}

const resizeHandleActiveStyle: React.CSSProperties = {
  background: colors.accentLight,
}

const resizeGripStyle: React.CSSProperties = {
  width: 2,
  height: 36,
  borderRadius: 2,
  background: colors.separatorThick,
  boxShadow: shadows.neuSm,
}

const otherWorkbooksSummaryStyle: React.CSSProperties = {
  padding: `${spacing.md}px`,
  color: colors.textTertiary,
  fontSize: fontSizes.caption,
  fontWeight: fontWeights.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  userSelect: 'none',
}

const hiddenSummaryStyle: React.CSSProperties = {
  display: 'none',
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
