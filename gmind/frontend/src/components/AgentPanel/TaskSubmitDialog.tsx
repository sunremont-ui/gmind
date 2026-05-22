import { useState } from 'react'
import type { TaskSubmitRequest, AgentInfo } from '../../types/agent'
import { AGENT_ROLES, ROLE_ACTIONS, ACTION_SCHEMAS } from '../../types/agent'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z } from '../../styles/tokens'

interface TaskSubmitDialogProps {
  agentId: string
  roleId: string
  workbookId: string
  agents: AgentInfo[]
  onSubmit: (agentId: string, req: TaskSubmitRequest) => Promise<string | undefined>
  onClose: () => void
}

const TASK_ACTIONS = [
  { value: 'create_topic',           label: 'Create Topic',           desc: 'Create a new topic in the mind map' },
  { value: 'create_multiple_topics', label: 'Create Multiple Topics', desc: 'Add several topics at once' },
  { value: 'summarize_topics',       label: 'Summarize Topics',       desc: 'Summarize a branch of topics' },
  { value: 'update_topic',           label: 'Update Topic',           desc: 'Update an existing topic title or notes' },
  { value: 'add_note',               label: 'Add Note',               desc: 'Add a note to a topic' },
  { value: 'search_web',             label: 'Search Web',             desc: 'Search the web for information' },
  { value: 'wiki_search',            label: 'Wiki Search',            desc: 'Search the project wiki' },
  { value: 'get_workbook',           label: 'Analyze Workbook',       desc: 'Analyze the full workbook structure' },
  { value: 'custom',                 label: 'Custom Action',          desc: 'Enter a custom action name' },
]

export function TaskSubmitDialog({ agentId, roleId, workbookId, agents, onSubmit, onClose }: TaskSubmitDialogProps) {
  const [action, setAction] = useState('')
  const [customAction, setCustomAction] = useState('')
  const [simpleMode, setSimpleMode] = useState(true)
  const [naturalPrompt, setNaturalPrompt] = useState('')
  const [params, setParams] = useState('')
  const [chainToAgentId, setChainToAgentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAllActions, setShowAllActions] = useState(false)

  const role = AGENT_ROLES.find(r => r.id === roleId)
  const roleLabel = role?.label ?? roleId

  const primaryActionValues = ROLE_ACTIONS[roleId] ?? []
  const primaryActions = TASK_ACTIONS.filter(a => primaryActionValues.includes(a.value))
  const secondaryActions = TASK_ACTIONS.filter(a => !primaryActionValues.includes(a.value))

  const visibleActions = showAllActions ? TASK_ACTIONS : primaryActions.length > 0 ? primaryActions : TASK_ACTIONS

  const isCustom = action === 'custom'
  const effectiveAction = isCustom ? customAction : action
  const hint = ACTION_SCHEMAS[action] ?? null

  const handleSubmit = async () => {
    if (!effectiveAction.trim()) return
    setSubmitting(true)
    try {
      let parsedParams: Record<string, unknown> | undefined
      if (simpleMode) {
        if (naturalPrompt.trim()) parsedParams = { query: naturalPrompt.trim() }
      } else if (params.trim()) {
        try { parsedParams = JSON.parse(params) }
        catch { parsedParams = { query: params } }
      }
      await onSubmit(agentId, {
        action: effectiveAction.trim(),
        params: parsedParams,
        workbook_id: workbookId,
        chain_to_agent_id: chainToAgentId || undefined,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const otherAgents = agents.filter(a => a.id !== agentId && a.status !== 'working')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
    border: 'none', borderRadius: radii.sm,
    background: colors.bgTertiary, color: colors.text, fontSize: fontSizes.label,
    fontFamily: fonts.mono, outline: 'none',
    boxShadow: shadows.neuInsetSm, boxSizing: 'border-box',
  }

  const fieldLabel: React.CSSProperties = {
    fontSize: fontSizes.caption, color: colors.textSecondary,
    marginBottom: spacing.xs, fontWeight: fontWeights.medium,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: colors.scrim,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: z.modal,
      fontFamily: fonts.ui,
    }}>
      <div style={{
        background: colors.bgTertiary,
        borderRadius: radii.xl,
        padding: spacing.xxxl,
        width: 500, maxHeight: '88vh', overflow: 'auto',
        boxShadow: shadows.neuLg,
        border: 'none',
      }}>
        <h2 style={{
          fontSize: fontSizes.title, fontWeight: fontWeights.semibold,
          color: colors.text, margin: `0 0 ${spacing.lg}px`,
          display: 'flex', alignItems: 'center', gap: spacing.sm,
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: role?.color ?? colors.accent,
            boxShadow: `0 0 0 3px ${(role?.color ?? colors.accent) + '25'}`,
          }} />
          Submit Task to {roleLabel}
        </h2>

        {/* Action selector */}
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{ ...fieldLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Action</span>
            {secondaryActions.length > 0 && (
              <button
                onClick={() => setShowAllActions(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: fontSizes.caption,
                  color: showAllActions ? colors.accent : colors.textQuaternary,
                  fontFamily: fonts.ui, padding: 0,
                  transition: `color ${transitions.fast}`,
                }}
              >
                {showAllActions ? '↩ Role actions' : '+ Show all'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {visibleActions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAction(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: spacing.xxs, padding: `${spacing.sm}px ${spacing.lg}px`,
                  border: 'none', borderRadius: radii.md,
                  background: action === opt.value ? colors.accentLight : colors.bgTertiary,
                  boxShadow: action === opt.value
                    ? `${shadows.neuInsetSm}, 0 0 0 2px ${colors.accent}`
                    : shadows.neuSm,
                  cursor: 'pointer', fontSize: fontSizes.label, textAlign: 'left',
                  fontFamily: fonts.ui, color: colors.text,
                  transition: `box-shadow ${transitions.fast}, background ${transitions.fast}`,
                }}
                onMouseEnter={e => {
                  if (action !== opt.value) {
                    e.currentTarget.style.background = colors.accentLight
                    e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 1px ${colors.accentLight}`
                  }
                }}
                onMouseLeave={e => {
                  if (action !== opt.value) {
                    e.currentTarget.style.background = colors.bgTertiary
                    e.currentTarget.style.boxShadow = shadows.neuSm
                  }
                }}
              >
                <span style={{ fontWeight: fontWeights.medium }}>{opt.label}</span>
                <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>{opt.desc}</span>
              </button>
            ))}
          </div>

          {isCustom && (
            <input
              value={customAction}
              onChange={e => setCustomAction(e.target.value)}
              placeholder="Enter custom action name"
              style={{ ...inputStyle, marginTop: spacing.sm }}
              autoFocus
            />
          )}
        </div>

        {/* Params: Simple / Advanced toggle */}
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{ ...fieldLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Parameters</span>
            <div style={{ display: 'flex', gap: spacing.xs }}>
              {(['simple', 'advanced'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSimpleMode(mode === 'simple')}
                  style={{
                    padding: `${spacing.xxs}px ${spacing.sm}px`,
                    border: 'none', borderRadius: radii.sm,
                    background: (simpleMode ? mode === 'simple' : mode === 'advanced') ? colors.accent : 'transparent',
                    color: (simpleMode ? mode === 'simple' : mode === 'advanced') ? colors.textInverse : colors.textSecondary,
                    fontSize: fontSizes.caption, fontFamily: fonts.ui, cursor: 'pointer',
                    transition: `all ${transitions.fast}`,
                  }}
                >
                  {mode === 'simple' ? 'Simple' : 'JSON'}
                </button>
              ))}
            </div>
          </div>

          {simpleMode ? (
            <textarea
              value={naturalPrompt}
              onChange={e => setNaturalPrompt(e.target.value)}
              placeholder="Describe what the agent should do…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          ) : (
            <>
              <textarea
                value={params}
                onChange={e => setParams(e.target.value)}
                placeholder='{"topic_id": "abc", "title": "New topic"}'
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              {hint && (
                <div style={{
                  marginTop: spacing.xs,
                  display: 'flex', alignItems: 'flex-start', gap: spacing.sm,
                }}>
                  <span style={{ fontSize: fontSizes.caption, color: colors.textQuaternary, fontFamily: fonts.mono, flex: 1, wordBreak: 'break-all' }}>
                    e.g. {hint}
                  </span>
                  <button
                    onClick={() => setParams(hint)}
                    style={{
                      flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: fontSizes.caption, color: colors.accent, fontFamily: fonts.ui,
                      padding: 0, transition: `opacity ${transitions.fast}`,
                    }}
                  >
                    Use example
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Chain selector */}
        {otherAgents.length > 0 && (
          <div style={{ marginBottom: spacing.lg }}>
            <div style={fieldLabel}>Chain to agent (optional)</div>
            <select
              value={chainToAgentId}
              onChange={e => setChainToAgentId(e.target.value)}
              style={{ ...inputStyle, fontFamily: fonts.ui, cursor: 'pointer' }}
            >
              <option value="">— No chain —</option>
              {otherAgents.map(a => {
                const r = AGENT_ROLES.find(r => r.id === a.role)
                return (
                  <option key={a.id} value={a.id}>
                    {a.name || r?.label || a.role} ({a.model || 'default'})
                  </option>
                )
              })}
            </select>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: `${spacing.md}px ${spacing.xl}px`,
              border: 'none', borderRadius: radii.md,
              background: colors.bgTertiary, boxShadow: shadows.neuSm,
              cursor: 'pointer', fontSize: fontSizes.body,
              color: colors.textSecondary, fontFamily: fonts.ui,
              transition: `box-shadow ${transitions.fast}`,
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = shadows.neuInsetSm}
            onMouseLeave={e => e.currentTarget.style.boxShadow = shadows.neuSm}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !effectiveAction.trim()}
            style={{
              padding: `${spacing.md}px ${spacing.xl}px`,
              border: 'none', borderRadius: radii.md,
              background: submitting ? colors.textQuaternary : colors.accent,
              cursor: submitting ? 'default' : 'pointer',
              fontSize: fontSizes.body, fontWeight: fontWeights.semibold,
              color: colors.textInverse, fontFamily: fonts.ui,
              transition: `background ${transitions.fast}, opacity ${transitions.fast}`,
              opacity: effectiveAction.trim() ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = colors.accentHover }}
            onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = colors.accent }}
          >
            {submitting ? 'Submitting…' : 'Submit Task →'}
          </button>
        </div>
      </div>
    </div>
  )
}
