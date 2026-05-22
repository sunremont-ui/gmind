import { useState, useEffect, useRef } from 'react'
import { useAgentStore } from '../../store/agent'
import { AGENT_ROLES, type AgentInfo, type TaskSubmitRequest } from '../../types/agent'
import type { AIModelProvider } from '../../types/api'
import { TaskList } from '../TaskList/TaskList'
import { TaskSubmitDialog } from './TaskSubmitDialog'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z } from '../../styles/tokens'

interface AgentPanelProps {
  workbookId: string | null
  onClose: () => void
}

export function AgentPanel({ workbookId, onClose }: AgentPanelProps) {
  const agents = useAgentStore(s => s.agents)
  const tasks = useAgentStore(s => s.tasks)
  const loading = useAgentStore(s => s.loading)
  const error = useAgentStore(s => s.error)
  const fetchAgents = useAgentStore(s => s.fetchAgents)
  const fetchModelPresets = useAgentStore(s => s.fetchModelPresets)
  const createAgent = useAgentStore(s => s.createAgent)
  const deleteAgent = useAgentStore(s => s.deleteAgent)
  const submitTask = useAgentStore(s => s.submitTask)
  const updateAgent = useAgentStore(s => s.updateAgent)
  const stopAgent = useAgentStore(s => s.stopAgent)
  const subscribeToEvents = useAgentStore(s => s.subscribeToEvents)
  const [showCreate, setShowCreate] = useState(false)
  const [submitDialog, setSubmitDialog] = useState<{ agentId: string; roleId: string } | null>(null)
  const [tab, setTab] = useState<'agents' | 'tasks'>('agents')

  useEffect(() => {
    fetchAgents()
    fetchModelPresets()
    const unsub = subscribeToEvents()
    return unsub
  }, [fetchAgents, fetchModelPresets, subscribeToEvents])

  const handleCreateAgent = async (roleId: string, provider?: string, model?: string, name?: string, systemPrompt?: string) => {
    try {
      await createAgent({ role: roleId, provider, model, name, system_prompt: systemPrompt })
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

const handleSubmitTask = async (agentId: string, req: { action: string; params?: Record<string, unknown>; workbook_id?: string }) => {
     return await submitTask(agentId, req)
   }

const handleUpdateAgent = async (agentId: string, provider?: string, model?: string, systemPrompt?: string) => {
      try {
        await updateAgent(agentId, provider, model, systemPrompt)
      } catch (err) {
        console.error('Failed to update agent:', err)
      }
    }

      const handleUpdateModel = async (agentId: string, model: string) => {
    await handleUpdateAgent(agentId, undefined, model)
  }

  const handleUpdateSystemPrompt = async (agentId: string, prompt: string) => {
    await handleUpdateAgent(agentId, undefined, undefined, prompt)
  }

  const handleStopAgent = async (agentId: string) => {
    try {
      await stopAgent(agentId)
    } catch (err) {
      console.error('Failed to stop agent:', err)
    }
  }

  return (
    <div style={{
      width: 360,
      background: colors.bgTertiary,
      borderLeft: 'none',
      boxShadow: '-2px 0 24px rgba(15, 15, 25, 0.08), -1px 0 0 rgba(15,15,25,0.06)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: fonts.ui,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${spacing.md}px ${spacing.xl}px`,
        borderBottom: `1px solid ${colors.separator}`,
        flexShrink: 0,
        background: colors.bgTertiary,
      }}>
        <div style={{ display: 'flex', gap: spacing.xs }}>
          <TabButton active={tab === 'agents'} onClick={() => setTab('agents')}>Agents</TabButton>
          <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>
            Tasks {tasks.length > 0 && <Badge count={tasks.length} />}
          </TabButton>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
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
              padding: `${spacing.xxs}px ${spacing.md}px`,
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

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: spacing.md }}>
        {tab === 'agents' ? (
          <>
            {error && (
              <div style={{
                padding: `${spacing.md}px ${spacing.lg}px`,
                marginBottom: spacing.md,
                background: colors.red + '12',
                border: `1px solid ${colors.red}40`,
                borderRadius: radii.md,
                color: colors.red,
                fontSize: fontSizes.caption,
              }}>
                {error}
              </div>
            )}
            {loading ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textQuaternary, fontSize: fontSizes.body }}>
              Loading agents...
            </div>
          ) : agents.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.lg }}>
              <span style={{ color: colors.textQuaternary, fontSize: fontSizes.body }}>
                No agents yet
              </span>
              <button onClick={() => setShowCreate(true)}
                style={{
                  padding: `${spacing.md}px ${spacing.xxl}px`,
                  background: colors.accent,
                  color: colors.textInverse,
                  border: 'none',
                  borderRadius: radii.md,
                  cursor: 'pointer',
                  fontSize: fontSizes.body,
                  fontWeight: fontWeights.semibold,
                  fontFamily: fonts.ui,
                  transition: `all ${transitions.fast}`,
                }}
                onMouseEnter={e => e.currentTarget.style.background = colors.accentHover}
                onMouseLeave={e => e.currentTarget.style.background = colors.accent}
              >
                + Create Agent
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
{agents.map(a => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  onDelete={handleDeleteAgent}
                  onStop={handleStopAgent}
                  onOpenAdvanced={() => setSubmitDialog({ agentId: a.id, roleId: a.role })}
                  onUpdateModel={handleUpdateModel}
                  onUpdateSystemPrompt={handleUpdateSystemPrompt}
                  onQuickSubmit={handleSubmitTask}
                />
              ))}
            </div>
          )}
          </>
        ) : (
          <TaskList workbookId={workbookId ?? ''} />
        )}

      </div>

      {/* Create Agent Dialog */}
      {showCreate && (
        <AgentCreateDialog
          onSelect={(roleId, provider, model, name, systemPrompt) => handleCreateAgent(roleId, provider, model, name, systemPrompt)}
          onClose={() => setShowCreate(false)}
        />
      )}

      {submitDialog && (
        <TaskSubmitDialog
          agentId={submitDialog.agentId}
          roleId={submitDialog.roleId}
          workbookId={workbookId ?? ''}
          agents={agents}
          onSubmit={handleSubmitTask}
          onClose={() => setSubmitDialog(null)}
        />
      )}
    </div>
  )
}


function Badge({ count }: { count: number }) {
  return (
    <span style={{
      background: colors.orange,
      color: colors.textInverse,
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      minWidth: 18, height: 18,
      borderRadius: 9,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 4px',
      marginLeft: spacing.xs,
    }}>
      {count}
    </span>
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

function flattenModels(presets: AIModelProvider[]): { key: string; value: string; label: string }[] {
  const flat: { key: string; value: string; label: string }[] = []
  for (const p of presets) {
    for (const m of p.models) {
      flat.push({ key: `${p.id}:${m.id}`, value: m.id, label: `${p.label} — ${m.label}` })
    }
  }
  return flat
}

// Default action per role for quick-prompt
const ROLE_DEFAULT_ACTION: Record<string, string> = {
  researcher:  'search_web',
  organizer:   'create_multiple_topics',
  critic:      'add_note',
  expander:    'create_multiple_topics',
  summarizer:  'summarize_topics',
  editor:      'update_topic',
  analyst:     'get_workbook',
}

function AgentCard({ agent, onDelete, onStop, onOpenAdvanced, onUpdateModel, onUpdateSystemPrompt, onQuickSubmit }: {
  agent: AgentInfo
  onDelete: (id: string) => void
  onStop: (id: string) => void
  onOpenAdvanced: () => void
  onUpdateModel: (agentId: string, model: string) => void
  onUpdateSystemPrompt: (agentId: string, prompt: string) => void
  onQuickSubmit: (agentId: string, req: { action: string; params?: Record<string, unknown>; workbook_id?: string }) => Promise<string | undefined>
}) {
  const role = AGENT_ROLES.find(r => r.id === agent.role)
  const agentLog = useAgentStore(s => s.agentLogs[agent.id])
  const lastTask = useAgentStore(s => { const t = s.tasks.filter(t => t.agent_id === agent.id); return t[t.length - 1] })
  const modelPresets = useAgentStore(s => s.modelPresets)
  const modelOptions = flattenModels(modelPresets)
  const [dots, setDots] = useState('')
  const [manualModel, setManualModel] = useState(false)
  const [manualModelValue, setManualModelValue] = useState(agent.model || '')
  const [quickPrompt, setQuickPrompt] = useState('')
  const [quickSending, setQuickSending] = useState(false)
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [promptDraft, setPromptDraft] = useState(agent.system_prompt || '')
  const [promptSaving, setPromptSaving] = useState(false)
  const quickRef = useRef<HTMLTextAreaElement>(null)

  const isWorking = agent.status === 'working'
  const statusColor = isWorking ? colors.green
    : agent.status === 'error' ? colors.red
    : colors.textQuaternary

  useEffect(() => {
    if (!isWorking) { setDots(''); return }
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [isWorking])

  // Sync prompt draft when agent updates
  useEffect(() => {
    if (!promptSaving) setPromptDraft(agent.system_prompt || '')
  }, [agent.system_prompt, promptSaving])

  const agentThought = isWorking
    ? agentLog?.tool_name
      ? `Using ${agentLog.tool_name}${dots}`
      : agentLog?.content
        ? `Thinking${dots}`
        : `Working${dots}`
    : null

  const displayName = agent.name || `${role?.label || agent.role} #${agent.id.slice(-4)}`

  const handleManualModelBlur = () => {
    if (manualModelValue.trim() && manualModelValue !== agent.model) {
      onUpdateModel(agent.id, manualModelValue.trim())
    }
  }

  const handleManualModelKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleManualModelBlur()
    if (e.key === 'Escape') { setManualModel(false); setManualModelValue(agent.model || '') }
  }

  const handleQuickSend = async () => {
    if (!quickPrompt.trim() || isWorking || quickSending) return
    setQuickSending(true)
    try {
      await onQuickSubmit(agent.id, {
        action: quickPrompt.trim(),
        params: { query: quickPrompt.trim() },
      })
      setQuickPrompt('')
    } catch {
      // error shown in store
    } finally {
      setQuickSending(false)
    }
  }

  const handleQuickKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleQuickSend()
    }
  }

  const handleSavePrompt = async () => {
    setPromptSaving(true)
    try {
      await onUpdateSystemPrompt(agent.id, promptDraft)
      setShowPromptEditor(false)
    } finally {
      setPromptSaving(false)
    }
  }

  const btnBase: React.CSSProperties = {
    padding: `${spacing.xxs}px ${spacing.sm}px`,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: fontSizes.body,
    transition: `color ${transitions.fast}`,
    fontFamily: fonts.ui,
  }

  return (
    <div style={{
      padding: `${spacing.md}px ${spacing.lg}px`,
      marginBottom: spacing.sm,
      borderRadius: radii.md,
      border: 'none',
      background: colors.bgTertiary,
      boxShadow: shadows.neuMd,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: statusColor,
            boxShadow: `0 0 0 2px ${statusColor}30`,
          }} />
          <span style={{
            fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayName}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
          {/* Prompt toggle */}
          <button
            onClick={() => setShowPromptEditor(v => !v)}
            title={showPromptEditor ? 'Hide prompt' : 'Edit system prompt'}
            style={{
              ...btnBase,
              color: (agent.system_prompt || showPromptEditor) ? colors.accent : colors.textQuaternary,
              fontSize: fontSizes.caption,
              padding: `${spacing.xxs}px ${spacing.xs}px`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = colors.accent}
            onMouseLeave={e => e.currentTarget.style.color = (agent.system_prompt || showPromptEditor) ? colors.accent : colors.textQuaternary}
          >⚙</button>
          {isWorking ? (
            <button
              onClick={() => onStop(agent.id)}
              style={{ ...btnBase, color: colors.red }}
              title="Stop agent"
              onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >■</button>
          ) : (
            <button
              onClick={() => onDelete(agent.id)}
              style={{ ...btnBase, color: colors.textQuaternary }}
              title="Delete agent"
              onMouseEnter={e => e.currentTarget.style.color = colors.red}
              onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
            >✕</button>
          )}
        </div>
      </div>

      {/* Model row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
        {manualModel ? (
          <input
            value={manualModelValue}
            onChange={e => setManualModelValue(e.target.value)}
            onBlur={handleManualModelBlur}
            onKeyDown={handleManualModelKey}
            autoFocus
            placeholder="model id…"
            style={{
              flex: 1,
              padding: `${spacing.xxs}px ${spacing.sm}px`,
              border: `1px solid ${colors.accent}`,
              borderRadius: radii.sm,
              background: colors.bg,
              color: colors.text,
              fontSize: fontSizes.caption,
              fontFamily: fonts.mono,
              outline: 'none',
            }}
          />
        ) : (
          <select
            value={modelOptions.find(m => m.value === agent.model) ? agent.model : (modelOptions[0]?.value || agent.model || '')}
            onChange={e => onUpdateModel(agent.id, e.target.value)}
            disabled={isWorking}
            style={{
              flex: 1,
              padding: `${spacing.xxs}px ${spacing.sm}px`,
              border: `1px solid ${colors.separator}`,
              borderRadius: radii.sm,
              background: isWorking ? colors.bgTertiary : colors.bg,
              color: colors.text,
              fontSize: fontSizes.caption,
              fontFamily: fonts.mono,
              outline: 'none',
              cursor: isWorking ? 'default' : 'pointer',
              opacity: isWorking ? 0.5 : 1,
            }}
          >
            {modelOptions.length > 0 ? modelOptions.map(m => (
              <option key={m.key} value={m.value}>{m.label}</option>
            )) : (
              <option value={agent.model || ''}>{agent.model || 'default'}</option>
            )}
          </select>
        )}
        <button
          onClick={() => {
            setManualModel(v => !v)
            if (!manualModel) setManualModelValue(agent.model || '')
          }}
          title={manualModel ? 'Use preset list' : 'Enter model ID manually'}
          style={{
            ...btnBase,
            color: manualModel ? colors.accent : colors.textQuaternary,
            fontSize: fontSizes.caption,
            padding: `${spacing.xxs}px ${spacing.xs}px`,
          }}
          onMouseEnter={e => e.currentTarget.style.color = colors.accent}
          onMouseLeave={e => e.currentTarget.style.color = manualModel ? colors.accent : colors.textQuaternary}
        >✎</button>
      </div>

      {/* System prompt editor (collapsible) */}
      {showPromptEditor && (
        <div style={{ marginBottom: spacing.sm }}>
          <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: fontWeights.medium }}>
            System Prompt <span style={{ color: colors.textQuaternary, fontWeight: fontWeights.regular }}>(overrides role default)</span>
          </div>
          <textarea
            value={promptDraft}
            onChange={e => setPromptDraft(e.target.value)}
            placeholder="You are a custom agent. Your goal is…"
            rows={4}
            style={{
              width: '100%', resize: 'vertical',
              padding: `${spacing.sm}px ${spacing.md}px`,
              border: 'none', borderRadius: radii.sm,
              background: colors.bgTertiary, color: colors.text,
              fontSize: fontSizes.caption, fontFamily: fonts.mono,
              outline: 'none', boxShadow: shadows.neuInsetSm,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.xs, justifyContent: 'flex-end' }}>
            {agent.system_prompt && (
              <button
                onClick={() => { setPromptDraft(''); onUpdateSystemPrompt(agent.id, '') }}
                style={{
                  padding: `${spacing.xxs}px ${spacing.sm}px`,
                  border: 'none', borderRadius: radii.sm,
                  background: 'none', color: colors.textQuaternary,
                  fontSize: fontSizes.caption, cursor: 'pointer', fontFamily: fonts.ui,
                }}
                onMouseEnter={e => e.currentTarget.style.color = colors.red}
                onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
              >✕ Reset</button>
            )}
            <button
              onClick={handleSavePrompt}
              disabled={promptSaving}
              style={{
                padding: `${spacing.xxs}px ${spacing.md}px`,
                border: 'none', borderRadius: radii.sm,
                background: colors.accent, color: colors.textInverse,
                fontSize: fontSizes.caption, cursor: 'pointer',
                fontWeight: fontWeights.medium, fontFamily: fonts.ui,
                opacity: promptSaving ? 0.6 : 1,
              }}
            >{promptSaving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* Tags */}
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm }}>
        <Tag label={agent.provider || 'default'} color={colors.accent} />
        <Tag label={agent.status} color={statusColor} />
        {agent.system_prompt && <Tag label="custom prompt" color={colors.purple ?? colors.accent} />}
      </div>

      {/* Working indicator */}
      {agentThought && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.sm,
          marginBottom: spacing.sm,
          padding: `${spacing.xs}px ${spacing.sm}px`,
          background: colors.green + '12',
          borderRadius: radii.sm,
          fontSize: fontSizes.caption,
          color: colors.green,
          fontFamily: fonts.mono,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.green, flexShrink: 0 }} />
          {agentThought}
        </div>
      )}

      {/* Last task snippet */}
      {!isWorking && lastTask && (
        <div style={{
          marginBottom: spacing.sm,
          padding: `${spacing.xxs}px ${spacing.sm}px`,
          borderRadius: radii.sm,
          background: lastTask.status === 'done' ? colors.green + '10' : lastTask.status === 'failed' ? colors.red + '10' : colors.separator + '40',
          fontSize: fontSizes.caption,
          color: lastTask.status === 'done' ? colors.green : lastTask.status === 'failed' ? colors.red : colors.textSecondary,
          display: 'flex', alignItems: 'center', gap: spacing.xs,
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          <span>{lastTask.status === 'done' ? '✓' : lastTask.status === 'failed' ? '✗' : '…'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastTask.action}</span>
        </div>
      )}

      {/* Quick prompt */}
      <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.xs }}>
        <textarea
          ref={quickRef}
          value={quickPrompt}
          onChange={e => setQuickPrompt(e.target.value)}
          onKeyDown={handleQuickKey}
          disabled={isWorking || quickSending}
          placeholder={isWorking ? 'Agent is working…' : `Ask ${role?.label ?? 'agent'}… (Enter to send)`}
          rows={2}
          style={{
            flex: 1, resize: 'none',
            padding: `${spacing.xs}px ${spacing.sm}px`,
            border: 'none', borderRadius: radii.sm,
            background: colors.bgTertiary, color: colors.text,
            fontSize: fontSizes.caption, fontFamily: fonts.ui,
            outline: 'none', boxShadow: shadows.neuInsetSm,
            opacity: (isWorking || quickSending) ? 0.5 : 1,
            transition: `opacity ${transitions.fast}`,
          }}
        />
        <button
          onClick={handleQuickSend}
          disabled={isWorking || quickSending || !quickPrompt.trim()}
          title="Send (or press Enter)"
          style={{
            flexShrink: 0,
            padding: `${spacing.xs}px ${spacing.md}px`,
            border: 'none', borderRadius: radii.sm,
            background: (isWorking || quickSending || !quickPrompt.trim()) ? colors.separator : colors.accent,
            color: colors.textInverse,
            cursor: (isWorking || quickSending || !quickPrompt.trim()) ? 'default' : 'pointer',
            fontSize: fontSizes.body,
            transition: `background ${transitions.fast}`,
            alignSelf: 'flex-end',
          }}
          onMouseEnter={e => { if (!isWorking && !quickSending && quickPrompt.trim()) e.currentTarget.style.background = colors.accentHover }}
          onMouseLeave={e => { if (!isWorking && !quickSending && quickPrompt.trim()) e.currentTarget.style.background = colors.accent }}
        >→</button>
      </div>

      {/* Advanced button */}
      <button
        onClick={onOpenAdvanced}
        style={{
          width: '100%',
          padding: `${spacing.xs}px ${spacing.lg}px`,
          background: 'none',
          color: colors.textSecondary,
          border: `1px solid ${colors.separator}`,
          borderRadius: radii.sm,
          cursor: 'pointer',
          fontSize: fontSizes.caption,
          fontFamily: fonts.ui,
          transition: `all ${transitions.fast}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.color = colors.accent }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = colors.separator; e.currentTarget.style.color = colors.textSecondary }}
      >
        ⚙ Advanced options
      </button>
    </div>
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

function AgentCreateDialog({ onSelect, onClose }: {
  onSelect: (roleId: string, provider?: string, model?: string, name?: string, systemPrompt?: string) => void
  onClose: () => void
}) {
  const modelPresets = useAgentStore(s => s.modelPresets)
  const [agentName, setAgentName] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [manualModel, setManualModel] = useState(false)
  const [customBaseURL, setCustomBaseURL] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showPromptSection, setShowPromptSection] = useState(false)

  const fetchModelPresetsOnOpen = useAgentStore(s => s.fetchModelPresets)

  useEffect(() => {
    // Ensure model presets (including local llama models) are loaded when dialog opens
    fetchModelPresetsOnOpen()
  }, [fetchModelPresetsOnOpen])

  const isCustom = selectedProvider === 'custom'
  const selectedProviderEntry = modelPresets.find(p => p.id === selectedProvider)
  const filteredModels = selectedProvider && !isCustom
    ? (selectedProviderEntry?.models ?? [])
    : modelPresets.flatMap(p => p.models)
  const groupedModels = selectedProvider && !isCustom
    ? (selectedProviderEntry ? [selectedProviderEntry] : [])
    : modelPresets

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProvider(e.target.value)
    setSelectedModel('')
    setManualModel(false)
  }

  const effectiveProvider = isCustom ? 'custom' : selectedProvider
  const effectiveModel = isCustom ? customBaseURL : selectedModel

  const fieldLabel: React.CSSProperties = {
    fontSize: fontSizes.caption, color: colors.textSecondary,
    marginBottom: spacing.xs, fontWeight: fontWeights.medium,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
    border: 'none', borderRadius: radii.sm,
    background: colors.bgTertiary, color: colors.text, fontSize: fontSizes.label,
    fontFamily: fonts.mono, outline: 'none',
    boxShadow: shadows.neuInsetSm, boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: colors.scrim,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: z.modal,
    }}>
      <div style={{
        background: colors.bgTertiary,
        borderRadius: radii.xl,
        padding: spacing.xxxl,
        width: 440, maxHeight: '88vh', overflow: 'auto',
        boxShadow: shadows.neuLg,
        fontFamily: fonts.ui, border: 'none',
      }}>
        <h2 style={{ fontSize: fontSizes.title, fontWeight: fontWeights.semibold, color: colors.text, margin: `0 0 ${spacing.xl}px` }}>
          Create New Agent
        </h2>

        {/* Name */}
        <div style={{ marginBottom: spacing.lg }}>
          <div style={fieldLabel}>Name (optional)</div>
          <input
            value={agentName}
            onChange={e => setAgentName(e.target.value)}
            placeholder="e.g. My Researcher"
            style={inputStyle}
          />
        </div>

        {/* Provider */}
        <div style={{ marginBottom: spacing.lg }}>
          <div style={fieldLabel}>Provider</div>
          <select value={selectedProvider} onChange={handleProviderChange} style={inputStyle}>
            <option value="">— auto (default) —</option>
            {modelPresets.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="custom">Custom endpoint…</option>
          </select>
        </div>

        {/* Custom Base URL */}
        {isCustom && (
          <div style={{ marginBottom: spacing.lg }}>
            <div style={fieldLabel}>Base URL</div>
            <input
              value={customBaseURL}
              onChange={e => setCustomBaseURL(e.target.value)}
              placeholder="http://localhost:1234/v1"
              style={inputStyle}
            />
          </div>
        )}

        {/* Model (non-custom providers) */}
        {!isCustom && (
          <div style={{ marginBottom: spacing.lg }}>
            <div style={{ ...fieldLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Model</span>
              <button
                onClick={() => { setManualModel(v => !v); setSelectedModel('') }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: fontSizes.caption, color: manualModel ? colors.accent : colors.textQuaternary,
                  fontFamily: fonts.ui, padding: 0,
                  transition: `color ${transitions.fast}`,
                }}
              >
                {manualModel ? '↩ Use list' : '✎ Enter manually'}
              </button>
            </div>
            {manualModel ? (
              <input
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                placeholder="e.g. llama3.2:8b, gpt-4o-mini"
                style={inputStyle}
                autoFocus
              />
            ) : (
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={inputStyle}>
                <option value="">— auto (default) —</option>
                {selectedProvider && !isCustom ? (
                  filteredModels.map((m, index) => (
                    <option key={`${selectedProvider}-${m.id}-${index}`} value={m.id}>{m.label}</option>
                  ))
                ) : (
                  groupedModels.map(provider => (
                    <optgroup key={provider.id} label={provider.label}>
                      {provider.models.map((m, index) => (
                        <option key={`${provider.id}-${m.id}-${index}`} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
            )}
          </div>
        )}

        {/* System Prompt (collapsible) */}
        <div style={{ marginBottom: spacing.lg }}>
          <button
            onClick={() => setShowPromptSection(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: spacing.xs,
              fontSize: fontSizes.caption, color: showPromptSection ? colors.accent : colors.textSecondary,
              fontFamily: fonts.ui, fontWeight: fontWeights.medium,
              transition: `color ${transitions.fast}`,
            }}
          >
            <span style={{ fontSize: 10 }}>{showPromptSection ? '▼' : '▶'}</span>
            Custom System Prompt
            {systemPrompt && <span style={{ fontSize: fontSizes.caption, color: colors.accent }}> ✓</span>}
          </button>
          {showPromptSection && (
            <div style={{ marginTop: spacing.sm }}>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="You are a custom agent. Overrides the role default prompt…"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: fonts.mono }}
                autoFocus
              />
              <div style={{ fontSize: fontSizes.caption, color: colors.textQuaternary, marginTop: spacing.xxs }}>
                Leave empty to use the role default.
              </div>
            </div>
          )}
        </div>

        {/* Role buttons */}
        <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: fontWeights.medium }}>
          Select Role to Create
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {AGENT_ROLES.map(role => (
            <button
              key={role.id}
              onClick={() => onSelect(
                role.id,
                effectiveProvider || undefined,
                effectiveModel || undefined,
                agentName.trim() || undefined,
                systemPrompt.trim() || undefined,
              )}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: spacing.xxs, padding: `${spacing.md}px ${spacing.lg}px`,
                border: 'none', borderRadius: radii.md,
                background: colors.bgTertiary, boxShadow: shadows.neuSm,
                cursor: 'pointer', fontSize: fontSizes.body, textAlign: 'left',
                fontFamily: fonts.ui,
                transition: `box-shadow ${transitions.fast}, background ${transitions.fast}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 2px ${colors.accentLight}`; e.currentTarget.style.background = colors.accentLight }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = shadows.neuSm; e.currentTarget.style.background = colors.bgTertiary }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: role.color, boxShadow: `0 0 0 3px ${role.color}25` }} />
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
        </div>
      </div>
    </div>
  )
}