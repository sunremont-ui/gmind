import { useCallback, useRef, useEffect } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii } from '../../styles/tokens'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onSave: (html: string) => void
  onCancel: () => void
  fontSize: number
  fontFamily: string
  fontColor: string
  textAlign: string
}

export function RichTextEditor({ value, onChange, onSave, onCancel, fontSize, fontFamily, fontColor, textAlign }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value
      ref.current.focus()
      const sel = window.getSelection()
      if (sel) {
        const range = document.createRange()
        range.selectNodeContents(ref.current)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [])

  const getHtml = useCallback(() => ref.current?.innerHTML || '', [])

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    ref.current?.focus()
    onChange(getHtml())
  }, [onChange, getHtml])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); exec('bold') }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); exec('italic') }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(getHtml()) }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }, [exec, onSave, onCancel, getHtml])

  const handleBlur = useCallback(() => {
    onChange(getHtml())
  }, [onChange, getHtml])

  const btnStyle: React.CSSProperties = {
    border: 'none', background: 'transparent',
    cursor: 'pointer', padding: '0 4px',
    fontSize: 11, fontFamily: fonts.ui,
    color: colors.textSecondary, borderRadius: radii.sm,
    lineHeight: '18px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onInput={() => onChange(getHtml())}
        style={{
          flex: 1, outline: 'none', padding: '2px 4px',
          fontSize, fontFamily, color: fontColor,
          textAlign: textAlign as any,
          overflow: 'auto',
          lineHeight: 1.4,
          background: 'transparent',
        }}
      />
      <div style={{
        display: 'flex', gap: 2, padding: '1px 2px',
        borderTop: `1px solid ${colors.separator}`, flexShrink: 0,
        background: colors.bgTertiary,
      }}>
        <button style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('bold') }} title="Bold (Ctrl+B)"><b>B</b></button>
        <button style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('italic') }} title="Italic (Ctrl+I)"><i>I</i></button>
        <button style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }} title="Bullet list">•≡</button>
        <button style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('insertOrderedList') }} title="Numbered list">1.</button>
        <button style={btnStyle} onMouseDown={e => {
          e.preventDefault()
          const url = prompt('Image URL:')
          if (url) exec('insertImage', url)
        }} title="Insert image">🖼</button>
      </div>
    </div>
  )
}
