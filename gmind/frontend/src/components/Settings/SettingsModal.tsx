import { useState, useEffect, useCallback } from 'react'
import { settingsApi, type StartupSettings } from '../../api/settings'
import { useAgentStore } from '../../store/agent'
import { Toggle, Button } from '../UI/Box'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

interface Props {
  onClose: () => void
}

const ROLE_LABELS: Record<string, string> = {
  assistant: 'Assistant',
  researcher: 'Researcher',
  writer: 'Writer',
  analyst: 'Analyst',
  coder: 'Coder',
  reviewer: 'Reviewer',
  planner: 'Planner',
}

// ── Shortcut capture input ────────────────────────────────────────────────────

interface ShortcutInputProps {
  value: string
  onChange: (keys: string) => void
  disabled?: boolean
}

function ShortcutInput({ value, onChange, disabled }: ShortcutInputProps) {
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState(value)

  const startRecording = () => {
    if (disabled) return
    setRecording(true)
    setDraft('…press keys…')
  }

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!recording) return
    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      setDraft(value)
      setRecording(false)
      return
    }

    const parts: string[] = []
    if (e.ctrlKey) parts.push('ctrl')
    if (e.shiftKey) parts.push('shift')
    if (e.altKey) parts.push('alt')
    if (e.metaKey) parts.push('meta')

    const key = e.key.toLowerCase()
    // Ignore standalone modifiers
    if (['control', 'shift', 'alt', 'meta'].includes(key)) return

    parts.push(key === ' ' ? 'space' : key)
    const combo = parts.join('+')
    setDraft(combo)
    setRecording(false)
    onChange(combo)
  }, [recording, value, onChange])

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleKey, true)
      return () => window.removeEventListener('keydown', handleKey, true)
    }
  }, [recording, handleKey])

  useEffect(() => { setDraft(value) }, [value])

  return (
    <div
      onClick={startRecording}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 160, padding: `${spacing.xs}px ${spacing.lg}px`,
        background: recording ? `${colors.accent}18` : colors.bgTertiary,
        boxShadow: recording ? `0 0 0 2px ${colors.accent}` : shadows.neuInsetSm,
        borderRadius: radii.sm,
        fontFamily: fonts.mono, fontSize: fontSizes.body,
        color: recording ? colors.accent : colors.text,
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        transition: `all ${transitions.fast}`,
        border: 'none', outline: 'none',
      }}
    >
      {draft || '—'}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      <div style={{
        fontSize: fontSizes.caption,
        fontWeight: fontWeights.semibold,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        paddingBottom: spacing.xs,
        borderBottom: `1px solid ${colors.separator}`,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, sub, children }: { label: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: spacing.lg, padding: `${spacing.xs}px 0`,
    }}>
      <div>
        <div style={{ fontSize: fontSizes.body, color: colors.text, fontWeight: fontWeights.medium }}>{label}</div>
        {sub && <div style={{ fontSize: fontSizes.caption, color: colors.textTertiary, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: Props) {
  const agents = useAgentStore(s => s.agents)
  const fetchAgents = useAgentStore(s => s.fetchAgents)

  const [settings, setSettings] = useState<StartupSettings>({
    autostart: false,
    startMinimized: true,
    startupAgentIds: [],
    mainWindowShortcut: 'ctrl+shift+g',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAgents()
    settingsApi.load().then(s => { setSettings(s); setLoading(false) })
  }, [fetchAgents])

  const update = async (patch: Partial<StartupSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    await settingsApi.save(next)

    // Sync OS autostart state when toggle changes
    if ('autostart' in patch) {
      if (patch.autostart) await settingsApi.enableAutostart()
      else await settingsApi.disableAutostart()
    }

    // Re-register shortcut when it changes
    if ('mainWindowShortcut' in patch && patch.mainWindowShortcut) {
      await settingsApi.updateMainShortcut(patch.mainWindowShortcut)
    }
  }

  const toggleAgent = (id: string) => {
    const ids = settings.startupAgentIds.includes(id)
      ? settings.startupAgentIds.filter(a => a !== id)
      : [...settings.startupAgentIds, id]
    update({ startupAgentIds: ids })
  }

  const handleClose = async () => {
    setSaving(true)
    await settingsApi.save(settings)
    setSaving(false)
    onClose()
  }

  return (
    <>
      {/* Scrim */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: colors.scrim,
          backdropFilter: 'blur(4px)',
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 201,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          width: 480, maxWidth: '95vw',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          background: colors.bgTertiary,
          borderRadius: radii.xl,
          boxShadow: shadows.neuLg,
          fontFamily: fonts.ui,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${spacing.lg}px ${spacing.xl}px`,
            borderBottom: `1px solid ${colors.separator}`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: fontSizes.title, fontWeight: fontWeights.semibold, color: colors.text }}>
              Настройки
            </span>
            <button
              onClick={handleClose}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                color: colors.textQuaternary, fontSize: 20,
                lineHeight: 1, padding: spacing.xxs,
                transition: `color ${transitions.fast}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = colors.text }}
              onMouseLeave={e => { e.currentTarget.style.color = colors.textQuaternary }}
            >✕</button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `${spacing.xl}px` }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: colors.textQuaternary, padding: spacing.xxl }}>
                Загрузка…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xxl }}>

                {/* ── Запуск ─────────────────────────────────────────── */}
                <Section title="Запуск">
                  <Row
                    label="Автозапуск"
                    sub="Запускать при входе в Windows"
                  >
                    <Toggle
                      checked={settings.autostart}
                      onChange={v => update({ autostart: v })}
                    />
                  </Row>
                  <Row
                    label="Запускать свёрнутым"
                    sub="Только в трей, без главного окна"
                  >
                    <Toggle
                      checked={settings.startMinimized}
                      onChange={v => update({ startMinimized: v })}
                      disabled={!settings.autostart}
                    />
                  </Row>
                </Section>

                {/* ── Агенты при запуске ─────────────────────────────── */}
                <Section title="Агенты при запуске">
                  {agents.length === 0 ? (
                    <div style={{ fontSize: fontSizes.body, color: colors.textQuaternary, padding: `${spacing.sm}px 0` }}>
                      Агенты не созданы
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                      {agents.map(agent => {
                        const checked = settings.startupAgentIds.includes(agent.id)
                        return (
                          <label
                            key={agent.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: spacing.md,
                              padding: `${spacing.sm}px ${spacing.md}px`,
                              borderRadius: radii.sm,
                              cursor: 'pointer',
                              background: checked ? `${colors.accent}10` : 'transparent',
                              boxShadow: checked ? `inset 0 0 0 1px ${colors.accent}30` : 'none',
                              transition: `all ${transitions.fast}`,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAgent(agent.id)}
                              style={{ accentColor: colors.accent, width: 15, height: 15, flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: fontSizes.body, fontWeight: fontWeights.medium, color: colors.text }}>
                                {agent.name || `${ROLE_LABELS[agent.role] ?? agent.role} #${agent.id.slice(-4)}`}
                              </div>
                              <div style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>
                                {agent.model}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {settings.startupAgentIds.length > 0 && (
                    <div style={{
                      fontSize: fontSizes.caption, color: colors.textTertiary,
                      background: `${colors.accent}08`,
                      borderRadius: radii.sm, padding: `${spacing.xs}px ${spacing.md}px`,
                      boxShadow: `inset 0 0 0 1px ${colors.accent}18`,
                    }}>
                      При запуске выбранные агенты получат задачу <code style={{ fontFamily: fonts.mono }}>__startup__</code>
                    </div>
                  )}
                </Section>

                {/* ── Горячие клавиши ────────────────────────────────── */}
                <Section title="Горячие клавиши">
                  <Row label="Показать главное окно" sub="Нажмите на поле и введите комбинацию">
                    <ShortcutInput
                      value={settings.mainWindowShortcut}
                      onChange={v => update({ mainWindowShortcut: v })}
                    />
                  </Row>
                  <Row label="Quick Capture" sub="Зафиксировано">
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 160, padding: `${spacing.xs}px ${spacing.lg}px`,
                      background: colors.bgTertiary, boxShadow: shadows.neuInsetSm,
                      borderRadius: radii.sm,
                      fontFamily: fonts.mono, fontSize: fontSizes.body,
                      color: colors.textTertiary,
                      userSelect: 'none',
                    }}>
                      ctrl+shift+space
                    </div>
                  </Row>
                </Section>

              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: `${spacing.lg}px ${spacing.xl}px`,
            borderTop: `1px solid ${colors.separator}`,
            flexShrink: 0,
          }}>
            <Button variant="primary" size="sm" onClick={handleClose}>
              {saving ? 'Сохранение…' : 'Готово'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
