import { useCallback, useRef, useEffect, useState, memo } from 'react'
import { LumenFileText, LumenZap, LumenStar, LumenHeart, LumenFlag, LumenLightbulb, LumenTarget, LumenCrown, LumenBrain, LumenRocket, LumenCode, LumenBookmark, LumenClock, LumenCheckCircle, LumenCloud, LumenSun, LumenGlobe, LumenLock, LumenKey, LumenMusic, LumenCamera, LumenImage, LumenUser, LumenBot, LumenHome, LumenFlame } from '../UI/LumenIcon'
import { RichTextEditor, TOOLBAR_OFFSET } from '../RichTextEditor/RichTextEditor'
import type { LayoutNode, TopicStyle } from '../../types'
import { useThemeStore } from '../../store/theme'
import { useLayoutStore } from '../../store/layout'
import { colors, fonts, fontSizes, anim } from '../../styles/tokens'
import { kindDef } from './memoryKinds'
import { splitHeadBody, composeEditHtml } from './splitNodeText'
import { nodePad, BODY_FONT_SCALE, HEAD_LINE_HEIGHT, BODY_LINE_HEIGHT } from '../../renderer/measure'
import { resolveNodeFont } from '../../renderer/nodeFont'
import { shapePath, shapeTextInset } from '../../renderer/shapes'
import { resolveNodeSkin, nodeRole, roleStyle } from '../../renderer/memoryPackages'
import { childSideCounts } from '../../renderer/edgeVisuals'
import { NodePins } from './NodePins'
import { openTopicLink } from '../../utils/openTopicLink'

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
  onEditSave: (id: string, title: string, richText?: string, body?: string) => void
  onEditStyleRequest?: (id: string, title: string, richText?: string, body?: string) => void
  onEditCancel: () => void
  // Сообщает фактический размер узла в режиме правки — чтобы якоря (EdgeAnchorsLayer)
  // сидели на гранях расширенного узла, а не на исходном layout-прямоугольнике.
  onEditResize?: (id: string, width: number, height: number) => void
  onNotesClick?: (id: string, notes: string) => void
  onCommentsClick?: (id: string) => void
  onFoldToggle?: (id: string) => void
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
const aniFold = `${anim.dur.normal}ms ${anim.ease.standard}`

// Комфортный минимум редактора: маленький узел расширяется при входе в правку.
const MIN_EDIT_WIDTH = 220
const MIN_EDIT_HEIGHT = 44

// Внешний контур двойной обводки: масштаб от центра узла на ~4px по большей
// стороне — работает для любой формы, не требуя второго пути.
function doubleOutlineTransform(w: number, h: number): string {
  const s = 1 + 4 / Math.max(w, h, 1)
  const cx = w / 2
  const cy = h / 2
  return `translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})`
}

// Узкому узлу маркировка не влезает — рисуем её только когда есть место.
const MIN_WIDTH_FOR_CODE = 84

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
  onEditStyleRequest,
  onEditCancel,
  onEditResize,
  onNotesClick,
  onCommentsClick,
  onFoldToggle,
}: TopicNodeProps) {
  const { topic, x, y, width, height } = layout
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const dragFiredRef = useRef(false)
  const theme = useThemeStore(s => s.theme)
  const [richEditValue, setRichEditValue] = useState('')
  const [richEditReady, setRichEditReady] = useState(false)
  // Фактическая высота текста в редакторе — узел растёт при наборе.
  const [editContentH, setEditContentH] = useState(0)

  useEffect(() => {
    if (isEditing) {
      setRichEditValue(composeEditHtml(topic))
      setRichEditReady(true)
    } else {
      setRichEditReady(false)
      setEditContentH(0)
    }
  }, [isEditing, topic])

  const defNodePadding = useLayoutStore(s => s.nodePadding)
  const defFontSize = useLayoutStore(s => s.fontSize)

  const baseStyle: TopicStyle = isRoot ? theme.rootTopic : theme.topic
  // Шрифт берём тем же резолвером, что и раскладка: иначе коробка меряется
  // одним начертанием, а текст рисуется другим и вылезает за корпус.
  const nodeFont = resolveNodeFont(topic, defFontSize || baseStyle.fontSize)
  const customFontSize = nodeFont.size
  const customFontColor = topic.font_color || baseStyle.textColor
  const customFontFamily = nodeFont.family
  const customFontWeight = nodeFont.weight
  const customTextAlign = topic.text_align || 'center'
  const { padH, padV } = nodePad(topic.padding ?? defNodePadding)
  const customOpacity = parentFolded ? 0 : (topic.opacity ?? 1)

  // Корпус вида памяти + роль узла в дереве. Явные настройки пользователя
  // всегда важнее корпуса — оформление остаётся свободным.
  const childCount = layout.children?.length ?? 0
  const skin = resolveNodeSkin({
    memoryKind: topic.memory_kind,
    shape: topic.shape,
    borderColor: topic.border_color,
    borderWidth: topic.border_width,
    nodeStyle: topic.node_style,
    childCount,
    isRoot,
    baseStrokeWidth: isRoot ? 2 : 1.5,
  })
  const customBorderWidth = skin.strokeWidth
  const role = nodeRole(childCount, isRoot)
  const rStyle = roleStyle(role)

  // Обратная связь взаимодействия (выделение, drop-target) главнее корпуса:
  // пользователь должен видеть, с чем работает прямо сейчас.
  const fillColor = (() => {
    if (isDragOver) return baseStyle.selectedGradient || baseStyle.selectedFill || colors.accentLight
    if (isSelected) return baseStyle.selectedGradient || baseStyle.selectedFill || colors.fill
    if (skin.fill) return skin.fill
    const style = topic.node_style || 'gradient'
    if (style === 'glass') return colors.white + '8c'
    if (style === 'outline') return 'transparent'
    if (style === 'solid') return baseStyle.fill
    return baseStyle.gradient || baseStyle.fill
  })()

  // Цвет рамки: явный выбор пользователя → обратная связь взаимодействия →
  // цвет корпуса вида памяти → тема.
  const strokeColor = topic.border_color || ((isDragOver || isSelected)
    ? (baseStyle.selectedStroke ?? colors.accent)
    : (skin.stroke || baseStyle.stroke || colors.separator))

  const shape = skin.shape

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

  // Сохранение: единый поток текста из редактора разбивается на голову
  // (title/rich_text) и тело (body) — длинный текст уходит в тело узла.
  const handleRichSave = useCallback((html: string) => {
    const { title, richText, body } = splitHeadBody(html)
    onEditSave(topic.id, title, richText, body)
  }, [topic.id, onEditSave])
  const handleRichStyleRequest = useCallback((html: string) => {
    const { title, richText, body } = splitHeadBody(html)
    if (onEditStyleRequest) onEditStyleRequest(topic.id, title, richText, body)
    else onEditSave(topic.id, title, richText, body)
  }, [topic.id, onEditSave, onEditStyleRequest])
  const handleRichChange = useCallback((html: string) => {
    setRichEditValue(html)
  }, [])
  const handleEditorResize = useCallback((h: number) => {
    setEditContentH(h)
  }, [])
  const hasRichText = !!(topic.rich_text && topic.rich_text !== topic.title)
  const hasImage = !!topic.image
  const hasBody = !!topic.body
  const bodyFontSize = Math.max(10, Math.round(customFontSize * BODY_FONT_SCALE))

  // Размеры в режиме правки: шрифт не уменьшается — растёт сам узел.
  const editWidth = Math.max(width, MIN_EDIT_WIDTH)
  const editHeight = Math.max(MIN_EDIT_HEIGHT, height, editContentH + 8)

  // Транслируем размер редактируемого узла наверх, чтобы якоря легли на грани.
  useEffect(() => {
    if (isEditing) onEditResize?.(topic.id, editWidth, editHeight)
  }, [isEditing, editWidth, editHeight, topic.id, onEditResize])

  // Контур формы и текстовая врезка: у ромба/эллипса текст живёт в середине.
  const boxW = isEditing ? editWidth : width
  const boxH = isEditing ? editHeight : height
  const shapeOutline = shapePath(shape, boxW, boxH, baseStyle.borderRadius)
  const textBox = shapeTextInset(shape, width, height)

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
      <title>{topic.body ? `${topic.title}\n\n${topic.body}` : topic.title}</title>

      {/* Glass node: additional backdrop layer, same outline as the shape */}
      {topic.node_style === 'glass' && (
        <path
          d={shapeOutline}
          fill={colors.white + '26'}
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        />
      )}

      {/* Выводы: узел-ветвление отличается от листа силуэтом, а не подписью */}
      {rStyle.pins && !isEditing && (
        <NodePins
          width={width}
          height={height}
          counts={childSideCounts(layout)}
          foldedSides={topic.folded_sides}
          color={strokeColor}
          length={rStyle.pinLength}
          strokeWidth={Math.max(1, customBorderWidth * 0.9)}
        />
      )}

      {/* Двойная обводка мета-корпуса — внешний контур, отмасштабированный от центра */}
      {skin.outline === 'double' && (
        <path
          d={shapeOutline}
          fill="none"
          stroke={strokeColor}
          strokeWidth={Math.max(1, customBorderWidth * 0.7)}
          opacity={0.5}
          transform={doubleOutlineTransform(boxW, boxH)}
          pointerEvents="none"
        />
      )}

      {/* Форма узла — единый контур из реестра форм */}
      <path
        d={shapeOutline}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={customBorderWidth}
        strokeDasharray={skin.dashArray}
        filter={shadowFilter}
      />

      {/* Маркировка корпуса: точка вида памяти + короткий код, как на чипе. */}
      {(() => {
        const kd = kindDef(topic.memory_kind)
        if (!kd || isEditing) return null
        const showCode = !!skin.code && width >= MIN_WIDTH_FOR_CODE
        return (
          <g pointerEvents="none">
            <circle cx={7} cy={7} r={4} fill={kd.color} stroke={colors.white} strokeWidth={1}>
              <title>{kd.icon} {kd.label}</title>
            </circle>
            {showCode && (
              <text
                x={14} y={10}
                fontSize={7}
                fontFamily={fonts.mono}
                fill={kd.color}
                opacity={0.75}
                style={{ userSelect: 'none' }}
              >
                {skin.code}
              </text>
            )}
          </g>
        )
      })()}

      {/* Inline editing — узел растёт под текст, тулбар плавает над узлом */}
      {isEditing && richEditReady ? (
        <foreignObject
          x={0}
          y={-TOOLBAR_OFFSET}
          width={editWidth}
          height={editHeight + TOOLBAR_OFFSET}
          style={{ overflow: 'visible' }}
        >
          <RichTextEditor
            value={richEditValue}
            onChange={handleRichChange}
            onSave={handleRichSave}
            onStyleRequest={handleRichStyleRequest}
            onCancel={onEditCancel}
            onResize={handleEditorResize}
            fontSize={customFontSize}
            fontFamily={customFontFamily}
            fontColor={customFontColor}
            textAlign={customTextAlign}
            minHeight={MIN_EDIT_HEIGHT - 8}
          />
        </foreignObject>
      ) : (
        <foreignObject
          x={textBox.x + padH}
          y={textBox.y + padV}
          width={Math.max(1, textBox.w - padH * 2)}
          height={Math.max(1, textBox.h - padV * 2)}
        >
          {/* Голова (заголовок) + опциональное тело (длинный текст) */}
          <div style={{
            width: '100%', height: '100%', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            justifyContent: hasBody || hasImage ? 'flex-start' : 'center',
            userSelect: 'none', WebkitUserSelect: 'none',
          }}>
            {topic.image && (
              <img src={topic.image} alt=""
                style={{
                  maxWidth: '100%', maxHeight: 52,
                  objectFit: 'contain', borderRadius: 4, flexShrink: 0,
                  display: 'block', margin: '0 auto 4px',
                }}
              />
            )}
            <div style={{
              fontSize: customFontSize, fontFamily: customFontFamily,
              color: customFontColor, fontWeight: customFontWeight,
              textAlign: customTextAlign as any, lineHeight: HEAD_LINE_HEIGHT,
              wordBreak: 'break-word', overflowWrap: 'break-word', flexShrink: 0,
            }}>
              {hasRichText
                ? <span dangerouslySetInnerHTML={{ __html: topic.rich_text! }} />
                : renderTitleHTML()}
            </div>
            {hasBody && (
              <div style={{
                marginTop: 4, paddingTop: 5,
                borderTop: `1px solid ${colors.separator}`,
                fontSize: bodyFontSize, fontFamily: customFontFamily,
                color: customFontColor, opacity: 0.78, fontWeight: 400,
                textAlign: 'left', lineHeight: BODY_LINE_HEIGHT,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', overflowWrap: 'break-word',
              }}>
                {topic.body}
              </div>
            )}
          </div>
        </foreignObject>
      )}

      {/* Node icon — outside left, styled as interface badge */}
      {topic.icon && ICON_MAP[topic.icon] && !isEditing && (
        <g
          transform={`translate(${-9}, ${height / 2})`}
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
          transform={`translate(${-NOTE_ICON_SIZE - 6}, ${height / 2 - NOTE_ICON_SIZE / 2})`}
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
          transform={`translate(${width - NOTE_ICON_SIZE * 2 - 8}, ${4})`}
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
          transform={`translate(${width - NOTE_ICON_SIZE - 4}, ${height - NOTE_ICON_SIZE - 4})`}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            // Документ проекта открывается картой, внешний адрес — как ссылка.
            void openTopicLink(topic.hyperlink!)
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

      {/* Total child-count badge removed from the node: per-direction badges
          (renderer) show counts; the total lives in the Properties panel. */}

      {/* Markers */}
      {topic.markers && topic.markers.length > 0 && (
        <text x={width / 2} y={-6} textAnchor="middle" fontSize={fontSizes.subhead}>
          {topic.markers.join(' ')}
        </text>
      )}

      {/* Labels */}
      {topic.labels && topic.labels.length > 0 && (
        <text
          x={width / 2}
          y={height + 10}
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
        <g transform={`translate(2, ${height - 4})`}>
          <rect x={0} y={0} width={width - 4} height={3} rx={1.5} fill={colors.separator} />
          <rect x={0} y={0} width={(width - 4) * Math.min(topic.progress / 100, 1)} height={3} rx={1.5} fill={colors.accent} />
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
    && prev.onCommentsClick === next.onCommentsClick
})
