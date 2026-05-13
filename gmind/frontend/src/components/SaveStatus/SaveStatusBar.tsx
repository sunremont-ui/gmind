import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z, sizes } from '../../styles/tokens'

interface SaveStatusBarProps {
  pendingCount: number
}

export function SaveStatusBar({ pendingCount }: SaveStatusBarProps) {
  const online = navigator.onLine
  const isOffline = !online || pendingCount > 0

  const bg = isOffline ? `${colors.orange}15` : `${colors.green}15`
  const fg = isOffline ? colors.orange : colors.green
  const text = isOffline
    ? `Offline · ${pendingCount} pending`
    : 'All changes saved'

  return (
    <div style={{
      position: 'fixed', bottom: spacing.xl, right: sizes.propertiesPanel + sizes.toolPanel + spacing.xl, zIndex: z.statusBar,
      display: 'flex', alignItems: 'center', gap: spacing.sm,
      padding: `${spacing.sm}px ${spacing.lg}px`,
      borderRadius: radii.full,
      background: bg,
      color: fg,
      fontSize: fontSizes.label,
      fontWeight: fontWeights.medium,
      fontFamily: fonts.ui,
      boxShadow: shadows.neuSm,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      userSelect: 'none',
      transition: `all ${transitions.normal}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg, flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  )
}
