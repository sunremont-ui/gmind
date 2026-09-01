import { useEffect, useId, useRef, useState } from 'react'
import type { Topic, UpdateTopicRequest } from '../../types'
import { ShapePicker } from '../PropertiesPanel/ShapePicker'
import { MEMORY_KINDS } from './memoryKinds'
import { colors, fonts, fontSizes, radii, shadows, spacing, z } from '../../styles/tokens'

interface Props {
  topic: Topic
  classOptions?: string[]
  x: number
  y: number
  onChange: (updates: Partial<UpdateTopicRequest>) => void
  onClose: () => void
}

export function NodeStyleQuickPicker({ topic, classOptions = [], x, y, onChange, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const classOptionsId = useId()
  const [className, setClassName] = useState(topic.memory_kind || '')
  const lastCommittedClass = useRef(topic.memory_kind || '')

  const commitClassName = () => {
    const memoryKind = className.trim()
    if (memoryKind === lastCommittedClass.current) return
    lastCommittedClass.current = memoryKind
    onChange({ memory_kind: memoryKind })
  }

  const closeAndCommit = () => {
    commitClassName()
    onClose()
  }

  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: z.overlay }}
        onPointerDown={closeAndCommit}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Стиль узла"
        style={{
          position: 'fixed',
          left: Math.max(8, Math.min(window.innerWidth - 310, x)),
          top: Math.max(8, Math.min(window.innerHeight - 430, y)),
          width: 294,
          padding: spacing.lg,
          background: colors.bgTertiary,
          border: `1px solid ${colors.separator}`,
          borderRadius: radii.xl,
          boxShadow: shadows.neuLg,
          fontFamily: fonts.ui,
          zIndex: z.overlay + 1,
        }}
        onPointerDown={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <div>
            <div style={{ color: colors.text, fontSize: fontSizes.subhead, fontWeight: 650 }}>
              Стиль узла
            </div>
            <div style={{ color: colors.textTertiary, fontSize: fontSizes.caption, marginTop: 2 }}>
              Tab — дальше · Enter — выбрать · Esc — закрыть
            </div>
          </div>
          <button
            type="button"
            aria-label="Закрыть выбор стиля"
            onClick={closeAndCommit}
            style={{ border: 0, background: 'transparent', color: colors.textTertiary, cursor: 'pointer', fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <div style={{ color: colors.textSecondary, fontSize: fontSizes.label, fontWeight: 600, marginBottom: spacing.xs }}>
          Форма
        </div>
        <ShapePicker
          value={topic.shape || 'rounded'}
          onChange={shape => onChange({ shape })}
        />

        <label style={{ display: 'block', marginTop: spacing.lg }}>
          <span style={{ display: 'block', color: colors.textSecondary, fontSize: fontSizes.label, fontWeight: 600, marginBottom: spacing.xs }}>
            Класс узла
          </span>
          <input
            type="text"
            list={classOptionsId}
            aria-label="Класс узла"
            value={className}
            placeholder="Выберите или введите свой класс"
            onChange={event => setClassName(event.target.value)}
            onBlur={commitClassName}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitClassName()
              }
            }}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: `${spacing.sm}px ${spacing.md}px`,
              color: colors.text, background: colors.bgSecondary,
              border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
              fontFamily: fonts.ui, fontSize: fontSizes.body,
            }}
          />
          <datalist id={classOptionsId}>
            {Object.entries(MEMORY_KINDS).map(([id, definition]) => (
              <option key={id} value={id}>{definition.icon} {definition.label}</option>
            ))}
            {classOptions.filter(id => !MEMORY_KINDS[id]).map(id => (
              <option key={id} value={id}>Пользовательский класс</option>
            ))}
          </datalist>
          <span style={{ display: 'block', color: colors.textTertiary, fontSize: fontSizes.caption, marginTop: spacing.xs }}>
            Можно выбрать готовый класс или создать новый именем в этом поле.
          </span>
        </label>
      </div>
    </>
  )
}
