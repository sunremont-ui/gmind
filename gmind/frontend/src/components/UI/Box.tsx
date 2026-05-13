import type { ReactNode, CSSProperties } from 'react'
import { LumenChevronRight } from './LumenIcon'
import { colors, fonts, fontSizes, fontWeights, radii, spacing, shadows, transitions } from '../../styles/tokens'

// ─── Stack (flex container) ──────────────────────────
interface StackProps {
  children: ReactNode
  direction?: 'row' | 'column'
  gap?: number
  align?: CSSProperties['alignItems']
  justify?: CSSProperties['justifyContent']
  wrap?: boolean
  style?: CSSProperties
  onClick?: () => void
  className?: string
}
export function Stack({ children, direction = 'column', gap = spacing.md, align, justify, wrap, style, onClick, className }: StackProps) {
  return (
    <div className={className} onClick={onClick} style={{ display: 'flex', flexDirection: direction, gap, alignItems: align, justifyContent: justify, flexWrap: wrap ? 'wrap' : undefined, ...style }}>
      {children}
    </div>
  )
}

// ─── Text ────────────────────────────────────────────
interface TextProps {
  children: ReactNode
  size?: number
  weight?: number
  color?: string
  secondary?: boolean
  mono?: boolean
  truncate?: boolean
  style?: CSSProperties
  onClick?: () => void
}
export function Text({ children, size = fontSizes.body, weight = fontWeights.regular, color, secondary, mono, truncate, style, onClick }: TextProps) {
  return (
    <span onClick={onClick} style={{
      fontFamily: mono ? fonts.mono : fonts.ui,
      fontSize: size,
      fontWeight: weight,
      color: color ?? (secondary ? colors.textSecondary : colors.text),
      lineHeight: 1.4,
      overflow: truncate ? 'hidden' : undefined,
      textOverflow: truncate ? 'ellipsis' : undefined,
      whiteSpace: truncate ? 'nowrap' : undefined,
      cursor: onClick ? 'pointer' : undefined,
      transition: `color ${transitions.normal}`,
      ...style,
    }}>
      {children}
    </span>
  )
}

// ─── Button (Lumen neumorphic) ───────────────────────
interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  title?: string
  style?: CSSProperties
  icon?: boolean
}
const btnBase: CSSProperties = {
  fontFamily: fonts.ui,
  fontWeight: fontWeights.medium,
  border: 'none',
  borderRadius: radii.sm,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.xs,
  transition: `all ${transitions.fast}`,
  userSelect: 'none',
  outline: 'none',
}

export function Button({ children, onClick, variant = 'secondary', size = 'md', disabled, title, style, icon }: ButtonProps) {
  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: `${spacing.xs}px ${spacing.md}px`, fontSize: fontSizes.label, height: 36, minWidth: icon ? 36 : undefined, borderRadius: radii.sm },
    md: { padding: `${spacing.sm}px ${spacing.xl}px`, fontSize: fontSizes.body, height: 40, minWidth: icon ? 40 : undefined, borderRadius: 12 },
    lg: { padding: `${spacing.md}px ${spacing.xxl}px`, fontSize: fontSizes.bodyLarge, height: 44, minWidth: icon ? 44 : undefined, borderRadius: 12 },
  }
  const colorStyles: Record<string, CSSProperties> = {
    primary: { background: colors.accent, color: colors.textInverse, boxShadow: shadows.neuMd },
    secondary: { background: 'transparent', color: colors.text, boxShadow: shadows.neuSm },
    ghost: { background: 'transparent', color: colors.textSecondary },
    danger: { background: colors.red, color: colors.textInverse, boxShadow: shadows.neuMd },
  }

  const hoverStyles: Record<string, CSSProperties> = {
    primary: { background: colors.accentHover, boxShadow: 'none' },
    secondary: { background: 'transparent', boxShadow: shadows.neuInsetSm },
    ghost: { background: colors.fill, color: colors.text },
    danger: { background: `${colors.red}dd`, boxShadow: 'none' },
  }

  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={e => { if (!disabled) Object.assign(e.currentTarget.style, hoverStyles[variant]) }}
      onMouseLeave={e => { if (!disabled) Object.assign(e.currentTarget.style, colorStyles[variant], { transform: 'scale(1)' }) }}
      onMouseDown={e => { if (!disabled && variant !== 'ghost') { e.currentTarget.style.boxShadow = shadows.neuInsetSm; e.currentTarget.style.transform = 'scale(0.97)' } }}
      onMouseUp={e => { if (!disabled) Object.assign(e.currentTarget.style, hoverStyles[variant], { transform: 'scale(1)' }) }}
      style={{
        ...btnBase,
        ...colorStyles[variant],
        ...sizeStyles[size],
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ─── Input ───────────────────────────────────────────
interface InputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: CSSProperties
  onKeyDown?: (e: React.KeyboardEvent) => void
  autoFocus?: boolean
  rows?: number
}
export function Input({ value, onChange, placeholder, style, onKeyDown, autoFocus, rows }: InputProps) {
  const inputStyle: CSSProperties = {
    fontFamily: fonts.ui,
    fontSize: fontSizes.body,
    color: colors.text,
    background: colors.bgTertiary,
    border: 'none',
    borderRadius: radii.sm,
    padding: `${spacing.sm + 1}px ${spacing.lg}px`,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: `all ${transitions.fast}`,
    resize: 'vertical',
    lineHeight: 1.4,
    boxShadow: shadows.neuInsetSm,
  }

  if (rows) {
    return (
      <textarea
        autoFocus={autoFocus}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accentLight}` }}
        onBlur={e => { e.currentTarget.style.borderColor = colors.separatorThick; e.currentTarget.style.boxShadow = 'none' }}
        style={{ ...inputStyle, ...style }}
      />
    )
  }

  return (
    <input
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accentLight}` }}
      onBlur={e => { e.currentTarget.style.borderColor = colors.separatorThick; e.currentTarget.style.boxShadow = 'none' }}
      style={{ ...inputStyle, height: 32, ...style }}
    />
  )
}

// ─── Divider ─────────────────────────────────────────
export function Divider() {
  return (
    <div style={{ height: 1, background: colors.separator, margin: `${spacing.sm}px 0` }} />
  )
}

// ─── Badge ───────────────────────────────────────────
interface BadgeProps {
  children: ReactNode
  color?: string
  dot?: boolean
}
export function Badge({ children, color = colors.accent, dot }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: dot ? `${spacing.xs}px ${spacing.md}px` : `${spacing.xxs}px ${spacing.md}px`,
      borderRadius: radii.full,
      fontSize: fontSizes.label,
      fontWeight: fontWeights.medium,
      background: `${color}18`,
      color,
      fontFamily: fonts.ui,
      boxShadow: shadows.neuInsetSm,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />}
      {children}
    </span>
  )
}

// ─── Section ─────────────────────────────────────────
interface SectionProps {
  title?: string
  children: ReactNode
  style?: CSSProperties
  right?: ReactNode
}
export function Section({ title, children, style, right }: SectionProps) {
  return (
    <div style={{ padding: `0 ${spacing.xl}px`, ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text size={fontSizes.label} weight={fontWeights.semibold} color={colors.textSecondary}>{title}</Text>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── Card ────────────────────────────────────────────
interface CardProps {
  children: ReactNode
  padding?: number
  style?: CSSProperties
  onClick?: () => void
  hoverable?: boolean
}
export function Card({ children, padding = spacing.lg, style, onClick, hoverable }: CardProps) {
  return (
    <div onClick={onClick} style={{
      background: colors.surface,
      border: 'none',
      borderRadius: radii.md,
      padding,
      boxShadow: shadows.neuMd,
      cursor: onClick ? 'pointer' : undefined,
      transition: hoverable ? transitions.fast : undefined,
      ...style,
    }}
    onMouseEnter={e => { if (hoverable) e.currentTarget.style.boxShadow = shadows.neuLg }}
    onMouseLeave={e => { if (hoverable) e.currentTarget.style.boxShadow = shadows.neuMd }}
    >
      {children}
    </div>
  )
}

// ─── SectionHeader (collapsible) ─────────────────────
interface SectionHeaderProps {
  title: string
  open?: boolean
  onToggle?: () => void
  count?: number
}
export function SectionHeader({ title, open, onToggle, count }: SectionHeaderProps) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `${spacing.sm + 2}px ${spacing.xs}px`, cursor: onToggle ? 'pointer' : 'default',
      userSelect: 'none', borderRadius: radii.sm,
      fontSize: fontSizes.label, fontWeight: fontWeights.semibold, color: colors.textTertiary,
      textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: fonts.ui,
      transition: `color ${transitions.fast}, background ${transitions.fast}`,
    }}
    onMouseEnter={e => { if (onToggle) { e.currentTarget.style.color = colors.text; e.currentTarget.style.background = colors.fillHover } }}
    onMouseLeave={e => { if (onToggle) { e.currentTarget.style.color = colors.textTertiary; e.currentTarget.style.background = 'transparent' } }}
    >
      <span>{title}{count !== undefined ? ` (${count})` : ''}</span>
      {onToggle && (
        <LumenChevronRight size={12} strokeWidth={2.5} style={{ transition: `transform ${transitions.fast}`, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }} />
      )}
    </div>
  )
}

// ─── MenuItem ────────────────────────────────────────
interface MenuItemProps {
  children: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}
export function MenuItem({ children, onClick, danger, disabled }: MenuItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'block', width: '100%', padding: `${spacing.md}px ${spacing.lg}px`, border: 'none',
        background: 'transparent', cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
        fontSize: fontSizes.body, borderRadius: radii.sm, color: danger ? colors.red : disabled ? colors.textTertiary : colors.text,
        opacity: disabled ? 0.5 : 1,
        fontFamily: fonts.ui,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = colors.bgTertiary }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

// ─── ToolbarButton ───────────────────────────────────
interface ToolbarButtonProps {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  active?: boolean
}
export function ToolbarButton({ children, onClick, disabled, title, active }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: `${spacing.sm}px ${spacing.lg}px`, background: disabled ? colors.fill : active ? colors.accentLight : 'transparent',
        color: disabled ? colors.textQuaternary : active ? colors.accent : colors.textSecondary,
        border: 'none', borderRadius: radii.sm, cursor: disabled ? 'default' : 'pointer',
        fontSize: fontSizes.body, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
        transition: `all ${transitions.fast}`,
      }}
    >
      {children}
    </button>
  )
}

// ─── Toggle (Switch — Lumen neumorphic) ──────────────
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.md,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      fontFamily: fonts.ui, fontSize: fontSizes.body, color: colors.textSecondary,
    }}>
      <div
        onClick={disabled ? undefined : () => onChange(!checked)}
        style={{
          position: 'relative', width: 46, height: 26, borderRadius: radii.full,
          background: colors.bgTertiary,
          boxShadow: shadows.neuInsetSm,
          transition: `background ${transitions.fast}, box-shadow ${transitions.fast}`,
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: checked ? `linear-gradient(135deg, ${colors.accent}, ${colors.purple})` : colors.bgTertiary,
          boxShadow: checked ? shadows.neuSm : `2px 2px 5px rgba(120,140,180,0.35), -2px -2px 5px #FFFFFF`,
          transition: `left ${transitions.fast}, background ${transitions.fast}`,
        }} />
      </div>
      {label && <span>{label}</span>}
    </label>
  )
}
