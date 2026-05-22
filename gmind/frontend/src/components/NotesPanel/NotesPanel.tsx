import { useState, useEffect, useRef } from 'react'
import { useNotesStore } from '../../store/notes'
import type { Note } from '../../api/notes'
import type { ModulePanelProps } from '../../modules/types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

export function NotesPanel({ workbookId, onClose }: ModulePanelProps) {
  const notes = useNotesStore(s => s.notes)
  const loading = useNotesStore(s => s.loading)
  const searchQuery = useNotesStore(s => s.searchQuery)
  const fetchNotes = useNotesStore(s => s.fetchNotes)
  const createNote = useNotesStore(s => s.createNote)
  const updateNote = useNotesStore(s => s.updateNote)
  const deleteNote = useNotesStore(s => s.deleteNote)
  const setSearchQuery = useNotesStore(s => s.setSearchQuery)

  const [input, setInput] = useState('')
  const [inputTags, setInputTags] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Focus input when gmind:focus-note-input event fires
  useEffect(() => {
    const handler = () => inputRef.current?.focus()
    window.addEventListener('gmind:focus-note-input', handler)
    return () => window.removeEventListener('gmind:focus-note-input', handler)
  }, [])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const tags = inputTags.split(',').map(t => t.trim()).filter(Boolean)
      await createNote({
        content,
        tags,
        source: 'manual',
        workbook_id: workbookId ?? undefined,
      })
      setInput('')
      setInputTags('')
    } finally {
      setSending(false)
    }
  }

  const handleInputKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      width: 360,
      background: colors.bgTertiary,
      boxShadow: '-2px 0 24px rgba(15, 15, 25, 0.08), -1px 0 0 rgba(15,15,25,0.06)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: fonts.ui,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${spacing.md}px ${spacing.xl}px`,
        borderBottom: `1px solid ${colors.separator}`,
        flexShrink: 0,
        background: colors.bgTertiary,
      }}>
        <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>
          Notes
        </span>
        <button
          onClick={onClose}
          style={{
            padding: `${spacing.xxs}px ${spacing.md}px`,
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textQuaternary, fontSize: fontSizes.bodyLarge, fontFamily: fonts.ui,
            transition: `color ${transitions.fast}`,
          }}
          onMouseEnter={e => e.currentTarget.style.color = colors.text}
          onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
        >
          ✕
        </button>
      </div>

      {/* Quick input */}
      <div style={{
        padding: spacing.md,
        borderBottom: `1px solid ${colors.separator}`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
        flexShrink: 0,
        background: colors.bg,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleInputKey}
          placeholder="Write a thought… (Enter to save)"
          rows={3}
          style={{
            width: '100%',
            resize: 'none',
            border: `1px solid ${colors.separator}`,
            borderRadius: radii.sm,
            background: colors.bgSecondary,
            color: colors.text,
            fontSize: fontSizes.body,
            fontFamily: fonts.ui,
            padding: `${spacing.sm}px ${spacing.md}px`,
            outline: 'none',
            boxSizing: 'border-box',
            transition: `border-color ${transitions.fast}`,
          }}
          onFocus={e => e.currentTarget.style.borderColor = colors.accent}
          onBlur={e => e.currentTarget.style.borderColor = colors.separator}
        />
        <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
          <input
            value={inputTags}
            onChange={e => setInputTags(e.target.value)}
            placeholder="tags: idea, work, …"
            style={{
              flex: 1,
              border: `1px solid ${colors.separator}`,
              borderRadius: radii.sm,
              background: colors.bgSecondary,
              color: colors.textSecondary,
              fontSize: fontSizes.label,
              fontFamily: fonts.ui,
              padding: `${spacing.xxs}px ${spacing.md}px`,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              padding: `${spacing.xs}px ${spacing.lg}px`,
              background: input.trim() ? colors.accent : colors.textQuaternary,
              color: colors.textInverse,
              border: 'none',
              borderRadius: radii.sm,
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              fontSize: fontSizes.label,
              fontWeight: fontWeights.medium,
              fontFamily: fonts.ui,
              transition: `background ${transitions.fast}`,
              flexShrink: 0,
            }}
          >
            {sending ? '…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: `${spacing.xs}px ${spacing.md}px`, flexShrink: 0 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search notes…"
          style={{
            width: '100%',
            border: `1px solid ${colors.separator}`,
            borderRadius: radii.sm,
            background: colors.bgSecondary,
            color: colors.text,
            fontSize: fontSizes.body,
            fontFamily: fonts.ui,
            padding: `${spacing.xs}px ${spacing.md}px`,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Notes list */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `0 ${spacing.md}px ${spacing.md}px` }}>
        {loading && notes.length === 0 ? (
          <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textQuaternary, fontSize: fontSizes.body }}>
            Loading…
          </div>
        ) : notes.length === 0 ? (
          <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textQuaternary, fontSize: fontSizes.body }}>
            {searchQuery ? 'No notes matching your search' : 'No notes yet'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingTop: spacing.sm }}>
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onPin={() => updateNote(note.id, { pinned: !note.pinned })}
                onDelete={() => deleteNote(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NoteCard({ note, onPin, onDelete }: { note: Note; onPin: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  const date = new Date(note.created_at).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      style={{
        padding: `${spacing.md}px ${spacing.lg}px`,
        borderRadius: radii.md,
        background: note.pinned ? colors.accentLight : colors.bgSecondary,
        boxShadow: shadows.neuSm,
        border: note.pinned ? `1px solid ${colors.accentLight}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        fontSize: fontSizes.body,
        color: colors.text,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.5,
      }}>
        {note.content}
      </div>

      {note.tags.length > 0 && (
        <div style={{ display: 'flex', gap: spacing.xxs, flexWrap: 'wrap' }}>
          {note.tags.map(tag => (
            <span key={tag} style={{
              fontSize: fontSizes.caption,
              color: colors.accent,
              background: colors.accentLight,
              padding: '1px 6px',
              borderRadius: radii.sm,
              fontWeight: fontWeights.medium,
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: fontSizes.caption, color: colors.textQuaternary }}>
          {date}
          {note.source !== 'manual' && (
            <span style={{ marginLeft: spacing.xs, color: colors.textQuaternary }}>· {note.source}</span>
          )}
        </span>

        {hovered && (
          <div style={{ display: 'flex', gap: spacing.xxs }}>
            <button
              onClick={onPin}
              title={note.pinned ? 'Unpin' : 'Pin'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: note.pinned ? colors.accent : colors.textQuaternary,
                fontSize: fontSizes.caption, padding: `${spacing.xxs}px ${spacing.xs}px`,
                transition: `color ${transitions.fast}`,
              }}
              onMouseEnter={e => e.currentTarget.style.color = colors.accent}
              onMouseLeave={e => e.currentTarget.style.color = note.pinned ? colors.accent : colors.textQuaternary}
            >
              📌
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textQuaternary,
                fontSize: fontSizes.caption, padding: `${spacing.xxs}px ${spacing.xs}px`,
                transition: `color ${transitions.fast}`,
              }}
              onMouseEnter={e => e.currentTarget.style.color = colors.red}
              onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
