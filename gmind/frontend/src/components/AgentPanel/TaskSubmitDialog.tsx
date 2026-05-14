import { useState } from 'react'
import type { TaskSubmitRequest, AgentInfo } from '../../types/agent'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

interface TaskSubmitDialogProps {
  agentId: string
  agentRole: string
  workbookId: string
  agents: AgentInfo[]
  onSubmit: (agentId: string, req: TaskSubmitRequest) => Promise<string | undefined>
  onClose: () => void
}

const TASK_ACTIONS = [
  { value: 'create_topic', label: 'Create Topic', desc: 'Create a new topic in the mind map' },
  { value: 'create_multiple_topics', label: 'Create Multiple Topics', desc: 'Add several topics at once' },
  { value: 'summarize_topics', label: 'Summarize Topics', desc: 'Summarize a branch of topics' },
  { value: 'update_topic', label: 'Update Topic', desc: 'Update an existing topic title or notes' },
  { value: 'add_note', label: 'Add Note', desc: 'Add a note to a topic' },
  { value: 'search_web', label: 'Search Web', desc: 'Search the web for information' },
  { value: 'wiki_search', label: 'Wiki Search', desc: 'Search the project wiki' },
  { value: 'get_workbook', label: 'Analyze Workbook', desc: 'Analyze the full workbook structure' },
  { value: 'custom', label: 'Custom Action', desc: 'Enter a custom action name' },
]

export function TaskSubmitDialog({ agentId, agentRole, workbookId, agents, onSubmit, onClose }: TaskSubmitDialogProps) {
  const [action, setAction] = useState('')
  const [customAction, setCustomAction] = useState('')
  const [params, setParams] = useState('')
  const [chainToAgentId, setChainToAgentId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedAction = TASK_ACTIONS.find(a => a.value === action)
  const isCustom = action === 'custom'
  const effectiveAction = isCustom ? customAction : action

  const handleSubmit = async () => {
    if (!effectiveAction.trim()) return
    setSubmitting(true)
    try {
      let parsedParams: Record<string, unknown> | undefined
      if (params.trim()) {
        try {
          parsedParams = JSON.parse(params)
        } catch {
          parsedParams = { query: params }
        }
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

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      fontFamily: fonts.ui,
    }}>
      <div style={{
        background: colors.bgSecondary,
        borderRadius: 16,
        padding: spacing.xxxl,
        width: 480, maxHeight: '85vh', overflow: 'auto',
        boxShadow: shadows.neuLg,
        border: 'none',
      }}>
        <h2 style={{
          fontSize: fontSizes.title, fontWeight: fontWeights.semibold,
          color: colors.text, margin: `0 0 ${spacing.lg}px`,
        }}>
          Submit Task to {agentRole}
        </h2>

        {/* Action selector */}
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{
            fontSize: fontSizes.caption, color: colors.textSecondary,
            marginBottom: spacing.xs, fontWeight: fontWeights.medium,
          }}>
            Action
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {TASK_ACTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAction(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: spacing.xxs, padding: `${spacing.sm}px ${spacing.lg}px`,
                  border: `1px solid ${action === opt.value ? colors.accent : colors.separator}`,
                  borderRadius: radii.md, background: action === opt.value ? colors.accentLight : colors.bg,
                  cursor: 'pointer', fontSize: fontSizes.label, textAlign: 'left',
                  fontFamily: fonts.ui, color: colors.text,
                  transition: `border-color ${transitions.fast}, background ${transitions.fast}`,
                }}
                onMouseEnter={e => {
                  if (action !== opt.value) e.currentTarget.style.background = colors.bgTertiary
                }}
                onMouseLeave={e => {
                  if (action !== opt.value) e.currentTarget.style.background = colors.bg
                }}
              >
                <span style={{ fontWeight: fontWeights.medium }}>{opt.label}</span>
                <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>{opt.desc}</span>
              </button>
            ))}
            {isCustom && (
              <input
                value={customAction}
                onChange={e => setCustomAction(e.target.value)}
                placeholder="Enter custom action name"
                style={{
                  width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
                  border: `1px solid ${colors.accent}`, borderRadius: radii.sm,
                  background: colors.bg, color: colors.text, fontSize: fontSizes.label,
                  fontFamily: fonts.mono, outline: 'none', marginTop: spacing.xs,
                }}
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Chain selector */}
        {otherAgents.length > 0 && (
          <div style={{ marginBottom: spacing.lg }}>
            <div style={{
              fontSize: fontSizes.caption, color: colors.textSecondary,
              marginBottom: spacing.xs, fontWeight: fontWeights.medium,
            }}>
              Chain to agent (optional)
            </div>
            <select
              value={chainToAgentId}
              onChange={e => setChainToAgentId(e.target.value)}
              style={{
                width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
                border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
                background: colors.bg, color: colors.text,
                fontSize: fontSizes.label, fontFamily: fonts.ui,
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">— No chain —</option>
              {otherAgents.map(a => {
                const role = AGENT_ROLES.find(r => r.id === a.role)
                return (
                  <option key={a.id} value={a.id}>
                    {role?.label || a.role} ({a.model})
                  </option>
                )
              })}
            </select>
          </div>
        )}

        {/* Parameters */}
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{
            fontSize: fontSizes.caption, color: colors.textSecondary,
            marginBottom: spacing.xs, fontWeight: fontWeights.medium,
          }}>
            Parameters (JSON, optional)
          </div>
          <textarea
            value={params}
            onChange={e => setParams(e.target.value)}
            placeholder='{"topic_id": "abc", "title": "New topic"}'
            rows={3}
            style={{
              width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
              border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
              background: colors.bg, color: colors.text, fontSize: fontSizes.label,
              fontFamily: fonts.mono, outline: 'none', resize: 'vertical',
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: `${spacing.md}px ${spacing.xl}px`,
              border: `1px solid ${colors.separatorThick}`,
              borderRadius: radii.md, background: colors.bgSecondary,
              cursor: 'pointer', fontSize: fontSizes.body,
              color: colors.textSecondary, fontFamily: fonts.ui,
              transition: `background ${transitions.fast}`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = colors.bgTertiary}
            onMouseLeave={e => e.currentTarget.style.background = colors.bgSecondary}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !effectiveAction.trim()}
            style={{
              padding: `${spacing.md}px ${spacing.xl}px`,
              border: 'none',
              borderRadius: radii.md,
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
            {submitting ? 'Submitting...' : 'Submit Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AGENT_ROLES = [
  { id: 'researcher', label: 'Researcher', color: '#3b82f6' },
  { id: 'organizer', label: 'Organizer', color: '#22c55e' },
  { id: 'critic', label: 'Critic', color: '#ef4444' },
  { id: 'expander', label: 'Expander', color: '#a855f7' },
  { id: 'summarizer', label: 'Summarizer', color: '#f59e0b' },
  { id: 'editor', label: 'Editor', color: '#06b6d4' },
  { id: 'analyst', label: 'Analyst', color: '#ec4899' },
]