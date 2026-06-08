// Anchor context menu — правый клик по якорю узла открывает выбор направления,
// в котором создать дочерний узел. (Левый клик создаёт узел сразу.)
import { useState, useEffect } from 'react'
import { useRelationshipsStore, type AnchorSide } from '../../store/relationships'
import { colors, fonts, fontSizes, spacing, radii, shadows } from '../../styles/tokens'

interface Props {
  // Создаёт дочерний узел у topicId в направлении side.
  onCreateChild: (topicId: string, side: AnchorSide) => void
}

const DIRECTIONS: Array<{ side: AnchorSide; arrow: string; label: string }> = [
  { side: 'top', arrow: '↑', label: 'Вверх' },
  { side: 'right', arrow: '→', label: 'Вправо' },
  { side: 'bottom', arrow: '↓', label: 'Вниз' },
  { side: 'left', arrow: '←', label: 'Влево' },
]

export function AnchorActionMenu({ onCreateChild }: Props) {
  const menu = useRelationshipsStore(s => s.anchorMenu)
  const close = useRelationshipsStore(s => s.closeAnchorMenu)
  const [side, setSide] = useState<AnchorSide>('right')

  // Sync the selected direction with whichever anchor was clicked.
  useEffect(() => {
    if (menu) setSide(menu.side)
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'Enter') {
        onCreateChild(menu.topicId, side)
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, side, close, onCreateChild])

  if (!menu) return null

  const handleCreate = (s: AnchorSide) => {
    onCreateChild(menu.topicId, s)
    close()
  }

  return (
    <>
      {/* Backdrop closes the menu on outside click. */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onPointerDown={close}
      />
      <div
        style={{
          position: 'fixed',
          left: Math.max(8, Math.min(window.innerWidth - 230, menu.screenX + 10)),
          top: Math.max(8, Math.min(window.innerHeight - 170, menu.screenY + 10)),
          width: 220,
          background: colors.bgTertiary,
          borderRadius: radii.xl,
          boxShadow: shadows.neuLg,
          padding: spacing.lg,
          fontFamily: fonts.ui,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.md,
        }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: fontSizes.subhead, fontWeight: 600, color: colors.text }}>
          Направление
        </div>
        <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>
          Куда создать дочерний узел
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: spacing.xs,
          }}
        >
          {DIRECTIONS.map(d => {
            const active = side === d.side
            return (
              <button
                key={d.side}
                onMouseEnter={() => setSide(d.side)}
                onClick={() => handleCreate(d.side)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  padding: `${spacing.sm}px ${spacing.sm}px`,
                  background: colors.bgTertiary,
                  boxShadow: active ? shadows.neuInsetSm : shadows.neuSm,
                  border: 'none',
                  borderRadius: radii.sm,
                  color: active ? colors.accent : colors.text,
                  fontSize: fontSizes.label,
                  fontFamily: fonts.ui,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{d.arrow}</span>
                {d.label}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => handleCreate(side)}
          style={{
            padding: `${spacing.sm}px ${spacing.md}px`,
            background: colors.accent,
            border: 'none',
            borderRadius: radii.sm,
            color: colors.textInverse,
            fontSize: fontSizes.label,
            fontWeight: 600,
            fontFamily: fonts.ui,
            cursor: 'pointer',
          }}
        >
          Создать
        </button>
      </div>
    </>
  )
}
