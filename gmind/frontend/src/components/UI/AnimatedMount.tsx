import { useState, useEffect, type ReactNode } from 'react'
import { anim } from '../../styles/tokens'

const aniEnter = `${anim.dur.long}ms ${anim.ease.emphasized}`
const aniExit = `${anim.dur.normal}ms ${anim.ease.accelerated}`
const EXIT_DURATION = anim.dur.normal

interface AnimatedMountProps {
  show: boolean
  children: ReactNode
  type?: 'modal' | 'panel-right' | 'panel-left' | 'fade'
  style?: React.CSSProperties
}

export function AnimatedMount({ show, children, type = 'fade', style }: AnimatedMountProps) {
  const [mounted, setMounted] = useState(show)
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    if (show) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(raf)
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), EXIT_DURATION)
      return () => clearTimeout(t)
    }
  }, [show])

  if (!mounted) return null

  const getTransform = () => {
    if (!visible) {
      switch (type) {
        case 'modal': return 'scale(0.92)'
        case 'panel-right': return 'translateX(100%)'
        case 'panel-left': return 'translateX(-100%)'
        default: return 'none'
      }
    }
    return type === 'modal' ? 'scale(1)' : 'translateX(0)'
  }

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: getTransform(),
      transition: `opacity ${visible ? aniEnter : aniExit}, transform ${visible ? aniEnter : aniExit}`,
      pointerEvents: show ? 'auto' : 'none',
      ...style,
    }}>
      {children}
    </div>
  )
}
