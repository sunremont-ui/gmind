// V6.1 — Wiki page editor (write-back). Create or overwrite a MASys wiki page
// in the active namespace via memory.wiki.write (upsert by slug).
import { useState } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface Props {
  initial?: { slug?: string; title?: string; content?: string; tags?: string[] }
  onClose: () => void
}

const SLUG_RE = /^[\w/-]+$/

export function WikiEditor({ initial, onClose }: Props) {
  const writeWiki = useMASysMemoryStore(s => s.writeWiki)
  const activeNamespace = useMASysMemoryStore(s => s.activeNamespace)

  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editing = !!initial?.slug
  const slugValid = slug === '' || SLUG_RE.test(slug)
  const canSave = slug.trim() !== '' && title.trim() !== '' && slugValid && !busy

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      await writeWiki({
        slug: slug.trim(),
        title: title.trim(),
        content,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      })
      onClose()
    } catch (e: any) {
      setError(e?.message ?? String(e))
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: colors.scrim ?? 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxHeight: '80vh', overflow: 'auto',
          background: colors.bgTertiary, boxShadow: shadows.neuLg ?? shadows.lg,
          borderRadius: radii.lg, padding: spacing.lg, fontFamily: fonts.ui,
          display: 'flex', flexDirection: 'column', gap: spacing.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: fontSizes.subhead, fontWeight: fontWeights.semibold, color: colors.text }}>
            📖 {editing ? 'Редактировать' : 'Новая'} wiki-страница
            <span style={{ color: colors.textTertiary, fontWeight: fontWeights.regular }}> · {activeNamespace}</span>
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textQuaternary }}>✕</button>
        </div>

        <LabeledInput label="slug" value={slug} onChange={setSlug} disabled={editing}
          placeholder="dir/page-name" invalid={!slugValid} mono />
        <LabeledInput label="Заголовок" value={title} onChange={setTitle} placeholder="Title" />
        <LabeledInput label="Теги (через запятую)" value={tags} onChange={setTags} placeholder="a, b" mono />

        <label style={{ fontSize: 10, color: colors.textTertiary }}>Содержимое (Markdown)</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={10}
          style={{
            resize: 'vertical', padding: spacing.sm,
            background: colors.bgTertiary, boxShadow: shadows.neuInsetSm,
            border: 'none', borderRadius: radii.sm, color: colors.text,
            fontSize: fontSizes.caption, fontFamily: fonts.mono, lineHeight: 1.5,
          }}
        />

        {!slugValid && <span style={{ fontSize: 10, color: '#ef4444' }}>slug: только буквы, цифры, -, /</span>}
        {error && <span style={{ fontSize: fontSizes.caption, color: '#ef4444' }}>✗ {error}</span>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs }}>
          <button onClick={onClose} style={btn(false)}>Отмена</button>
          <button onClick={save} disabled={!canSave} style={btn(canSave)}>
            {busy ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LabeledInput({ label, value, onChange, placeholder, disabled, invalid, mono }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; disabled?: boolean; invalid?: boolean; mono?: boolean
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: colors.textTertiary }}>{label}</span>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{
          padding: `${spacing.xs}px ${spacing.sm}px`,
          background: colors.bgTertiary,
          boxShadow: invalid ? `inset 0 0 0 1px #ef4444` : shadows.neuInsetSm,
          border: 'none', borderRadius: radii.sm,
          color: disabled ? colors.textTertiary : colors.text,
          fontSize: fontSizes.caption, fontFamily: mono ? fonts.mono : fonts.ui,
        }}
      />
    </label>
  )
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: `${spacing.xs}px ${spacing.md}px`,
    background: primary ? colors.accent : colors.bgTertiary,
    color: primary ? '#fff' : colors.textSecondary,
    boxShadow: primary ? 'none' : shadows.neuSm,
    border: 'none', borderRadius: radii.sm,
    fontSize: fontSizes.caption, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
    cursor: primary ? 'pointer' : 'pointer',
  }
}
