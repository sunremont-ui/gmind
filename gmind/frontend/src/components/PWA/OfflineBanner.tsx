import { useState, useEffect } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z } from '../../styles/tokens'

export function OfflineBanner({ pendingCount }: { pendingCount: number }) {
  const [visible, setVisible] = useState(!navigator.onLine)

  useEffect(() => {
    const goOff = () => setVisible(true)
    const goOn = () => { if (pendingCount === 0) setVisible(false) }
    window.addEventListener('offline', goOff)
    window.addEventListener('online', goOn)
    return () => {
      window.removeEventListener('offline', goOff)
      window.removeEventListener('online', goOn)
    }
  }, [pendingCount])

  const online = navigator.onLine

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: spacing.xxl,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: z.banner,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.lg,
        padding: `${spacing.lg}px ${spacing.xxl}px`,
        borderRadius: radii.full,
        fontFamily: fonts.ui,
        fontSize: fontSizes.body,
        fontWeight: fontWeights.medium,
        boxShadow: shadows.neuMd,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: `all ${transitions.normal}`,
        ...(online
          ? { background: `${colors.green}15`, color: colors.green }
          : { background: `${colors.orange}15`, color: colors.orange }),
      }}
    >
      <span style={{ fontSize: fontSizes.title }}>
        {online ? '✓' : '⚠'}
      </span>
      <span>
        {online
          ? `Connected — ${pendingCount} pending change${pendingCount === 1 ? '' : 's'} syncing...`
          : `You're offline — ${pendingCount} change${pendingCount === 1 ? '' : 's'} queued`}
      </span>
      {online && pendingCount > 0 && (
        <div
          style={{
            width: 14,
            height: 14,
            border: `2px solid ${colors.green}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      )}
    </div>
  )
}
