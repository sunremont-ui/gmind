import { useCallback, useRef, useEffect } from 'react'
import { colors, fonts, radii, shadows } from '../../styles/tokens'

// Высота зоны тулбара над текстом (кнопки 26 + зазор 8). TopicNode сдвигает
// foreignObject вверх ровно на эту величину, чтобы текст совпал с рамкой узла.
export const TOOLBAR_OFFSET = 34

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onSave: (html: string) => void
  /** Сохранить текст и передать Tab следующему шагу — выбору формы/класса. */
  onStyleRequest?: (html: string) => void
  onCancel: () => void
  /** Сообщает фактическую высоту текста — узел растёт при наборе. */
  onResize?: (height: number) => void
  fontSize: number
  fontFamily: string
  fontColor: string
  textAlign: string
  minHeight?: number
}

export function RichTextEditor({ value, onChange, onSave, onStyleRequest, onCancel, onResize, fontSize, fontFamily, fontColor, textAlign, minHeight = 32 }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value
      ref.current.focus()
      const sel = window.getSelection()
      if (sel) {
        // Выделяем весь текст узла (двойной клик → правка всего текста).
        const range = document.createRange()
        range.selectNodeContents(ref.current)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [])

  // Авторост: contentEditable имеет height:auto, наблюдаем фактическую высоту
  // и сообщаем наверх — TopicNode растягивает прямоугольник узла под текст.
  useEffect(() => {
    const el = ref.current
    if (!el || !onResize) return
    onResize(Math.ceil(el.offsetHeight))
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => onResize(Math.ceil(el.offsetHeight)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [onResize])

  const getHtml = useCallback(() => ref.current?.innerHTML || '', [])

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    ref.current?.focus()
    onChange(getHtml())
  }, [onChange, getHtml])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); exec('bold') }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); exec('italic') }
    else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const html = getHtml()
      if (onStyleRequest) onStyleRequest(html)
      else onSave(html)
    }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(getHtml()) }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }, [exec, onSave, onStyleRequest, onCancel, getHtml])

  // Клик вне редактора (по пустому холсту/другому узлу) → коммитим правку.
  // Кнопки тулбара используют onMouseDown+preventDefault, поэтому blur от них
  // не срабатывает и преждевременного сохранения нет.
  const handleBlur = useCallback(() => {
    onSave(getHtml())
  }, [onSave, getHtml])

  const btnStyle: React.CSSProperties = {
    border: 'none', background: 'transparent',
    cursor: 'pointer', padding: '0 5px',
    fontSize: 12, fontFamily: fonts.ui,
    color: colors.textSecondary, borderRadius: radii.sm,
    lineHeight: '22px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Плавающий тулбар над узлом — не съедает место под текст */}
      <div style={{
        display: 'flex', gap: 2, padding: '2px 4px',
        alignSelf: 'flex-start', height: 26, marginBottom: 8,
        background: colors.bgTertiary, borderRadius: radii.md,
        border: `1px solid ${colors.separator}`,
        boxShadow: shadows.md,
        flexShrink: 0, boxSizing: 'border-box',
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
        <span style={{ ...btnStyle, cursor: 'default', opacity: 0.6, fontSize: 10 }}>Enter — сохранить · Tab — стиль · Shift+Enter — строка</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onInput={() => onChange(getHtml())}
        style={{
          outline: 'none', padding: '6px 8px',
          fontSize, fontFamily, color: fontColor,
          textAlign: textAlign as any,
          minHeight,
          height: 'auto',
          overflow: 'hidden',
          lineHeight: 1.4,
          background: 'transparent',
          wordBreak: 'break-word', overflowWrap: 'break-word',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
