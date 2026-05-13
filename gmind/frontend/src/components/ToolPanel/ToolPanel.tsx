import { useState, useEffect } from 'react'
import {
  LumenMousePointer, LumenPlus, LumenFileText, LumenStickyNote,
  LumenPalette, LumenMoveHorizontal, LumenDownload, LumenUpload, LumenX,
  LumenUsers, LumenBot, LumenSparkles, LumenImageIcon,
} from '../UI/LumenIcon'
import { useLayoutStore } from '../../store/layout'
import { useThemeStore } from '../../store/theme'
import { themes, type Theme } from '../../types/theme'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

export type Tool = 'pointer' | 'topic' | 'floating' | 'sticky'

export interface ToolPanelProps {
  activeTool: Tool
  onToolSelect: (tool: Tool) => void
  showStyle: boolean
  onStyleToggle: () => void
  onExportXMind: () => void
  onExportSVG: () => void
  onExportPNG: () => void
  onExportPDF: () => void
  onExportMarkdown: () => void
  onExportFreeMind: () => void
  onExportOPML: () => void
  onImportXMind: () => void
  onImportMarkdown: () => void
  onImportFreeMind: () => void
  onImportJSON: () => void
  onBatchImport: () => void
  onClearImportData: () => void
  hasImportedData: boolean
  presenceCount: number
  onPresenceToggle: () => void
  onSummarize: () => void
  summaryLoading: boolean
  onGenerateImage: () => void
  onAIServer: () => void
  closeToken: number
}

const toolIcons: Record<string, React.ReactNode> = {
  pointer: <LumenMousePointer size={16} strokeWidth={1.8} />,
  topic: <LumenPlus size={16} strokeWidth={1.8} />,
  floating: <LumenFileText size={16} strokeWidth={1.8} />,
  sticky: <LumenStickyNote size={16} strokeWidth={1.8} />,
}

const tools: { id: Tool; label: string }[] = [
  { id: 'pointer', label: 'Select' },
  { id: 'topic', label: 'Add Topic' },
  { id: 'floating', label: 'Floating' },
  { id: 'sticky', label: 'Sticky Note' },
]

export function ToolPanel({
  activeTool, onToolSelect, showStyle, onStyleToggle,
  onExportXMind, onExportSVG, onExportPNG, onExportPDF, onExportMarkdown, onExportFreeMind, onExportOPML,
  onImportXMind, onImportMarkdown, onImportFreeMind, onImportJSON, onBatchImport,
  onClearImportData, hasImportedData,
  presenceCount, onPresenceToggle,
  onSummarize, summaryLoading, onGenerateImage, onAIServer,
  closeToken,
}: ToolPanelProps) {
  const gaps = { levelGap: useLayoutStore(s => s.levelGap), siblingGap: useLayoutStore(s => s.siblingGap), childGap: useLayoutStore(s => s.childGap) }
  const nodeDefaults = { nodePadding: useLayoutStore(s => s.nodePadding), maxChars: useLayoutStore(s => s.maxChars), fontSize: useLayoutStore(s => s.fontSize) }
  const { setLevelGap, setSiblingGap, setChildGap, setNodePadding, setMaxChars, setFontSize, resetGaps } = useLayoutStore.getState()
  const { theme, setTheme } = useThemeStore()

  const [showSpacing, setShowSpacing] = useState(false)
  const [showThemePick, setShowThemePick] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => { setShowSpacing(false); setShowThemePick(false); setShowExport(false); setShowImport(false) }, [closeToken])

  const closeAll = () => { setShowSpacing(false); setShowThemePick(false); setShowExport(false); setShowImport(false) }

  const btnBase: React.CSSProperties = {
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderRadius: radii.sm, cursor: 'pointer', fontSize: fontSizes.body,
    fontFamily: fonts.ui, transition: `all ${transitions.fast}`,
    background: 'transparent',
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    boxShadow: active ? shadows.neuInsetSm : shadows.neuSm,
    color: active ? colors.accent : colors.textSecondary,
  })

  const popoverBase: React.CSSProperties = {
    position: 'absolute', left: '100%', top: 0, marginLeft: spacing.sm,
    background: colors.bg, border: 'none',
    borderRadius: radii.md, boxShadow: shadows.neuLg, padding: spacing.lg, zIndex: 100,
  }

  const toolBtn = (icon: React.ReactNode, title: string, active: boolean, onClick: () => void, key?: string) => (
    <button key={key} onClick={onClick} title={title}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.boxShadow = shadows.neuMd; e.currentTarget.style.color = colors.text } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.boxShadow = shadows.neuSm; e.currentTarget.style.color = colors.textSecondary } }}
      style={{ ...btnBase, ...btnStyle(active) }}>
      {icon}
    </button>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: spacing.xxs,
      padding: `${spacing.sm}px`, background: colors.bgTertiary,
      boxShadow: shadows.neuInset, position: 'relative',
    }}>

      {tools.map(t => toolBtn(toolIcons[t.id], t.label, activeTool === t.id, () => onToolSelect(t.id), t.id))}

      <div style={{ height: 1, background: colors.separator, margin: `${spacing.sm}px 0` }} />

      {toolBtn(<LumenPalette size={16} strokeWidth={1.8} />, 'Style Panel', showStyle, onStyleToggle)}

      <div style={{ height: 1, background: colors.separator, margin: `${spacing.sm}px 0` }} />

      {/* Layout Spacing + Node Defaults */}
      <div style={{ position: 'relative' }}>
        {toolBtn(<LumenMoveHorizontal size={16} strokeWidth={1.8} />, `Layout: ${gaps.levelGap}/${gaps.siblingGap}`, showSpacing, () => { closeAll(); setShowSpacing(p => !p) })}
        {showSpacing && (
          <div style={popoverBase}>
            <div style={{ fontSize: fontSizes.label, fontWeight: fontWeights.semibold, color: colors.textSecondary, marginBottom: spacing.md, whiteSpace: 'nowrap' }}>Layout Spacing</div>
            {[
              { label: 'Level Gap', value: gaps.levelGap, setter: setLevelGap, min: 40, max: 300, suffix: 'px', step: 4 },
              { label: 'Sibling Gap', value: gaps.siblingGap, setter: setSiblingGap, min: 4, max: 120, suffix: 'px', step: 4 },
              { label: 'Child Gap', value: gaps.childGap, setter: setChildGap, min: 4, max: 80, suffix: 'px', step: 4 },
            ].map(g => (
              <div key={g.label} style={{ marginBottom: spacing.md }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fontSizes.caption, color: colors.textQuaternary, marginBottom: spacing.xxs }}>
                  <span>{g.label}</span>
                  <span>{g.value}{g.suffix}</span>
                </div>
                <input type="range" min={g.min} max={g.max} step={g.step} value={g.value}
                  onChange={e => g.setter(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: colors.accent }} />
              </div>
            ))}
            <div style={{ height: 1, background: colors.separator, margin: `${spacing.md}px 0` }} />
            <div style={{ fontSize: fontSizes.label, fontWeight: fontWeights.semibold, color: colors.textSecondary, marginBottom: spacing.md, whiteSpace: 'nowrap' }}>Node Defaults</div>
            {[
              { label: 'Padding', value: nodeDefaults.nodePadding, setter: setNodePadding, min: 2, max: 30, suffix: 'px', step: 2 },
              { label: 'Max chars/line', value: nodeDefaults.maxChars, setter: setMaxChars, min: 10, max: 100, suffix: '', step: 5 },
              { label: 'Font size', value: nodeDefaults.fontSize, setter: setFontSize, min: 8, max: 32, suffix: 'px', step: 1 },
            ].map(g => (
              <div key={g.label} style={{ marginBottom: spacing.md }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fontSizes.caption, color: colors.textQuaternary, marginBottom: spacing.xxs }}>
                  <span>{g.label}</span>
                  <span>{g.value}{g.suffix}</span>
                </div>
                <input type="range" min={g.min} max={g.max} step={g.step} value={g.value}
                  onChange={e => g.setter(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: colors.accent }} />
              </div>
            ))}
            <button onClick={() => { resetGaps(); setShowSpacing(false) }}
              style={{ fontSize: fontSizes.caption, color: colors.accent, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: fonts.ui }}>
              Reset defaults
            </button>
          </div>
        )}
      </div>

      {/* Theme */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => { closeAll(); setShowThemePick(p => !p) }} title={`Theme: ${theme.name}`}
          style={{ ...btnBase }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: theme.rootTopic.fill, border: `2px solid ${theme.rootTopic.stroke}` }} />
        </button>
        {showThemePick && (
          <div style={{ ...popoverBase, padding: spacing.md, minWidth: 160 }}>
            {themes.map(t => (
              <button key={t.id}
                onClick={() => { setTheme(t.id); setShowThemePick(false) }}
                style={{
                  display: 'block', width: '100%', padding: `${spacing.sm}px ${spacing.lg}px`,
                  border: 'none',
                  background: t.id === theme.id ? colors.accentLight : 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontSize: fontSizes.body,
                  borderRadius: radii.sm, color: t.id === theme.id ? colors.accent : colors.text,
                  fontFamily: fonts.ui, fontWeight: t.id === theme.id ? fontWeights.medium : fontWeights.regular,
                  transition: `background ${transitions.fast}`,
                }}
                onMouseEnter={e => { if (t.id !== theme.id) e.currentTarget.style.background = colors.bgTertiary }}
                onMouseLeave={e => { if (t.id !== theme.id) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{
                  display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                  background: t.rootTopic.fill, border: `2px solid ${t.rootTopic.stroke}`,
                  marginRight: spacing.md, verticalAlign: 'middle',
                }} />
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div style={{ position: 'relative' }}>
        {toolBtn(<LumenDownload size={16} strokeWidth={1.8} />, 'Export', showExport, () => { closeAll(); setShowExport(p => !p) })}
        {showExport && (
          <div style={{ ...popoverBase, padding: spacing.xs, minWidth: 140 }}>
            <MenuBtn onClick={() => { onExportSVG(); setShowExport(false) }}>SVG</MenuBtn>
            <MenuBtn onClick={() => { onExportPNG(); setShowExport(false) }}>PNG</MenuBtn>
            <MenuBtn onClick={() => { onExportPDF(); setShowExport(false) }}>PDF</MenuBtn>
            <div style={{ height: 1, background: colors.separator, margin: `${spacing.xs}px 0` }} />
            <MenuBtn onClick={() => { onExportXMind(); setShowExport(false) }}>XMind (.xmind)</MenuBtn>
            <MenuBtn onClick={() => { onExportMarkdown(); setShowExport(false) }}>Markdown (.md)</MenuBtn>
            <MenuBtn onClick={() => { onExportFreeMind(); setShowExport(false) }}>FreeMind (.mm)</MenuBtn>
            <MenuBtn onClick={() => { onExportOPML(); setShowExport(false) }}>OPML (.opml)</MenuBtn>
          </div>
        )}
      </div>

      {/* Import */}
      <div style={{ position: 'relative' }}>
        {toolBtn(<LumenUpload size={16} strokeWidth={1.8} />, 'Import', showImport, () => { closeAll(); setShowImport(p => !p) })}
        {showImport && (
          <div style={{ ...popoverBase, padding: spacing.xs, minWidth: 160 }}>
            <MenuBtn onClick={() => { onBatchImport(); setShowImport(false) }}>Batch import (multi-file)</MenuBtn>
            <div style={{ height: 1, background: colors.separator, margin: `${spacing.xs}px 0` }} />
            <MenuBtn onClick={() => { onImportXMind(); setShowImport(false) }}>XMind (.xmind)</MenuBtn>
            <MenuBtn onClick={() => { onImportJSON(); setShowImport(false) }}>JSON (AI context)</MenuBtn>
            <MenuBtn onClick={() => { onImportMarkdown(); setShowImport(false) }}>Markdown (.md)</MenuBtn>
            <MenuBtn onClick={() => { onImportFreeMind(); setShowImport(false) }}>FreeMind (.mm)</MenuBtn>
          </div>
        )}
      </div>

      {hasImportedData && toolBtn(<LumenX size={16} strokeWidth={1.8} />, 'Clear imported data', false, onClearImportData)}

      <div style={{ height: 1, background: colors.separator, margin: `${spacing.sm}px 0` }} />

      <div style={{ position: 'relative' }}>
        {toolBtn(<LumenUsers size={16} strokeWidth={1.8} />, `Online: ${presenceCount}`, false, onPresenceToggle)}
        {presenceCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 14, height: 14, borderRadius: '50%',
            background: colors.green, color: '#fff',
            fontSize: fontSizes.caption - 2, fontWeight: fontWeights.bold,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: fonts.mono,
          }}>{presenceCount}</span>
        )}
      </div>
      {toolBtn(<LumenBot size={16} strokeWidth={1.8} />, 'Local AI Server', false, onAIServer)}
      {toolBtn(<LumenSparkles size={16} strokeWidth={1.8} />, 'AI Summarize', false, summaryLoading ? () => {} : onSummarize)}
      {toolBtn(<LumenImageIcon size={16} strokeWidth={1.8} />, 'Generate Image (DALL-E)', false, onGenerateImage)}
    </div>
  )
}

function MenuBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
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
