import { useState, useRef, useEffect, createElement } from 'react'
import { LumenSearch, lumenIcons } from '../UI/LumenIcon'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'
import { Text } from '../UI/Box'

export interface Command {
  id: string
  label: string
  shortcut?: string
  icon?: string
  section?: string
  action: () => void
}

interface CommandPaletteProps {
  commands: Command[]
  onClose: () => void
}

const ICON_MAP: Record<string, keyof typeof lumenIcons> = {
  zap: 'Zap',
  sparkles: 'Sparkles',
  users: 'Users',
  plus: 'Plus',
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.shortcut || '').toLowerCase().includes(query.toLowerCase())
      )
    : commands

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIdx]) {
        filtered[activeIdx].action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const sections = new Map<string, Command[]>()
  for (const cmd of filtered) {
    const sec = cmd.section || 'General'
    if (!sections.has(sec)) sections.set(sec, [])
    sections.get(sec)!.push(cmd)
  }

  let idx = 0
  const items: React.ReactNode[] = []
  for (const [secName, cmds] of sections) {
    items.push(
      <div key={`sec-${secName}`} style={{
        fontSize: fontSizes.caption, fontWeight: fontWeights.semibold,
        color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em',
        padding: `${spacing.md}px ${spacing.lg}px ${spacing.xs}px`,
        fontFamily: fonts.ui,
      }}>
        {secName}
      </div>
    )
    for (const cmd of cmds) {
      const i = idx++
      const LucideIcon = cmd.icon ? ICON_MAP[cmd.icon] : undefined
      items.push(
        <div
          key={cmd.id}
          onClick={() => { cmd.action(); onClose() }}
          onMouseEnter={() => setActiveIdx(i)}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing.md,
            padding: `${spacing.sm + 1}px ${spacing.lg}px`,
            cursor: 'pointer',
            borderRadius: 10,
            margin: `0 ${spacing.xs}px`,
            background: i === activeIdx ? colors.bgTertiary : 'transparent',
            boxShadow: i === activeIdx ? shadows.neuSm : 'none',
            transition: `background ${transitions.fast}, box-shadow ${transitions.fast}`,
          }}
        >
          <span style={{
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: radii.sm,
            background: i === activeIdx ? colors.accent : colors.bgTertiary,
            color: i === activeIdx ? colors.textInverse : colors.textTertiary,
            boxShadow: i === activeIdx ? shadows.neuSm : shadows.neuInsetSm,
            flexShrink: 0,
          }}>
            {LucideIcon
              ? createElement(lumenIcons[LucideIcon], { size: 15, strokeWidth: 1.8 })
              : null}
          </span>
          <Text
            size={fontSizes.body}
            weight={i === activeIdx ? fontWeights.medium : fontWeights.regular}
            color={colors.text}
            style={{ flex: 1 }}
          >
            {cmd.label}
          </Text>
          {cmd.shortcut && (
            <span style={{
              fontSize: fontSizes.caption, fontFamily: fonts.mono,
              color: colors.textSecondary, background: colors.bgTertiary,
              boxShadow: shadows.neuInsetSm,
              padding: `${spacing.xxs}px ${spacing.sm}px`, borderRadius: radii.sm,
              lineHeight: '1.6',
            }}>
              {cmd.shortcut}
            </span>
          )}
        </div>
      )
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        background: colors.scrim,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: fonts.ui,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: colors.bgTertiary,
        borderRadius: 16,
        width: 500,
        boxShadow: shadows.neuLg,
        display: 'flex', flexDirection: 'column',
        maxHeight: '60vh',
        border: 'none',
        overflow: 'hidden',
        padding: spacing.sm,
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.md,
          padding: `${spacing.md}px ${spacing.lg}px`,
          margin: spacing.xs,
          borderRadius: 12,
          background: colors.bgTertiary,
          boxShadow: shadows.neuInsetSm,
        }}>
          <LumenSearch size={16} strokeWidth={1.8} color={colors.textTertiary} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            style={{
              flex: 1, padding: `${spacing.sm}px 0`,
              fontSize: fontSizes.subhead,
              border: 'none', outline: 'none',
              fontFamily: fonts.ui,
              background: 'transparent',
              color: colors.text,
            }}
          />
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflow: 'auto', padding: `${spacing.xs}px 0` }}>
          {items.length === 0 ? (
            <div style={{ padding: spacing.xxl, textAlign: 'center' }}>
              <Text color={colors.textTertiary}>No matching commands</Text>
            </div>
          ) : items}
        </div>

        {/* Footer hints */}
        <div style={{
          padding: `${spacing.sm}px ${spacing.lg}px`,
          display: 'flex', gap: spacing.xl,
          fontSize: fontSizes.caption,
          color: colors.textTertiary,
          fontFamily: fonts.ui,
        }}>
          <span>↑↓ Navigate</span>
          <span>↵ Execute</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
