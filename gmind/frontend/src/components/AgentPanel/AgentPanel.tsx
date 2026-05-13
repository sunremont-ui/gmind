import { useState, useEffect } from 'react'
import { useAgentStore } from '../../store/agent'
import { AGENT_ROLES, type AgentInfo } from '../../types/agent'
import { TaskList } from '../TaskList/TaskList'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z } from '../../styles/tokens'

interface AgentPanelProps {
  workbookId: string
  onClose: () => void
}

export function AgentPanel({ workbookId, onClose }: AgentPanelProps) {
  const agents = useAgentStore(s => s.agents)
  const loading = useAgentStore(s => s.loading)
  const fetchAgents = useAgentStore(s => s.fetchAgents)
  const createAgent = useAgentStore(s => s.createAgent)
  const deleteAgent = useAgentStore(s => s.deleteAgent)
  const subscribeToEvents = useAgentStore(s => s.subscribeToEvents)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'agents' | 'tasks'>('agents')

  useEffect(() => {
    fetchAgents()
    const unsub = subscribeToEvents()
    return unsub
  }, [fetchAgents, subscribeToEvents])

  const handleCreateAgent = async (roleId: string, provider?: string, model?: string) => {
    try {
      await createAgent({ role: roleId, provider, model })
      setShowCreate(false)
    } catch (err) {
      console.error('Failed to create agent:', err)
    }
  }

  const handleDeleteAgent = async (id: string) => {
    try {
      await deleteAgent(id)
    } catch (err) {
      console.error('Failed to delete agent:', err)
    }
  }

  return (
    <div style={{
      width: 320,
      background: colors.bgSecondary,
      borderLeft: `1px solid ${colors.separator}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: fonts.ui,
      overflowY: 'auto',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${spacing.md}px ${spacing.xl}px`,
        borderBottom: `1px solid ${colors.separator}`,
      }}>
        <div style={{ display: 'flex', gap: spacing.xs }}>
          <TabButton active={tab === 'agents'} onClick={() => setTab('agents')}>Agents</TabButton>
          <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>Tasks</TabButton>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          {tab === 'agents' && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: `${spacing.xs}px ${spacing.lg}px`,
                background: colors.accent,
                color: colors.textInverse,
                border: 'none',
                borderRadius: radii.sm,
                cursor: 'pointer',
                fontSize: fontSizes.label,
                fontWeight: fontWeights.medium,
                fontFamily: fonts.ui,
                transition: `all ${transitions.fast}`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = colors.accentHover}
              onMouseLeave={e => e.currentTarget.style.background = colors.accent}
            >
              + New
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: `${spacing.xs}px ${spacing.md}px`,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textQuaternary,
              fontSize: fontSizes.bodyLarge,
              fontFamily: fonts.ui,
              transition: `color ${transitions.fast}`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = colors.text}
            onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: spacing.md }}>
        {tab === 'agents' ? (
          loading ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textQuaternary, fontSize: fontSizes.body }}>
              Loading agents...
            </div>
          ) : agents.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textQuaternary, fontSize: fontSizes.body }}>
              No agents yet. Click "+ New" to create one.
            </div>
          ) : (
            agents.map(a => (
              <AgentCard key={a.id} agent={a} onDelete={handleDeleteAgent} />
            ))
          )
        ) : (
          <TaskList workbookId={workbookId} />
        )}
      </div>

      {showCreate && (
        <AgentCreateDialog
          onSelect={handleCreateAgent}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function AgentCard({ agent, onDelete }: { agent: AgentInfo; onDelete: (id: string) => void }) {
  const role = AGENT_ROLES.find(r => r.id === agent.role)

  const statusColor = agent.status === 'working' ? colors.green
    : agent.status === 'error' ? colors.red
    : colors.textQuaternary

  return (
    <div style={{
      padding: `${spacing.md}px ${spacing.lg}px`,
      marginBottom: spacing.sm,
      borderRadius: radii.md,
      border: 'none',
      background: colors.bgTertiary,
      boxShadow: shadows.neuMd,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 0 2px ${statusColor}30`,
          }} />
          <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>
            {role?.label || agent.role}
          </span>
        </div>
        <button
          onClick={() => onDelete(agent.id)}
          style={{
            padding: `${spacing.xxs}px ${spacing.sm}px`,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.textQuaternary,
            fontSize: fontSizes.body,
            transition: `color ${transitions.fast}`,
          }}
          onMouseEnter={e => e.currentTarget.style.color = colors.red}
          onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Tag label={agent.provider || 'default'} color={colors.accent} />
        <Tag label={agent.model || 'gpt-4o'} color={colors.textSecondary} />
        <Tag label={agent.status} color={statusColor} />
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: `${spacing.xs}px ${spacing.lg}px`,
        border: 'none',
        borderRadius: radii.sm,
        cursor: 'pointer',
        fontSize: fontSizes.label,
        fontWeight: fontWeights.semibold,
        background: active ? colors.accentLight : 'transparent',
        color: active ? colors.accent : colors.textSecondary,
        fontFamily: fonts.ui,
        transition: `all ${transitions.fast}`,
      }}
    >
      {children}
    </button>
  )
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      padding: `${spacing.xxs}px ${spacing.sm}px`,
      borderRadius: radii.sm,
      background: color + '18',
      color,
    }}>
      {label}
    </span>
  )
}

function AgentCreateDialog({ onSelect, onClose }: { onSelect: (roleId: string, provider?: string, model?: string) => void; onClose: () => void }) {
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: colors.scrim,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: z.modalBackdrop,
    }}>
      <div style={{
        background: colors.bgTertiary,
        borderRadius: 18,
        padding: spacing.xxxl,
        width: 400, maxHeight: '80vh', overflow: 'auto',
        boxShadow: shadows.neuLg,
        fontFamily: fonts.ui, border: 'none',
      }}>
        <h2 style={{ fontSize: fontSizes.title, fontWeight: fontWeights.semibold, marginBottom: spacing.xl, color: colors.text, margin: `0 0 ${spacing.xl}px` }}>
          Create New Agent
        </h2>

        <div style={{ marginBottom: spacing.xl, display: 'flex', gap: spacing.md }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary, marginBottom: spacing.xxs }}>Provider</div>
            <input value={provider} onChange={e => setProvider(e.target.value)}
              placeholder="openai" style={{
                width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
                border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
                background: colors.bg, color: colors.text, fontSize: fontSizes.label,
                fontFamily: fonts.mono,
                outline: 'none',
              }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary, marginBottom: spacing.xxs }}>Model</div>
            <input value={model} onChange={e => setModel(e.target.value)}
              placeholder="gpt-4o" style={{
                width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
                border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
                background: colors.bg, color: colors.text, fontSize: fontSizes.label,
                fontFamily: fonts.mono,
                outline: 'none',
              }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {AGENT_ROLES.map(role => (
            <button
              key={role.id}
              onClick={() => onSelect(role.id, provider || undefined, model || undefined)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: spacing.xxs, padding: `${spacing.lg}px ${spacing.xl}px`,
                border: `1px solid ${colors.separator}`,
                borderRadius: radii.md, background: colors.bg,
                cursor: 'pointer', fontSize: fontSizes.body, textAlign: 'left',
                fontFamily: fonts.ui,
                transition: `border-color ${transitions.fast}, background ${transitions.fast}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.background = colors.accentLight }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = colors.separator; e.currentTarget.style.background = colors.bg }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: role.color }} />
                <span style={{ fontWeight: fontWeights.semibold, color: colors.text }}>{role.label}</span>
              </div>
              <span style={{ fontSize: fontSizes.caption, color: colors.textSecondary, marginLeft: spacing.xl }}>{role.desc}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.xl }}>
          <button
            onClick={onClose}
            style={{
              padding: `${spacing.md}px ${spacing.xl}px`,
              border: `1px solid ${colors.separatorThick}`,
              borderRadius: radii.md,
              background: colors.bgSecondary,
              cursor: 'pointer',
              fontSize: fontSizes.body,
              color: colors.textSecondary,
              fontFamily: fonts.ui,
              transition: `background ${transitions.fast}`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = colors.bgTertiary}
            onMouseLeave={e => e.currentTarget.style.background = colors.bgSecondary}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
