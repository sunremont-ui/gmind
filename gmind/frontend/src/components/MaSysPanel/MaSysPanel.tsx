import { useState, useEffect } from 'react'
import { useAgentStore } from '../../store/agent'
import type { AgentInfo } from '../../types/agent'
import type { ModulePanelProps } from '../../modules/types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

interface MaSysPipeline { id: string; name: string; description?: string }

export function MaSysPanel({ workbookId, onClose }: ModulePanelProps) {
  const agents = useAgentStore(s => s.agents)
  const masysPipelines = useAgentStore(s => s.masysPipelines)
  const fetchAgents = useAgentStore(s => s.fetchAgents)
  const fetchMasysPipelines = useAgentStore(s => s.fetchMasysPipelines)
  const submitTask = useAgentStore(s => s.submitTask)

  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [runningPipeline, setRunningPipeline] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
    fetchMasysPipelines()
  }, [fetchAgents, fetchMasysPipelines])

  const handleRun = async (pipelineId: string, agentId?: string) => {
    setRunningPipeline(pipelineId)
    try {
      if (agentId) {
        await submitTask(agentId, {
          action: `Run MASys pipeline: ${pipelineId}`,
          params: { pipeline_id: pipelineId },
          workbook_id: workbookId ?? undefined,
        })
      }
    } finally {
      setRunningPipeline(null)
    }
  }

  return (
    <div style={{
      width: 360,
      background: colors.bgTertiary,
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
        <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>
          MASys Pipelines
        </span>
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          <button
            onClick={() => fetchMasysPipelines()}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: colors.textQuaternary, fontSize: fontSizes.caption, fontFamily: fonts.ui,
              transition: `color ${transitions.fast}`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = colors.accent}
            onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
          >
            ↻ Refresh
          </button>
          <button
            onClick={onClose}
            style={{
              padding: `${spacing.xxs}px ${spacing.md}px`,
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textQuaternary, fontSize: fontSizes.bodyLarge, fontFamily: fonts.ui,
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        {agents.length > 0 && (
          <div>
            <div style={{ fontSize: fontSizes.label, color: colors.textSecondary, marginBottom: spacing.xxs }}>
              Run via agent
            </div>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              style={{
                width: '100%', padding: `${spacing.xs}px ${spacing.md}px`,
                border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
                background: colors.bgTertiary, color: colors.text,
                fontSize: fontSizes.body, fontFamily: fonts.ui,
              }}
            >
              <option value="">— select agent —</option>
              {agents.map((a: AgentInfo) => (
                <option key={a.id} value={a.id}>{a.role} ({a.id.slice(-6)})</option>
              ))}
            </select>
          </div>
        )}

        {masysPipelines.length === 0 ? (
          <div style={{
            padding: spacing.xl, textAlign: 'center',
            color: colors.textQuaternary, fontSize: fontSizes.body,
          }}>
            MASys not connected or no pipelines found
          </div>
        ) : (
          masysPipelines.map((p: MaSysPipeline) => (
            <div key={p.id} style={{
              padding: spacing.md, borderRadius: radii.md,
              background: colors.bgTertiary, boxShadow: shadows.neuSm,
              display: 'flex', flexDirection: 'column', gap: spacing.xs,
            }}>
              <div style={{ fontWeight: fontWeights.medium, color: colors.text, fontSize: fontSizes.body }}>
                {p.name || p.id}
              </div>
              {p.description && (
                <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>{p.description}</div>
              )}
              <div style={{ fontSize: fontSizes.label, color: colors.textQuaternary, fontFamily: 'monospace' }}>
                {p.id}
              </div>
              <button
                disabled={runningPipeline === p.id}
                onClick={() => handleRun(p.id, selectedAgent || undefined)}
                style={{
                  marginTop: spacing.xs, padding: `${spacing.xs}px ${spacing.md}px`,
                  border: 'none', borderRadius: radii.sm,
                  background: runningPipeline === p.id ? colors.textQuaternary : colors.accent,
                  color: colors.textInverse,
                  cursor: runningPipeline === p.id ? 'not-allowed' : 'pointer',
                  fontSize: fontSizes.label, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
                  transition: `background ${transitions.fast}`,
                  alignSelf: 'flex-start',
                }}
                onMouseEnter={e => { if (runningPipeline !== p.id) e.currentTarget.style.background = colors.accentHover }}
                onMouseLeave={e => { if (runningPipeline !== p.id) e.currentTarget.style.background = colors.accent }}
              >
                {runningPipeline === p.id ? 'Running...' : '▶ Run'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
