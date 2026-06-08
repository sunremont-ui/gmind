import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useMindMapStore } from '../../store/mindmap'
import { useThemeStore } from '../../store/theme'
import { useLayoutStore } from '../../store/layout'
import { buildLayout, computeTreeLayout, translate } from '../../renderer/layout'
import { MindMapRenderer } from '../../renderer/renderer'
import { api } from '../../api/client'
import { wsClient } from '../../api/ws'
import type { LayoutNode, CursorPosition, PresenceUser } from '../../types'
import type { Topic } from '../../types'

import type { StructureClass } from '../../types'
import { LumenX, LumenChevronRight, LumenChevronLeft, LumenUndo, LumenRedo, LumenSearch, LumenInbox } from '../UI/LumenIcon'
import { AnimatedMount } from '../UI/AnimatedMount'
import { ErrorBoundary } from './ErrorBoundary'
import { PropertiesPanel } from '../PropertiesPanel/PropertiesPanel'
import { AIServerPanel } from '../AIServerPanel/AIServerPanel'
import { PresencePanel } from '../PresencePanel/PresencePanel'
import { CommentsPanel } from '../Comments/CommentsPanel'
import { ShareDialog } from '../ShareDialog/ShareDialog'
import { ToolPanel, type Tool } from '../ToolPanel/ToolPanel'
import { StylePanel } from '../StylePanel/StylePanel'
import { RelationshipPanel } from '../RelationshipPanel/RelationshipPanel'
import { EdgeAnchorsLayer } from './EdgeAnchorsLayer'
import { FantomLine } from './FantomLine'
import { ConnectionPopover } from './ConnectionPopover'
import { AnchorActionMenu } from './AnchorActionMenu'
import { RelationshipMarkers } from './RelationshipLine'
import { RelationshipFilter } from './RelationshipFilter'
import { useGraphDragTracking } from './useGraphDragTracking'
import { useRelationshipsStore, type AnchorSide } from '../../store/relationships'
import { KGSyncDialog } from '../MemoryWorkbench/KGSyncDialog'

import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z } from '../../styles/tokens'

import { parseMarkdownToTopics } from '../../utils/markdown'
import { parseFreeMind } from '../../utils/freemind'
import { offlineSettings, offlineQueue } from '../../utils/offline'

interface MindMapProps {
  workbookId: string
  onXMindImported?: (wbId: string) => void
}

const MAX_HISTORY = 50
const USER_COLORS = [colors.accent, colors.red, colors.green, colors.orange, '#ec4899', '#06b6d4', colors.purple, colors.orange]
const USER_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta']

function makeUserName(): string {
  const n = USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)]
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${n}-${suffix}`
}

function makeUserColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
}

export function MindMap({ workbookId, onXMindImported }: MindMapProps) {
  const {
    workbook,
    activeSheetId,
    selectedTopicId,
    selectedTopicIds,
    setSelectedTopic,
    toggleSelectedTopic,
    updateTopicInTree,
    addTopic,
    addTopicAt,
    removeTopic,
    moveTopicInTree,
    detachToFloating,
    swapTopics,
    isDescendant,
  } = useMindMapStore()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; topicId: string } | null>(null)
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number } | null>(null)
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set())
  const { theme } = useThemeStore()
  const userIdRef = useRef(localStorage.getItem('gmind_user_id') || 'user-' + Math.random().toString(36).slice(2, 8))
  const userNameRef = useRef(localStorage.getItem('gmind_user_name') || makeUserName())
  const userColorRef = useRef(localStorage.getItem('gmind_user_color') || makeUserColor())
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map())
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [showRemoteCursors, setShowRemoteCursors] = useState(() => localStorage.getItem('gmind_show_cursors') !== 'false')
  const [broadcastCursor, setBroadcastCursor] = useState(() => localStorage.getItem('gmind_broadcast') !== 'false')
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showKGSync, setShowKGSync] = useState(false)
  const [draggingTopicId, setDraggingTopicId] = useState<string | null>(null)
  const [dragOverTopicId, setDragOverTopicId] = useState<string | null>(null)
  const [reorderTarget, setReorderTarget] = useState<{ parentId: string; insertIndex: number; nodeHeight: number } | null>(null)
  // Drop zone over a target node: center → swap, edge → new child in that direction.
  const [dropZone, setDropZone] = useState<{ targetId: string; mode: 'swap' | 'child'; side: AnchorSide } | null>(null)
  const dropZoneRef = useRef<{ targetId: string; mode: 'swap' | 'child'; side: AnchorSide } | null>(null)
  const dragState = useRef<{ topicId: string; svgX: number; svgY: number; isFloating?: boolean; pointerSvgX?: number; pointerSvgY?: number } | null>(null)
  const dragOverRef = useRef<string | null>(null)
  const [dragLine, setDragLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [connectLine, setConnectLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // V5.0 relationships
  const fetchRelationships = useRelationshipsStore(s => s.fetch)
  const setHighlight = useRelationshipsStore(s => s.setHighlight)
  const openConnectionPopover = useRelationshipsStore(s => s.openPopover)

  // Zoom & pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOrigin = useRef({ x: 0, y: 0 })

  // Search
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Copy/paste
  const copiedTopicRef = useRef<string | null>(null)

  const deepCloneForCopy = (topic: import('../../types').Topic): Record<string, unknown> => ({
    title: topic.title,
    notes: topic.notes,
    markers: topic.markers,
    labels: topic.labels,
    hyperlink: topic.hyperlink,
    image: topic.image,
    rich_text: topic.rich_text,
    structure_class: topic.structure_class,
    children: (topic.children || []).map(deepCloneForCopy),
  })

  const pasteTopicRecursive = async (parentId: string, data: Record<string, unknown>): Promise<void> => {
    const result = await api.createTopic(workbookId, parentId, data.title as string)
    const newId = result.id
    const updates: Record<string, unknown> = {}
    if (data.notes) updates.notes = data.notes
    if (data.markers) updates.markers = data.markers
    if (data.labels) updates.labels = data.labels
    if (data.hyperlink) updates.hyperlink = data.hyperlink
    if (data.image) updates.image = data.image
    if (data.rich_text) updates.rich_text = data.rich_text
    if (data.structure_class) updates.structure_class = data.structure_class
    if (Object.keys(updates).length > 0) {
      await api.updateTopic(workbookId, newId, updates as any)
    }
    for (const child of (data.children as Record<string, unknown>[]) || []) {
      await pasteTopicRecursive(newId, child)
    }
  }

  // Undo stack (client-side snapshots)
  const undoStack = useRef<unknown[]>([])
  const redoStack = useRef<unknown[]>([])

  const pushHistory = useCallback(() => {
    const wb = useMindMapStore.getState().workbook
    if (!wb) return
    undoStack.current.push(JSON.parse(JSON.stringify(wb)))
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
    redoStack.current = []
  }, [])

  // V6.1 — optimistic child/sibling creation: the node (with a client-generated
  // id) appears and enters edit mode immediately, while the server create runs
  // in the background. Offline → queued; online failure → rolled back.
  const createChildOptimistic = useCallback((parentId: string, index?: number, childDir?: string) => {
    const id = crypto.randomUUID()
    const newTopic = { id, title: '', folded: false, children: [] } as Topic
    if (childDir) newTopic.child_dir = childDir

    // Memory Lab: type the new node by inheriting the parent's kind (default concept).
    const wb = useMindMapStore.getState().workbook
    let memoryKind: string | undefined
    if (wb?.kind === 'memory_lab') {
      const parent = useMindMapStore.getState().getTopic(parentId)
      memoryKind = parent?.memory_kind || 'concept'
      newTopic.memory_kind = memoryKind
    }

    if (index == null) addTopic(parentId, newTopic)
    else addTopicAt(parentId, newTopic, index)
    setSelectedTopic(id)
    setEditingTopicId(id)

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      offlineQueue.add({
        type: 'create',
        endpoint: `/workbooks/${workbookId}/topics`,
        body: { title: '', parent_id: parentId, id, index, memory_kind: memoryKind, child_dir: childDir },
      }).catch(() => {})
      return
    }
    api.createTopic(workbookId, parentId, '', undefined, { id, index, memoryKind, childDir })
      .then(() => wsClient.sendOperation('topic_created', { parent_id: parentId, topic: newTopic }))
      .catch(err => {
        console.error('Failed to create topic:', err)
        removeTopic(id) // rollback optimistic node
      })
  }, [workbookId, addTopic, addTopicAt, setSelectedTopic, removeTopic])

  // Клик/перетаскивание по точке узла → новый дочерний узел в этом направлении.
  // Направление хранится per-child (child_dir), поэтому остальные дети остаются
  // там, где были (раскладку родителя не меняем).
  const createChildInDirection = useCallback((topicId: string, side: AnchorSide) => {
    const dirBySide: Record<AnchorSide, string> = {
      top: 'up',
      right: 'right',
      bottom: 'down',
      left: 'left',
    }
    createChildOptimistic(topicId, undefined, dirBySide[side])
  }, [createChildOptimistic])

  const undo = useCallback(async () => {
    const stack = undoStack.current
    if (stack.length === 0) return
    const wb = useMindMapStore.getState().workbook
    if (wb) redoStack.current.push(JSON.parse(JSON.stringify(wb)))
    const prev = stack.pop()!
    useMindMapStore.getState().setWorkbook(prev as any)
    try {
      await api.updateWorkbook(workbookId, prev as any)
      wsClient.send({ type: 'update', payload: {} })
    } catch (err) {
      console.error('Undo save failed:', err)
    }
  }, [workbookId])

  const redo = useCallback(async () => {
    const stack = redoStack.current
    if (stack.length === 0) return
    const wb = useMindMapStore.getState().workbook
    if (wb) undoStack.current.push(JSON.parse(JSON.stringify(wb)))
    const next = stack.pop()!
    useMindMapStore.getState().setWorkbook(next as any)
    try {
      await api.updateWorkbook(workbookId, next as any)
      wsClient.send({ type: 'update', payload: {} })
    } catch (err) {
      console.error('Redo save failed:', err)
    }
  }, [workbookId])

  const loadWorkbook = async () => {
    try {
      const wb = await api.getWorkbook(workbookId)
      useMindMapStore.getState().setWorkbook(wb)
    } catch (err) {
      console.error('Failed to load workbook:', err)
    }
  }

  useEffect(() => {
    // Persist user identity
    if (!localStorage.getItem('gmind_user_id')) {
      localStorage.setItem('gmind_user_id', userIdRef.current)
      localStorage.setItem('gmind_user_name', userNameRef.current)
      localStorage.setItem('gmind_user_color', userColorRef.current)
    }
    loadWorkbook()
  }, [workbookId])

  useEffect(() => {
    if (!workbookId) return
    const userId = userIdRef.current
    const userName = userNameRef.current
    const userColor = userColorRef.current

    wsClient.connect(workbookId, userId, userName, userColor)
    const unsubUpdate = wsClient.on('update', () => loadWorkbook())
    const unsubCursor = wsClient.on('cursor', (msg) => {
      const payload = msg.payload as CursorPosition
      setCursors(prev => {
        const next = new Map(prev)
        next.set(payload.user_id, payload)
        return next
      })
    })
    const unsubPresence = wsClient.on('presence', (msg) => {
      const payload = msg.payload as { users: PresenceUser[] }
      setPresenceUsers(payload.users || [])
    })

    const unsubOperation = wsClient.on('operation', (msg) => {
      const p = msg.payload as { op: string; data: any }
      if (!p) return
      const store = useMindMapStore.getState()
      switch (p.op) {
        case 'topic_created': {
          store.addTopic(p.data.parent_id, p.data.topic)
          break
        }
        case 'topic_updated': {
          store.updateTopicInTree(p.data.topic_id, p.data.updates)
          break
        }
        case 'topic_deleted': {
          store.removeTopic(p.data.topic_id)
          break
        }
        case 'floating_created': {
          store.addFloatingTopic(p.data.topic)
          break
        }
        case 'floating_updated': {
          store.updateFloatingTopic(p.data.topic_id, p.data.updates)
          break
        }
        case 'floating_deleted': {
          store.removeFloatingTopic(p.data.topic_id)
          break
        }
        case 'workbook_updated':
        case 'move':
        case 'swap':
        case 'detach': {
          // Complex structural ops — fall back to full reload on peers.
          loadWorkbook()
          break
        }
        default:
          break
      }
    })

    return () => {
      wsClient.disconnect()
      unsubUpdate()
      unsubCursor()
      unsubPresence()
      unsubOperation()
    }
  }, [workbookId])

  const activeSheet = useMemo(() => {
    if (!workbook || !activeSheetId) return null
    return workbook.sheets.find(s => s.id === activeSheetId) ?? null
  }, [workbook, activeSheetId])

  const levelGap = useLayoutStore(s => s.levelGap)
  const siblingGap = useLayoutStore(s => s.siblingGap)
  const childGap = useLayoutStore(s => s.childGap)
  const maxChars = useLayoutStore(s => s.maxChars)
  const fontSize = useLayoutStore(s => s.fontSize)
  const gaps = useMemo(() => ({ levelGap, siblingGap, childGap }), [levelGap, siblingGap, childGap])
  const layoutResult = useMemo((): LayoutNode | null => {
    if (!activeSheet) return null
    const root = buildLayout(activeSheet.root_topic, 0, maxChars, fontSize)

    const structMap = new Map<string, StructureClass>()
    const collectStruct = (topic: import('../../types').Topic) => {
      if (!topic) return
      if (topic.structure_class) {
        structMap.set(topic.id, topic.structure_class as StructureClass)
      }
      topic.children?.forEach(collectStruct)
    }
    collectStruct(activeSheet.root_topic)

    const rootStruct = (activeSheet.root_topic.structure_class as StructureClass) || 'mindmap'
    const result = computeTreeLayout(root, rootStruct, structMap, gaps)
    return result.root
  }, [activeSheet, gaps, maxChars, fontSize])

  // Floating topics are laid out as independent subtree roots anchored at their
  // stored position, so a node detached onto empty canvas keeps its children
  // visible (instead of collapsing to a single leaf).
  const floatingLayouts = useMemo((): LayoutNode[] => {
    if (!activeSheet?.floating_topics?.length) return []
    return activeSheet.floating_topics.map(ft => {
      const root = buildLayout(ft, 0, maxChars, fontSize)
      const structMap = new Map<string, StructureClass>()
      const collect = (t: import('../../types').Topic) => {
        if (t.structure_class) structMap.set(t.id, t.structure_class as StructureClass)
        t.children?.forEach(collect)
      }
      collect(ft)
      const struct = (ft.structure_class as StructureClass) || 'mindmap'
      const { root: laid } = computeTreeLayout(root, struct, structMap, gaps)
      const pos = ft.position || { x: 200, y: 200 }
      translate(laid, pos.x - laid.x, pos.y - laid.y)
      return laid
    })
  }, [activeSheet, gaps, maxChars, fontSize])

  // Node position map (SVG coords) from layout result + floating subtrees
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>()
    const walk = (n: LayoutNode) => {
      if (n.topic) map.set(n.topic.id, { x: n.x, y: n.y, w: n.width, h: n.height, cx: n.x + n.width / 2, cy: n.y + n.height / 2 })
      if (n.children) n.children.forEach(walk)
    }
    if (layoutResult) walk(layoutResult)
    for (const fl of floatingLayouts) walk(fl)
    return map
  }, [layoutResult, floatingLayouts])

  // Viewport rect for culling
  const viewportRect = useMemo(() => {
    const el = svgRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      left: -pan.x / zoom,
      top: -pan.y / zoom,
      right: (-pan.x + r.width) / zoom,
      bottom: (-pan.y + r.height) / zoom,
    }
  }, [zoom, pan])

  // Parent map for sibling lookup during reorder
  const parentMap = useMemo(() => {
    const map = new Map<string, string>()
    const walk = (n: LayoutNode) => {
      if (n.children) {
        for (const child of n.children) {
          if (child.topic) map.set(child.topic.id, n.topic.id)
          walk(child)
        }
      }
    }
    if (layoutResult) walk(layoutResult)
    return map
  }, [layoutResult])

  // Viewport → SVG coordinate conversion
  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: clientX, y: clientY }
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    }
  }, [zoom, pan])

  // V5.0: fetch relationships when workbook changes
  useEffect(() => {
    if (workbookId) {
      fetchRelationships(workbookId).catch(err => console.error('fetch relationships:', err))
    }
  }, [workbookId, fetchRelationships])

  // V5.0: highlight subgraph around selected topic
  useEffect(() => {
    setHighlight(selectedTopicId)
  }, [selectedTopicId, setHighlight])

  // V5.0: track relationship drag globally
  useGraphDragTracking({ svgRef, clientToWorld: toSvgPoint, onCreateChildDrag: createChildInDirection })

  // V5.0: helper to find LayoutNode by topic id (for EdgeAnchorsLayer)
  const findLayoutNode = useCallback((root: LayoutNode | null, id: string | null): LayoutNode | null => {
    if (!root || !id) return null
    if (root.topic.id === id) return root
    for (const c of root.children) {
      const found = findLayoutNode(c, id)
      if (found) return found
    }
    return null
  }, [])

  // ---- Pointer event handlers for drag & drop ----
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragState.current) return
    const pt = toSvgPoint(e.clientX, e.clientY)

    dragState.current.pointerSvgX = pt.x
    dragState.current.pointerSvgY = pt.y

    // Update drag line: source node → pointer
    setDragLine({
      x1: dragState.current.svgX,
      y1: dragState.current.svgY,
      x2: pt.x,
      y2: pt.y,
    })

    // Detect target under cursor via elementFromPoint (avoids stale onPointerEnter)
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const topicEl = el?.closest?.('[data-topic-id]')
    const rawTargetId = topicEl?.getAttribute('data-topic-id') || null
    const targetId = rawTargetId && rawTargetId !== dragState.current.topicId ? rawTargetId : null

    dragOverRef.current = targetId

    if (targetId) {
      const toPos = nodePositions.get(targetId)
      if (toPos) {
        setConnectLine({
          x1: dragState.current.svgX,
          y1: dragState.current.svgY,
          x2: toPos.cx,
          y2: toPos.cy,
        })
      }
    } else {
      setConnectLine(null)
    }

    // Compute drop zone over the target: center band → swap, edge band → child
    // in that direction. Normalized offset from the target's centre decides.
    const sourceId = dragState.current.topicId
    if (targetId && sourceId) {
      const tp = nodePositions.get(targetId)
      if (tp) {
        const nx = (pt.x - tp.cx) / (tp.w / 2 || 1)
        const ny = (pt.y - tp.cy) / (tp.h / 2 || 1)
        let next: { targetId: string; mode: 'swap' | 'child'; side: AnchorSide }
        if (Math.max(Math.abs(nx), Math.abs(ny)) < 0.5) {
          next = { targetId, mode: 'swap', side: 'right' }
        } else {
          const side: AnchorSide = Math.abs(nx) >= Math.abs(ny)
            ? (nx >= 0 ? 'right' : 'left')
            : (ny >= 0 ? 'bottom' : 'top')
          next = { targetId, mode: 'child', side }
        }
        dropZoneRef.current = next
        setDropZone(prev =>
          prev && prev.targetId === next.targetId && prev.mode === next.mode && prev.side === next.side
            ? prev : next)
      }
    } else {
      dropZoneRef.current = null
      setDropZone(null)
    }
  }, [toSvgPoint, nodePositions])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = -e.deltaY * 0.001
      setZoom(z => Math.max(0.1, Math.min(5, z + delta)))
    }
    svg.addEventListener('wheel', handler, { passive: false })
    return () => svg.removeEventListener('wheel', handler)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      panOrigin.current = { ...pan }
    }
  }, [pan])

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isPanning.current) return
      setPan({
        x: panOrigin.current.x + (e.clientX - panStart.current.x),
        y: panOrigin.current.y + (e.clientY - panStart.current.y),
      })
    }
    const handleUp = () => { isPanning.current = false }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [])

  // Throttled cursor broadcast
  const cursorThrottle = useRef(0)
  useEffect(() => {
    if (!broadcastCursor) return
    const svg = svgRef.current
    if (!svg) return
    const handler = (e: PointerEvent) => {
      const now = Date.now()
      if (now - cursorThrottle.current < 50) return
      cursorThrottle.current = now
      const pt = toSvgPoint(e.clientX, e.clientY)
      wsClient.sendCursor(pt.x, pt.y)
    }
    svg.addEventListener('pointermove', handler)
    return () => svg.removeEventListener('pointermove', handler)
  }, [toSvgPoint, broadcastCursor])

  const [activeTool, setActiveTool] = useState<Tool>('pointer')

  // ---- View history ----
  const viewHistory = useRef<string[]>([])
  const viewHistoryIdx = useRef(-1)

  const [closeToken, setCloseToken] = useState(0)
  const [showHelp, setShowHelp] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [showProperties, setShowProperties] = useState(false)
  const [showStyle, setShowStyle] = useState(false)
  const [showAIServer, setShowAIServer] = useState(false)
  const [showPresence, setShowPresence] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageB64, setImageB64] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [showNotesPopup, setShowNotesPopup] = useState(false)
  const [notesPopupData, setNotesPopupData] = useState<{ topicId: string; text: string } | null>(null)
  const [notesEditText, setNotesEditText] = useState('')
  const [commentsDialog, setCommentsDialog] = useState<{ topicId: string; title: string } | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showImportMenu, setShowImportMenu] = useState(false)

  // Auto-focus SVG on mount for immediate click handling
  useEffect(() => { svgRef.current?.focus() }, [])

  useEffect(() => {
    if (showHelp) {
      const timer = setTimeout(() => setShowHelp(false), 6000)
      return () => clearTimeout(timer)
    }
  }, [showHelp])

  const pushViewHistory = useCallback((topicId: string) => {
    viewHistory.current = viewHistory.current.slice(0, viewHistoryIdx.current + 1)
    viewHistory.current.push(topicId)
    if (viewHistory.current.length > 50) viewHistory.current.shift()
    viewHistoryIdx.current = viewHistory.current.length - 1
  }, [])

  const goBack = useCallback(() => {
    if (viewHistoryIdx.current <= 0) return
    viewHistoryIdx.current--
    const id = viewHistory.current[viewHistoryIdx.current]
    if (id) { setSelectedTopic(id); setShowProperties(true) }
  }, [setSelectedTopic, setShowProperties])

  const goForward = useCallback(() => {
    if (viewHistoryIdx.current >= viewHistory.current.length - 1) return
    viewHistoryIdx.current++
    const id = viewHistory.current[viewHistoryIdx.current]
    if (id) { setSelectedTopic(id); setShowProperties(true) }
  }, [setSelectedTopic, setShowProperties])

  // ---- Tool panel handlers ----
  const handleCanvasToolClick = useCallback(async (e: React.MouseEvent) => {
    if (activeTool === 'pointer') return
    if (!activeSheet) return

    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom

    setContextMenu(null)
    setShowProperties(true)

    try {
      if (activeTool === 'topic') {
        const topic = await api.createTopic(workbookId, activeSheet.root_topic.id, 'New Topic')
        addTopic(activeSheet.root_topic.id, topic)
        wsClient.sendOperation('topic_created', { parent_id: activeSheet.root_topic.id, topic })
        setSelectedTopic(topic.id)
        setEditingTopicId(topic.id)
      } else if (activeTool === 'floating') {
        const topic = await api.createFloatingTopic(workbookId, 'New Topic', { x, y })
        useMindMapStore.getState().addFloatingTopic(topic)
        wsClient.sendOperation('floating_created', { topic })
        setSelectedTopic(topic.id)
        setEditingTopicId(topic.id)
      } else if (activeTool === 'sticky') {
        const topic = await api.createFloatingTopic(workbookId, '', { x, y })
        useMindMapStore.getState().addFloatingTopic(topic)
        wsClient.sendOperation('floating_created', { topic })
        setSelectedTopic(topic.id)
        setEditingTopicId(topic.id)
      }
      setActiveTool('pointer')
    } catch (err) {
      console.error('Failed to create topic:', err)
    }
  }, [activeTool, activeSheet, workbookId, zoom, pan, addTopic, setSelectedTopic])

  // ---- Pointer event handlers for drag & drop ----
  const handlePointerUpGlobal = useCallback(async () => {
    if (!dragState.current) {
      setDraggingTopicId(null)
      setDragOverTopicId(null)
      setDragLine(null)
      setConnectLine(null)
      setDropZone(null)
      dropZoneRef.current = null
      return
    }

    const targetId = dragOverRef.current
    const sourceId = dragState.current.topicId
    const isFloating = dragState.current.isFloating
    const zone = dropZoneRef.current
    const px = dragState.current.pointerSvgX
    const py = dragState.current.pointerSvgY

    const reconcile = async () => {
      try {
        const wb = await api.getWorkbook(workbookId)
        useMindMapStore.getState().setWorkbook(wb)
      } catch {}
    }

    // Floating topics aren't tree nodes — swap/reparent onto them would diverge
    // from the backend, so a drop on a floating node is a no-op (snaps back).
    const targetFloating = !!targetId &&
      !!useMindMapStore.getState().getActiveSheet()?.floating_topics?.some(ft => ft.id === targetId)

    if (targetId && targetId !== sourceId && !targetFloating) {
      // Guard: can't drop a node onto its own subtree (mirrors backend).
      if (isDescendant(sourceId, targetId)) {
        console.warn('Drop blocked: target is a descendant of the dragged topic')
      } else if (zone?.mode === 'swap' && !isFloating) {
        // Center of target → exchange the two nodes' tree positions.
        // (A floating source isn't in the tree, so it can't swap — falls through
        // to reparent below.)
        pushHistory()
        swapTopics(sourceId, targetId)
        wsClient.sendOperation('swap', { topic_id: sourceId, other_id: targetId })
        api.swapTopics(workbookId, sourceId, targetId).catch(err => {
          console.error('Failed to swap topics:', err)
          reconcile()
        })
      } else {
        // Edge of target → become its child in the chosen direction.
        const side = zone?.side ?? 'right'
        const childDir = ({ top: 'up', right: 'right', bottom: 'down', left: 'left' } as Record<AnchorSide, string>)[side]
        pushHistory()
        updateTopicInTree(sourceId, { child_dir: childDir })
        moveTopicInTree(sourceId, targetId, 0)
        wsClient.sendOperation('move', { topic_id: sourceId, new_parent_id: targetId })
        Promise.all([
          api.updateTopic(workbookId, sourceId, { child_dir: childDir }),
          api.moveTopic(workbookId, sourceId, targetId, 0),
        ]).catch(err => {
          console.error('Failed to reparent topic:', err)
          reconcile()
        })
      }
    } else if (!targetId && isFloating && px != null && py != null) {
      // Floating node dropped on empty canvas → just reposition.
      pushHistory()
      const newPos = { x: px - 30, y: py - 20 }
      useMindMapStore.getState().updateFloatingTopic(sourceId, { position: newPos })
      api.updateFloatingTopic(workbookId, sourceId, { position: newPos })
        .then(() => wsClient.sendOperation('floating_updated', { topic_id: sourceId, updates: { position: newPos } }))
        .catch(err => { console.error('Failed to update floating topic position:', err); reconcile() })
    } else if (!targetId && !isFloating && px != null && py != null) {
      // Tree node dropped on empty canvas → detach (with subtree) into a free
      // floating node at the drop point.
      pushHistory()
      const newPos = { x: px - 30, y: py - 20 }
      detachToFloating(sourceId, newPos)
      wsClient.sendOperation('detach', { topic_id: sourceId })
      api.detachTopic(workbookId, sourceId, newPos).catch(err => {
        console.error('Failed to detach topic:', err)
        reconcile()
      })
    }

    dragState.current = null
    dragOverRef.current = null
    dropZoneRef.current = null
    setDraggingTopicId(null)
    setDragOverTopicId(null)
    setDragLine(null)
    setConnectLine(null)
    setReorderTarget(null)
    setDropZone(null)
  }, [workbookId, pushHistory, isDescendant, moveTopicInTree, updateTopicInTree, swapTopics, detachToFloating])

  // Use refs to avoid stale closures and prevent listener re-attachment during drag
  const handlePointerMoveRef = useRef<(e: PointerEvent) => void>(handlePointerMove)
  handlePointerMoveRef.current = handlePointerMove
  const handlePointerUpRef = useRef<(e: PointerEvent) => void>(handlePointerUpGlobal as (e: PointerEvent) => void)
  handlePointerUpRef.current = handlePointerUpGlobal as (e: PointerEvent) => void

  useEffect(() => {
    if (!draggingTopicId) return

    const onMove = (e: PointerEvent) => handlePointerMoveRef.current(e)
    const onUp = (e: PointerEvent) => handlePointerUpRef.current(e)
    const onCancel = () => {
      dragState.current = null
      dragOverRef.current = null
      dropZoneRef.current = null
      setDraggingTopicId(null)
      setDragOverTopicId(null)
      setDragLine(null)
      setConnectLine(null)
      setReorderTarget(null)
      setDropZone(null)
    }

    document.body.style.userSelect = 'none'
    const preventSelect = (e: Event) => e.preventDefault()
    window.addEventListener('selectstart', preventSelect)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      document.body.style.userSelect = ''
      window.removeEventListener('selectstart', preventSelect)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [draggingTopicId])

  const handleTopicDragStart = useCallback((topicId: string, _x: number, _y: number) => {
    const pos = nodePositions.get(topicId)
    const isFloating = activeSheet?.floating_topics?.some(ft => ft.id === topicId)
    dragState.current = {
      topicId,
      svgX: pos ? pos.cx : 0,
      svgY: pos ? pos.cy : 0,
      isFloating: !!isFloating,
    }
    setDraggingTopicId(topicId)
  }, [nodePositions, activeSheet])

  const handleTopicDragOver = useCallback((topicId: string) => {
    if (draggingTopicId && topicId !== draggingTopicId) {
      dragOverRef.current = topicId
      setDragOverTopicId(topicId)
    }
  }, [draggingTopicId])

  const handleTopicDrop = useCallback((_targetId: string) => {
    // handled by global pointer up
  }, [])

  // ---- End drag & drop handlers ----

  const handleTopicSelect = useCallback((topicId: string, e: React.MouseEvent) => {
    if (!draggingTopicId) {
      if (e.metaKey || e.ctrlKey) {
        toggleSelectedTopic(topicId)
      } else {
        setSelectedTopic(topicId)
        pushViewHistory(topicId)
      }
      setContextMenu(null)
      setShowProperties(true)
    }
  }, [draggingTopicId, setSelectedTopic, toggleSelectedTopic, pushViewHistory])

  const handleTopicDoubleClick = useCallback((topicId: string) => {
    setEditingTopicId(topicId)
  }, [])

  const handleTopicEditSave = useCallback(async (topicId: string, title: string, richText?: string) => {
    if (!title.trim()) { setEditingTopicId(null); return }
    pushHistory()
    const updates: Record<string, any> = { title: title.trim() }
    if (richText !== undefined) updates.rich_text = richText
    try {
      const isFloating = activeSheet?.floating_topics?.some(ft => ft.id === topicId)
      if (isFloating) {
        await api.updateFloatingTopic(workbookId, topicId, updates)
        useMindMapStore.getState().updateFloatingTopic(topicId, updates)
        wsClient.sendOperation('floating_updated', { topic_id: topicId, updates })
      } else {
        await api.updateTopic(workbookId, topicId, updates)
        updateTopicInTree(topicId, updates)
        wsClient.sendOperation('topic_updated', { topic_id: topicId, updates })
      }
    } catch (err) {
      console.error('Failed to update topic:', err)
    }
    setEditingTopicId(null)
  }, [workbookId, activeSheet, updateTopicInTree, pushHistory])

  const handleTopicEditCancel = useCallback(() => {
    setEditingTopicId(null)
  }, [])

  const handleTopicNotesClick = useCallback((topicId: string, notes: string) => {
    setNotesPopupData({ topicId, text: notes })
    setNotesEditText(notes)
    setShowNotesPopup(true)
  }, [])

  const handleTopicCommentsClick = useCallback((topicId: string) => {
    const topic = useMindMapStore.getState().getTopic(topicId)
    setCommentsDialog({ topicId, title: topic?.title || 'Topic' })
  }, [])

  const handleNotesSave = useCallback(async () => {
    if (!notesPopupData) return
    pushHistory()
    try {
      const updates = { notes: notesEditText }
      const isFloating = activeSheet?.floating_topics?.some(ft => ft.id === notesPopupData.topicId)
      if (isFloating) {
        await api.updateFloatingTopic(workbookId, notesPopupData.topicId, updates)
        useMindMapStore.getState().updateFloatingTopic(notesPopupData.topicId, updates)
        wsClient.sendOperation('floating_updated', { topic_id: notesPopupData.topicId, updates })
      } else {
        await api.updateTopic(workbookId, notesPopupData.topicId, updates)
        updateTopicInTree(notesPopupData.topicId, updates)
        wsClient.sendOperation('topic_updated', { topic_id: notesPopupData.topicId, updates })
      }
    } catch (err) {
      console.error('Failed to save notes:', err)
    }
    setShowNotesPopup(false)
    setNotesPopupData(null)
  }, [notesPopupData, notesEditText, workbookId, activeSheet, updateTopicInTree, pushHistory])

  const handleTopicFoldToggle = useCallback(async (topicId: string) => {
    const topic = useMindMapStore.getState().getTopic(topicId)
    if (!topic) return
    const newFolded = !topic.folded
    pushHistory()
    try {
      await api.updateTopic(workbookId, topicId, { folded: newFolded })
      updateTopicInTree(topicId, { folded: newFolded })
      wsClient.sendOperation('topic_updated', { topic_id: topicId, updates: { folded: newFolded } })
    } catch (err) {
      console.error('Failed to toggle fold:', err)
    }
  }, [workbookId, updateTopicInTree, pushHistory])

  // Toggle folding of one side's children (top|right|bottom|left). Hides those
  // children without reflowing, so the other sides and badges stay put.
  const handleToggleChildSide = useCallback(async (topicId: string, side: string) => {
    const topic = useMindMapStore.getState().getTopic(topicId)
    if (!topic) return
    const cur = topic.folded_sides ?? []
    const next = cur.includes(side) ? cur.filter(s => s !== side) : [...cur, side]
    pushHistory()
    updateTopicInTree(topicId, { folded_sides: next })
    try {
      await api.updateTopic(workbookId, topicId, { folded_sides: next })
      wsClient.sendOperation('topic_updated', { topic_id: topicId, updates: { folded_sides: next } })
    } catch (err) {
      console.error('Failed to toggle side fold:', err)
    }
  }, [workbookId, updateTopicInTree, pushHistory])

  const handleTopicExpandToggle = useCallback((topicId: string, expanded: boolean) => {
    setExpandedTopicIds(prev => {
      const next = new Set(prev)
      if (expanded) next.add(topicId)
      else next.delete(topicId)
      return next
    })
  }, [])

  const handleTogglePrivate = useCallback(async (v: boolean) => {
    if (!workbook) return
    try {
      await api.updateWorkbook(workbook.id, { private: v, access_mode: v ? (workbook.access_mode || 'collaborators') : 'public' } as any)
      loadWorkbook()
    } catch (err) {
      console.error('Failed to toggle private:', err)
    }
  }, [workbook, loadWorkbook])

  const handleChangeAccessMode = useCallback(async (mode: string) => {
    if (!workbook) return
    try {
      await api.updateWorkbook(workbook.id, { private: mode !== 'public', access_mode: mode } as any)
      loadWorkbook()
    } catch (err) {
      console.error('Failed to set access mode:', err)
    }
  }, [workbook, loadWorkbook])

  const expandLoadingRef = useRef<Set<string>>(new Set())

  const handleAIExpand = useCallback(async (topicId: string, title: string) => {
    if (!activeSheetId) return
    expandLoadingRef.current = new Set(expandLoadingRef.current).add(topicId)
    try {
      const topic = useMindMapStore.getState().getTopic(topicId)
      const children = (topic?.children || []).map(c => c.title)
      const result = await api.aiExpandTopic(workbookId, activeSheetId, topicId, title, children)
      for (const t of result.topics) {
        useMindMapStore.getState().addTopic(topicId, t)
      }
      wsClient.sendOperation('workbook_updated', {})
    } catch (err) {
      console.error('AI expand failed:', err)
    }
    expandLoadingRef.current = new Set([...expandLoadingRef.current].filter(id => id !== topicId))
  }, [workbookId, activeSheetId])

  const handleSummarize = async () => {
    if (!activeSheetId) return
    setSummaryLoading(true)
    try {
      const result = await api.aiSummarize(workbookId, activeSheetId)
      setSummaryText(result.reply)
      setShowSummary(true)
    } catch (err) {
      console.error('Summarize failed:', err)
    }
    setSummaryLoading(false)
  }

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return
    setImageLoading(true)
    try {
      const result = await api.aiGenerateImage(imagePrompt)
      setImageB64(result.b64_json)
    } catch (err) {
      console.error('Image generation failed:', err)
    }
    setImageLoading(false)
  }

  const handleCanvasContextMenu = useCallback((x: number, y: number) => {
    if (!draggingTopicId) {
      setCanvasMenu({ x, y })
    }
  }, [draggingTopicId])

  const handleTopicContextMenu = useCallback((topicId: string, x: number, y: number) => {
    if (!draggingTopicId) {
      setCanvasMenu(null)
      setContextMenu({ x, y, topicId })
    }
  }, [draggingTopicId])

  const addRootTopic = async () => {
    if (!activeSheet) return
    const title = prompt('New topic title:')
    if (!title) return
    pushHistory()
    try {
      const topic = await api.createTopic(workbookId, activeSheet.root_topic.id, title)
      addTopic(activeSheet.root_topic.id, topic)
      wsClient.sendOperation('topic_created', { parent_id: activeSheet.root_topic.id, topic })
    } catch (err) {
      console.error('Failed to add topic:', err)
    }
    setCanvasMenu(null)
  }

  const addFloatingTopicAction = async () => {
    const title = prompt('New floating topic title:')
    if (!title) return
    pushHistory()
    try {
      const topic = await api.createFloatingTopic(workbookId, title, {
        x: 200 + Math.random() * 200,
        y: 200 + Math.random() * 200,
      })
      useMindMapStore.getState().addFloatingTopic(topic)
      wsClient.sendOperation('floating_created', { topic })
    } catch (err) {
      console.error('Failed to add floating topic:', err)
    }
    setCanvasMenu(null)
  }

  const addChildTopic = async () => {
    if (!contextMenu) return
    const title = prompt('New topic title:')
    if (!title) return
    pushHistory()
    try {
      const topic = await api.createTopic(workbookId, contextMenu.topicId, title)
      addTopic(contextMenu.topicId, topic)
      wsClient.sendOperation('topic_created', { parent_id: contextMenu.topicId, topic })
    } catch (err) {
      console.error('Failed to add topic:', err)
    }
    setContextMenu(null)
  }

  const deleteSelectedTopic = async () => {
    const ids = useMindMapStore.getState().selectedTopicIds
    if (ids.length === 0) return
    pushHistory()
    try {
      for (const id of [...ids]) {
        const isFloating = activeSheet?.floating_topics?.some(ft => ft.id === id)
        if (isFloating) {
          await api.deleteFloatingTopic(workbookId, id)
          useMindMapStore.getState().removeFloatingTopic(id)
          wsClient.sendOperation('floating_deleted', { topic_id: id })
        } else if (activeSheet?.root_topic.id !== id) {
          await api.deleteTopic(workbookId, id)
          removeTopic(id)
          wsClient.sendOperation('topic_deleted', { topic_id: id })
        }
      }
      setSelectedTopic(null)
    } catch (err) {
      console.error('Failed to delete topics:', err)
    }
    setContextMenu(null)
  }

  const handleExport = async () => {
    try {
      const blob = await api.exportXMind(workbookId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workbook?.title ?? 'mindmap'}.xmind`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const getSvgEl = (): SVGSVGElement | null => {
    return svgRef.current
  }

  const handleExportSVG = async () => {
    const svg = getSvgEl()
    if (!svg) return
    try {
      const { exportSVG: fn } = await import('../../utils/export')
      await fn(svg, workbook?.title ?? 'mindmap')
    } catch (err) {
      console.error('SVG export failed:', err)
    }
    setShowExportMenu(false)
  }

  const handleExportPNG = async () => {
    const svg = getSvgEl()
    if (!svg) return
    try {
      const { exportPNG: fn } = await import('../../utils/export')
      await fn(svg, workbook?.title ?? 'mindmap')
    } catch (err) {
      console.error('PNG export failed:', err)
    }
    setShowExportMenu(false)
  }

  const handleExportPDF = async () => {
    const svg = getSvgEl()
    if (!svg) return
    try {
      const { exportPDF: fn } = await import('../../utils/export')
      await fn(svg, workbook?.title ?? 'mindmap')
    } catch (err) {
      console.error('PDF export failed:', err)
    }
    setShowExportMenu(false)
  }

  const handleExportFreeMind = async () => {
    if (!activeSheet?.root_topic) return
    try {
      const { exportToFreeMind, downloadFreeMind } = await import('../../utils/freeMindExport')
      const xml = exportToFreeMind(activeSheet.root_topic)
      downloadFreeMind(xml, (workbook?.title || 'mindmap') + '.mm')
    } catch (err) {
      console.error('FreeMind export failed:', err)
    }
    setShowExportMenu(false)
  }

  const handleExportOPML = async () => {
    if (!activeSheet?.root_topic) return
    try {
      const { exportToOPML, downloadOPML } = await import('../../utils/opmlExport')
      const opml = exportToOPML(activeSheet.root_topic, workbook?.title || 'mindmap')
      downloadOPML(opml, (workbook?.title || 'mindmap') + '.opml')
    } catch (err) {
      console.error('OPML export failed:', err)
    }
    setShowExportMenu(false)
  }

  const handleExportMarkdown = async () => {
    if (!activeSheet?.root_topic) return
    try {
      const { exportToMarkdown, downloadMarkdown } = await import('../../utils/markdownExport')
      const md = exportToMarkdown(activeSheet.root_topic)
      downloadMarkdown(md, (workbook?.title || 'mindmap') + '.md')
    } catch (err) {
      console.error('Markdown export failed:', err)
    }
    setShowExportMenu(false)
  }

  const handleImportMarkdown = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const roots = parseMarkdownToTopics(text)
        const sheet = activeSheet
        if (!sheet) return
        for (const root of roots) {
          await api.importTopicTree(workbookId, sheet.root_topic.id, root)
        }
        const wb = await api.getWorkbook(workbookId)
        useMindMapStore.getState().setWorkbook(wb)
      } catch (err) {
        console.error('Markdown import failed:', err)
      }
    }
    input.click()
    setShowImportMenu(false)
  }

  const handleImportFreeMind = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mm'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const roots = parseFreeMind(text)
        const sheet = activeSheet
        if (!sheet) return
        for (const root of roots) {
          await api.importTopicTree(workbookId, sheet.root_topic.id, root)
        }
        const wb = await api.getWorkbook(workbookId)
        useMindMapStore.getState().setWorkbook(wb)
      } catch (err) {
        console.error('FreeMind import failed:', err)
      }
    }
    input.click()
    setShowImportMenu(false)
  }

  const handleImportXMind = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xmind'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const wb = await api.importXMind(file)
        useMindMapStore.getState().setWorkbook(wb)
        onXMindImported?.(wb.id)
      } catch (err) {
        console.error('XMind import failed:', err)
      }
    }
    input.click()
    setShowImportMenu(false)
  }

  const handleImportJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        JSON.parse(text)
        const sheetId = useMindMapStore.getState().activeSheetId
        if (!sheetId) return
        await api.importJSON(workbookId, sheetId, text)
        const wb = await api.getWorkbook(workbookId)
        useMindMapStore.getState().setWorkbook(wb)
      } catch (err) {
        console.error('Import failed:', err)
      }
    }
    input.click()
  }

  const handleBatchImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt,.mm,.xmind'
    input.multiple = true
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return
      let imported = 0
      for (const file of Array.from(files)) {
        try {
          if (file.name.endsWith('.xmind')) {
            await api.importXMind(file)
            imported++
          } else if (file.name.endsWith('.mm')) {
            const text = await file.text()
            const sheet = activeSheet
            if (!sheet) continue
            const roots = parseFreeMind(text)
            for (const root of roots) {
              await api.importTopicTree(workbookId, sheet.root_topic.id, root)
            }
            imported++
          } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
            const text = await file.text()
            const sheet = activeSheet
            if (!sheet) continue
            const roots = parseMarkdownToTopics(text)
            for (const root of roots) {
              await api.importTopicTree(workbookId, sheet.root_topic.id, root)
            }
            imported++
          }
        } catch (err) {
          console.error(`Batch import failed for ${file.name}:`, err)
        }
      }
      const wb = await api.getWorkbook(workbookId)
      useMindMapStore.getState().setWorkbook(wb)
      console.log(`Batch import complete: ${imported}/${files.length} files imported`)
    }
    input.click()
    setShowImportMenu(false)
  }

  const handleClearImportData = async () => {
    const sheetId = useMindMapStore.getState().activeSheetId
    if (!sheetId) return
    try {
      await api.clearImportedData(workbookId, sheetId)
      const wb = await api.getWorkbook(workbookId)
      useMindMapStore.getState().setWorkbook(wb)
    } catch (err) {
      console.error('Clear failed:', err)
    }
  }

  const handleAddSheet = async () => {
    if (!workbook) return
    const title = prompt('New sheet title:')
    if (!title) return
    try {
      const sheet = await api.createSheet(workbookId, title)
      const wb = await api.getWorkbook(workbookId)
      useMindMapStore.getState().setWorkbook(wb)
      useMindMapStore.getState().setActiveSheet(sheet.id)
    } catch (err) {
      console.error('Failed to create sheet:', err)
    }
  }

  const handleDeleteSheet = async (sheetId: string) => {
    if (!workbook || workbook.sheets.length <= 1) return
    if (!confirm('Delete this sheet?')) return
    try {
      await api.deleteSheet(workbookId, sheetId)
      const wb = await api.getWorkbook(workbookId)
      useMindMapStore.getState().setWorkbook(wb)
    } catch (err) {
      console.error('Failed to delete sheet:', err)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(s => { if (!s) setTimeout(() => searchRef.current?.focus(), 50); return true })
        return
      }

      if (e.key === 'Escape') {
        setShowSearch(false)
        setSearchQuery('')
        if (activeTool !== 'pointer') setActiveTool('pointer')
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && selectedTopicId) {
          e.preventDefault()
          const selIds = useMindMapStore.getState().selectedTopicIds
          const copyId = selIds[0] || selectedTopicId
          if (!copyId) return
          const topic = useMindMapStore.getState().getTopic(copyId)
          if (topic && topic.id !== activeSheet?.root_topic?.id) {
            copiedTopicRef.current = JSON.stringify(deepCloneForCopy(topic))
          }
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && copiedTopicRef.current) {
          e.preventDefault()
          const parentId = selectedTopicId || activeSheet?.root_topic?.id
          if (!parentId) return
          const data = JSON.parse(copiedTopicRef.current)
          pasteTopicRecursive(parentId, data).then(async () => {
            const wb = await api.getWorkbook(workbookId)
            useMindMapStore.getState().setWorkbook(wb)
          })
        }
        return
      }

      if ((e.altKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
        return
      }
      if ((e.altKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault()
        goForward()
        return
      }

      if (e.key === 'Tab') {
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !editingTopicId) {
          e.preventDefault()
          const selId = useMindMapStore.getState().selectedTopicId || activeSheet?.root_topic?.id
          if (!selId) return
          pushHistory()
          createChildOptimistic(selId)
        }
        return
      }

      if (e.key === 'Enter') {
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !editingTopicId) {
          e.preventDefault()
          const selId = useMindMapStore.getState().selectedTopicId
          const rootId = activeSheet?.root_topic?.id
          if (!selId || selId === rootId) return
          const findParent = (t: Topic, id: string): Topic | null => {
            for (const c of (t.children || [])) {
              if (c.id === id) return t
              const found = findParent(c, id)
              if (found) return found
            }
            return null
          }
          const root = activeSheet?.root_topic
          if (!root) return
          const parent = findParent(root, selId)
          if (!parent) return
          const sibIndex = (parent.children || []).findIndex(c => c.id === selId)
          pushHistory()
          createChildOptimistic(parent.id, sibIndex < 0 ? undefined : sibIndex + 1)
        }
        return
      }

      // L — link the two most-recently selected topics (opens the connection popover).
      if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !editingTopicId) {
          const ids = useMindMapStore.getState().selectedTopicIds
          if (ids.length >= 2) {
            e.preventDefault()
            openConnectionPopover(ids[0], ids[1], window.innerWidth / 2 - 150, window.innerHeight / 2 - 140)
          }
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selIds = useMindMapStore.getState().selectedTopicIds
        const isEditable = (e.target as HTMLElement).isContentEditable
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !isEditable && !editingTopicId && selIds.length > 0) {
          e.preventDefault()
          deleteSelectedTopic()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTopicIds, undo, redo, workbookId, activeSheet, activeTool, goBack, goForward, editingTopicId, addTopic, setSelectedTopic, pushHistory, createChildOptimistic, openConnectionPopover])

  if (!workbook) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textQuaternary, fontSize: fontSizes.body, fontFamily: fonts.ui }}>
        Loading workbook...
      </div>
    )
  }

  const hasFloating = (activeSheet?.floating_topics?.length ?? 0) > 0

  if (!layoutResult && !hasFloating) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%',
        color: colors.textQuaternary, padding: spacing.block, textAlign: 'center', fontFamily: fonts.ui,
      }}>
        <div style={{ fontSize: 40, marginBottom: spacing.lg }}>🧠</div>
        <div style={{ fontSize: fontSizes.bodyLarge, fontWeight: fontWeights.semibold, color: colors.textSecondary, marginBottom: spacing.md }}>Mind Map is empty</div>
        <div style={{ fontSize: fontSizes.body, maxWidth: 300, lineHeight: 1.6 }}>
          Right-click on the canvas to add topics, or use the buttons in the toolbar.
        </div>
      </div>
    )
  }

  const svgTransform = `scale(${zoom}) translate(${pan.x / zoom}, ${pan.y / zoom})`

  return (
    <ErrorBoundary>
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: theme.canvasBackground }}>

      {/* Sheet tabs + toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: colors.bgTertiary,
        boxShadow: shadows.neuInset,
        padding: `0 ${spacing.md}px`,
        overflowX: 'auto', flexShrink: 0, gap: spacing.xs,
        fontFamily: fonts.ui,
      }}>
        {workbook.sheets.map(sheet => (
          <div
            key={sheet.id}
            onClick={() => useMindMapStore.getState().setActiveSheet(sheet.id)}
            style={{
              padding: `${spacing.md}px ${spacing.xl}px`,
              cursor: 'pointer', fontSize: fontSizes.body,
              fontWeight: sheet.id === activeSheetId ? fontWeights.semibold : fontWeights.regular,
              color: sheet.id === activeSheetId ? colors.accent : colors.textSecondary,
              borderBottom: sheet.id === activeSheetId ? `2px solid ${colors.accent}` : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: spacing.md,
              userSelect: 'none', transition: `color ${transitions.fast}`,
            }}
          >
            {sheet.title}
            {workbook.sheets.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); handleDeleteSheet(sheet.id) }}
                style={{ display: 'flex', color: colors.textQuaternary, cursor: 'pointer' }}
              ><LumenX size={12} strokeWidth={2.5} /></span>
            )}
          </div>
        ))}
        <button onClick={handleAddSheet} style={{
          padding: `${spacing.md}px ${spacing.lg}px`, border: 'none', background: 'transparent',
          cursor: 'pointer', color: colors.accent, fontSize: fontSizes.bodyLarge,
          fontWeight: fontWeights.semibold, fontFamily: fonts.ui,
        }} title="Add sheet">+</button>

        <div style={{ flex: 1 }} />

        {showSearch ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px 0` }}>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') } }}
              placeholder="Search topics..."
              style={{
                padding: `${spacing.xs}px ${spacing.md}px`, fontSize: fontSizes.body,
                border: 'none',
                borderRadius: radii.md, outline: 'none', width: 180,
                fontFamily: fonts.ui, background: colors.bgTertiary, color: colors.text,
                boxShadow: shadows.neuInsetSm,
                transition: `box-shadow ${transitions.fast}`,
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery('') }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: colors.textQuaternary, fontFamily: fonts.ui }}><LumenX size={16} strokeWidth={1.8} /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            style={{
              padding: `${spacing.sm}px ${spacing.lg}px`, border: 'none', background: 'transparent',
              cursor: 'pointer', color: colors.textSecondary, fontSize: fontSizes.body, fontFamily: fonts.ui,
            }}
            title="Search (Ctrl+F)"
          ><LumenSearch size={16} strokeWidth={1.8} /></button>
        )}

        <ToolbarButton onClick={() => setShowProperties(s => !s)}
          title={showProperties ? 'Close Properties' : 'Open Properties'}>
          {showProperties ? 'Hide' : 'Props'}
        </ToolbarButton>

        <ToolbarButton onClick={goBack}
          disabled={viewHistoryIdx.current <= 0}
          title="Back (Alt+Left)"><LumenChevronLeft size={14} strokeWidth={2.5} /></ToolbarButton>
        <ToolbarButton onClick={goForward}
          disabled={viewHistoryIdx.current >= viewHistory.current.length - 1}
          title="Forward (Alt+Right)"><LumenChevronRight size={14} strokeWidth={2.5} /></ToolbarButton>
        <span style={{ fontSize: fontSizes.caption, color: colors.separator, margin: `0 ${spacing.xxs}px` }}>|</span>
        <ToolbarButton onClick={() => undoStack.current.length > 0 ? undo() : undefined}
          disabled={undoStack.current.length === 0}
          title="Undo (Ctrl+Z)"><LumenUndo size={14} strokeWidth={2.5} /></ToolbarButton>
        <ToolbarButton onClick={() => redoStack.current.length > 0 ? redo() : undefined}
          disabled={redoStack.current.length === 0}
          title="Redo (Ctrl+Shift+Z)"><LumenRedo size={14} strokeWidth={2.5} /></ToolbarButton>
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}
          style={{ padding: `${spacing.xs}px ${spacing.md}px`, border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textSecondary, fontSize: fontSizes.bodyLarge, fontWeight: fontWeights.semibold, fontFamily: fonts.ui }}
          title="Zoom out">−</button>
        <span style={{ fontSize: fontSizes.label, color: colors.textQuaternary, minWidth: 36, textAlign: 'center', fontFamily: fonts.mono }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(z => Math.min(5, z + 0.1))}
          style={{ padding: `${spacing.xs}px ${spacing.md}px`, border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textSecondary, fontSize: fontSizes.bodyLarge, fontWeight: fontWeights.semibold, fontFamily: fonts.ui }}
          title="Zoom in">+</button>
        {zoom !== 1 && (
          <button onClick={() => setZoom(1)}
            style={{ padding: `${spacing.xs}px ${spacing.sm}px`, border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textQuaternary, fontSize: fontSizes.caption, fontFamily: fonts.ui }}
            title="Reset zoom">↺</button>
        )}

        <ToolbarButton onClick={() => {
          useLayoutStore.getState().resetGaps()
          setZoom(1)
          setPan({ x: 0, y: 0 })
          loadWorkbook()
        }} title="Auto-layout: reset gaps and fit view">
          ⊞
        </ToolbarButton>

        <span style={{ fontSize: fontSizes.caption, color: colors.separator, margin: `0 ${spacing.xxs}px` }}>|</span>

        <ToolbarButton onClick={() => setShowShareDialog(true)}
          title={workbook?.private ? 'Private — Share' : 'Share workbook'}>
          {workbook?.private ? '🔒' : '🌐'}
        </ToolbarButton>
      </div>

      {/* Tool panel + mind map canvas + properties panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <ToolPanel
        activeTool={activeTool}
        onToolSelect={setActiveTool}
        showStyle={showStyle}
        onStyleToggle={() => setShowStyle(s => !s)}
        onExportXMind={handleExport}
        onExportSVG={handleExportSVG}
        onExportPNG={handleExportPNG}
        onExportPDF={handleExportPDF}
        onExportMarkdown={handleExportMarkdown}
        onExportFreeMind={handleExportFreeMind}
        onExportOPML={handleExportOPML}
        onImportXMind={handleImportXMind}
        onImportMarkdown={handleImportMarkdown}
        onImportFreeMind={handleImportFreeMind}
        onImportJSON={handleImportJSON}
        onBatchImport={handleBatchImport}
        onClearImportData={handleClearImportData}
        hasImportedData={!!activeSheet?.imported_data}
        presenceCount={presenceUsers.length}
        onPresenceToggle={() => { setShowPresence(s => !s); setShowAIServer(false) }}
        onSummarize={handleSummarize}
        summaryLoading={summaryLoading}
        onGenerateImage={() => setShowImageDialog(true)}
        onAIServer={() => { setShowAIServer(s => !s); setShowPresence(false) }}
        closeToken={closeToken}
      />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
        onDrop={async (e) => {
          e.preventDefault()
          setDragOver(false)
          const files = e.dataTransfer?.files
          if (!files || files.length === 0) return
          for (const file of Array.from(files)) {
            try {
              if (file.name.endsWith('.xmind')) {
                const wb = await api.importXMind(file)
                useMindMapStore.getState().setWorkbook(wb)
                onXMindImported?.(wb.id)
              } else if (file.name.endsWith('.mm')) {
                const text = await file.text()
                const roots = parseFreeMind(text)
                const sheet = activeSheet
                if (sheet) for (const root of roots) await api.importTopicTree(workbookId, sheet.root_topic.id, root)
              } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
                const text = await file.text()
                const roots = parseMarkdownToTopics(text)
                const sheet = activeSheet
                if (sheet) for (const root of roots) await api.importTopicTree(workbookId, sheet.root_topic.id, root)
              }
            } catch (err) {
              console.error(`Drop import failed for ${file.name}:`, err)
            }
          }
          const wb = await api.getWorkbook(workbookId)
          useMindMapStore.getState().setWorkbook(wb)
        }}
      >
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(91,108,255,0.08)',
          border: '2px dashed ' + colors.accent,
          borderRadius: radii.md,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ background: colors.bg, padding: `${spacing.md}px ${spacing.lg}px`, borderRadius: radii.md, fontSize: fontSizes.bodyLarge, color: colors.accent, fontFamily: fonts.ui, boxShadow: shadows.neuMd }}>
            Drop files to import
          </span>
        </div>
      )}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        tabIndex={0}
        style={{
          display: 'block', outline: 'none',
          cursor: activeTool !== 'pointer' ? 'crosshair' : isPanning.current ? 'grabbing' : 'default',
        }}
        onClick={(e) => {
          if (contextMenu) setContextMenu(null)
          setShowStyle(false)
          setShowPresence(false)
          setShowHelp(false)
          setCloseToken(t => t + 1)
          // Клик мимо узла → снять выделение, ничто не активно.
          // Якоря (точки) не считаем «мимо» — они создают узлы.
          const el = e.target as Element
          const onNode = el?.closest?.('[data-topic-id]') || el?.closest?.('[data-anchor-side]')
          if (!onNode && activeTool === 'pointer') {
            setSelectedTopic(null)
            setEditingTopicId(null)
            try { window.getSelection()?.removeAllRanges() } catch { /* ignore */ }
          }
          handleCanvasToolClick(e)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          if (!draggingTopicId) handleCanvasContextMenu(e.clientX, e.clientY)
        }}
        onPointerUp={() => {
          if (draggingTopicId) handleTopicDrop('')
        }}
        onMouseDown={handleMouseDown}
      >
        <defs>
          {/* Selected: двойное свечение — accent halo + lift */}
          <filter id="topic-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={colors.accent} floodOpacity="0.40" result="glow1" />
            <feDropShadow dx="0" dy="3" stdDeviation="8" floodColor={colors.accent} floodOpacity="0.20" />
          </filter>
          <filter id="selected-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={colors.accent} floodOpacity="0.40" />
            <feDropShadow dx="0" dy="3" stdDeviation="8" floodColor={colors.accent} floodOpacity="0.20" />
          </filter>
          {/* Default: лёгкие тени для глубины */}
          <filter id="shadow-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor={colors.accent} floodOpacity="0.08" />
          </filter>
          <filter id="shadow-medium" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor={colors.text} floodOpacity="0.10" />
          </filter>
          <filter id="shadow-strong" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="12" floodColor={colors.text} floodOpacity="0.16" />
          </filter>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <polygon points="0 0, 10 5, 0 10" fill={colors.orange} />
          </marker>
          {theme.gradients?.map(g => (
            <linearGradient key={g.id} id={g.id} x1={g.x1||'0%'} y1={g.y1||'0%'} x2={g.x2||'100%'} y2={g.y2||'100%'}>
              {g.stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
              ))}
            </linearGradient>
          ))}
        </defs>
        <g transform={svgTransform}>
          <MindMapRenderer
            root={layoutResult}
            relationships={activeSheet?.relationships}
            floatingRoots={floatingLayouts}
            selectedTopicId={selectedTopicId}
            selectedTopicIds={selectedTopicIds}
            dragOverTopicId={dragOverTopicId}
            draggingTopicId={draggingTopicId}
            editingTopicId={editingTopicId}
            searchQuery={searchQuery}
            viewportRect={viewportRect}
            cursors={showRemoteCursors ? cursors : new Map()}
            onTopicSelect={handleTopicSelect}
            onTopicDoubleClick={handleTopicDoubleClick}
            onTopicContextMenu={handleTopicContextMenu}
            onTopicDragStart={handleTopicDragStart}
            onTopicDragOver={handleTopicDragOver}
            onTopicDrop={handleTopicDrop}
            onTopicEditSave={handleTopicEditSave}
            onTopicEditCancel={handleTopicEditCancel}
            onTopicNotesClick={handleTopicNotesClick}
            onTopicCommentsClick={handleTopicCommentsClick}
            onTopicFoldToggle={handleTopicFoldToggle}
            onToggleChildSide={handleToggleChildSide}
            onTopicExpandToggle={handleTopicExpandToggle}
            reorderTarget={reorderTarget}
          />

          {/* V5.0: edge anchors on selected node */}
          <EdgeAnchorsLayer
            node={
              findLayoutNode(layoutResult, selectedTopicId)
              ?? floatingLayouts.reduce<LayoutNode | null>((acc, fl) => acc ?? findLayoutNode(fl, selectedTopicId), null)
            }
            onToggleSide={handleToggleChildSide}
          />

          {/* Node-drag drop hint over the target: center=swap, edge=child-direction */}
          {dropZone && draggingTopicId && (() => {
            const tp = nodePositions.get(dropZone.targetId)
            if (!tp) return null
            const anchors = [
              { side: 'top' as AnchorSide, cx: tp.x + tp.w / 2, cy: tp.y },
              { side: 'right' as AnchorSide, cx: tp.x + tp.w, cy: tp.y + tp.h / 2 },
              { side: 'bottom' as AnchorSide, cx: tp.x + tp.w / 2, cy: tp.y + tp.h },
              { side: 'left' as AnchorSide, cx: tp.x, cy: tp.y + tp.h / 2 },
            ]
            return (
              <g pointerEvents="none">
                {dropZone.mode === 'swap' ? (
                  <>
                    <rect x={tp.x - 3} y={tp.y - 3} width={tp.w + 6} height={tp.h + 6} rx={12}
                      fill={colors.green + '1f'} stroke={colors.green} strokeWidth={2} strokeDasharray="6,4" />
                    <text x={tp.cx} y={tp.cy + 6} textAnchor="middle" fontSize={18} fontWeight="bold" fill={colors.green}>⇄</text>
                  </>
                ) : (
                  anchors.map(a => {
                    const active = a.side === dropZone.side
                    return (
                      <circle key={a.side} cx={a.cx} cy={a.cy} r={active ? 11 : 5}
                        fill={active ? colors.accent : colors.accent + '66'}
                        stroke="#fff" strokeWidth={1.5}
                        style={{ transition: 'r 80ms ease' }} />
                    )
                  })
                )}
              </g>
            )
          })()}

          {/* V5.0: phantom line during relationship drag */}
          <FantomLine />

          {/* V5.0: arrow markers for relationship lines */}
          <RelationshipMarkers />

          {/* Connection line: source → target (green, shown when hovering target) */}
          {connectLine && (
            <line
              x1={connectLine.x1}
              y1={connectLine.y1}
              x2={connectLine.x2}
              y2={connectLine.y2}
              stroke={colors.green}
              strokeWidth={3}
              strokeDasharray="5,3"
              opacity={0.9}
            />
          )}
          {connectLine && (
            <circle cx={connectLine.x2} cy={connectLine.y2} r={6} fill="none" stroke={colors.green} strokeWidth={2} opacity={0.8} />
          )}

          {/* Drag line: source → pointer */}
          {dragLine && (
            <line
              x1={dragLine.x1}
              y1={dragLine.y1}
              x2={dragLine.x2}
              y2={dragLine.y2}
              stroke={colors.accent}
              strokeWidth={2}
              strokeDasharray="6,3"
              opacity={0.6}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>

      {/* V5.0: relationship-related overlays */}
      <ConnectionPopover workbookId={workbookId} />
      <AnchorActionMenu onCreateChild={createChildInDirection} />
      <RelationshipPanel />
      <RelationshipFilter />

      {/* V6.1 Memory Lab: sync MASys knowledge graph into this canvas. */}
      {workbook?.kind === 'memory_lab' && (
        <button
          onClick={() => setShowKGSync(true)}
          title="Синхронизировать граф знаний из MASys в эту карту"
          style={{
            position: 'absolute', bottom: spacing.lg, right: spacing.lg, zIndex: 100,
            padding: `${spacing.sm}px ${spacing.md}px`,
            background: colors.accent, color: '#fff', border: 'none',
            borderRadius: radii.md, boxShadow: shadows.neuMd,
            fontSize: fontSizes.caption, fontWeight: fontWeights.medium,
            fontFamily: fonts.ui, cursor: 'pointer',
          }}
        >🌐 Sync MASys</button>
      )}
      {showKGSync && <KGSyncDialog targetWorkbookId={workbookId} onClose={() => setShowKGSync(false)} />}

      {/* StylePanel — абсолютно поверх canvas, слева */}
      <AnimatedMount
        show={showStyle}
        type="panel-left"
        style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, zIndex: 100, maxHeight: `calc(100% - ${spacing.sm * 2}px)`, display: 'flex' }}
      >
        <StylePanel workbookId={workbookId} onClose={() => setShowStyle(false)} />
      </AnimatedMount>

      {/* PropertiesPanel — абсолютно поверх canvas, справа */}
      <AnimatedMount
        show={showProperties}
        type="panel-right"
        style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 100, maxHeight: `calc(100% - ${spacing.sm * 2}px)`, display: 'flex' }}
      >
        <PropertiesPanel workbookId={workbookId} onClose={() => setShowProperties(false)} onCommentsClick={handleTopicCommentsClick} />
      </AnimatedMount>

      </div>

      </div>

      {contextMenu && (
        <div style={{
          position: 'fixed', top: contextMenu.y, left: contextMenu.x,
          background: colors.bgTertiary, border: 'none',
          borderRadius: radii.md, boxShadow: shadows.neuMd,
          zIndex: 1000, minWidth: 160, padding: spacing.xs,
          fontFamily: fonts.ui,
        }}>
          <MenuItem onClick={addChildTopic}>Add Child Topic</MenuItem>
          <MenuItem onClick={() => { handleTopicCommentsClick(contextMenu.topicId); setContextMenu(null) }}>💬 Add Comment</MenuItem>
          <MenuItem onClick={() => { setEditingTopicId(contextMenu.topicId); setContextMenu(null) }}>Rename</MenuItem>
          {(() => {
            const t = useMindMapStore.getState().getTopic(contextMenu.topicId)
            return t?.hyperlink ? (
              <MenuItem onClick={() => {
                window.open(t.hyperlink!, '_blank', 'noopener,noreferrer')
                setContextMenu(null)
              }}>🔗 Open Link</MenuItem>
            ) : null
          })()}
          <div style={{ height: 1, background: colors.separator, margin: `${spacing.xs}px 0` }} />
          <MenuItem onClick={async () => {
            await api.updateTopic(workbookId, contextMenu.topicId, { structure_class: 'mindmap' as StructureClass })
            loadWorkbook()
            setContextMenu(null)
          }}>Layout: Mindmap</MenuItem>
          <MenuItem onClick={async () => {
            await api.updateTopic(workbookId, contextMenu.topicId, { structure_class: 'tree-right' as StructureClass })
            loadWorkbook()
            setContextMenu(null)
          }}>Layout: Tree Right</MenuItem>
          <MenuItem onClick={async () => {
            await api.updateTopic(workbookId, contextMenu.topicId, { structure_class: 'tree-left' as StructureClass })
            loadWorkbook()
            setContextMenu(null)
          }}>Layout: Tree Left</MenuItem>
          <MenuItem onClick={async () => {
            await api.updateTopic(workbookId, contextMenu.topicId, { structure_class: 'tree-down' as StructureClass })
            loadWorkbook()
            setContextMenu(null)
          }}>Layout: Tree Down</MenuItem>
          <MenuItem onClick={async () => {
            await api.updateTopic(workbookId, contextMenu.topicId, { structure_class: 'tree-up' as StructureClass })
            loadWorkbook()
            setContextMenu(null)
          }}>Layout: Tree Up</MenuItem>
          <MenuItem onClick={async () => {
            await api.updateTopic(workbookId, contextMenu.topicId, { structure_class: 'fishbone' as StructureClass })
            loadWorkbook()
            setContextMenu(null)
          }}>Layout: Fishbone</MenuItem>
          <MenuItem onClick={async () => {
            await api.updateTopic(workbookId, contextMenu.topicId, { structure_class: 'radial' as StructureClass })
            loadWorkbook()
            setContextMenu(null)
          }}>Layout: Radial</MenuItem>
          <div style={{ height: 1, background: colors.separator, margin: `${spacing.xs}px 0` }} />
          {activeSheet?.root_topic?.id !== contextMenu.topicId && (
            <MenuItem onClick={async () => {
              const inboxId = await offlineSettings.get<string>('inbox_workbook_id')
              if (!inboxId) { setContextMenu(null); return }
              try {
                const sheet = activeSheet
                if (!sheet) return
                await api.copyTopicToWorkbook(workbookId, contextMenu.topicId, inboxId, sheet.root_topic.id)
                setContextMenu(null)
              } catch (err) {
                console.error('Failed to copy to inbox:', err)
              }
            }}><LumenInbox size={14} strokeWidth={1.8} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Move to Inbox</MenuItem>
          )}
          <div style={{ height: 1, background: colors.separator, margin: `${spacing.xs}px 0` }} />
          <MenuItem onClick={deleteSelectedTopic} danger>Delete</MenuItem>
        </div>
      )}

      {(contextMenu || canvasMenu) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: z.overlay }}
          onClick={() => { setContextMenu(null); setCanvasMenu(null) }} />
      )}

      {canvasMenu && (
        <div style={{
          position: 'fixed', top: canvasMenu.y, left: canvasMenu.x,
          background: colors.bgTertiary, border: 'none',
          borderRadius: radii.md, boxShadow: shadows.neuMd,
          zIndex: 1000, minWidth: 160, padding: spacing.xs,
          fontFamily: fonts.ui,
        }}>
          <MenuItem onClick={addRootTopic}>Add Topic</MenuItem>
          <MenuItem onClick={addFloatingTopicAction}>Add Floating Topic</MenuItem>
        </div>
      )}

      {showPresence && (
        <PresencePanel
          users={presenceUsers}
          userName={userNameRef.current}
          userColor={userColorRef.current}
          broadcastCursor={broadcastCursor}
          showRemoteCursors={showRemoteCursors}
          onToggleBroadcast={() => {
            const next = !broadcastCursor
            setBroadcastCursor(next)
            localStorage.setItem('gmind_broadcast', String(next))
          }}
          onToggleShowCursors={() => {
            const next = !showRemoteCursors
            setShowRemoteCursors(next)
            localStorage.setItem('gmind_show_cursors', String(next))
          }}
          onChangeName={(name) => {
            userNameRef.current = name
            localStorage.setItem('gmind_user_name', name)
          }}
          onClose={() => setShowPresence(false)}
        />
      )}
      {showAIServer && (
        <AIServerPanel onClose={() => setShowAIServer(false)} />
      )}
      <AnimatedMount show={showShareDialog && !!workbook} type="modal" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {workbook && (
          <ShareDialog
            workbookId={workbook.id}
            ownerId={workbook.owner_id}
            isPrivate={workbook.private}
            accessMode={workbook.access_mode}
            currentUserId={userIdRef.current}
            onClose={() => setShowShareDialog(false)}
            onTogglePrivate={handleTogglePrivate}
            onChangeAccessMode={handleChangeAccessMode}
          />
        )}
      </AnimatedMount>

      {/* Summary Dialog */}
      <AnimatedMount show={showSummary} type="modal" style={{ position: 'fixed', inset: 0, zIndex: z.modal }}>
        <div style={{ position: 'fixed', inset: 0, background: colors.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.ui }}>
          <div style={{ background: colors.bgTertiary, borderRadius: radii.lg, padding: spacing.xxxl, width: 480, maxHeight: '60vh', overflow: 'auto', boxShadow: shadows.neuLg, border: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
              <h2 style={{ fontSize: fontSizes.title, fontWeight: fontWeights.semibold, color: colors.text, margin: 0 }}>AI Summary</h2>
              <button onClick={() => setShowSummary(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textQuaternary, fontSize: fontSizes.title, padding: 0, transition: `color ${transitions.fast}` }}
                onMouseEnter={e => e.currentTarget.style.color = colors.text}
                onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
              ><LumenX size={18} strokeWidth={1.8} /></button>
            </div>
            {summaryLoading ? (
              <div style={{ textAlign: 'center', color: colors.textQuaternary, padding: spacing.block }}>Thinking...</div>
            ) : (
              <div style={{ fontSize: fontSizes.body, lineHeight: 1.7, color: colors.textSecondary, whiteSpace: 'pre-wrap' }}>{summaryText}</div>
            )}
          </div>
        </div>
      </AnimatedMount>

      {/* Image Generation Dialog */}
      <AnimatedMount show={showImageDialog} type="modal" style={{ position: 'fixed', inset: 0, zIndex: z.modal }}>
        <div style={{ position: 'fixed', inset: 0, background: colors.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.ui }}>
          <div style={{ background: colors.bgTertiary, borderRadius: radii.lg, padding: spacing.xxxl, width: 500, boxShadow: shadows.neuLg, border: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
              <h2 style={{ fontSize: fontSizes.title, fontWeight: fontWeights.semibold, color: colors.text, margin: 0 }}>Generate Image (DALL-E)</h2>
              <button onClick={() => { setShowImageDialog(false); setImageB64(''); setImagePrompt('') }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textQuaternary, fontSize: fontSizes.title, padding: 0, transition: `color ${transitions.fast}` }}
                onMouseEnter={e => e.currentTarget.style.color = colors.text}
                onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
              ><LumenX size={18} strokeWidth={1.8} /></button>
            </div>
            <textarea
              value={imagePrompt}
              onChange={e => setImagePrompt(e.target.value)}
              placeholder="Describe the image to generate..."
              rows={3}
              style={{
                width: '100%', padding: `${spacing.md}px ${spacing.lg}px`, fontSize: fontSizes.body,
                border: 'none', borderRadius: radii.md,
                resize: 'vertical', outline: 'none', marginBottom: spacing.lg,
                fontFamily: fonts.ui, background: colors.bgTertiary, color: colors.text,
                boxSizing: 'border-box', lineHeight: 1.5,
                boxShadow: shadows.neuInsetSm,
                transition: `box-shadow ${transitions.fast}`,
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
            <button onClick={handleGenerateImage} disabled={imageLoading || !imagePrompt.trim()}
              style={{
                padding: `${spacing.lg}px ${spacing.xxl}px`,
                background: imageLoading || !imagePrompt.trim() ? colors.fill : colors.accent,
                color: imageLoading || !imagePrompt.trim() ? colors.textTertiary : colors.textInverse,
                border: 'none', borderRadius: radii.md,
                cursor: imageLoading || !imagePrompt.trim() ? 'not-allowed' : 'pointer',
                fontSize: fontSizes.body, fontWeight: fontWeights.semibold,
                marginBottom: spacing.lg, fontFamily: fonts.ui,
                transition: `all ${transitions.fast}`,
              }}
              onMouseEnter={e => { if (!imageLoading && imagePrompt.trim()) e.currentTarget.style.background = colors.accentHover }}
              onMouseLeave={e => { if (!imageLoading && imagePrompt.trim()) e.currentTarget.style.background = colors.accent }}
            >
              {imageLoading ? 'Generating...' : 'Generate'}
            </button>
            {imageB64 && (
              <div style={{ textAlign: 'center' }}>
                <img src={`data:image/png;base64,${imageB64}`} alt="Generated" style={{ maxWidth: '100%', borderRadius: radii.md }} />
              </div>
            )}
          </div>
        </div>
      </AnimatedMount>

      {showHelp && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: `${colors.text}F0`, color: colors.bgTertiary,
          padding: `${spacing.xl}px ${spacing.xxxl}px`,
          borderRadius: radii.md, fontSize: fontSizes.body, zIndex: 100,
          boxShadow: shadows.neuLg, fontFamily: fonts.ui,
          textAlign: 'center', lineHeight: 1.7, pointerEvents: 'none', maxWidth: 380,
        }}>
          <div style={{ fontWeight: fontWeights.semibold, marginBottom: spacing.xs, fontSize: fontSizes.subhead }}>Getting Started</div>
          <div>🖱 <b>Click</b> to select &nbsp; <b>Double-click</b> to edit inline</div>
          <div>🔄 <b>Right-click</b> for menu (add, rename, layout, delete)</div>
          <div>👇 <b>Long-press & drag</b> to move a topic</div>
          <div>⌨ <b>Ctrl+F</b> search &nbsp; <b>Ctrl+Z</b> undo &nbsp; <b>Ctrl+C/V</b> copy/paste &nbsp; <b>Alt+←→</b> history &nbsp; <b>Scroll</b> zoom</div>
          <div>⌨ <b>Del</b> delete &nbsp; <b>Space+Drag</b> pan</div>
        </div>
      )}

      {/* Notes popup */}
      <AnimatedMount show={showNotesPopup && !!notesPopupData} type="modal" style={{ position: 'fixed', inset: 0, zIndex: z.modal }}>
        {showNotesPopup && notesPopupData && (
        <div style={{ position: 'fixed', inset: 0, background: colors.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.ui }}
          onClick={() => { setShowNotesPopup(false); setNotesPopupData(null) }}>
          <div style={{ background: colors.bgTertiary, borderRadius: radii.lg, padding: spacing.xxxl, width: 480, boxShadow: shadows.neuLg, border: 'none' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
              <h2 style={{ fontSize: fontSizes.title, fontWeight: fontWeights.semibold, color: colors.text, margin: 0 }}>Notes</h2>
              <button onClick={() => { setShowNotesPopup(false); setNotesPopupData(null) }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textQuaternary, fontSize: fontSizes.title, padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = colors.text}
                onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
              ><LumenX size={18} strokeWidth={1.8} /></button>
            </div>
            <textarea
              value={notesEditText}
              onChange={e => setNotesEditText(e.target.value)}
              placeholder="Add notes..."
              rows={6}
              style={{
                width: '100%', padding: `${spacing.md}px ${spacing.lg}px`, fontSize: fontSizes.body,
                border: 'none', borderRadius: radii.md,
                resize: 'vertical', outline: 'none', marginBottom: spacing.lg,
                fontFamily: fonts.ui, background: colors.bgTertiary, color: colors.text,
                boxSizing: 'border-box', lineHeight: 1.5,
                boxShadow: shadows.neuInsetSm,
                transition: `box-shadow ${transitions.fast}`,
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
            <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNotesPopup(false); setNotesPopupData(null) }}
                style={{
                  padding: `${spacing.lg}px ${spacing.xxl}px`,
                  background: colors.bgTertiary, color: colors.textSecondary,
                  border: 'none', borderRadius: radii.md, cursor: 'pointer',
                  fontSize: fontSizes.body, fontWeight: fontWeights.semibold, fontFamily: fonts.ui,
                }}>Cancel</button>
              <button onClick={handleNotesSave}
                style={{
                  padding: `${spacing.lg}px ${spacing.xxl}px`,
                  background: colors.accent, color: colors.textInverse,
                  border: 'none', borderRadius: radii.md, cursor: 'pointer',
                  fontSize: fontSizes.body, fontWeight: fontWeights.semibold, fontFamily: fonts.ui,
                }}>Save</button>
            </div>
          </div>
        </div>
      )}
      </AnimatedMount>

      {/* Comments dialog */}
      {commentsDialog && (
        <CommentsPanel
          topicId={commentsDialog.topicId}
          topicTitle={commentsDialog.title}
          workbookId={workbookId}
          onClose={() => setCommentsDialog(null)}
        />
      )}
    </div>
    </ErrorBoundary>
  )
}

function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
        border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
        fontSize: fontSizes.body, borderRadius: radii.sm,
        color: danger ? colors.red : colors.text, fontFamily: fonts.ui,
        transition: `background ${transitions.fast}`,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? colors.red + '12' : colors.bgTertiary)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function ToolbarButton({ children, onClick, disabled, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: `${spacing.sm}px ${spacing.lg}px`,
        background: disabled ? colors.fill : 'transparent',
        color: disabled ? colors.textQuaternary : colors.textSecondary,
        border: 'none', borderRadius: radii.sm,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: fontSizes.body, fontWeight: fontWeights.medium,
        fontFamily: fonts.ui, transition: `background ${transitions.fast}`,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = colors.bgTertiary }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function MenuBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
        border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
        fontSize: fontSizes.body, borderRadius: radii.sm, color: colors.text,
        fontFamily: fonts.ui, transition: `background ${transitions.fast}`,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = colors.bgTertiary)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}
