import React, { useCallback, useMemo } from 'react'
import type { LayoutNode, Relationship } from '../types'
import { TopicNode } from '../components/MindMap/TopicNode'
import { TreeEdge } from '../components/MindMap/TreeEdge'
import { DIRECTION_VECTORS, isNodeSide, oppositeNodeSide, type ChildDirection, type NodeSide } from '../components/MindMap/nodeDirections'
import { RelationshipLine } from '../components/MindMap/RelationshipLine'
import { useThemeStore } from '../store/theme'
import { useRelationshipsStore } from '../store/relationships'
import { DEFAULT_NODE_HEIGHT, DEFAULT_SIBLING_GAP } from './layout'
import { colors } from '../styles/tokens'
import { weightToColor, thicknessForSubtree, sideOf, childSideCounts, type Side } from './edgeVisuals'
import { pointHalfway, routePortToPort, routeToPath, routeTreeEdge, sidePoint, type NodeObstacle } from './edgeRouting'

const CULL_PADDING = 400
const EMPTY_NOTE_IDS: ReadonlySet<string> = new Set()
const NOTE_NODE_WIDTH = 236
const NOTE_NODE_HEIGHT = 148
const NOTE_NODE_GAP = 24

interface RendererProps {
  root: LayoutNode | null
  relationships?: Relationship[]
  // Floating topics pre-laid-out as independent subtree roots (node + children).
  floatingRoots?: LayoutNode[]
  selectedTopicId: string | null
  selectedTopicIds?: string[]
  dragOverTopicId: string | null
  draggingTopicId: string | null
  editingTopicId: string | null
  searchQuery: string
  expandedNoteIds?: ReadonlySet<string>
  selectedNoteId?: string | null
  viewportRect?: { left: number; top: number; right: number; bottom: number } | null
  onTopicSelect: (id: string, e: React.MouseEvent) => void
  onTopicDoubleClick: (id: string) => void
  onTopicContextMenu: (id: string, x: number, y: number) => void
  onTopicDragStart: (id: string, x: number, y: number) => void
  onTopicDragOver: (id: string) => void
  onTopicDrop: (targetId: string) => void
  onTopicEditSave: (id: string, title: string, richText?: string, body?: string) => void
  onTopicEditStyleRequest?: (id: string, title: string, richText?: string, body?: string) => void
  onTopicEditCancel: () => void
  onTopicEditResize?: (id: string, width: number, height: number) => void
  onTopicNotesClick?: (id: string, notes: string) => void
  onNoteSelect?: (id: string) => void
  onTopicCommentsClick?: (id: string) => void
  onTopicFoldToggle?: (id: string) => void
  // Fold/unfold only the children on one side of a node (top|right|bottom|left).
  onToggleChildSide?: (id: string, side: string) => void
  onTreeEdgeAnchorChange?: (childId: string, parentSide: NodeSide, childDirection: ChildDirection) => void
  cursors?: Map<string, import('../types').CursorPosition>
  reorderTarget?: { parentId: string; insertIndex: number; nodeHeight?: number } | null
}

export function MindMapRenderer({
  root,
  relationships = [],
  floatingRoots = [],
  selectedTopicId,
  selectedTopicIds,
  dragOverTopicId,
  draggingTopicId,
  editingTopicId,
  searchQuery,
  expandedNoteIds = EMPTY_NOTE_IDS,
  selectedNoteId = null,
  viewportRect,
  onTopicSelect,
  onTopicDoubleClick,
  onTopicContextMenu,
  onTopicDragStart,
  onTopicDragOver,
  onTopicDrop,
  onTopicEditSave,
  onTopicEditStyleRequest,
  onTopicEditCancel,
  onTopicEditResize,
  onTopicNotesClick,
  onNoteSelect,
  onTopicCommentsClick,
  onTopicFoldToggle,
  onToggleChildSide,
  onTreeEdgeAnchorChange,
  cursors,
  reorderTarget,
}: RendererProps) {
  const selSet = useMemo(
    () => new Set(selectedTopicIds || (selectedTopicId ? [selectedTopicId] : [])),
    [selectedTopicId, selectedTopicIds],
  )
  const theme = useThemeStore(s => s.theme)
  // V5.0: prefer store (single source of truth) over workbook JSON
  const storeRels = useRelationshipsStore(s => s.relationships)
  const effectiveRels = storeRels.length > 0 ? storeRels : relationships

  const isInViewport = useCallback((nx: number, ny: number, nw: number, nh: number) => {
    if (!viewportRect) return true
    return nx + nw > viewportRect.left - CULL_PADDING
      && nx < viewportRect.right + CULL_PADDING
      && ny + nh > viewportRect.top - CULL_PADDING
      && ny < viewportRect.bottom + CULL_PADDING
  }, [viewportRect])

  // Геометрия карты: препятствия, маршруты веток, позиции узлов. Считается
  // только когда меняется само дерево — панорамирование и зум её не трогают.
  // Раньше сюда входил viewportRect, и каждый пиксель протяжки перекладывал
  // маршруты всех рёбер (с A* внутри): карта дёргалась и отставала от курсора.
  const { edgeData, nodePositions } = useMemo(() => {
    const edges: {
      path: string; dash: string; key: string; opacity: number; width?: number; color?: string
      parentRect: NodeObstacle; childRect: NodeObstacle; fromSide: NodeSide
    }[] = []
    const positions = new Map<string, { x: number; y: number; w: number; h: number }>()

    // Subtree size per topic id (node + all descendants) → edge thickness.
    const sizeMap = new Map<string, number>()
    const measure = (n: LayoutNode): number => {
      let s = 1
      for (const c of n.children ?? []) s += measure(c)
      if (n.topic) sizeMap.set(n.topic.id, s)
      return s
    }

    const collectEdges = (node: LayoutNode) => {
      if (!node || !node.topic) return
      const foldedSides = node.topic?.folded_sides
      for (const child of (node.children || [])) {
        // Children on a folded side are hidden (no reflow): skip edge + subtree.
        if (foldedSides && foldedSides.includes(sideOf(node, child))) continue
        const es = child.topic?.edge_style || node.topic?.edge_style || 'curved'
        const ed = child.topic?.edge_dash || node.topic?.edge_dash || 'solid'
        const dm: Record<string, string> = { solid: '0', dashed: '6,4', dotted: '2,3' }
        const childFolded = !!child.topic?.folded
        const w = child.topic?.edge_weight
        const size = sizeMap.get(child.topic?.id || '') ?? 1
        const width = thicknessForSubtree(size)
        const endpoints = routeTreeEdge(node, child, width)
        edges.push({
          path: routeToPath(endpoints.route, es),
          dash: dm[ed] || '0',
          key: child.topic?.id || '',
          opacity: node.topic?.folded ? 0 : 1,
          // Thickness tracks subtree size; weight (if set) tints cold→hot.
          width,
          color: w && w > 0 ? weightToColor(w) : undefined,
          parentRect: { id: node.topic.id, x: node.x, y: node.y, width: node.width, height: node.height },
          childRect: { id: child.topic.id, x: child.x, y: child.y, width: child.width, height: child.height },
          fromSide: endpoints.fromSide,
        })
        if (!childFolded) {
          collectEdges(child)
        }
      }
    }

    const collectPositions = (node: LayoutNode) => {
      if (!node?.topic) return
      positions.set(node.topic.id, { x: node.x, y: node.y, w: node.width, h: node.height })
      for (const child of node.children ?? []) collectPositions(child)
    }

    if (root) measure(root)
    for (const fRoot of floatingRoots) measure(fRoot)
    if (root) { collectEdges(root); collectPositions(root) }
    for (const fRoot of floatingRoots) { collectEdges(fRoot); collectPositions(fRoot) }

    return {
      edgeData: edges,
      nodePositions: positions,
    }
  }, [root, floatingRoots])

  // Узлы и бейджи: сюда входит отсечение по видимой области, поэтому мемо
  // пересчитывается при протяжке и зуме. Внутри только сборка React-элементов —
  // без раскладки и маршрутизации, так что это дёшево.
  const { nodeComponents, childBadges } = useMemo(() => {
    const regularNodes: React.ReactNode[] = []
    const topNodes: React.ReactNode[] = []
    const shiftMap = new Map<string, number>()
    // Per-node child-count badges, one per direction that actually has children.
    const badges: { key: string; topicId: string; side: Side; folded: boolean; cx: number; cy: number; count: number }[] = []

    const renderNode = (node: LayoutNode, parentFolded = false) => {
      if (!node || !node.topic) return
      const hidden = !isInViewport(node.x, node.y, node.width, node.height) || parentFolded

      // Child-count badges per direction. Shown for every node with children
      // except the selected one (its interactive anchors carry the counts).
      // Folded nodes keep their badges so they can still be expanded by click.
      if (!hidden && !selSet.has(node.topic.id) && (node.children?.length ?? 0) > 0 && node.topic.show_child_count !== false) {
        const sc = childSideCounts(node)
        const ncx = node.x + node.width / 2, ncy = node.y + node.height / 2
        const pts: Record<string, [number, number]> = {
          top: [ncx, node.y], right: [node.x + node.width, ncy],
          bottom: [ncx, node.y + node.height], left: [node.x, ncy],
        }
        const fSidesB = node.topic.folded_sides
        for (const side of ['top', 'right', 'bottom', 'left'] as Side[]) {
          if (sc[side] > 0) {
            const [cx, cy] = pts[side]
            badges.push({
              key: `${node.topic.id}-${side}`, topicId: node.topic.id, side,
              folded: !!fSidesB && fSidesB.includes(side), cx, cy, count: sc[side],
            })
          }
        }
      }

      const el = (
        <TopicNode
          key={node.topic.id}
          layout={node}
          isSelected={selSet.has(node.topic.id)}
          isDragOver={node.topic.id === dragOverTopicId}
          isDragging={node.topic.id === draggingTopicId}
          isRoot={!!(root && node.topic === root.topic)}
          isEditing={node.topic.id === editingTopicId}
          searchQuery={searchQuery}
          hidden={hidden}
          parentFolded={parentFolded}
          onSelect={onTopicSelect}
          onDoubleClick={onTopicDoubleClick}
          onContextMenu={onTopicContextMenu}
          shiftY={shiftMap.get(node.topic.id) || 0}
          onDragStart={onTopicDragStart}
          onDragOver={onTopicDragOver}
          onDrop={onTopicDrop}
           onEditSave={onTopicEditSave}
           onEditStyleRequest={onTopicEditStyleRequest}
           onEditCancel={onTopicEditCancel}
            onEditResize={onTopicEditResize}
            onNotesClick={onTopicNotesClick}
            onCommentsClick={onTopicCommentsClick}
            onFoldToggle={onTopicFoldToggle}
        />
      )
      // Редактируемый и выделенные узлы рисуем поверх остальных.
      ;(node.topic.id === editingTopicId || selSet.has(node.topic.id) ? topNodes : regularNodes).push(el)
      const childFolded = parentFolded || !!node.topic?.folded
      const fSides = node.topic?.folded_sides
      for (const child of (node.children || [])) {
        // Hide (without reflow) children on a folded side, plus their subtree.
        const sideHidden = !!fSides && fSides.includes(sideOf(node, child))
        renderNode(child, childFolded || sideHidden)
      }
    }

    // Compute shiftY for sibling reorder preview
    if (reorderTarget && root) {
      const walkShift = (n: LayoutNode) => {
        if (n.topic?.id === reorderTarget.parentId && n.children) {
          const shiftH = (reorderTarget.nodeHeight || DEFAULT_NODE_HEIGHT) + DEFAULT_SIBLING_GAP
          for (let i = reorderTarget.insertIndex; i < n.children.length; i++) {
            const child = n.children[i]
            if (child.topic) shiftMap.set(child.topic.id, shiftH)
          }
        }
        for (const child of (n.children || [])) walkShift(child)
      }
      walkShift(root)
    }

    if (root) renderNode(root)
    for (const fRoot of floatingRoots) renderNode(fRoot)

    return {
      nodeComponents: [...regularNodes, ...topNodes],
      childBadges: badges,
    }
  }, [
    root, selSet, searchQuery, isInViewport, reorderTarget, onTopicNotesClick,
    dragOverTopicId, draggingTopicId, editingTopicId,
    onTopicSelect, onTopicDoubleClick, onTopicContextMenu,
    onTopicDragStart, onTopicDragOver, onTopicDrop,
    onTopicEditSave, onTopicEditStyleRequest, onTopicEditCancel, onTopicEditResize, onTopicCommentsClick, onTopicFoldToggle,
    floatingRoots,
  ])

  // Линии связей: маршрутизация тоже не должна повторяться на каждом кадре
  // протяжки — раньше этот блок был IIFE прямо в JSX и пересчитывал маршрут
  // каждой связи при любом ре-рендере.
  const relationshipLines = useMemo(() => {
    // V5.0: bundle parallel multi-edges per (from,to) pair for offset rendering
      const groups = new Map<string, Relationship[]>()
      for (const rel of effectiveRels) {
        const fid = rel.from_topic_id || rel.end1_id
        const tid = rel.to_topic_id || rel.end2_id
        const key = fid < tid ? `${fid}|${tid}` : `${tid}|${fid}`
        const list = groups.get(key) ?? []
        list.push(rel)
        groups.set(key, list)
      }
      return effectiveRels.map(rel => {
        const fid = rel.from_topic_id || rel.end1_id
        const tid = rel.to_topic_id || rel.end2_id
        const from = nodePositions.get(fid)
        const to = nodePositions.get(tid)
        if (!from || !to) return null
        const key = fid < tid ? `${fid}|${tid}` : `${tid}|${fid}`
        const bundle = groups.get(key) ?? [rel]
        const offsetIndex = bundle.indexOf(rel)
        // Self-loop: anchor at the node's own rect (RelationshipLine draws a dome).
        if (fid === tid) {
          return (
            <RelationshipLine
              key={rel.id}
              relationship={rel}
              fromX={from.x} fromY={from.y} toX={from.x} toY={from.y}
              nodeWidth={from.w} nodeHeight={from.h}
              offsetIndex={offsetIndex} offsetCount={bundle.length}
            />
          )
        }
        // Persisted drag port wins; legacy/agent edges use the two facing ports.
        let fromSide: NodeSide | undefined
        let toSide: NodeSide | undefined
        if (rel.metadata) {
          try {
            const metadata = JSON.parse(rel.metadata) as { from_side?: string; to_side?: string }
            if (isNodeSide(metadata.from_side)) fromSide = metadata.from_side
            if (isNodeSide(metadata.to_side)) toSide = metadata.to_side
          } catch { /* legacy metadata may not be JSON */ }
        }
        if (!fromSide) {
          const dx = to.x + to.w / 2 - (from.x + from.w / 2)
          const dy = to.y + to.h / 2 - (from.y + from.h / 2)
          fromSide = Math.abs(dx) >= Math.abs(dy)
            ? (dx >= 0 ? 'right' : 'left')
            : (dy >= 0 ? 'bottom' : 'top')
        }
        toSide ??= oppositeNodeSide(fromSide)
        const fromRect = { id: fid, x: from.x, y: from.y, width: from.w, height: from.h }
        const toRect = { id: tid, x: to.x, y: to.y, width: to.w, height: to.h }
        const fromPoint = sidePoint(fromRect, fromSide)
        const toPoint = sidePoint(toRect, toSide)
        const route = routePortToPort(fromPoint, toPoint, fromSide, toSide, rel.weight ?? 1.5)
        const label = pointHalfway(route)
        return (
          <RelationshipLine
            key={rel.id}
            relationship={rel}
            fromX={fromPoint.x}
            fromY={fromPoint.y}
            toX={toPoint.x}
            toY={toPoint.y}
            routedPath={routeToPath(route, 'curved')}
            labelX={label.x}
            labelY={label.y}
            offsetIndex={offsetIndex}
            offsetCount={bundle.length}
          />
        )
    })
  }, [effectiveRels, nodePositions])

  const noteNodes = useMemo(() => {
    const result: React.ReactNode[] = []

    const walk = (node: LayoutNode, parentFolded = false) => {
      if (!node?.topic) return
      const hidden = parentFolded || !isInViewport(node.x, node.y, node.width, node.height)
      const notes = node.topic.notes?.trim()
      if (!hidden && notes && expandedNoteIds.has(node.topic.id)) {
        result.push(
          <ExpandedNoteNode
            key={`note-${node.topic.id}`}
            node={node}
            selected={selectedNoteId === node.topic.id}
            onSelect={() => onNoteSelect?.(node.topic.id)}
            fill={theme.topic.fill}
            textColor={theme.topic.textColor}
          />,
        )
      }

      const childrenFolded = parentFolded || !!node.topic.folded
      const foldedSides = node.topic.folded_sides
      for (const child of node.children ?? []) {
        const sideHidden = !!foldedSides && foldedSides.includes(sideOf(node, child))
        walk(child, childrenFolded || sideHidden)
      }
    }

    if (root) walk(root)
    for (const floatingRoot of floatingRoots) walk(floatingRoot)
    return result
  }, [expandedNoteIds, floatingRoots, isInViewport, onNoteSelect, root, selectedNoteId, theme.topic.fill, theme.topic.textColor])

  return (
    <g>
      {/* Отсечение рёбер по видимой области — дешёвая проверка готовых
          прямоугольников: маршруты уже посчитаны выше и от прокрутки не зависят. */}
      {edgeData.filter(e => (
        isInViewport(e.parentRect.x, e.parentRect.y, e.parentRect.width, e.parentRect.height)
        || isInViewport(e.childRect.x, e.childRect.y, e.childRect.width, e.childRect.height)
      )).map(e => (
        <TreeEdge key={e.key} childId={e.key} path={e.path}
          parentRect={e.parentRect} childRect={e.childRect} fromSide={e.fromSide}
          stroke={e.color ?? theme.connection.stroke}
          strokeWidth={e.width ?? theme.connection.strokeWidth}
          opacity={theme.connection.opacity * e.opacity}
          dash={e.dash === '0' ? undefined : e.dash}
          onAnchorChange={onTreeEdgeAnchorChange}
        />
      ))}
      {nodeComponents}
      {/* Child-count badges: one per direction that has children, on every node.
          Click folds/unfolds only that direction (no reflow). Folded sides are
          drawn hollow so they read as "collapsed, click to expand". */}
      {childBadges.map(b => (
        <g key={b.key} style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onToggleChildSide?.(b.topicId, b.side) }}>
          <circle cx={b.cx} cy={b.cy} r={9}
            fill={b.folded ? '#fff' : colors.accent}
            stroke={b.folded ? colors.accent : '#fff'} strokeWidth={1.5}
            opacity={0.95} />
          <text x={b.cx} y={b.cy} textAnchor="middle" dominantBaseline="central"
            fontSize={11} fontWeight={700} fill={b.folded ? colors.accent : '#fff'} pointerEvents="none"
            style={{ userSelect: 'none' }}>
            {b.count}
          </text>
        </g>
      ))}
      {relationshipLines}
      {noteNodes}
      {cursors && renderCursors(cursors)}
    </g>
  )
}

function ExpandedNoteNode({ node, selected, onSelect, fill, textColor }: {
  node: LayoutNode
  selected: boolean
  onSelect: () => void
  fill: string
  textColor: string
}) {
  const vector = node.placedDir ? DIRECTION_VECTORS[node.placedDir] : DIRECTION_VECTORS.right
  const x = vector.x < 0
    ? node.x - NOTE_NODE_WIDTH - NOTE_NODE_GAP
    : vector.x > 0
      ? node.x + node.width + NOTE_NODE_GAP
      : node.x + (node.width - NOTE_NODE_WIDTH) / 2
  const y = vector.y < 0
    ? node.y - NOTE_NODE_HEIGHT - NOTE_NODE_GAP
    : vector.y > 0
      ? node.y + node.height + NOTE_NODE_GAP
      : node.y + (node.height - NOTE_NODE_HEIGHT) / 2

  const sourceX = vector.x < 0 ? node.x : vector.x > 0 ? node.x + node.width : node.x + node.width / 2
  const sourceY = vector.y < 0 ? node.y : vector.y > 0 ? node.y + node.height : node.y + node.height / 2
  const noteX = vector.x < 0 ? x + NOTE_NODE_WIDTH : vector.x > 0 ? x : x + NOTE_NODE_WIDTH / 2
  const noteY = vector.y < 0 ? y + NOTE_NODE_HEIGHT : vector.y > 0 ? y : y + NOTE_NODE_HEIGHT / 2

  return (
    <g
      data-note-topic-id={node.topic.id}
      data-selected={selected ? 'true' : 'false'}
      role="note"
      aria-label={`Notes for ${node.topic.title}`}
      style={{ cursor: 'pointer' }}
      onClick={event => {
        event.stopPropagation()
        onSelect()
      }}
      onMouseDown={event => event.stopPropagation()}
    >
      <line
        x1={sourceX}
        y1={sourceY}
        x2={noteX}
        y2={noteY}
        stroke={colors.accent}
        strokeWidth={1.5}
        strokeDasharray="5,5"
        opacity={0.55}
        pointerEvents="none"
      />
      <rect
        x={x}
        y={y}
        width={NOTE_NODE_WIDTH}
        height={NOTE_NODE_HEIGHT}
        rx={12}
        fill={fill}
        stroke={colors.accent}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray="7,5"
        filter={selected ? 'url(#topic-shadow)' : 'url(#shadow-soft)'}
      />
      <foreignObject x={x + 12} y={y + 10} width={NOTE_NODE_WIDTH - 24} height={NOTE_NODE_HEIGHT - 20}>
        <div data-note-scroll="true" style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          color: textColor, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          overflow: 'hidden', userSelect: 'none', cursor: 'default',
        }}>
          <div style={{
            color: colors.accent, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 7, flexShrink: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Notes · {node.topic.title}
          </div>
          <div style={{
            fontSize: 12, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowY: 'auto',
            overflowX: 'hidden', overflowWrap: 'anywhere', opacity: 0.9,
            flex: '1 1 auto', minHeight: 0, paddingRight: 5, userSelect: 'none', cursor: 'default',
          }}>
            {node.topic.notes}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 6, fontSize: 10, color: colors.textQuaternary, flexShrink: 0 }}>
            Use the Notes icon to hide
          </div>
        </div>
      </foreignObject>
    </g>
  )
}

function renderCursors(cursors: Map<string, import('../types').CursorPosition>) {
  return Array.from(cursors.entries()).map(([userId, pos]) => {
    const color = pos.user_color || '#5B6CFF'
    const name = pos.user_name || userId
    return (
      <g key={userId} transform={`translate(${pos.x}, ${pos.y})`} pointerEvents="none">
        <circle cx="0" cy="0" r="5" fill={color} opacity="0.8" stroke="white" strokeWidth={1.5} />
        <rect x={8} y={-6} width={name.length * 7 + 8} height={16} rx={3} fill={color} opacity={0.85} />
        <text x={12} y={5} fontSize={11} fill="white" fontWeight="bold" style={{ userSelect: 'none' }}>
          {name}
        </text>
      </g>
    )
  })
}
