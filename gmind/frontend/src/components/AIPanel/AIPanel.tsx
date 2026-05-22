import { useState } from 'react'
import { api } from '../../api/client'
import { useMindMapStore } from '../../store/mindmap'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, sizes } from '../../styles/tokens'

interface AIPanelProps {
  workbookId: string | null
  onClose: () => void
}

export function AIPanel({ workbookId, onClose }: AIPanelProps) {
  const [mode, setMode] = useState<'generate' | 'chat'>('generate')
  const [prompt, setPrompt] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([])
  const activeSheetId = useMindMapStore(s => s.activeSheetId)
  const selectedTopicId = useMindMapStore(s => s.selectedTopicId)
  const setWorkbook = useMindMapStore(s => s.setWorkbook)
  const activeSheet = useMindMapStore(s => s.workbook?.sheets.find(sh => sh.id === s.activeSheetId))

  const handleGenerate = async () => {
    if (!prompt.trim() || !activeSheetId) return
    setLoading(true)
    try {
      await api.aiGenerate(workbookId ?? '', prompt, activeSheetId, selectedTopicId ?? undefined)
      const wb = await api.getWorkbook(workbookId ?? '')
      setWorkbook(wb)
      setPrompt('')
    } catch (err) {
      console.error('AI generation failed:', err)
    }
    setLoading(false)
  }

  const handleChat = async () => {
    if (!message.trim() || !activeSheetId) return
    setChatHistory(prev => [...prev, { role: 'user', content: message }])
    setLoading(true)
    try {
      const result = await api.aiChat(workbookId ?? '', activeSheetId, message)
      setChatHistory(prev => [...prev, { role: 'assistant', content: result.reply }])
      setMessage('')
    } catch (err) {
      console.error('AI chat failed:', err)
    }
    setLoading(false)
  }

  return (
    <div style={{
      width: sizes.aiPanel,
      height: '100%',
      background: colors.bgTertiary,
      borderLeft: 'none',
      boxShadow: shadows.neuInset,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: fonts.ui,
      overflow: 'hidden',
    }}>
      {/* Tabs — Lumen segmented */}
      <div style={{
        display: 'flex', gap: spacing.xxs,
        padding: spacing.sm, margin: spacing.sm,
        borderRadius: 12,
        background: colors.bgTertiary,
        boxShadow: shadows.neuInset,
      }}>
        <TabButton active={mode === 'generate'} onClick={() => setMode('generate')}>Generate</TabButton>
        <TabButton active={mode === 'chat'} onClick={() => setMode('chat')}>Chat</TabButton>
      </div>

      {/* Imported data notice */}
      {activeSheet?.imported_data && (
        <div style={{
          padding: `${spacing.xs}px ${spacing.lg}px`,
          fontSize: fontSizes.caption,
          background: colors.orange + '15',
          color: colors.orange,
          borderBottom: `1px solid ${colors.orange}30`,
          display: 'flex', alignItems: 'center', gap: spacing.xs,
        }}>
          <span>📄</span>
          <span>Imported data ({activeSheet.imported_data.length} chars) available as AI context</span>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: spacing.xl }}>
        {mode === 'generate' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <p style={{ fontSize: fontSizes.body, color: colors.textSecondary, margin: 0, lineHeight: 1.6 }}>
              Describe the mind map you want to create. AI will generate topics and sub-topics.
            </p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g.: Create a mind map about machine learning concepts..."
              rows={6}
              style={{
                width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
                fontSize: fontSizes.body, fontFamily: fonts.ui,
                border: 'none',
                borderRadius: radii.md, resize: 'vertical', outline: 'none',
                background: colors.bgTertiary, color: colors.text, lineHeight: 1.5,
                boxSizing: 'border-box',
                boxShadow: shadows.neuInsetSm,
                transition: `box-shadow ${transitions.fast}`,
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={{
                width: '100%', padding: `${spacing.md}px`,
                background: loading || !prompt.trim() ? colors.fill : colors.accent,
                color: loading || !prompt.trim() ? colors.textTertiary : colors.textInverse,
                border: 'none', borderRadius: radii.md,
                cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                fontSize: fontSizes.body, fontWeight: fontWeights.semibold,
                fontFamily: fonts.ui,
                transition: `all ${transitions.fast}`,
              }}
            >
              {loading ? 'Generating…' : 'Generate Mind Map'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: spacing.md }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {chatHistory.length === 0 && (
                <p style={{ fontSize: fontSizes.body, color: colors.textQuaternary, textAlign: 'center', marginTop: spacing.block }}>
                  Ask me anything about your mind map!
                </p>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} style={{
                  marginBottom: spacing.md, padding: `${spacing.md}px ${spacing.lg}px`,
                  borderRadius: radii.md,
                  background: msg.role === 'user' ? colors.accentLight : colors.bg,
                  border: `1px solid ${msg.role === 'user' ? colors.accent + '30' : colors.separator}`,
                  fontSize: fontSizes.body, lineHeight: 1.6, color: colors.text,
                }}>
                  <strong style={{
                    color: msg.role === 'user' ? colors.accent : colors.green,
                    display: 'block', marginBottom: spacing.xs,
                    fontSize: fontSizes.caption, textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </strong>
                  {msg.content}
                </div>
              ))}
              {loading && (
                <div style={{ textAlign: 'center', color: colors.textQuaternary, fontSize: fontSizes.body, padding: spacing.xxl }}>
                  Thinking…
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat() } }}
                placeholder="Ask AI…"
                style={{
                  flex: 1, padding: `${spacing.sm}px ${spacing.lg}px`,
                  fontSize: fontSizes.body, fontFamily: fonts.ui,
                  border: 'none',
                  borderRadius: radii.md, outline: 'none',
                  background: colors.bgTertiary, color: colors.text,
                  boxShadow: shadows.neuInsetSm,
                  transition: `box-shadow ${transitions.fast}`,
                }}
                onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
                onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
              />
              <button
                onClick={handleChat}
                disabled={loading || !message.trim()}
                style={{
                  padding: `${spacing.sm}px ${spacing.lg}px`,
                  background: loading || !message.trim() ? colors.fill : colors.accent,
                  color: loading || !message.trim() ? colors.textTertiary : colors.textInverse,
                  border: 'none', borderRadius: radii.md,
                  cursor: loading || !message.trim() ? 'not-allowed' : 'pointer',
                  fontSize: fontSizes.body, fontWeight: fontWeights.medium,
                  fontFamily: fonts.ui,
                  transition: `all ${transitions.fast}`,
                }}
              >Send</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <button
        onClick={onClose}
        style={{
          padding: `${spacing.md}px`,
          border: 'none', borderTop: `1px solid ${colors.separator}`,
          background: colors.bg, cursor: 'pointer',
          fontSize: fontSizes.body, color: colors.textSecondary,
          fontFamily: fonts.ui,
          transition: `background ${transitions.fast}`,
        }}
        onMouseEnter={e => e.currentTarget.style.background = colors.bgTertiary}
        onMouseLeave={e => e.currentTarget.style.background = colors.bg}
      >
        Close AI Panel
      </button>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: `${spacing.md}px`,
        border: 'none', borderRadius: 8,
        background: 'transparent',
        cursor: 'pointer',
        fontSize: fontSizes.body,
        fontWeight: active ? fontWeights.semibold : fontWeights.regular,
        color: active ? colors.text : colors.textTertiary,
        fontFamily: fonts.ui,
        transition: `all ${transitions.fast}`,
        boxShadow: active ? shadows.neuSm : 'none',
      }}
    >
      {children}
    </button>
  )
}
