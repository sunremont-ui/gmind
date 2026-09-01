// Палитра визуальных компонентов — каталог заготовок для холста.
//
// Клик по компоненту кладёт его на холст: под выделенный узел, а если ничего не
// выделено — под корень. Выделенный узел можно сохранить как свой компонент,
// поэтому библиотека наполняется прямо в работе.
import { useState } from 'react'
import {
  COMPONENT_CATEGORIES,
  componentsByCategory,
  componentShape,
  componentColor,
  componentNodeCount,
  componentFromTopic,
  isBuiltinComponent,
  validateComponent,
  type ComponentCategory,
  type ComponentNodeSpec,
  type VisualComponent,
} from '../../renderer/componentLibrary'
import { shapePath } from '../../renderer/shapes'
import { useComponentLibraryStore } from '../../store/componentLibrary'
import { useMindMapStore } from '../../store/mindmap'
import { api } from '../../api/client'
import type { ModulePanelProps } from '../../modules/types'
import { LumenX, LumenPlus } from '../UI/LumenIcon'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, transitions } from '../../styles/tokens'

export function ComponentLibraryPanel({ workbookId, onClose }: ModulePanelProps) {
  const custom = useComponentLibraryStore(s => s.custom)
  const saveComponent = useComponentLibraryStore(s => s.saveComponent)
  const removeComponent = useComponentLibraryStore(s => s.removeComponent)

  const workbook = useMindMapStore(s => s.workbook)
  const activeSheetId = useMindMapStore(s => s.activeSheetId)
  const selectedTopicId = useMindMapStore(s => s.selectedTopicId)
  const getTopic = useMindMapStore(s => s.getTopic)
  const setWorkbook = useMindMapStore(s => s.setWorkbook)

  const [category, setCategory] = useState<ComponentCategory>('memory')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ownLabel, setOwnLabel] = useState('')

  const sheet = workbook?.sheets.find(s => s.id === activeSheetId) ?? workbook?.sheets[0]
  const selected = selectedTopicId ? getTopic(selectedTopicId) : null
  // Куда ляжет компонент: под выделенный узел, иначе под корень листа.
  const parentId = selectedTopicId ?? sheet?.root_topic.id ?? null
  const parentTitle = selected?.title ?? sheet?.root_topic.title ?? '—'

  const insert = async (c: VisualComponent) => {
    if (!workbookId || !parentId) return
    setBusy(c.id)
    setNotice(null)
    try {
      await api.importTopicTree(workbookId, parentId, specToTree(c.spec))
      const wb = await api.getWorkbook(workbookId)
      setWorkbook(wb)
      setNotice(`«${c.label}» добавлен под «${parentTitle}»`)
    } catch (err: unknown) {
      setNotice(`Не удалось вставить: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const saveSelectionAsComponent = () => {
    if (!selected) return
    const label = ownLabel.trim() || selected.title
    const c = componentFromTopic(selected, label, category)
    const err = validateComponent(c)
    if (err) {
      setNotice(err)
      return
    }
    saveComponent(c)
    setOwnLabel('')
    setNotice(`Сохранён свой компонент «${label}» (${componentNodeCount(c.spec)} узл.)`)
  }

  const items = componentsByCategory(category)

  return (
    <div style={panel}>
      <div style={header}>
        <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>
          🧩 Компоненты
        </span>
        <button onClick={onClose} style={iconBtn} title="Закрыть">
          <LumenX size={16} color={colors.textSecondary} />
        </button>
      </div>

      {/* Куда вставляем */}
      <div style={{ padding: `${spacing.sm}px ${spacing.xl}px`, borderBottom: `1px solid ${colors.separator}` }}>
        <div style={label}>Вставить под</div>
        <div style={{ fontSize: fontSizes.caption, color: parentId ? colors.text : colors.textTertiary }}>
          {parentId ? parentTitle : 'откройте карту'}
          {!selectedTopicId && parentId && (
            <span style={{ color: colors.textTertiary }}> (корень — выделите узел, чтобы вставить в него)</span>
          )}
        </div>
      </div>

      {/* Категории */}
      <div style={{ display: 'flex', gap: 2, padding: `${spacing.sm}px ${spacing.xl}px 0`, flexWrap: 'wrap' }}>
        {COMPONENT_CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            style={{
              ...tabBtn,
              background: category === c.id ? colors.accentLight : 'transparent',
              color: category === c.id ? colors.accent : colors.textSecondary,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Сетка компонентов */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: spacing.xl }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
          {items.map(c => (
            <button
              key={c.id}
              onClick={() => insert(c)}
              disabled={!parentId || busy === c.id}
              title={c.hint}
              style={{
                ...card,
                borderColor: componentColor(c.spec) ? componentColor(c.spec)! + '66' : colors.separator,
                cursor: parentId ? 'pointer' : 'default',
              }}
            >
              <ComponentThumb spec={c.spec} />
              <span style={{ fontSize: fontSizes.caption, color: colors.text, textAlign: 'center' }}>
                {c.label}
              </span>
              <span style={{ fontSize: 9, color: colors.textTertiary }}>
                {componentNodeCount(c.spec) > 1 ? `${componentNodeCount(c.spec)} узлов` : '1 узел'}
                {!isBuiltinComponent(c.id) && ' · свой'}
              </span>
              {!isBuiltinComponent(c.id) && (
                <span
                  role="button"
                  aria-label="Удалить компонент"
                  onClick={e => { e.stopPropagation(); removeComponent(c.id) }}
                  style={{ position: 'absolute', top: 2, right: 4, fontSize: 10, color: colors.textTertiary }}
                >
                  ✕
                </span>
              )}
            </button>
          ))}
        </div>

        {items.length === 0 && (
          <div style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>
            В этой категории пока пусто.
          </div>
        )}
      </div>

      {/* Сохранить выделение как компонент */}
      <div style={{ padding: `${spacing.md}px ${spacing.xl}px`, borderTop: `1px solid ${colors.separator}` }}>
        <div style={label}>Сохранить выделенный узел</div>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <input
            value={ownLabel}
            onChange={e => setOwnLabel(e.target.value)}
            placeholder={selected ? selected.title : 'выделите узел на холсте'}
            disabled={!selected}
            style={input}
          />
          <button onClick={saveSelectionAsComponent} disabled={!selected} style={primaryBtn}>
            <LumenPlus size={12} color={colors.white} /> В библиотеку
          </button>
        </div>
        <div style={{ fontSize: 10, color: colors.textQuaternary, marginTop: spacing.xs }}>
          Узел сохраняется с оформлением, раскладкой и поддеревом — как заготовка,
          а не копия. Попадёт в категорию «{COMPONENT_CATEGORIES.find(c => c.id === category)?.label}».
          {custom.length > 0 && ` Своих компонентов: ${custom.length}.`}
        </div>
      </div>

      {notice && (
        <div style={{
          padding: `${spacing.sm}px ${spacing.xl}px`,
          borderTop: `1px solid ${colors.separator}`,
          fontSize: fontSizes.caption,
          color: colors.textSecondary,
          wordBreak: 'break-word',
        }}>
          {notice}
        </div>
      )}
    </div>
  )
}

/** Превью компонента: корпус головы и намёк на поддерево. */
function ComponentThumb({ spec }: { spec: ComponentNodeSpec }) {
  const w = 72
  const h = 28
  const color = componentColor(spec) ?? colors.textTertiary
  const kids = Math.min((spec.children ?? []).length, 4)

  return (
    <svg width={w + 10} height={h + 18} viewBox={`-5 -4 ${w + 10} ${h + 18}`} aria-hidden>
      <path
        d={shapePath(componentShape(spec), w, h, 7)}
        fill={color + '24'}
        stroke={color}
        strokeWidth={1.2}
      />
      {/* Дети — короткие штрихи вниз, как выводы корпуса */}
      {Array.from({ length: kids }).map((_, i) => {
        const x = (w * (i + 1)) / (kids + 1)
        return (
          <line
            key={i}
            x1={x} y1={h} x2={x} y2={h + 8}
            stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity={0.6}
          />
        )
      })}
    </svg>
  )
}

/** ComponentNodeSpec → дерево для api.importTopicTree (оформление идёт в meta). */
function specToTree(spec: ComponentNodeSpec): {
  title: string; body?: string; notes?: string; meta?: object; children: unknown[]
} {
  const meta: Record<string, unknown> = {}
  if (spec.memory_kind) meta.memory_kind = spec.memory_kind
  if (spec.shape) meta.shape = spec.shape
  if (spec.icon) meta.icon = spec.icon
  if (spec.border_color) meta.border_color = spec.border_color
  if (spec.node_style) meta.node_style = spec.node_style
  if (spec.structure_class) meta.structure_class = spec.structure_class

  return {
    title: spec.title,
    body: spec.body,
    notes: spec.notes,
    meta: Object.keys(meta).length ? meta : undefined,
    children: (spec.children ?? []).map(specToTree),
  }
}

const panel: React.CSSProperties = {
  width: 360,
  background: colors.bgTertiary,
  boxShadow: '-2px 0 24px rgba(15, 15, 25, 0.08), -1px 0 0 rgba(15,15,25,0.06)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontFamily: fonts.ui,
  overflow: 'hidden',
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing.md}px ${spacing.xl}px`,
  borderBottom: `1px solid ${colors.separator}`,
  flexShrink: 0,
}

const label: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: colors.textTertiary,
  marginBottom: spacing.xxs,
}

const card: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  padding: spacing.sm,
  background: 'transparent',
  border: `1px solid ${colors.separator}`,
  borderRadius: radii.md,
  transition: transitions.fast,
  fontFamily: fonts.ui,
}

const tabBtn: React.CSSProperties = {
  padding: `${spacing.xxs}px ${spacing.sm}px`,
  border: 'none',
  borderRadius: radii.sm,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  cursor: 'pointer',
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: spacing.xs,
  display: 'flex',
  alignItems: 'center',
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing.xxs,
  padding: `${spacing.xs}px ${spacing.md}px`,
  border: 'none',
  borderRadius: radii.sm,
  background: colors.accent,
  color: colors.white,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: `${spacing.xs}px ${spacing.sm}px`,
  border: `1px solid ${colors.separator}`,
  borderRadius: radii.sm,
  background: colors.bgSecondary,
  color: colors.text,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  outline: 'none',
}
