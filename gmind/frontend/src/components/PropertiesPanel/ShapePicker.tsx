// Визуальный выбор формы узла: миниатюры рисуются тем же контуром,
// что и настоящие узлы (renderer/shapes), поэтому превью не врёт.
import { NODE_SHAPES, shapePath } from '../../renderer/shapes'
import { colors, fontSizes, spacing, radii, transitions } from '../../styles/tokens'

interface ShapePickerProps {
  value: string
  onChange: (shape: string) => void
}

const TILE_W = 54
const TILE_H = 30

export function ShapePicker({ value, onChange }: ShapePickerProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.xs }}>
      {NODE_SHAPES.map(s => {
        const selected = (value || 'rounded') === s.id
        return (
          <button
            key={s.id}
            type="button"
            title={s.label}
            aria-label={s.label}
            aria-pressed={selected}
            onClick={() => onChange(s.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: spacing.xs,
              background: selected ? colors.accentLight : 'transparent',
              border: `1px solid ${selected ? colors.accent : colors.separator}`,
              borderRadius: radii.sm,
              cursor: 'pointer',
              transition: transitions.fast,
            }}
          >
            <svg width={TILE_W} height={TILE_H} viewBox={`-4 -4 ${TILE_W + 8} ${TILE_H + 8}`} aria-hidden>
              <path
                d={shapePath(s.id, TILE_W, TILE_H, 7)}
                fill={selected ? colors.accent : colors.fill}
                stroke={selected ? colors.accent : colors.textTertiary}
                strokeWidth={1.2}
                opacity={selected ? 0.85 : 1}
              />
            </svg>
            <span style={{
              fontSize: 9,
              color: selected ? colors.accent : colors.textTertiary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: TILE_W + 8,
            }}>
              {s.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Превью узла выбранной формы с текущей типографикой. */
export function ShapePreview({
  shape,
  label,
  fontSize,
  fontWeight,
  fontFamily,
  fontColor,
  opacity,
}: {
  shape: string
  label: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  fontColor?: string
  opacity?: number
}) {
  const w = 190
  const h = 56
  return (
    <svg width={w} height={h} style={{ opacity: opacity ?? 1, overflow: 'visible' }}>
      <path
        d={shapePath(shape, w, h, 10)}
        fill={colors.accentLight}
        stroke={colors.accent}
        strokeWidth={2}
      />
      <foreignObject x={0} y={0} width={w} height={h}>
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 14px', boxSizing: 'border-box',
          fontSize: fontSize || fontSizes.body,
          fontWeight: fontWeight || 500,
          fontFamily: fontFamily || undefined,
          color: fontColor || colors.accent,
          textAlign: 'center',
          overflow: 'hidden',
        }}>
          {label}
        </div>
      </foreignObject>
    </svg>
  )
}
