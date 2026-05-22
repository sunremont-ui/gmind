import { useState, useEffect, useCallback, useRef } from 'react'
import { useMindMapStore } from '../../store/mindmap'
import { api } from '../../api/client'
import { wsClient } from '../../api/ws'
import type { Topic } from '../../types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, sizes } from '../../styles/tokens'
import { Button, Text, Input } from '../UI/Box'
import { LumenStar, LumenHeart, LumenFlag, LumenLightbulb, LumenTarget, LumenCrown, LumenBrain, LumenRocket, LumenCode, LumenBookmark, LumenZap, LumenClock, LumenCheckCircle, LumenCloud, LumenSun, LumenGlobe, LumenLock, LumenKey, LumenMusic, LumenCamera, LumenImage, LumenUser, LumenBot, LumenHome, LumenFlame, LumenChevronRight, LumenX } from '../UI/LumenIcon'
import type { IconProps } from '../UI/LumenIcon'

interface PropertiesPanelProps {
  workbookId: string
  onClose: () => void
  onCommentsClick?: (topicId: string) => void
}

const COMMENT_ICONS = ['💬', '💡', '⚠️', '❓', '✅', '🔥', '📌', '❌']

const MARKER_OPTIONS = ['⭐', '🚩', '🔥', '✅', '❗', '🔵', '🟢', '🟡', '🔴', '💡', '📌', '🎯']

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

const SHAPES = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'pill', label: 'Pill' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'cloud', label: 'Cloud' },
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

const NODE_ICONS: { value: string; icon: React.ComponentType<IconProps>; label: string }[] = [
  { value: '', icon: LumenStar, label: 'None' },
  { value: 'Star', icon: LumenStar, label: 'Star' },
  { value: 'Heart', icon: LumenHeart, label: 'Heart' },
  { value: 'Flag', icon: LumenFlag, label: 'Flag' },
  { value: 'Lightbulb', icon: LumenLightbulb, label: 'Idea' },
  { value: 'Target', icon: LumenTarget, label: 'Target' },
  { value: 'Crown', icon: LumenCrown, label: 'Crown' },
  { value: 'Brain', icon: LumenBrain, label: 'Brain' },
  { value: 'Rocket', icon: LumenRocket, label: 'Rocket' },
  { value: 'Code', icon: LumenCode, label: 'Code' },
  { value: 'Bookmark', icon: LumenBookmark, label: 'Bookmark' },
  { value: 'Zap', icon: LumenZap, label: 'Zap' },
  { value: 'Clock', icon: LumenClock, label: 'Clock' },
  { value: 'CheckCircle', icon: LumenCheckCircle, label: 'Check' },
  { value: 'Cloud', icon: LumenCloud, label: 'Cloud' },
  { value: 'Sun', icon: LumenSun, label: 'Sun' },
  { value: 'Globe', icon: LumenGlobe, label: 'Globe' },
  { value: 'Lock', icon: LumenLock, label: 'Lock' },
  { value: 'Key', icon: LumenKey, label: 'Key' },
  { value: 'Music', icon: LumenMusic, label: 'Music' },
  { value: 'Camera', icon: LumenCamera, label: 'Camera' },
  { value: 'Image', icon: LumenImage, label: 'Image' },
  { value: 'User', icon: LumenUser, label: 'User' },
  { value: 'Bot', icon: LumenBot, label: 'Bot' },
  { value: 'Home', icon: LumenHome, label: 'Home' },
  { value: 'Flame', icon: LumenFlame, label: 'Flame' },
]

export function PropertiesPanel({ workbookId, onClose, onCommentsClick }: PropertiesPanelProps) {
  const selectedTopicId = useMindMapStore(s => s.selectedTopicId)
  const selectedTopicIds = useMindMapStore(s => s.selectedTopicIds)
  const workbook = useMindMapStore(s => s.workbook)
  const getTopic = useMindMapStore(s => s.getTopic)
  const updateTopicInTree = useMindMapStore(s => s.updateTopicInTree)
  const updateFloatingTopic = useMindMapStore(s => s.updateFloatingTopic)

  const [topic, setTopic] = useState<Topic | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [markers, setMarkers] = useState<string[]>([])
  const [hyperlink, setHyperlink] = useState('')
  const [image, setImage] = useState('')
  const [structureClass, setStructureClass] = useState<string>('mindmap')
  const [branchSide, setBranchSide] = useState<string>('auto')
  const [edgeStyle, setEdgeStyle] = useState<string>('curved')
  const [edgeDash, setEdgeDash] = useState<string>('solid')
  const [fontSize, setFontSize] = useState<number | undefined>(undefined)
  const [fontColor, setFontColor] = useState<string>('')
  const [fontFamily, setFontFamily] = useState('')
  const [fontWeight, setFontWeight] = useState(500)
  const [textAlign, setTextAlign] = useState<string>('center')
  const [nodeWidth, setNodeWidth] = useState<number | undefined>(undefined)
  const [borderWidth, setBorderWidth] = useState<number | undefined>(undefined)
  const [padding, setPadding] = useState<number | undefined>(undefined)
  const [opacity, setOpacity] = useState<number | undefined>(undefined)
  const [shape, setShape] = useState<string>('rounded')
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [priority, setPriority] = useState<number | undefined>(undefined)
  const [folded, setFolded] = useState(false)
  const [isFloating, setIsFloating] = useState(false)
  const [nodeHeight, setNodeHeight] = useState<number | undefined>(undefined)
  const [borderColor, setBorderColor] = useState('')
  const [connectionColor, setConnectionColor] = useState('')
  const [shadowType, setShadowType] = useState('soft')
  const [nodeStyle, setNodeStyle] = useState('solid')
  const [showChildCount, setShowChildCount] = useState(true)
  const [nodeIcon, setNodeIcon] = useState('')
  const [levelGap, setLevelGap] = useState<number | undefined>(undefined)
  const [siblingGap, setSiblingGap] = useState<number | undefined>(undefined)
  const [commentIcon, setCommentIcon] = useState('💬')
  const [sections, setSections] = useState({ basic: true, notes: false, markers: false, advanced: false, style: false, comment: false });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!selectedTopicId) return
    const t = getTopic(selectedTopicId)
    if (t) {
      setTopic(t)
      setTitle(t.title)
      setNotes(t.notes || '')
      setLabels(t.labels || [])
      setMarkers(t.markers || [])
      setHyperlink(t.hyperlink || '')
      setImage(t.image || '')
      setStructureClass(t.structure_class || 'mindmap')
      setBranchSide(t.branch_side || 'auto')
      setEdgeStyle(t.edge_style || 'curved')
      setEdgeDash(t.edge_dash || 'solid')
      setFontSize(t.font_size)
      setFontColor(t.font_color || '')
      setFontFamily(t.font_family || '')
      setFontWeight(t.font_weight || 500)
      setTextAlign(t.text_align || 'center')
      setNodeWidth(t.node_width)
      setBorderWidth(t.border_width)
      setPadding(t.padding)
      setOpacity(t.opacity)
      setShape(t.shape || 'rounded')
      setProgress(t.progress)
      setPriority(t.priority)
      setFolded(t.folded || false)
      setNodeHeight(t.node_height)
      setBorderColor(t.border_color || '')
      setConnectionColor(t.connection_color || '')
      setShadowType(t.shadow_type || 'soft')
      setNodeStyle(t.node_style || 'solid')
      setShowChildCount(t.show_child_count !== false)
      setNodeIcon(t.icon || '')
      setLevelGap(t.level_gap)
      setSiblingGap(t.sibling_gap)
      setCommentIcon(t.comment_icon || '💬')
      setIsFloating(!!useMindMapStore.getState().getActiveSheet()?.floating_topics?.some(ft => ft.id === selectedTopicId))
    }
  }, [selectedTopicId, workbook])

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
        console.error('Auto-save failed:', err)
      }
    }, 300)
  }, [selectedTopicId, isFloating, workbookId, updateTopicInTree, updateFloatingTopic])

  const setAndSave = useCallback((field: string, value: unknown) => {
    if (field === 'title') setTitle(value as string)
    else if (field === 'notes') setNotes(value as string)
    else if (field === 'labels') setLabels(value as string[])
    else if (field === 'markers') setMarkers(value as string[])
    else if (field === 'hyperlink') setHyperlink(value as string)
    else if (field === 'image') setImage(value as string)
    else if (field === 'structure_class') setStructureClass(value as string)
    else if (field === 'branch_side') setBranchSide(value as string)
    else if (field === 'edge_style') setEdgeStyle(value as string)
    else if (field === 'edge_dash') setEdgeDash(value as string)
    else if (field === 'font_size') setFontSize(value as number)
    else if (field === 'font_color') setFontColor(value as string)
    else if (field === 'font_family') setFontFamily(value as string)
    else if (field === 'font_weight') setFontWeight(value as number)
    else if (field === 'text_align') setTextAlign(value as string)
    else if (field === 'node_width') setNodeWidth(value as number)
    else if (field === 'border_width') setBorderWidth(value as number)
    else if (field === 'padding') setPadding(value as number)
    else if (field === 'opacity') setOpacity(value as number)
    else if (field === 'shape') setShape(value as string)
    else if (field === 'progress') setProgress(value as number)
    else if (field === 'priority') setPriority(value as number)
    else if (field === 'folded') setFolded(value as boolean)
    else if (field === 'node_height') setNodeHeight(value as number)
    else if (field === 'border_color') setBorderColor(value as string)
    else if (field === 'connection_color') setConnectionColor(value as string)
    else if (field === 'shadow_type') setShadowType(value as string)
    else if (field === 'node_style') setNodeStyle(value as string)
    else if (field === 'show_child_count') setShowChildCount(value as boolean)
    else if (field === 'icon') setNodeIcon(value as string)
    else if (field === 'level_gap') setLevelGap(value as number)
    else if (field === 'sibling_gap') setSiblingGap(value as number)
    else if (field === 'comment_icon') setCommentIcon(value as string)
    autoSave({ [field]: value })
  }, [autoSave])

  const imageInputRef = useRef<HTMLInputElement>(null)
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setImage(dataUrl)
      autoSave({ image: dataUrl })
    }
    reader.readAsDataURL(file)
  }, [autoSave])

  const toggleMarker = (m: string) => {
    const next = markers.includes(m) ? markers.filter(x => x !== m) : [...markers, m]
    setAndSave('markers', next)
  }

  const addLabel = () => {
    const v = prompt('New label:')
    if (v && v.trim()) {
      setAndSave('labels', [...labels, v.trim()])
    }
  }

  const removeLabel = (l: string) => {
    setAndSave('labels', labels.filter(x => x !== l))
  }

  const toggleSection = (s: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [s]: !prev[s] }))
  }

  if (selectedTopicIds.length > 1) {
    return (
      <div style={{
        width: sizes.propertiesPanel, background: colors.bgTertiary,
        borderLeft: 'none', boxShadow: shadows.neuInset,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textTertiary, fontSize: fontSizes.body, padding: spacing.xxl, textAlign: 'center',
        fontFamily: fonts.ui,
      }}>
        {selectedTopicIds.length} topics selected
      </div>
    )
  }

  if (!selectedTopicId || !topic) {
    return (
      <div style={{
        width: sizes.propertiesPanel, background: colors.bgTertiary,
        borderLeft: 'none', boxShadow: shadows.neuInset,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textTertiary, fontSize: fontSizes.body, padding: spacing.xxl, textAlign: 'center',
        fontFamily: fonts.ui,
      }}>
        Select a topic to edit properties
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
      width: sizes.propertiesPanel, height: '100%', background: colors.bgTertiary,
      borderLeft: 'none', boxShadow: shadows.neuInset,
      display: 'flex', flexDirection: 'column', overflow: 'auto',
      fontSize: fontSizes.body, fontFamily: fonts.ui,
    }}>
      {/* Header */}
      <div style={{
        padding: `${spacing.lg}px ${spacing.xl}px`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <Text size={fontSizes.subhead} weight={fontWeights.semibold}>Properties</Text>
          {isFloating && (
            <span style={{ fontSize: fontSizes.caption, color: colors.accent, background: colors.accentLight, padding: `1px ${spacing.sm}px`, borderRadius: radii.sm }}>
              floating
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" icon onClick={onClose}>✕</Button>
      </div>

      <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.xxs }}>

        {/* Basic */}
        <SectionHeader title="Basic" open={sections.basic} onToggle={() => toggleSection('basic')} />
        {sections.basic && (
          <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px`, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            {ctrl('Title', (
              <Input value={title} onChange={v => { setTitle(v); autoSave({ title: v }) }} />
            ))}
            {topic && !workbook?.sheets.some(s => s.root_topic.id === selectedTopicId) && !isFloating && ctrl('Parent', (
              <div style={{ fontSize: fontSizes.label, color: colors.textSecondary, background: colors.fill, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.sm, border: `1px solid ${colors.separator}` }}>
                {findBreadcrumb(workbook?.sheets || [], selectedTopicId)}
              </div>
            ))}
            {isFloating && topic.position && ctrl('Position', (
              <div style={{ fontSize: fontSizes.label, color: colors.textSecondary, background: colors.fill, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.sm, border: `1px solid ${colors.separator}` }}>
                x: {Math.round(topic.position.x)}, y: {Math.round(topic.position.y)}
              </div>
            ))}
            {ctrl('Children', (
              <Text size={fontSizes.label} color={colors.textSecondary}>{(topic.children?.length || 0)} {(topic.children?.length === 1 ? 'child' : 'children')}</Text>
            ))}
            {(topic.children?.length ?? 0) > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: spacing.md, cursor: 'pointer', fontSize: fontSizes.body }}>
                <input type="checkbox" checked={folded} onChange={e => setAndSave('folded', e.target.checked)}
                  style={{ accentColor: colors.accent }} />
                <Text size={fontSizes.body}>Collapse children</Text>
              </label>
            )}
          </div>
        )}

        {/* Notes */}
        <SectionHeader title="Notes" open={sections.notes} onToggle={() => toggleSection('notes')} />
        {sections.notes && (
          <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px` }}>
            <Input value={notes} onChange={v => { setNotes(v); autoSave({ notes: v }) }} rows={4} placeholder="Add notes..." />
          </div>
        )}

        {/* Markers */}
        <SectionHeader title={`Markers (${markers.length})`} open={sections.markers} onToggle={() => toggleSection('markers')} />
        {sections.markers && (
          <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px` }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
              {MARKER_OPTIONS.map(m => (
                <button key={m} onClick={() => toggleMarker(m)}
                  style={{
                    width: 30, height: 30, fontSize: fontSizes.bodyLarge, border: markers.includes(m) ? `2px solid ${colors.accent}` : `1px solid ${colors.separatorThick}`,
                    borderRadius: radii.sm, cursor: 'pointer', background: markers.includes(m) ? colors.accentLight : colors.fill,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `all ${transitions.fast}`,
                  }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced */}
        <SectionHeader title="Advanced" open={sections.advanced} onToggle={() => toggleSection('advanced')} />
        {sections.advanced && (
          <div style={{ padding: `${spacing.xs}px 0 ${spacing.md}px`, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            {ctrl('Labels', (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
                  {labels.map(l => (
                    <span key={l} style={{ padding: `${spacing.xxs}px ${spacing.md}px`, background: colors.accentLight, borderRadius: radii.sm, fontSize: fontSizes.label, color: colors.accent, display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                      {l}
                      <span onClick={() => removeLabel(l)} style={{ cursor: 'pointer', display: 'flex', color: colors.accent, opacity: 0.6 }}><LumenX size={12} strokeWidth={2.5} /></span>
                    </span>
                  ))}
                </div>
                <Button variant="secondary" size="sm" onClick={addLabel}>+ Add label</Button>
              </div>
            ))}
            {ctrl('Hyperlink', (
              <Input value={hyperlink} onChange={v => { setHyperlink(v); autoSave({ hyperlink: v }) }} placeholder="https://..." />
            ))}
            {ctrl('Image', (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <Input value={image} onChange={v => { setImage(v); autoSave({ image: v }) }} placeholder="Image URL or upload..." />
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  <Button variant="secondary" size="sm" onClick={() => imageInputRef.current?.click()}>
                    Upload image
                  </Button>
                  {image && (
                    <Button variant="ghost" size="sm" icon onClick={() => { setImage(''); autoSave({ image: '' }) }}>
                      <LumenX size={14} strokeWidth={2} />
                    </Button>
                  )}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                {image && (
                  <img src={image} alt="preview" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: radii.sm, objectFit: 'contain', marginTop: spacing.xs }} />
                )}
              </div>
            ))}
            {!isFloating && ctrl('Layout', (
              <select value={structureClass} onChange={e => { setStructureClass(e.target.value); autoSave({ structure_class: e.target.value }) }}
                style={selStyle}>
                <option value="mindmap">Mindmap</option>
                <option value="org-chart">Org Chart</option>
                <option value="tree">Tree (Right)</option>
                <option value="tree-right">Tree Right</option>
                <option value="tree-left">Tree Left</option>
                <option value="tree-down">Tree Down</option>
                <option value="tree-up">Tree Up</option>
                <option value="fishbone">Fishbone</option>
                <option value="radial">Radial</option>
              </select>
            ))}
            {!isFloating && ctrl('Branch Side', (
              <select value={branchSide} onChange={e => setAndSave('branch_side', e.target.value)} style={selStyle}>
                <option value="auto">Auto</option>
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            ))}
            {!isFloating && ctrl('Edge Style', (
              <select value={edgeStyle} onChange={e => setAndSave('edge_style', e.target.value)} style={selStyle}>
                <option value="curved">Curved</option>
                <option value="straight">Straight</option>
                <option value="angled">Angled</option>
              </select>
            ))}
            {!isFloating && ctrl('Edge Dash', (
              <select value={edgeDash} onChange={e => setAndSave('edge_dash', e.target.value)} style={selStyle}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            ))}
            {ctrl('Shape', (
              <select value={shape} onChange={e => setAndSave('shape', e.target.value)} style={selStyle}>
                {SHAPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ))}
            {ctrl('Level Gap', (
              <input type="number" min={0} max={600} step={10}
                value={levelGap ?? ''} placeholder="default"
                onChange={e => setAndSave('level_gap', e.target.value ? parseInt(e.target.value) : undefined)}
                style={numStyle} />
            ))}
            {ctrl('Sibling Gap', (
              <input type="number" min={0} max={300} step={5}
                value={siblingGap ?? ''} placeholder="default"
                onChange={e => setAndSave('sibling_gap', e.target.value ? parseInt(e.target.value) : undefined)}
                style={numStyle} />
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
              {ctrl('Progress', (
                <div>
                  <input type="range" min={0} max={100} step={5}
                    value={progress || 0}
                    onChange={e => setAndSave('progress', parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: colors.accent }} />
                  <Text size={fontSizes.caption} color={colors.textTertiary}>{progress || 0}%</Text>
                </div>
              ))}
              {ctrl('Priority', (
                <select value={priority || 0} onChange={e => setAndSave('priority', parseInt(e.target.value))} style={selStyle}>
                  <option value={0}>None</option>
                  <option value={1}>Low</option>
                  <option value={2}>Medium</option>
                  <option value={3}>High</option>
                  <option value={4}>Urgent</option>
                </select>
              ))}
            </div>
            {(topic.children?.length ?? 0) > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: spacing.md, cursor: 'pointer', fontSize: fontSizes.body }}>
                <input type="checkbox" checked={showChildCount} onChange={e => setAndSave('show_child_count', e.target.checked)}
                  style={{ accentColor: colors.accent }} />
                <span style={{ color: colors.textSecondary, fontSize: fontSizes.label }}>Child count</span>
              </label>
            )}
          </div>
        )}

        {/* Style */}
        <SectionHeader title="Style" open={sections.style} onToggle={() => toggleSection('style')} />
        {sections.style && (
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
                  placeholder="Default" min={8} max={48}
                  style={{ ...numStyle }} />
              ))}
              {ctrl('Font Color', (
                <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                  <input type="color" value={fontColor || colors.text}
                    onChange={e => { setFontColor(e.target.value); autoSave({ font_color: e.target.value || '' }) }}
                    style={{ width: 32, height: 28, border: `1px solid ${colors.separatorThick}`, borderRadius: radii.sm, padding: 0, cursor: 'pointer' }} />
                  {fontColor && (
                    <Button variant="ghost" size="sm" icon onClick={() => { setFontColor(''); autoSave({ font_color: '' }) }}><LumenX size={14} strokeWidth={2} /></Button>
                  )}
                </div>
              ))}
            </div>
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
                  style={{ ...numStyle }} />
              ))}
              {ctrl('Border Width', (
                <input type="number" value={borderWidth || ''}
                  onChange={e => {
                    const v = e.target.value ? parseInt(e.target.value) : undefined
                    setBorderWidth(v)
                    if (v !== undefined && v > 0) autoSave({ border_width: v })
                  }}
                  placeholder="Auto" min={0} max={10}
                  style={{ ...numStyle }} />
              ))}
            </div>
            {ctrl('Node Height', (
              <input type="number" value={nodeHeight || ''}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value) : undefined
                  setNodeHeight(v)
                  if (v !== undefined && v >= 28) autoSave({ node_height: v })
                }}
                placeholder="Auto" min={28} max={120}
                style={{ ...numStyle }} />
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
              {ctrl('Border Color', (
                <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                  <input type="color" value={borderColor || colors.accent}
                    onChange={e => { setBorderColor(e.target.value); autoSave({ border_color: e.target.value }) }}
                    style={{ width: 32, height: 28, border: `1px solid ${colors.separatorThick}`, borderRadius: radii.sm, padding: 0, cursor: 'pointer' }} />
                  {borderColor && (
                    <Button variant="ghost" size="sm" icon onClick={() => { setBorderColor(''); autoSave({ border_color: '' }) }}><LumenX size={14} strokeWidth={2} /></Button>
                  )}
                </div>
              ))}
              {ctrl('Connection Color', (
                <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                  <input type="color" value={connectionColor || colors.accent}
                    onChange={e => { setConnectionColor(e.target.value); autoSave({ connection_color: e.target.value }) }}
                    style={{ width: 32, height: 28, border: `1px solid ${colors.separatorThick}`, borderRadius: radii.sm, padding: 0, cursor: 'pointer' }} />
                  {connectionColor && (
                    <Button variant="ghost" size="sm" icon onClick={() => { setConnectionColor(''); autoSave({ connection_color: '' }) }}><LumenX size={14} strokeWidth={2} /></Button>
                  )}
                </div>
              ))}
            </div>
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
            {ctrl('Node Icon', (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
                {NODE_ICONS.map(({ value, icon: Icon }) => (
                  <button key={value}
                    onClick={() => setAndSave('icon', value)}
                    style={{
                      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: nodeIcon === value ? `2px solid ${colors.accent}` : `1px solid ${colors.separator}`,
                      borderRadius: radii.sm, background: nodeIcon === value ? colors.accentLight : colors.bgTertiary,
                      cursor: 'pointer', color: nodeIcon === value ? colors.accent : colors.textSecondary,
                      transition: `all ${transitions.fast}`,
                    }}>
                    {value ? <Icon size={16} strokeWidth={1.8} /> : <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>—</span>}
                  </button>
                ))}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
              {ctrl('Padding', (
                <input type="number" value={padding || ''}
                  onChange={e => {
                    const v = e.target.value ? parseInt(e.target.value) : undefined
                    setPadding(v)
                    if (v !== undefined && v >= 0) autoSave({ padding: v })
                  }}
                  placeholder="Auto" min={0} max={40}
                  style={{ ...numStyle }} />
              ))}
              {ctrl('Opacity', (
                <input type="number" value={opacity !== undefined ? Math.round(opacity * 100) : ''}
                  onChange={e => {
                    const v = e.target.value ? Math.round(parseInt(e.target.value)) / 100 : undefined
                    setOpacity(v)
                    if (v !== undefined && v >= 0 && v <= 1) autoSave({ opacity: v })
                  }}
                  placeholder="100%" min={0} max={100}
                  style={{ ...numStyle }} />
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        <SectionHeader title="Comment" open={sections.comment} onToggle={() => toggleSection('comment')} />
        {sections.comment && (
          <div style={{ padding: `${spacing.md}px ${spacing.xs}px`, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <Text size={fontSizes.caption} color={colors.textSecondary}>Icon on node (shown when comments exist)</Text>
            <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap' }}>
              {COMMENT_ICONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setAndSave('comment_icon', emoji)}
                  style={{
                    width: 32, height: 32, fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: commentIcon === emoji ? `2px solid ${colors.accent}` : `1px solid ${colors.separator}`,
                    borderRadius: radii.sm,
                    background: commentIcon === emoji ? colors.accentLight : colors.bgTertiary,
                    cursor: 'pointer',
                    transition: `all ${transitions.fast}`,
                  }}
                >{emoji}</button>
              ))}
            </div>
            <button
              onClick={() => selectedTopicId && onCommentsClick?.(selectedTopicId)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                padding: `${spacing.sm}px ${spacing.md}px`,
                background: colors.accent, color: colors.textInverse,
                border: 'none', borderRadius: radii.sm,
                fontSize: fontSizes.body, fontFamily: fonts.ui, cursor: 'pointer',
                transition: `background ${transitions.fast}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = colors.accentHover }}
              onMouseLeave={e => { e.currentTarget.style.background = colors.accent }}
            >
              💬 Open comments
            </button>
          </div>
        )}

        {/* Preview */}
        <div style={{ marginTop: spacing.md, padding: spacing.lg, background: colors.fill, borderRadius: radii.md, border: `1px solid ${colors.separator}` }}>
          <Text size={fontSizes.caption} weight={fontWeights.semibold} color={colors.textTertiary} style={{ marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Preview
          </Text>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing.sm,
            padding: `${spacing.sm}px ${spacing.lg}px`,
            background: colors.accentLight, border: `2px solid ${colors.accent}`,
            borderRadius: shape === 'pill' ? radii.sm + 12 : shape === 'rectangle' ? 0 : radii.md,
            fontSize: fontSize || fontSizes.body, fontWeight: fontWeight || fontWeights.medium,
            color: fontColor || colors.accent,
            fontFamily: fontFamily || fonts.ui,
            opacity: opacity ?? 1,
          }}>
            {markers.slice(0, 2).join(' ')}
            <span style={{ marginLeft: spacing.xxs }}>{title || 'Topic'}</span>
          </div>
          {labels.length > 0 && (
            <div style={{ marginTop: spacing.sm, display: 'flex', gap: spacing.xs, flexWrap: 'wrap' }}>
              {labels.map(l => (
                <span key={l} style={{ padding: `${spacing.xxs}px ${spacing.sm}px`, background: colors.accentLight, borderRadius: radii.sm, fontSize: fontSizes.caption, color: colors.accent }}>
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `${spacing.sm + 2}px ${spacing.xs}px`, cursor: 'pointer', userSelect: 'none',
      borderBottom: `1px solid ${colors.separator}`,
      fontSize: fontSizes.label, fontWeight: fontWeights.semibold, color: colors.textTertiary,
      textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: fonts.ui,
      transition: `color ${transitions.fast}`,
    }}
    onMouseEnter={e => e.currentTarget.style.color = colors.text}
    onMouseLeave={e => e.currentTarget.style.color = colors.textTertiary}
    >
      {title}
      <LumenChevronRight size={12} strokeWidth={2.5} style={{ transition: `transform ${transitions.fast}`, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }} />
    </div>
  )
}

const selStyle: React.CSSProperties = {
  width: '100%', padding: `${spacing.sm + 1}px ${spacing.lg}px`,
  fontSize: fontSizes.body, fontFamily: fonts.ui,
  border: 'none', borderRadius: radii.sm,
  outline: 'none', background: colors.bgTertiary, color: colors.text,
  boxSizing: 'border-box', boxShadow: shadows.neuInsetSm,
  transition: `box-shadow ${transitions.fast}`,
}

const numStyle: React.CSSProperties = {
  width: '100%', padding: `${spacing.sm + 1}px ${spacing.md}px`,
  fontSize: fontSizes.body, fontFamily: fonts.ui,
  border: 'none', borderRadius: radii.sm,
  outline: 'none', background: colors.bgTertiary, color: colors.text,
  boxSizing: 'border-box', boxShadow: shadows.neuInsetSm,
  transition: `box-shadow ${transitions.fast}`,
}

function findBreadcrumb(sheets: { root_topic: Topic }[], topicId: string): string {
  for (const sheet of sheets) {
    const parts: string[] = []
    const walk = (t: Topic): boolean => {
      if (t.id === topicId) { parts.unshift(t.title); return true }
      for (const c of t.children || []) {
        if (walk(c)) { parts.unshift(t.title); return true }
      }
      return false
    }
    if (walk(sheet.root_topic)) return parts.join(' → ')
  }
  return '—'
}
