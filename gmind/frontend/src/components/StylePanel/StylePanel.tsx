import { useState, useEffect, useCallback, useRef } from 'react'
import { useMindMapStore } from '../../store/mindmap'
import { api } from '../../api/client'
import { wsClient } from '../../api/ws'
import type { Topic } from '../../types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'
import { LumenX } from '../UI/LumenIcon'
import { Button, Text } from '../UI/Box'
import { getTemplates, saveTemplate, deleteTemplate, collectStyle, styleToUpdates, type NodeTemplate } from '../../utils/templates'

interface StylePanelProps {
  workbookId: string
  onClose: () => void
}

const FONT_FAMILIES = [
  { value: '', label: 'System' },
  { value: "'Inter', ui-sans-serif, sans-serif", label: 'Inter' },
  { value: "'JetBrains Mono', ui-monospace, monospace", label: 'JetBrains Mono' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, Times New Roman, serif', label: 'Georgia' },
  { value: 'Courier New, monospace', label: 'Courier' },
  { value: '-apple-system, BlinkMacSystemFont, SF Pro, sans-serif', label: 'SF Pro' },
]

const FONT_WEIGHTS = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
]

const SHADOW_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
]

const NODE_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'glass', label: 'Glass' },
  { value: 'outline', label: 'Outline' },
]

export function StylePanel({ workbookId, onClose }: StylePanelProps) {
  const selectedTopicId = useMindMapStore(s => s.selectedTopicId)
  const getTopic = useMindMapStore(s => s.getTopic)
  const updateTopicInTree = useMindMapStore(s => s.updateTopicInTree)
  const updateFloatingTopic = useMindMapStore(s => s.updateFloatingTopic)

  const [topic, setTopic] = useState<Topic | null>(null)
  const [fontSize, setFontSize] = useState<number | undefined>(undefined)
  const [fontColor, setFontColor] = useState('')
  const [fontFamily, setFontFamily] = useState('')
  const [fontWeight, setFontWeight] = useState(500)
  const [textAlign, setTextAlign] = useState<string>('center')
  const [nodeWidth, setNodeWidth] = useState<number | undefined>(undefined)
  const [borderWidth, setBorderWidth] = useState<number | undefined>(undefined)
  const [padding, setPadding] = useState<number | undefined>(undefined)
  const [opacity, setOpacity] = useState<number | undefined>(undefined)
  const [nodeHeight, setNodeHeight] = useState<number | undefined>(undefined)
  const [borderColor, setBorderColor] = useState('')
  const [connectionColor, setConnectionColor] = useState('')
  const [shadowType, setShadowType] = useState('soft')
  const [nodeStyle, setNodeStyle] = useState('solid')
  const [showChildCount, setShowChildCount] = useState(true)
  const [isFloating, setIsFloating] = useState(false)
  const [templates, setTemplates] = useState<NodeTemplate[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!selectedTopicId) return
    const t = getTopic(selectedTopicId)
    if (t) {
      setTopic(t)
      setFontSize(t.font_size)
      setFontColor(t.font_color || '')
      setFontFamily(t.font_family || '')
      setFontWeight(t.font_weight || 500)
      setTextAlign(t.text_align || 'center')
      setNodeWidth(t.node_width)
      setBorderWidth(t.border_width)
      setPadding(t.padding)
      setOpacity(t.opacity)
      setNodeHeight(t.node_height)
      setBorderColor(t.border_color || '')
      setConnectionColor(t.connection_color || '')
      setShadowType(t.shadow_type || 'soft')
      setNodeStyle(t.node_style || 'solid')
      setShowChildCount(t.show_child_count !== false)
      setIsFloating(!!useMindMapStore.getState().getActiveSheet()?.floating_topics?.some(ft => ft.id === selectedTopicId))
    }
  }, [selectedTopicId, getTopic])

  useEffect(() => {
    setTemplates(getTemplates())
  }, [])

  const autoSave = useCallback((updates: Partial<Topic>) => {
    if (!selectedTopicId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        if (isFloating) {
          await api.updateFloatingTopic(workbookId, selectedTopicId, updates)
          updateFloatingTopic(selectedTopicId, updates)
        } else {
          await api.updateTopic(workbookId, selectedTopicId, updates)
          updateTopicInTree(selectedTopicId, updates)
        }
        wsClient.send({ type: 'update', payload: { topic_id: selectedTopicId } })
      } catch (err) {
        console.error('Style auto-save failed:', err)
      }
    }, 300)
  }, [selectedTopicId, isFloating, workbookId, updateTopicInTree, updateFloatingTopic])

  const setAndSave = useCallback((field: string, value: unknown) => {
    if (field === 'font_size') setFontSize(value as number)
    else if (field === 'font_color') setFontColor(value as string)
    else if (field === 'font_family') setFontFamily(value as string)
    else if (field === 'font_weight') setFontWeight(value as number)
    else if (field === 'text_align') setTextAlign(value as string)
    else if (field === 'node_width') setNodeWidth(value as number)
    else if (field === 'border_width') setBorderWidth(value as number)
    else if (field === 'padding') setPadding(value as number)
    else if (field === 'opacity') setOpacity(value as number)
    else if (field === 'node_height') setNodeHeight(value as number)
    else if (field === 'border_color') setBorderColor(value as string)
    else if (field === 'connection_color') setConnectionColor(value as string)
    else if (field === 'shadow_type') setShadowType(value as string)
    else if (field === 'node_style') setNodeStyle(value as string)
    else if (field === 'show_child_count') setShowChildCount(value as boolean)
    autoSave({ [field]: value })
  }, [autoSave])

  if (!selectedTopicId || !topic) {
    return (
      <div style={{
        background: colors.bgTertiary,
        border: 'none',
        borderRadius: radii.xl,
        boxShadow: shadows.neuLg,
        width: 260,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: colors.textTertiary, fontSize: fontSizes.body, padding: spacing.xxl, textAlign: 'center',
        fontFamily: fonts.ui, gap: spacing.md,
      }}>
        <div style={{ fontSize: 28, opacity: 0.4 }}>✦</div>
        Select a topic to style
      </div>
    )
  }

  const ctrl = (label: string, control: React.ReactNode) => (
    <div>
      <Text size={fontSizes.label} weight={fontWeights.medium} color={colors.textSecondary} style={{ marginBottom: spacing.xs, display: 'block' }}>{label}</Text>
      {control}
    </div>
  )

  return (
    <div style={{
      background: colors.bgTertiary,
      border: 'none',
      borderRadius: radii.xl,
      boxShadow: shadows.neuLg,
      width: 260,
      height: '100%',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontSize: fontSizes.body, fontFamily: fonts.ui,
    }}>
      <div style={{
        padding: `${spacing.md}px ${spacing.xl}px`,
        borderBottom: `1px solid ${colors.separator}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
        background: colors.bgTertiary,
      }}>
        <Text size={fontSizes.subhead} weight={fontWeights.semibold}>Style</Text>
        <button
          onClick={onClose}
          style={{
            width: 26, height: 26, borderRadius: '50%',
            background: colors.bgTertiary, border: 'none', cursor: 'pointer',
            color: colors.textQuaternary, fontSize: fontSizes.body,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: shadows.neuSm,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = colors.text; e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
          onMouseLeave={e => { e.currentTarget.style.color = colors.textQuaternary; e.currentTarget.style.boxShadow = shadows.neuSm }}
        >✕</button>
      </div>

      <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.xxs, overflow: 'auto', flex: 1, minHeight: 0 }}>

        {/* Typography */}
        <SectionHeader title="Typography" />
        <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px`, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          {ctrl('Font Family', (
            <select value={fontFamily} onChange={e => setAndSave('font_family', e.target.value)} style={{ ...selStyle, fontFamily: fontFamily || fonts.ui }}>
              {FONT_FAMILIES.map(f => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value || fonts.ui }}>{f.label}</option>
              ))}
            </select>
          ))}
          {ctrl('Font Weight', (
            <select value={fontWeight} onChange={e => setAndSave('font_weight', parseInt(e.target.value))} style={selStyle}>
              {FONT_WEIGHTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          ))}
          {ctrl('Text Align', (
            <select value={textAlign} onChange={e => setAndSave('text_align', e.target.value)} style={selStyle}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
            {ctrl('Font Size', (
              <input type="number" value={fontSize || ''}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value) : undefined
                  const valid = v !== undefined && !isNaN(v)
                  setFontSize(valid ? v : undefined)
                  if (valid && v > 0) autoSave({ font_size: v })
                  else if (!valid) autoSave({ font_size: 0 })
                }}
                placeholder="14" min={8} max={48}
                style={numStyle} />
            ))}
            {ctrl('Font Color', (
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                <input type="color" value={fontColor || colors.text}
                  onChange={e => setAndSave('font_color', e.target.value || '')}
                  style={{ width: 32, height: 28, border: `1px solid ${colors.separatorThick}`, borderRadius: radii.sm, padding: 0, cursor: 'pointer' }} />
                {fontColor && (
                  <Button variant="ghost" size="sm" icon onClick={() => setAndSave('font_color', '')}><LumenX size={14} strokeWidth={2} /></Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sizing */}
        <SectionHeader title="Sizing" />
        <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px`, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
            {ctrl('Node Width', (
              <input type="number" value={nodeWidth || ''}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value) : undefined
                  setNodeWidth(v)
                  if (v !== undefined && v > 0) autoSave({ node_width: v })
                  else if (v === undefined) autoSave({ node_width: 0 })
                }}
                placeholder="Auto" min={60} max={300}
                style={numStyle} />
            ))}
            {ctrl('Node Height', (
              <input type="number" value={nodeHeight || ''}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value) : undefined
                  setNodeHeight(v)
                  if (v !== undefined && v >= 28) autoSave({ node_height: v })
                }}
                placeholder="Auto" min={28} max={120}
                style={numStyle} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
            {ctrl('Border Width', (
              <input type="number" value={borderWidth || ''}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value) : undefined
                  setBorderWidth(v)
                  if (v !== undefined && v >= 0) autoSave({ border_width: v })
                }}
                placeholder="Auto" min={0} max={10}
                style={numStyle} />
            ))}
            {ctrl('Padding', (
              <input type="number" value={padding || ''}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value) : undefined
                  setPadding(v)
                  if (v !== undefined && v >= 0) autoSave({ padding: v })
                }}
                placeholder="Auto" min={0} max={40}
                style={numStyle} />
            ))}
          </div>
          {ctrl('Opacity', (
            <input type="number" value={opacity !== undefined ? Math.round(opacity * 100) : ''}
              onChange={e => {
                const v = e.target.value ? Math.round(parseInt(e.target.value)) / 100 : undefined
                setOpacity(v)
                if (v !== undefined && v >= 0 && v <= 1) autoSave({ opacity: v })
              }}
              placeholder="100%" min={0} max={100}
              style={numStyle} />
          ))}
        </div>

        {/* Colors */}
        <SectionHeader title="Colors" />
        <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px`, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
            {ctrl('Border Color', (
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                <input type="color" value={borderColor || colors.accent}
                  onChange={e => setAndSave('border_color', e.target.value)}
                  style={{ width: 32, height: 28, border: `1px solid ${colors.separatorThick}`, borderRadius: radii.sm, padding: 0, cursor: 'pointer' }} />
                {borderColor && (
                  <Button variant="ghost" size="sm" icon onClick={() => setAndSave('border_color', '')}><LumenX size={14} strokeWidth={2} /></Button>
                )}
              </div>
            ))}
            {ctrl('Connection Color', (
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                <input type="color" value={connectionColor || colors.accent}
                  onChange={e => setAndSave('connection_color', e.target.value)}
                  style={{ width: 32, height: 28, border: `1px solid ${colors.separatorThick}`, borderRadius: radii.sm, padding: 0, cursor: 'pointer' }} />
                {connectionColor && (
                  <Button variant="ghost" size="sm" icon onClick={() => setAndSave('connection_color', '')}><LumenX size={14} strokeWidth={2} /></Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Effects */}
        <SectionHeader title="Effects" />
        <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px`, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
            {ctrl('Shadow', (
              <select value={shadowType} onChange={e => setAndSave('shadow_type', e.target.value)} style={selStyle}>
                {SHADOW_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ))}
            {ctrl('Node Style', (
              <select value={nodeStyle} onChange={e => setAndSave('node_style', e.target.value)} style={selStyle}>
                {NODE_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ))}
          </div>
        </div>

        {/* Templates */}
        <SectionHeader title="Templates" />
        <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px`, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <Button variant="secondary" size="sm" onClick={() => {
            const name = prompt('Template name:')
            if (name && name.trim()) {
              saveTemplate(name.trim(), collectStyle(topic))
              setTemplates(getTemplates())
            }
          }} style={{ width: '100%' }}>+ Save as template</Button>
          {templates.length === 0 ? (
            <Text size={fontSizes.caption} color={colors.textQuaternary} style={{ textAlign: 'center' }}>
              No saved templates
            </Text>
          ) : (
            templates.map(t => (
              <div key={t.name} style={{
                display: 'flex', alignItems: 'center', gap: spacing.sm,
                padding: `${spacing.sm}px ${spacing.md}px`,
                background: colors.fill, borderRadius: radii.sm,
              }}>
                <span style={{ flex: 1, fontSize: fontSizes.label, color: colors.text, fontFamily: fonts.ui }}>{t.name}</span>
                <button onClick={() => {
                  autoSave(styleToUpdates(t.style) as any)
                }} style={{ border: 'none', background: colors.accent, color: colors.textInverse, borderRadius: radii.sm, padding: `2px ${spacing.md}px`, cursor: 'pointer', fontSize: fontSizes.caption, fontFamily: fonts.ui }}>
                  Apply
                </button>
                <button onClick={() => {
                  deleteTemplate(t.name)
                  setTemplates(getTemplates())
                }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textQuaternary, fontSize: fontSizes.caption, padding: 0, fontFamily: fonts.ui }}>
                  <LumenX size={12} strokeWidth={2} />
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      padding: `${spacing.sm + 2}px ${spacing.xs}px`,
      fontSize: fontSizes.label, fontWeight: fontWeights.semibold, color: colors.textTertiary,
      textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: fonts.ui,
      borderBottom: `1px solid ${colors.separator}`,
    }}>
      {title}
    </div>
  )
}

const selStyle: React.CSSProperties = {
  width: '100%', padding: `${spacing.sm + 1}px ${spacing.lg}px`,
  fontSize: fontSizes.body, fontFamily: fonts.ui,
  border: 'none', borderRadius: radii.sm,
  outline: 'none', background: colors.bgTertiary, color: colors.text,
  boxSizing: 'border-box',
  boxShadow: shadows.neuInsetSm,
}

const numStyle: React.CSSProperties = {
  width: '100%', padding: `${spacing.sm + 1}px ${spacing.md}px`,
  fontSize: fontSizes.body, fontFamily: fonts.ui,
  border: 'none', borderRadius: radii.sm,
  outline: 'none', background: colors.bgTertiary, color: colors.text,
  boxSizing: 'border-box',
  boxShadow: shadows.neuInsetSm,
}
