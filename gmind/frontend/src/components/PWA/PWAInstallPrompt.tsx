import { useState, useEffect } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z } from '../../styles/tokens'
import { Button } from '../UI/Box'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => setInstalled(true)

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  if (!deferredPrompt || dismissed || installed) return null

  const handleInstall = async () => {
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstalled(true)
    }
    setDeferredPrompt(null)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: spacing.block,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: z.banner,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.lg,
        padding: `${spacing.lg}px ${spacing.xxl}px`,
        background: `${colors.text}`,
        color: colors.textInverse,
        borderRadius: radii.full,
        fontFamily: fonts.ui,
        fontSize: fontSizes.body,
        fontWeight: fontWeights.medium,
        boxShadow: shadows.neuLg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <span style={{ fontSize: fontSizes.headline }}>📲</span>
      <span>Install Gmind for offline access</span>
      <Button variant="primary" size="sm" onClick={handleInstall}>Install</Button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: colors.textTertiary,
          cursor: 'pointer',
          fontSize: fontSizes.title,
          padding: spacing.xxs,
          borderRadius: radii.sm,
          transition: `color ${transitions.fast}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = colors.textInverse }}
        onMouseLeave={e => { e.currentTarget.style.color = colors.textTertiary }}
      >✕</button>
    </div>
  )
}
