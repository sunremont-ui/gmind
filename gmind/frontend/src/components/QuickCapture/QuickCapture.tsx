import { useState, useRef, useEffect, useCallback } from 'react'
import { captureToInbox } from '../../utils/inbox'
import { api } from '../../api/client'
import { offlineStorage } from '../../utils/offline'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import type { Workbook } from '../../types'
import { LumenX, LumenLightbulb, LumenPlus } from '../UI/LumenIcon'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z } from '../../styles/tokens'

interface QuickCaptureProps {
  initialText?: string
  onClose: () => void
  onCaptured: () => void
}

const TAG_PRESETS = ['idea', 'todo', 'fix', 'note', 'question', 'reference']

export function QuickCapture({ initialText, onClose, onCaptured }: QuickCaptureProps) {
  const [text, setText] = useState(initialText || '')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [targetId, setTargetId] = useState('inbox')
  const [workbooks, setWorkbooks] = useState<Workbook[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const savingRef = useRef(false)
  const { online } = useOnlineStatus()

  useEffect(() => {
    if (!text) {
      const sel = window.getSelection()?.toString() || ''
      if (sel) setText(sel)
    }

    const loadWorkbooks = async () => {
      try {
        const list = await api.listWorkbooks()
        setWorkbooks(list)
      } catch {
        const cached = await offlineStorage.listWorkbooks()
        setWorkbooks(cached)
      }
    }
    loadWorkbooks()

    setTimeout(() => textRef.current?.focus(), 50)
  }, [])

  const addTag = useCallback((t: string) => {
    const trimmed = t.trim().toLowerCase().replace(/\s+/g, '-')
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
    }
    setTagInput('')
  }, [tags])

  const removeTag = useCallback((t: string) => {
    setTags(prev => prev.filter(x => x !== t))
  }, [])

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const buildTitle = () => {
    const tagPart = tags.map(t => `[${t}]`).join('')
    return tagPart ? `${tagPart} ${text.trim()}` : text.trim()
  }

  const handleSave = async () => {
    const trimmed = text.trim()
    if (!trimmed || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const title = buildTitle()
      if (targetId === 'inbox') {
        await captureToInbox(title)
      } else {
        const wb = workbooks.find(w => w.id === targetId) || await api.getWorkbook(targetId)
        const sheet = wb.sheets[0]
        if (sheet) {
          await api.createTopic(targetId, sheet.root_topic.id, title)
        }
      }
      setDone(true)
      onCaptured()
      setTimeout(onClose, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
      savingRef.current = false
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed', top: 60, right: 16, zIndex: z.modal + 900,
        fontFamily: fonts.ui,
      }}
    >
      <div style={{
        background: colors.bgTertiary,
        borderRadius: radii.xl,
        padding: spacing.lg,
        width: 400,
        boxShadow: shadows.neuLg,
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <LumenLightbulb size={16} strokeWidth={1.8} color={colors.accent} />
            <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>
              Quick Capture
            </span>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex',
            color: colors.textTertiary, padding: 0,
            transition: `color ${transitions.fast}`,
          }}
            onMouseEnter={e => e.currentTarget.style.color = colors.text}
            onMouseLeave={e => e.currentTarget.style.color = colors.textTertiary}
          ><LumenX size={16} strokeWidth={1.8} /></button>
        </div>

        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Capture a thought, idea, or task..."
          rows={3}
          style={{
            width: '100%', resize: 'none', padding: `${spacing.md}px ${spacing.lg}px`, fontSize: fontSizes.body,
            fontFamily: fonts.ui, border: 'none',
            borderRadius: radii.md, outline: 'none', color: done ? colors.green : colors.text,
            background: colors.bgTertiary, lineHeight: 1.5, boxSizing: 'border-box',
            boxShadow: shadows.neuInsetSm, transition: `box-shadow ${transitions.fast}`,
          }}
          onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
          onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
        />

        <div>
          <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.xs }}>
            {tags.map(t => (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing.xxs,
                padding: `${spacing.xxs}px ${spacing.md}px`, background: colors.accentLight,
                color: colors.accent, borderRadius: radii.full,
                fontSize: fontSizes.caption, fontWeight: fontWeights.medium,
              }}>
                {t}
                <button onClick={() => removeTag(t)} style={{
                  border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex',
                  color: 'inherit', padding: 0,
                }}><LumenX size={12} strokeWidth={2.5} /></button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add tag..."
              style={{
                flex: 1, padding: `${spacing.xs}px ${spacing.md}px`, fontSize: fontSizes.caption,
                fontFamily: fonts.ui, border: 'none',
                borderRadius: radii.sm, outline: 'none', background: colors.bgTertiary,
                color: colors.text, boxShadow: shadows.neuInsetSm,
                transition: `box-shadow ${transitions.fast}`,
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
            <button onClick={() => addTag(tagInput)} disabled={!tagInput.trim()} style={{
              border: 'none', background: colors.accent, color: colors.textInverse,
              borderRadius: radii.sm, width: 24, height: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: tagInput.trim() ? 1 : 0.4,
              transition: `opacity ${transitions.fast}`,
            }}><LumenPlus size={14} strokeWidth={2.5} /></button>
          </div>
          <div style={{ display: 'flex', gap: spacing.xxs, flexWrap: 'wrap', marginTop: spacing.xs }}>
            {TAG_PRESETS.filter(t => !tags.includes(t)).map(t => (
              <button key={t} onClick={() => addTag(t)} style={{
                border: 'none', background: colors.bgTertiary, boxShadow: shadows.neuSm,
                borderRadius: radii.full, padding: `${spacing.xxs}px ${spacing.md}px`, cursor: 'pointer',
                fontSize: fontSizes.caption, color: colors.textTertiary, fontFamily: fonts.ui,
                display: 'inline-flex', alignItems: 'center', gap: spacing.xxs,
                transition: `box-shadow ${transitions.fast}`,
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'none' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = shadows.neuSm }}
              ><LumenPlus size={10} strokeWidth={2.5} />{t}</button>
            ))}
          </div>
        </div>

        {workbooks.length > 1 && (
          <div>
            <label style={{ fontSize: fontSizes.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing.xs }}>
              Target:
            </label>
            <select
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              style={{
                width: '100%', padding: `${spacing.sm}px ${spacing.md}px`, fontSize: fontSizes.body,
                fontFamily: fonts.ui, border: 'none',
                borderRadius: radii.sm, outline: 'none', background: colors.bgTertiary,
                color: colors.text, boxShadow: shadows.neuInsetSm, cursor: 'pointer',
                transition: `box-shadow ${transitions.fast}`,
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            >
              <option value="inbox">Inbox</option>
              {workbooks.filter(w => w.title !== 'Inbox').map(w => (
                <option key={w.id} value={w.id}>{w.title}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xxs }}>
            {error && (
              <span style={{ fontSize: fontSizes.caption, color: colors.red }}>{error}</span>
            )}
            <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>
              {done ? 'Saved' : online ? 'Cmd+Enter to save \u00B7 Esc to cancel' : 'Offline \u00B7 will sync later'}
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving || done}
            style={{
              padding: `${spacing.sm}px ${spacing.xl}px`, border: 'none', borderRadius: radii.md,
              background: done ? colors.green : !text.trim() || saving ? colors.fill : colors.accent,
              color: done ? colors.textInverse : !text.trim() || saving ? colors.textTertiary : colors.textInverse,
              cursor: (!text.trim() || saving || done) ? 'default' : 'pointer',
              fontSize: fontSizes.body, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
              boxShadow: !text.trim() || saving || done ? 'none' : shadows.neuSm,
              transition: `box-shadow ${transitions.fast}`,
            }}
            onMouseEnter={e => { if (!done && text.trim() && !saving) e.currentTarget.style.boxShadow = 'none' }}
            onMouseLeave={e => { if (!done && text.trim() && !saving) e.currentTarget.style.boxShadow = shadows.neuSm }}
          >
            {done ? 'Saved' : saving ? 'Saving...' : 'Capture'}
          </button>
        </div>
      </div>
    </div>
  )
}
