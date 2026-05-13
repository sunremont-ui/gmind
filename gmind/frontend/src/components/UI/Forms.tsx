import type { CSSProperties, ReactNode } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

// ─── Shared control style ────────────────────────────
const controlBase: CSSProperties = {
  width: '100%',
  padding: `${spacing.sm + 1}px ${spacing.lg}px`,
  fontSize: fontSizes.body,
  fontFamily: fonts.ui,
  border: 'none',
  borderRadius: radii.sm,
  outline: 'none',
  background: colors.bgTertiary,
  color: colors.text,
  boxSizing: 'border-box',
  boxShadow: shadows.neuInsetSm,
  transition: `box-shadow ${transitions.fast}`,
}

const controlFocus: CSSProperties = {
  boxShadow: `inset 1px 1px 2px rgba(120,140,180,0.30), inset -1px -1px 2px #FFFFFF, 0 0 0 3px ${colors.accentLight}`,
}

// ─── Select ──────────────────────────────────────────
interface SelectOption {
  value: string | number
  label: string
  style?: CSSProperties
}

interface SelectProps {
  value: string | number
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  style?: CSSProperties
  label?: string
}

export function Select({ value, onChange, options, placeholder, style, label }: SelectProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <span style={{ display: 'block', fontSize: fontSizes.label, fontWeight: fontWeights.medium, color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: fonts.ui }}>
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => { e.currentTarget.style.boxShadow = controlFocus.boxShadow as string }}
        onBlur={e => { e.currentTarget.style.boxShadow = controlBase.boxShadow as string }}
        style={{ ...controlBase, cursor: 'pointer', ...style }}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} style={o.style}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── NumberInput ─────────────────────────────────────
interface NumberInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  style?: CSSProperties
  label?: string
  suffix?: string
}

export function NumberInput({ value, onChange, min, max, step = 1, placeholder, style, label, suffix }: NumberInputProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <span style={{ display: 'block', fontSize: fontSizes.label, fontWeight: fontWeights.medium, color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: fonts.ui }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
        <input
          type="number"
          value={value ?? ''}
          onChange={e => {
            const v = e.target.value ? parseInt(e.target.value) : undefined
            onChange(v)
          }}
          onFocus={e => { e.currentTarget.style.boxShadow = controlFocus.boxShadow as string }}
          onBlur={e => { e.currentTarget.style.boxShadow = controlBase.boxShadow as string }}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          style={{ ...controlBase, width: suffix ? '60%' : '100%', ...style }}
        />
        {suffix && (
          <span style={{ fontSize: fontSizes.label, color: colors.textTertiary, fontFamily: fonts.ui, minWidth: 24 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Slider ──────────────────────────────────────────
interface SliderProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  label?: string
  showValue?: boolean
  suffix?: string
}

export function Slider({ value, onChange, min, max, step = 1, label, showValue = true, suffix }: SliderProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <span style={{ fontSize: fontSizes.label, fontWeight: fontWeights.medium, color: colors.textSecondary, fontFamily: fonts.ui }}>
            {label}
          </span>
          {showValue && (
            <span style={{ fontSize: fontSizes.label, color: colors.textTertiary, fontFamily: fonts.ui }}>
              {value}{suffix || ''}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        className="lumen-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{
          width: '100%',
          background: `linear-gradient(to right, ${colors.accent} 0%, ${colors.accent} ${((value - min) / (max - min)) * 100}%, transparent ${((value - min) / (max - min)) * 100}%, transparent 100%)`,
          cursor: 'pointer',
        }}
      />
    </div>
  )
}

// ─── ColorPicker ─────────────────────────────────────
interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  defaultColor?: string
  onClear?: () => void
}

export function ColorPicker({ value, onChange, label, defaultColor = colors.accent, onClear }: ColorPickerProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <span style={{ display: 'block', fontSize: fontSizes.label, fontWeight: fontWeights.medium, color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: fonts.ui }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
        <input
          type="color"
          value={value || defaultColor}
          onChange={e => onChange(e.target.value)}
          style={{
            width: 32, height: 28, border: 'none',
            borderRadius: radii.sm, padding: 0, cursor: 'pointer', background: colors.bgTertiary,
            boxShadow: shadows.neuInsetSm,
          }}
        />
        {onClear && (
          <button
            onClick={onClear}
            style={{
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', borderRadius: radii.sm,
              background: 'transparent', cursor: 'pointer', fontSize: fontSizes.body, color: colors.textTertiary,
              fontFamily: fonts.ui, lineHeight: 1, boxShadow: shadows.neuInsetSm,
            }}
            title="Reset to default"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Label wrapper ───────────────────────────────────
interface FieldProps {
  label: string
  children: ReactNode
  style?: CSSProperties
}
export function Field({ label, children, style }: FieldProps) {
  return (
    <div style={style}>
      <span style={{ display: 'block', fontSize: fontSizes.label, fontWeight: fontWeights.medium, color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: fonts.ui }}>
        {label}
      </span>
      {children}
    </div>
  )
}

// ─── Grid (2-column layout helper) ───────────────────
interface GridProps {
  children: ReactNode
  columns?: number
  gap?: number
  style?: CSSProperties
}
export function Grid({ children, columns = 2, gap = spacing.md, style }: GridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap, ...style }}>
      {children}
    </div>
  )
}
