import React, { useMemo } from 'react'
import type { LayoutNode, Relationship } from '../types'
import { TopicNode } from '../components/MindMap/TopicNode'
import { RelationshipLine } from '../components/MindMap/RelationshipLine'
import { useThemeStore } from '../store/theme'
import { DEFAULT_NODE_HEIGHT, DEFAULT_SIBLING_GAP } from './layout'

const CULL_PADDING = 400

interface RendererProps {
  root: LayoutNode | null
  relationships?: Relationship[]
  floatingTopics?: import('../types').Topic[]
  selectedTopicId: string | null
  selectedTopicIds?: string[]
  dragOverTopicId: string | null
  draggingTopicId: string | null
  editingTopicId: string | null
  searchQuery: string
  viewportRect?: { left: number; top: number; right: number; bottom: number } | null
  onTopicSelect: (id: string, e: React.MouseEvent) => void
  onTopicDoubleClick: (id: string) => void
  onTopicContextMenu: (id: string, x: number, y: number) => void
  onTopicDragStart: (id: string, x: number, y: number) => void
  onTopicDragOver: (id: string) => void
  onTopicDrop: (targetId: string) => void
  onTopicEditSave: (id: string, title: string) => void
  onTopicEditCancel: () => void
  onTopicNotesClick?: (id: string, notes: string) => void
  onTopicFoldToggle?: (id: string) => void
  cursors?: Map<string, import('../types').CursorPosition>
  reorderTarget?: { parentId: string; insertIndex: number; nodeHeight?: number } | null
  expandedTopicIds?: Set<string>
  onTopicExpandToggle?: (id: string, expanded: boolean) => void
}

export function MindMapRenderer({
  root,
  relationships = [],
  floatingTopics = [],
  selectedTopicId,
  selectedTopicIds,
  dragOverTopicId,
  draggingTopicId,
  editingTopicId,
  searchQuery,
  viewportRect,
  onTopicSelect,
  onTopicDoubleClick,
  onTopicContextMenu,
  onTopicDragStart,
  onTopicDragOver,
  onTopicDrop,
  onTopicEditSave,
  onTopicEditCancel,
  onTopicNotesClick,
  onTopicFoldToggle,
  cursors,
  reorderTarget,
  expandedTopicIds,
  onTopicExpandToggle,
}: RendererProps) {
  const selSet = useMemo(
    () => new Set(selectedTopicIds || (selectedTopicId ? [selectedTopicId] : [])),
    [selectedTopicId, selectedTopicIds],
  )
  const theme = useThemeStore(s => s.theme)

  const isInViewport = (nx: number, ny: number, nw: number, nh: number) => {
    if (!viewportRect) return true
    return nx + nw > viewportRect.left - CULL_PADDING
      && nx < viewportRect.right + CULL_PADDING
      && ny + nh > viewportRect.top - CULL_PADDING
      && ny < viewportRect.bottom + CULL_PADDING
  }

  const edgePath = (fromX: number, fromY: number, toX: number, toY: number, edgeStyle?: string) => {
    const midX = (fromX + toX) / 2
    switch (edgeStyle || 'curved') {
      case 'straight': return `M ${fromX} ${fromY} L ${toX} ${toY}`
      case 'angled': return `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`
      default: return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
    }
  }

  const { edgeData, nodeComponents, nodePositions, nodeShiftMap } = useMemo(() => {
    const edges: { path: string; dash: string; key: string; opacity: number }[] = []
    const regularNodes: React.ReactNode[] = []
    const topNodes: React.ReactNode[] = []
    const positions = new Map<string, { x: number; y: number }>()
    const shiftMap = new Map<string, number>()

    const collectEdges = (node: LayoutNode) => {
      if (!node || !node.topic) return
      const nodeHidden = !isInViewport(node.x, node.y, node.width, node.height)
      for (const child of (node.children || [])) {
        const es = child.topic?.edge_style || node.topic?.edge_style || 'curved'
        const ed = child.topic?.edge_dash || node.topic?.edge_dash || 'solid'
        const dm: Record<string, string> = { solid: '0', dashed: '6,4', dotted: '2,3' }
        const fromX = node.x + node.width
        const fromY = node.y + node.height / 2
        const toX = child.x
        const toY = child.y + child.height / 2
        const childFolded = !!child.topic?.folded
        if (!nodeHidden || isInViewport(child.x, child.y, child.width, child.height)) {
          edges.push({ path: edgePath(fromX, fromY, toX, toY, es), dash: dm[ed] || '0', key: child.topic?.id || '', opacity: node.topic?.folded ? 0 : 1 })
        }
        if (!childFolded) {
          collectEdges(child)
        }
      }
    }

    const renderNode = (node: LayoutNode, parentFolded = false) => {
      if (!node || !node.topic) return
      positions.set(node.topic.id, { x: node.x, y: node.y })
      const hidden = !isInViewport(node.x, node.y, node.width, node.height) || parentFolded
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
           onEditCancel={onTopicEditCancel}
            onNotesClick={onTopicNotesClick}
            onFoldToggle={onTopicFoldToggle}
            onExpandToggle={onTopicExpandToggle}
        />
      )
      ;(expandedTopicIds?.has(node.topic.id) || selSet.has(node.topic.id) ? topNodes : regularNodes).push(el)
      const childFolded = parentFolded || !!node.topic?.folded
      for (const child of (node.children || [])) {
        renderNode(child, childFolded)
      }
    }

    if (root) {
      collectEdges(root)
      renderNode(root)
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

    return { edgeData: edges, nodeComponents: [...regularNodes, ...topNodes], nodePositions: positions, nodeShiftMap: shiftMap }
  }, [
    root, selSet, searchQuery, viewportRect, reorderTarget,
    dragOverTopicId, draggingTopicId, editingTopicId,
    onTopicSelect, onTopicDoubleClick, onTopicContextMenu,
    onTopicDragStart, onTopicDragOver, onTopicDrop,
    onTopicEditSave, onTopicEditCancel, onTopicFoldToggle,
    expandedTopicIds, onTopicExpandToggle,
  ])

  return (
    <g>
      {edgeData.map(e => (
        <path key={e.key} d={e.path} fill="none"
          stroke={theme.connection.stroke}
          strokeWidth={theme.connection.strokeWidth}
          opacity={theme.connection.opacity * e.opacity}
          strokeLinecap="round"
          strokeDasharray={e.dash === '0' ? undefined : e.dash}
          style={{ transition: 'opacity 0.25s ease' }}
        />
      ))}
      {nodeComponents}
      {relationships.map(rel => {
        const from = nodePositions.get(rel.end1_id)
        const to = nodePositions.get(rel.end2_id)
        if (!from || !to) return null
        return (
          <RelationshipLine
            key={rel.id}
            relationship={rel}
            fromX={from.x}
            fromY={from.y}
            toX={to.x}
            toY={to.y}
          />
        )
      })}
      {floatingTopics.map(ft => {
        const pos = ft.position || { x: 200, y: 200 }
        const w = Math.max(60, Math.min(200, (ft.title?.length || 1) * 8 + 20))
        const fnWidth = ft.node_width ? Math.max(60, Math.min(300, ft.node_width)) : w
        const fNode: LayoutNode = {
          topic: ft,
          x: pos.x,
          y: pos.y,
          width: fnWidth,
          height: 40,
          children: [],
        }
        const fHidden = viewportRect ? !isInViewport(pos.x, pos.y, fnWidth, 40) : false
        return (
          <TopicNode key={`floating-${ft.id}`}
            layout={fNode}
            isSelected={selSet.has(ft.id)}
            isDragOver={ft.id === dragOverTopicId}
            isDragging={ft.id === draggingTopicId}
            isRoot={false}
            isEditing={ft.id === editingTopicId}
            searchQuery={searchQuery}
            hidden={fHidden}
            onSelect={onTopicSelect}
            onDoubleClick={onTopicDoubleClick}
            onContextMenu={onTopicContextMenu}
            onDragStart={onTopicDragStart}
            onDragOver={onTopicDragOver}
            onDrop={onTopicDrop}
            onEditSave={onTopicEditSave}
            onEditCancel={onTopicEditCancel}
            onNotesClick={onTopicNotesClick}
            onFoldToggle={onTopicFoldToggle}
            onExpandToggle={onTopicExpandToggle}
          />
        )
      })}
      {cursors && renderCursors(cursors)}
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
