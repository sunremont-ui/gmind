import { useCallback, useRef, useEffect, useState, memo } from 'react'
import { LumenFileText, LumenZap, LumenStar, LumenHeart, LumenFlag, LumenLightbulb, LumenTarget, LumenCrown, LumenBrain, LumenRocket, LumenCode, LumenBookmark, LumenClock, LumenCheckCircle, LumenCloud, LumenSun, LumenGlobe, LumenLock, LumenKey, LumenMusic, LumenCamera, LumenImage, LumenUser, LumenBot, LumenHome, LumenFlame } from '../UI/LumenIcon'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import type { LayoutNode, TopicStyle } from '../../types'
import { useThemeStore } from '../../store/theme'
import { useLayoutStore } from '../../store/layout'
import { colors, fonts, fontSizes, fontWeights as fw, anim } from '../../styles/tokens'

interface TopicNodeProps {
  layout: LayoutNode
  isSelected: boolean
  isDragOver: boolean
  isDragging: boolean
  isRoot: boolean
  isEditing: boolean
  searchQuery: string
  hidden?: boolean
  parentFolded?: boolean
  shiftY?: number
  onSelect: (id: string, e: React.MouseEvent) => void
  onDoubleClick: (id: string) => void
  onContextMenu: (id: string, x: number, y: number) => void
  onDragStart: (id: string, x: number, y: number) => void
  onDragOver: (id: string) => void
  onDrop: (targetId: string) => void
  onEditSave: (id: string, title: string, richText?: string) => void
  onEditCancel: () => void
  onNotesClick?: (id: string, notes: string) => void
  onCommentsClick?: (id: string) => void
  onFoldToggle?: (id: string) => void
  onExpandToggle?: (id: string, expanded: boolean) => void
}

const NOTE_ICON_SIZE = 14

import type { IconProps } from '../UI/LumenIcon'

const ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  Star: LumenStar, Heart: LumenHeart, Flag: LumenFlag, Lightbulb: LumenLightbulb,
  Target: LumenTarget, Crown: LumenCrown, Brain: LumenBrain, Rocket: LumenRocket,
  Code: LumenCode, Bookmark: LumenBookmark, Zap: LumenZap, Clock: LumenClock,
  CheckCircle: LumenCheckCircle, Cloud: LumenCloud, Sun: LumenSun, Globe: LumenGlobe,
  Lock: LumenLock, Key: LumenKey, Music: LumenMusic, Camera: LumenCamera,
  Image: LumenImage, User: LumenUser, Bot: LumenBot, Home: LumenHome, Flame: LumenFlame,
}

function getShapePath(shape: string | undefined, w: number, h: number, r: number): { rx: number; ry: number } {
  switch (shape) {
    case 'rectangle': return { rx: 0, ry: 0 }
    case 'pill': return { rx: h / 2, ry: h / 2 }
    case 'diamond': return { rx: 0, ry: 0 }
    case 'cloud': return { rx: r, ry: r }
    default: return { rx: r, ry: r }
  }
}

function getShadowFilter(shadowType: string | undefined, isSelected: boolean): string | undefined {
  if (isSelected) return 'url(#topic-shadow)'
  switch (shadowType) {
    case 'soft': return 'url(#shadow-soft)'
    case 'medium': return 'url(#shadow-medium)'
    case 'strong': return 'url(#shadow-strong)'
    default: return 'url(#shadow-soft)'
  }
}

// ─── Animation presets (tweak these) ──────────────────
const aniExpand = `${anim.dur.short}ms ${anim.ease.decelerated}`
const aniFold = `${anim.dur.normal}ms ${anim.ease.standard}`
const aniChevron = `${anim.dur.short}ms ${anim.ease.standard}`

export const TopicNode = memo(function TopicNode({
  layout,
  isSelected,
  isDragOver,
  isDragging,
  isRoot,
  isEditing,
  searchQuery,
  hidden,
  parentFolded,
  shiftY = 0,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onEditSave,
  onEditCancel,
  onNotesClick,
  onCommentsClick,
  onFoldToggle,
  onExpandToggle,
}: TopicNodeProps) {
  const { topic, x, y, width, height } = layout
  const childCount = topic.children?.length ?? 0
  const hasChildren = childCount > 0
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const dragFiredRef = useRef(false)
  const theme = useThemeStore(s => s.theme)
  const [richEditValue, setRichEditValue] = useState('')
  const richEditInit = useRef(false)

  useEffect(() => {
    if (isEditing && !richEditInit.current) {
      setRichEditValue(topic.rich_text || topic.title)
      richEditInit.current = true
    }
    if (!isEditing) {
      richEditInit.current = false
    }
  }, [isEditing, topic.rich_text, topic.title])

  const defNodePadding = useLayoutStore(s => s.nodePadding)
  const defMaxChars = useLayoutStore(s => s.maxChars)
  const defFontSize = useLayoutStore(s => s.fontSize)

  const baseStyle: TopicStyle = isRoot ? theme.rootTopic : theme.topic
  const customFontSize = topic.font_size || defFontSize || baseStyle.fontSize
  const customFontColor = topic.font_color || baseStyle.textColor
  const customFontFamily = topic.font_family || baseStyle.fontFamily || fonts.ui
  const customFontWeight = topic.font_weight || fw.medium
  const customTextAlign = topic.text_align || 'center'
  const customWidth = topic.node_width ? Math.max(60, Math.min(300, topic.node_width)) : width
  const customHeight = topic.node_height ? Math.max(28, Math.min(120, topic.node_height)) : height
  const customPadding = topic.padding ?? defNodePadding
  const multilinePadding = customPadding * 0.98
  const customBorderWidth = topic.border_width ?? (isRoot ? 2 : 1.5)
  const customOpacity = parentFolded ? 0 : (topic.opacity ?? 1)

  const userBorderColor = topic.border_color
  const fillColor = (() => {
    if (isDragOver) return baseStyle.selectedGradient || baseStyle.selectedFill || colors.accentLight
    if (isSelected) return baseStyle.selectedGradient || baseStyle.selectedFill || colors.fill
    const style = topic.node_style || 'gradient'
    if (style === 'glass') return colors.white + '8c'
    if (style === 'outline') return 'transparent'
    if (style === 'solid') return baseStyle.fill
    return baseStyle.gradient || baseStyle.fill
  })()

  const strokeColor = userBorderColor || (isDragOver
    ? (baseStyle.selectedStroke ?? colors.accent)
    : isSelected
      ? (baseStyle.selectedStroke ?? colors.accent)
      : (baseStyle.stroke || colors.separator))

  const shape = topic.shape || 'rounded'
  const { rx, ry } = getShapePath(shape, customWidth, customHeight, baseStyle.borderRadius)

  const shadowType = topic.shadow_type || 'soft'
  const shadowFilter = getShadowFilter(isSelected ? undefined : shadowType, isSelected)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditing) return
      const pos = { x: e.clientX, y: e.clientY }
      dragStartPos.current = pos
      longPressTimer.current = setTimeout(() => {
        if (dragStartPos.current) {
          dragFiredRef.current = true
          onDragStart(topic.id, e.clientX, e.clientY)
        }
      }, 1000)
    },
    [topic.id, onDragStart, isEditing],
  )

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    dragStartPos.current = null
  }, [])

  const handleSelect = useCallback((e: React.MouseEvent) => {
    if (dragFiredRef.current) {
      dragFiredRef.current = false
      return
    }
    onSelect(topic.id, e)
  }, [topic.id, onSelect])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onContextMenu(topic.id, e.clientX, e.clientY)
    },
    [topic.id, onContextMenu],
  )

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim()
  const handleRichSave = useCallback((html: string) => {
    const plain = stripHtml(html)
    onEditSave(topic.id, plain || '(empty)', html)
  }, [topic.id, onEditSave])
  const handleRichChange = useCallback((html: string) => {
    setRichEditValue(html)
  }, [])
  const hasRichText = !!(topic.rich_text && topic.rich_text !== topic.title)
  const hasImage = !!topic.image

  const multilineFontSize = (() => {
    const len = topic.title.length
    if (len <= defMaxChars) return customFontSize
    const estimatedLines = Math.ceil(len / defMaxChars)
    const scale = Math.pow(0.985, estimatedLines - 1)
    return Math.max(8, Math.round(customFontSize * scale))
  })()

  const editPlainLen = stripHtml(richEditValue).length
  const editEstimatedLines = Math.max(1, Math.ceil(editPlainLen / Math.max(1, defMaxChars)))
  const editFontSize = (() => {
    if (editPlainLen <= defMaxChars) return customFontSize
    const scale = Math.pow(0.985, editEstimatedLines - 1)
    return Math.max(8, Math.round(customFontSize * scale))
  })()
  const editExpandedHeight = Math.min(400, Math.max(customHeight, editEstimatedLines * editFontSize * 1.4 + 28))

  const renderTitleHTML = () => {
    if (!searchQuery) return topic.title
    const idx = topic.title.toLowerCase().indexOf(searchQuery.toLowerCase())
    if (idx === -1) return topic.title
    return (
      <>
        {topic.title.slice(0, idx)}
        <span style={{ background: colors.yellow, fontWeight: 'bold', color: '#000' }}>
          {topic.title.slice(idx, idx + searchQuery.length)}
        </span>
        {topic.title.slice(idx + searchQuery.length)}
      </>
    )
  }

  const hasNotes = !!topic.notes
  const showCount = topic.show_child_count !== false && hasChildren
  const [expanded, setExpanded] = useState(false)
  const handleToggleExpanded = useCallback(() => {
    const next = !expanded
    setExpanded(next)
    onExpandToggle?.(topic.id, next)
  }, [expanded, topic.id, onExpandToggle])
  const textLen = topic.title.length
  const estimatedTextLines = Math.max(1, Math.ceil(textLen / defMaxChars))
  const textOverflows = !expanded && estimatedTextLines > 1 && (estimatedTextLines * multilineFontSize * 1.3) > customHeight - customPadding * 2
  const expandedHeight = expanded ? Math.min(400, Math.max(customHeight, estimatedTextLines * multilineFontSize * 1.3 + customPadding * 2)) : customHeight

  return (
    <g
      style={{
        transform: `translate(${x}px, ${y + shiftY}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : customOpacity,
        visibility: (!parentFolded && hidden) ? 'hidden' as any : 'visible' as any,
        pointerEvents: parentFolded ? 'none' as any : undefined,
        transformOrigin: '0 0',
        transition: `transform ${aniFold}, opacity ${aniFold}`,
      }}
      onClick={handleSelect}
      onDoubleClick={() => onDoubleClick(topic.id)}
      onContextMenu={handleContextMenu}
      data-topic-id={topic.id}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerUpCapture={handlePointerUp}
      onMouseDown={e => e.stopPropagation()}
    >
      <title>{topic.title}</title>

      {/* Glass node: additional backdrop rect */}
      {topic.node_style === 'glass' && (
        <rect
          x={0} y={0}
          width={customWidth} height={isEditing ? editExpandedHeight : customHeight}
          rx={rx} ry={ry}
          fill={colors.white + '26'}
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', transition: `height ${aniExpand}` }}
        />
      )}

      {/* Diamond shape uses rotated rect */}
      {shape === 'diamond' ? (
        <g transform={`translate(${customWidth / 2}, ${customHeight / 2}) rotate(45) translate(${-customWidth / 2}, ${-customHeight / 2})`}>
          <rect
            x={0} y={0}
            width={customWidth} height={customHeight}
            rx={rx} ry={ry}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={customBorderWidth}
            filter={shadowFilter}
          />
        </g>
      ) : shape === 'cloud' ? (
        <path
          d={`M${customWidth * 0.2} ${customHeight}
             C${-customWidth * 0.15} ${customHeight * 0.85}, ${-customWidth * 0.1} ${customHeight * 0.15}, ${customWidth * 0.25} ${customHeight * 0.15}
             C${customWidth * 0.25} ${-customHeight * 0.2}, ${customWidth * 0.75} ${-customHeight * 0.2}, ${customWidth * 0.8} ${customHeight * 0.15}
             C${customWidth * 1.15} ${customHeight * 0.1}, ${customWidth * 1.2} ${customHeight * 0.85}, ${customWidth * 0.8} ${customHeight}
             Z`}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={customBorderWidth}
          filter={shadowFilter}
        />
      ) : (
        <rect
          x={0} y={0}
          width={customWidth} height={isEditing ? editExpandedHeight : expanded ? expandedHeight : customHeight}
          rx={rx} ry={ry}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={customBorderWidth}
          filter={shadowFilter}
          style={{ transition: `height ${aniExpand}` }}
        />
      )}

      {/* Inline editing — auto-grows with text */}
      {isEditing ? (
        <foreignObject x={0} y={0} width={customWidth} height={editExpandedHeight} style={{ transition: `height ${aniExpand}` }}>
          <RichTextEditor
            value={richEditValue}
            onChange={handleRichChange}
            onSave={handleRichSave}
            onCancel={onEditCancel}
            fontSize={editFontSize}
            fontFamily={customFontFamily}
            fontColor={customFontColor}
            textAlign={customTextAlign}
          />
        </foreignObject>
      ) : hasRichText || hasImage ? (
        <foreignObject
          x={customPadding}
          y={customPadding}
          width={customWidth - customPadding * 2}
          height={customHeight - customPadding * 2}
          style={{ transition: `height ${aniExpand}` }}
        >
          <div style={{
            width: '100%', height: '100%', overflow: 'hidden',
            fontSize: customFontSize, fontFamily: customFontFamily,
            color: customFontColor, fontWeight: customFontWeight,
            textAlign: customTextAlign as any, lineHeight: 1.3,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4,
          }}>
            {topic.image && (
              <img src={topic.image} alt=""
                style={{
                  maxWidth: '100%', maxHeight: hasRichText ? '60%' : '100%',
                  objectFit: 'contain', borderRadius: 4, flexShrink: 0,
                  display: 'block',
                }}
              />
            )}
            {hasRichText ? (
              <div dangerouslySetInnerHTML={{ __html: topic.rich_text! }}
                style={{ flexShrink: 0, lineHeight: 1.3 }} />
            ) : topic.title ? (
              <span>{topic.title}</span>
            ) : null}
          </div>
        </foreignObject>
      ) : (
        <foreignObject
          x={customPadding}
          y={expanded || textOverflows ? multilinePadding : 0}
          width={customWidth - customPadding * 2}
          height={expanded || textOverflows ? expandedHeight - multilinePadding * 2 : customHeight}
          style={{ transition: `height ${aniExpand}` }}
        >
          <div style={{
            width: '100%', height: expanded ? 'auto' : '100%',
            overflow: expanded ? 'visible' : 'hidden',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: expanded || textOverflows ? 'flex-start' : 'center',
            fontSize: multilineFontSize, fontFamily: customFontFamily,
            color: customFontColor, fontWeight: customFontWeight,
            textAlign: customTextAlign as any, lineHeight: 1.3,
            wordBreak: 'break-word', overflowWrap: 'break-word',
          }}>
            <div style={{ flexShrink: 0 }}>{renderTitleHTML()}</div>
          </div>
        </foreignObject>
      )}

      {/* Expand/collapse chevron — centered below node */}
      {(textOverflows || expanded) && !isEditing && (
        <g
          style={{
            transform: `translate(${customWidth / 2}px, ${(expanded ? expandedHeight : customHeight) + 6 - customHeight * 0.05}px)`,
            cursor: 'pointer',
            transition: `transform ${aniChevron}`,
          }}
          onClick={(e) => { e.stopPropagation(); handleToggleExpanded() }}
          >
            <rect x={-37} y={-4} width={84} height={24} rx={8} fill="transparent" pointerEvents="all" />
            <g
              style={{
                transform: `rotate(${expanded ? 180 : 0}deg)`,
                transformOrigin: '5px 7px',
                transformBox: 'fill-box',
                transition: `transform ${aniChevron}`,
              }}
            >
              <polyline points="-15,3 5,11 25,3" fill="none" stroke={strokeColor} strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
          </g>
        </g>
      )}

      {/* Node icon — outside left, styled as interface badge */}
      {topic.icon && ICON_MAP[topic.icon] && !isEditing && (
        <g
          transform={`translate(${-9}, ${customHeight / 2})`}
          style={{ cursor: 'pointer' }}
        >
          <rect x={-9} y={-9} width={18} height={18} rx={6} ry={6} fill={strokeColor} opacity={0.12} />
          <foreignObject x={-9} y={-9} width={18} height={18}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(() => { const Icon = ICON_MAP[topic.icon]; return <Icon size={16} color={strokeColor} strokeWidth={1.8} /> })()}
            </div>
          </foreignObject>
        </g>
      )}

      {/* Comments indicator — shows only when topic has comments, positioned left of node */}
      {(topic.comment_count ?? 0) > 0 && !isEditing && (
        <g
          transform={`translate(${-NOTE_ICON_SIZE - 6}, ${customHeight / 2 - NOTE_ICON_SIZE / 2})`}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            onCommentsClick?.(topic.id)
          }}
        >
          <rect x={-2} y={-2} width={NOTE_ICON_SIZE + 4} height={NOTE_ICON_SIZE + 4} rx={5}
            fill={colors.accent} opacity={0.15} />
          <rect x={-2} y={-2} width={NOTE_ICON_SIZE + 4} height={NOTE_ICON_SIZE + 4} rx={5}
            fill="none" stroke={colors.accent} strokeWidth={0.8} opacity={0.5} />
          <foreignObject width={NOTE_ICON_SIZE} height={NOTE_ICON_SIZE}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 9 }}>{topic.comment_icon || '💬'}</div>
          </foreignObject>
        </g>
      )}

      {/* Note indicator */}
      {hasNotes && !isEditing && (
        <g
          transform={`translate(${customWidth - NOTE_ICON_SIZE * 2 - 8}, ${4})`}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            onNotesClick?.(topic.id, topic.notes || '')
          }}
        >
          <rect x={-2} y={-2} width={NOTE_ICON_SIZE + 4} height={NOTE_ICON_SIZE + 4} rx={5}
            fill={colors.accent} opacity={0.15} />
          <rect x={-2} y={-2} width={NOTE_ICON_SIZE + 4} height={NOTE_ICON_SIZE + 4} rx={5}
            fill="none" stroke={colors.accent} strokeWidth={0.8} opacity={0.5} />
          <foreignObject width={NOTE_ICON_SIZE} height={NOTE_ICON_SIZE}>
            <LumenFileText size={NOTE_ICON_SIZE} color={colors.accent} />
          </foreignObject>
        </g>
      )}

      {/* Hyperlink indicator */}
      {topic.hyperlink && !isEditing && (
        <g
          transform={`translate(${customWidth - NOTE_ICON_SIZE - 4}, ${customHeight - NOTE_ICON_SIZE - 4})`}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            window.open(topic.hyperlink, '_blank', 'noopener,noreferrer')
          }}
        >
          <rect x={-2} y={-2} width={NOTE_ICON_SIZE + 4} height={NOTE_ICON_SIZE + 4} rx={5}
            fill={colors.purple} opacity={0.15} />
          <rect x={-2} y={-2} width={NOTE_ICON_SIZE + 4} height={NOTE_ICON_SIZE + 4} rx={5}
            fill="none" stroke={colors.purple} strokeWidth={0.8} opacity={0.5} />
          <foreignObject width={NOTE_ICON_SIZE} height={NOTE_ICON_SIZE}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 9 }}>🔗</div>
          </foreignObject>
          <title>{topic.hyperlink}</title>
        </g>
      )}

      {/* Child count badge — clickable for fold/unfold */}
      {hasChildren && showCount && !isEditing && (
        <g transform={`translate(${customWidth + 1}, ${customHeight / 2})`} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onFoldToggle?.(topic.id) }}>
          <circle cx={0} cy={0} r={8} fill={colors.accent} opacity={0.92} />
          <circle cx={0} cy={0} r={8} fill="none" stroke={colors.white} strokeWidth={1} opacity={0.4} />
          <text x={0} y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill={colors.textInverse} style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {childCount}
          </text>
        </g>
      )}

      {/* Markers */}
      {topic.markers && topic.markers.length > 0 && (
        <text x={customWidth / 2} y={-6} textAnchor="middle" fontSize={fontSizes.subhead}>
          {topic.markers.join(' ')}
        </text>
      )}

      {/* Labels */}
      {topic.labels && topic.labels.length > 0 && (
        <text
          x={customWidth / 2}
          y={customHeight + 10}
          textAnchor="middle"
          fontSize={9}
          fill={colors.textTertiary}
          fontFamily={fonts.ui}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {topic.labels.map(l => l.length > 3 ? l.slice(0, 3) : l).join(' · ')}
        </text>
      )}

      {/* Progress bar */}
      {topic.progress !== undefined && topic.progress > 0 && (
        <g transform={`translate(2, ${customHeight - 4})`}>
          <rect x={0} y={0} width={customWidth - 4} height={3} rx={1.5} fill={colors.separator} />
          <rect x={0} y={0} width={(customWidth - 4) * Math.min(topic.progress / 100, 1)} height={3} rx={1.5} fill={colors.accent} />
        </g>
      )}
    </g>
  )
}, (prev, next) => {
  return prev.layout === next.layout
    && prev.isSelected === next.isSelected
    && prev.isDragOver === next.isDragOver
    && prev.isDragging === next.isDragging
    && prev.isEditing === next.isEditing
    && prev.hidden === next.hidden
    && prev.parentFolded === next.parentFolded
    && prev.isRoot === next.isRoot
    && prev.searchQuery === next.searchQuery
    && prev.shiftY === next.shiftY
    && prev.onFoldToggle === next.onFoldToggle
    && prev.onExpandToggle === next.onExpandToggle
    && prev.onCommentsClick === next.onCommentsClick
})
