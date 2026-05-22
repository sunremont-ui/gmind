import { useState, useEffect, useRef } from 'react'
import { useAgentStore } from '../../store/agent'
import type { Comment } from '../../types/agent'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

interface CommentsPanelProps {
  topicId: string
  topicTitle: string
  workbookId?: string
  onClose: () => void
}

export function CommentsPanel({ topicId, topicTitle, workbookId: _workbookId, onClose }: CommentsPanelProps) {
  const comments = useAgentStore(s => s.comments)
  const fetchComments = useAgentStore(s => s.fetchComments)
  const addComment = useAgentStore(s => s.addComment)
  const removeComment = useAgentStore(s => s.removeComment)

  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchComments(topicId)
  }, [topicId, fetchComments])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim() || sending) return

    setSending(true)
    try {
      await addComment(topicId, inputValue.trim())
      setInputValue('')
    } catch { /* ignore */ }
    setSending(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await removeComment(id)
    } catch { /* ignore */ }
    setDeletingId(null)
  }

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ts
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: colors.scrim,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      fontFamily: fonts.ui,
    }}>
      <div style={{
        background: colors.bgSecondary,
        borderRadius: 18,
        padding: spacing.xxxl,
        width: 480, maxHeight: '80vh',
        boxShadow: shadows.neuLg,
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: spacing.lg,
        }}>
          <h2 style={{
            fontSize: fontSizes.title, fontWeight: fontWeights.semibold,
            color: colors.text, margin: 0,
          }}>
            💬 Комментарии
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: `${spacing.xxs}px ${spacing.md}px`,
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textQuaternary,
              fontSize: fontSizes.bodyLarge,
              transition: `color ${transitions.fast}`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = colors.text}
            onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
          >
            ✕
          </button>
        </div>

        <div style={{
          fontSize: fontSizes.caption, color: colors.textSecondary,
          marginBottom: spacing.md,
        }}>
          Топик: {topicTitle}
        </div>

        {/* Comment list */}
        <div style={{
          flex: 1, overflow: 'auto',
          background: colors.bg,
          borderRadius: radii.md,
          padding: spacing.md,
          boxShadow: shadows.neuInsetSm,
          marginBottom: spacing.md,
        }}>
          {comments.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: spacing.xl,
              color: colors.textQuaternary, fontSize: fontSizes.body,
            }}>
              Нет комментариев. Будьте первым!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {comments.map(comment => (
                <div
                  key={comment.id}
                  style={{
                    display: 'flex', gap: spacing.sm,
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: radii.sm,
                    background: colors.bgTertiary,
                    transition: `background ${transitions.fast}`,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: colors.accent + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: fontSizes.caption, fontWeight: fontWeights.bold,
                    color: colors.accent,
                  }}>
                    {comment.user_id?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: fontSizes.caption, color: colors.textSecondary,
                      marginBottom: spacing.xxs,
                    }}>
                      {comment.user_id || 'Unknown'} · {formatTime(comment.created_at)}
                    </div>
                    <div style={{
                      fontSize: fontSizes.body, color: colors.text,
                      lineHeight: 1.5, wordBreak: 'break-word',
                    }}>
                      {comment.content}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    style={{
                      padding: spacing.xxs,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: colors.textQuaternary,
                      opacity: 0.6,
                      transition: `all ${transitions.fast}`,
                      fontSize: fontSizes.body,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = colors.red
                      e.currentTarget.style.opacity = '1'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = colors.textQuaternary
                      e.currentTarget.style.opacity = '0.6'
                    }}
                    title="Удалить комментарий"
                  >
                    {deletingId === comment.id ? '⌛' : '🗑'}
                  </button>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: spacing.sm }}>
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Напишите комментарий..."
            style={{
              flex: 1,
              padding: `${spacing.sm}px ${spacing.md}px`,
              border: `1px solid ${colors.separator}`,
              borderRadius: radii.sm,
              background: colors.bg,
              color: colors.text,
              fontSize: fontSizes.body,
              fontFamily: fonts.ui,
              outline: 'none',
              transition: `border-color ${transitions.fast}`,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = colors.accent }}
            onBlur={e => { e.currentTarget.style.borderColor = colors.separator }}
          />
          <button
            type="submit"
            disabled={sending || !inputValue.trim()}
            style={{
              padding: `${spacing.sm}px ${spacing.xl}px`,
              background: colors.accent,
              color: colors.textInverse,
              border: 'none',
              borderRadius: radii.sm,
              cursor: sending || !inputValue.trim() ? 'default' : 'pointer',
              fontSize: fontSizes.body,
              fontWeight: fontWeights.semibold,
              fontFamily: fonts.ui,
              transition: `all ${transitions.fast}`,
              opacity: sending || !inputValue.trim() ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (!sending && inputValue.trim()) e.currentTarget.style.background = colors.accentHover
            }}
            onMouseLeave={e => {
              if (!sending && inputValue.trim()) e.currentTarget.style.background = colors.accent
            }}
          >
            {sending ? '⏳' : 'Отправить'}
          </button>
        </form>
      </div>
    </div>
  )
}