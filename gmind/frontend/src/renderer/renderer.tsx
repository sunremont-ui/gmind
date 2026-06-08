import React, { useMemo } from 'react'
import type { LayoutNode, Relationship } from '../types'
import { TopicNode } from '../components/MindMap/TopicNode'
import { RelationshipLine } from '../components/MindMap/RelationshipLine'
import { useThemeStore } from '../store/theme'
import { useRelationshipsStore } from '../store/relationships'
import { DEFAULT_NODE_HEIGHT, DEFAULT_SIBLING_GAP } from './layout'
import { edgeAttachment } from './edgeAttachment'
import { colors } from '../styles/tokens'
import { weightToColor, thicknessForSubtree, sideOf, type Side } from './edgeVisuals'

const CULL_PADDING = 400

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
  onTopicCommentsClick?: (id: string) => void
  onTopicFoldToggle?: (id: string) => void
  // Fold/unfold only the children on one side of a node (top|right|bottom|left).
  onToggleChildSide?: (id: string, side: string) => void
  cursors?: Map<string, import('../types').CursorPosition>
  reorderTarget?: { parentId: string; insertIndex: number; nodeHeight?: number } | null
  expandedTopicIds?: Set<string>
  onTopicExpandToggle?: (id: string, expanded: boolean) => void
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
  onTopicCommentsClick,
  onTopicFoldToggle,
  onToggleChildSide,
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
  // V5.0: prefer store (single source of truth) over workbook JSON
  const storeRels = useRelationshipsStore(s => s.relationships)
  const effectiveRels = storeRels.length > 0 ? storeRels : relationships

  const isInViewport = (nx: number, ny: number, nw: number, nh: number) => {
    if (!viewportRect) return true
    return nx + nw > viewportRect.left - CULL_PADDING
      && nx < viewportRect.right + CULL_PADDING
      && ny + nh > viewportRect.top - CULL_PADDING
      && ny < viewportRect.bottom + CULL_PADDING
  }

  const edgePath = (fromX: number, fromY: number, toX: number, toY: number, edgeStyle?: string, axis: 'h' | 'v' = 'h') => {
    if (axis === 'v') {
      // Vertical run: bend along Y so the curve leaves top/bottom cleanly.
      const midY = (fromY + toY) / 2
      switch (edgeStyle || 'curved') {
        case 'straight': return `M ${fromX} ${fromY} L ${toX} ${toY}`
        case 'angled': return `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`
        default: return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`
      }
    }
    const midX = (fromX + toX) / 2
    switch (edgeStyle || 'curved') {
      case 'straight': return `M ${fromX} ${fromY} L ${toX} ${toY}`
      case 'angled': return `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`
      default: return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
    }
  }

  // Pick attachment points based on which side the child sits relative to parent,
  // so edges leave/enter the correct face instead of always parent-right→child-left.
  const edgeEndpoints = (p: LayoutNode, c: LayoutNode) => {
    const pcx = p.x + p.width / 2, pcy = p.y + p.height / 2
    const ccx = c.x + c.width / 2, ccy = c.y + c.height / 2
    const dx = ccx - pcx, dy = ccy - pcy
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0
        ? { fromX: p.x + p.width, fromY: pcy, toX: c.x, toY: ccy, axis: 'h' as const }
        : { fromX: p.x, fromY: pcy, toX: c.x + c.width, toY: ccy, axis: 'h' as const }
    }
    return dy >= 0
      ? { fromX: pcx, fromY: p.y + p.height, toX: ccx, toY: c.y, axis: 'v' as const }
      : { fromX: pcx, fromY: p.y, toX: ccx, toY: c.y + c.height, axis: 'v' as const }
  }

  const { edgeData, nodeComponents, nodePositions, nodeShiftMap, childBadges } = useMemo(() => {
    const edges: { path: string; dash: string; key: string; opacity: number; width?: number; color?: string }[] = []
    const regularNodes: React.ReactNode[] = []
    const topNodes: React.ReactNode[] = []
    const positions = new Map<string, { x: number; y: number; w: number; h: number }>()
    const shiftMap = new Map<string, number>()

    // Per-node child-count badges, one per direction that actually has children.
    const badges: { key: string; topicId: string; side: Side; folded: boolean; cx: number; cy: number; count: number }[] = []

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
      const nodeHidden = !isInViewport(node.x, node.y, node.width, node.height)
      const foldedSides = node.topic?.folded_sides
      for (const child of (node.children || [])) {
        // Children on a folded side are hidden (no reflow): skip edge + subtree.
        if (foldedSides && foldedSides.includes(sideOf(node, child))) continue
        const es = child.topic?.edge_style || node.topic?.edge_style || 'curved'
        const ed = child.topic?.edge_dash || node.topic?.edge_dash || 'solid'
        const dm: Record<string, string> = { solid: '0', dashed: '6,4', dotted: '2,3' }
        const { fromX, fromY, toX, toY, axis } = edgeEndpoints(node, child)
        const childFolded = !!child.topic?.folded
        if (!nodeHidden || isInViewport(child.x, child.y, child.width, child.height)) {
          const w = child.topic?.edge_weight
          const size = sizeMap.get(child.topic?.id || '') ?? 1
          edges.push({
            path: edgePath(fromX, fromY, toX, toY, es, axis),
            dash: dm[ed] || '0',
            key: child.topic?.id || '',
            opacity: node.topic?.folded ? 0 : 1,
            // Thickness tracks subtree size; weight (if set) tints cold→hot.
            width: thicknessForSubtree(size),
            color: w && w > 0 ? weightToColor(w) : undefined,
          })
        }
        if (!childFolded) {
          collectEdges(child)
        }
      }
    }

    const renderNode = (node: LayoutNode, parentFolded = false) => {
      if (!node || !node.topic) return
      positions.set(node.topic.id, { x: node.x, y: node.y, w: node.width, h: node.height })
      const hidden = !isInViewport(node.x, node.y, node.width, node.height) || parentFolded

      // Child-count badges per direction. Shown for every node with children
      // except the selected one (its interactive anchors carry the counts).
      // Folded nodes keep their badges so they can still be expanded by click.
      if (!hidden && !selSet.has(node.topic.id) && (node.children?.length ?? 0) > 0 && node.topic.show_child_count !== false) {
        const sc: Record<string, number> = { top: 0, right: 0, bottom: 0, left: 0 }
        const ncx = node.x + node.width / 2, ncy = node.y + node.height / 2
        for (const ch of node.children ?? []) {
          const dx = (ch.x + ch.width / 2) - ncx
          const dy = (ch.y + ch.height / 2) - ncy
          if (Math.abs(dx) >= Math.abs(dy)) sc[dx >= 0 ? 'right' : 'left']++
          else sc[dy >= 0 ? 'bottom' : 'top']++
        }
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
           onEditCancel={onTopicEditCancel}
            onNotesClick={onTopicNotesClick}
            onCommentsClick={onTopicCommentsClick}
            onFoldToggle={onTopicFoldToggle}
            onExpandToggle={onTopicExpandToggle}
        />
      )
      ;(expandedTopicIds?.has(node.topic.id) || selSet.has(node.topic.id) ? topNodes : regularNodes).push(el)
      const childFolded = parentFolded || !!node.topic?.folded
      const fSides = node.topic?.folded_sides
      for (const child of (node.children || [])) {
        // Hide (without reflow) children on a folded side, plus their subtree.
        const sideHidden = !!fSides && fSides.includes(sideOf(node, child))
        renderNode(child, childFolded || sideHidden)
      }
    }

    if (root) {
      measure(root)
      collectEdges(root)
      renderNode(root)
    }

    // Floating subtrees: same edge + node rendering as the main tree, so a
    // detached node keeps its children (and registers positions for relationships).
    for (const fRoot of floatingRoots) {
      measure(fRoot)
      collectEdges(fRoot)
      renderNode(fRoot)
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

    return { edgeData: edges, nodeComponents: [...regularNodes, ...topNodes], nodePositions: positions, nodeShiftMap: shiftMap, childBadges: badges }
  }, [
    root, selSet, searchQuery, viewportRect, reorderTarget,
    dragOverTopicId, draggingTopicId, editingTopicId,
    onTopicSelect, onTopicDoubleClick, onTopicContextMenu,
    onTopicDragStart, onTopicDragOver, onTopicDrop,
    onTopicEditSave, onTopicEditCancel, onTopicCommentsClick, onTopicFoldToggle,
    expandedTopicIds, onTopicExpandToggle, floatingRoots,
  ])

  return (
    <g>
      {edgeData.map(e => (
        <path key={e.key} d={e.path} fill="none"
          stroke={e.color ?? theme.connection.stroke}
          strokeWidth={e.width ?? theme.connection.strokeWidth}
          opacity={theme.connection.opacity * e.opacity}
          strokeLinecap="round"
          strokeDasharray={e.dash === '0' ? undefined : e.dash}
          style={{ transition: 'opacity 0.25s ease' }}
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
      {(() => {
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
          // Side-aware: attach to the facing borders of the two node rects.
          const at = edgeAttachment(from, to)
          return (
            <RelationshipLine
              key={rel.id}
              relationship={rel}
              fromX={at.fromX}
              fromY={at.fromY}
              toX={at.toX}
              toY={at.toY}
              offsetIndex={offsetIndex}
              offsetCount={bundle.length}
            />
          )
        })
      })()}
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
