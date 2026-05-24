import { useState, useEffect } from 'react'
import { useAgentStore } from '../../store/agent'
import type { AgentTask } from '../../types/agent'
import { TaskLogPanel } from './TaskLogPanel'
import { CommentsPanel } from '../Comments/CommentsPanel'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

const STATUS_COLORS: Record<string, string> = {
  queued: colors.textQuaternary,
  running: colors.purple,
  done: colors.green,
  failed: colors.red,
  pending_approval: colors.orange,
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  pending_approval: 'Pending Approval',
}

interface Props {
  workbookId: string
}

export function TaskList({ workbookId }: Props) {
  const tasks = useAgentStore(s => s.tasks)
  const agents = useAgentStore(s => s.agents)
  const fetchTasks = useAgentStore(s => s.fetchTasks)
  const approveTask = useAgentStore(s => s.approveTask)
  const rejectTask = useAgentStore(s => s.rejectTask)
  const subscribeToEvents = useAgentStore(s => s.subscribeToEvents)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [logTaskId, setLogTaskId] = useState<string | null>(null)
  const [commentsTaskId, setCommentsTaskId] = useState<string | null>(null)

  useEffect(() => {
    fetchTasks()
    const unsub = subscribeToEvents()
    return unsub
  }, [fetchTasks, subscribeToEvents])

  const handleApprove = async (id: string) => {
    setActing(id)
    try { await approveTask(id) } catch { /* ignore */ }
    setActing(null)
  }

  const handleReject = async (id: string) => {
    setActing(id)
    try { await rejectTask(id) } catch { /* ignore */ }
    setActing(null)
  }

  const handleViewLogs = (taskId: string) => {
    setLogTaskId(taskId)
  }

  const agentMap = new Map(agents.map(a => [a.id, a]))
  const taskMap = new Map(tasks.map(t => [t.id, t]))

  // Group tasks by parallel_group_id (V4.4)
  type Row = { kind: 'single'; task: AgentTask } | { kind: 'group'; groupId: string; tasks: AgentTask[] }
  const groups = new Map<string, AgentTask[]>()
  const singles: AgentTask[] = []
  for (const t of tasks) {
    if (t.parallel_group_id) {
      const list = groups.get(t.parallel_group_id) ?? []
      list.push(t)
      groups.set(t.parallel_group_id, list)
    } else {
      singles.push(t)
    }
  }
  const rows: Row[] = [
    ...singles.map(t => ({ kind: 'single' as const, task: t })),
    ...Array.from(groups.entries()).map(([groupId, ts]) => ({ kind: 'group' as const, groupId, tasks: ts })),
  ]
  rows.sort((a, b) => {
    const ta = a.kind === 'single' ? a.task.created_at : a.tasks[0].created_at
    const tb = b.kind === 'single' ? b.task.created_at : b.tasks[0].created_at
    return tb.localeCompare(ta)
  })

  return (
    <div style={{
      padding: `${spacing.lg}px ${spacing.xl}px`,
      fontFamily: fonts.ui,
      background: colors.bgTertiary,
      boxShadow: shadows.neuInset,
      borderRadius: radii.lg,
      margin: spacing.sm,
    }}>
      <h3 style={{
        margin: `0 0 ${spacing.lg}px`,
        fontSize: fontSizes.subhead,
        fontWeight: fontWeights.semibold,
        color: colors.text,
      }}>
        Tasks
      </h3>
      {tasks.length === 0 ? (
        <p style={{ fontSize: fontSizes.label, color: colors.textQuaternary, margin: 0 }}>
          No tasks yet. Create an agent and submit a task to see it here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {rows.slice(0, 20).map(row => {
            if (row.kind === 'group') {
              const counts = { done: 0, failed: 0, running: 0, queued: 0, pending: 0 }
              for (const t of row.tasks) {
                if (t.status === 'done') counts.done++
                else if (t.status === 'failed') counts.failed++
                else if (t.status === 'running') counts.running++
                else if (t.status === 'pending_approval') counts.pending++
                else counts.queued++
              }
              const groupKey = `group:${row.groupId}`
              const isExpanded = expanded === groupKey
              const allDone = counts.done + counts.failed === row.tasks.length
              const statusColor = allDone
                ? (counts.failed > 0 ? colors.orange : colors.green)
                : colors.purple
              return (
                <div key={groupKey}>
                  <div
                    onClick={() => setExpanded(isExpanded ? null : groupKey)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: spacing.md,
                      padding: `${spacing.md}px ${spacing.lg}px`,
                      background: colors.bgTertiary,
                      borderRadius: radii.md,
                      cursor: 'pointer',
                      border: 'none',
                      boxShadow: shadows.neuMd,
                      fontSize: fontSizes.label,
                      transition: `box-shadow ${transitions.fast}`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = shadows.neuLg }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = shadows.neuMd }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: statusColor, flexShrink: 0,
                      boxShadow: `0 0 0 2px ${statusColor}30`,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: fontWeights.medium, color: colors.text }}>
                        ⚡ Parallel group · {row.tasks.length} tasks
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: fontSizes.caption }}>
                        {counts.done}/{row.tasks.length} done
                        {counts.failed > 0 ? ` · ${counts.failed} failed` : ''}
                        {counts.running > 0 ? ` · ${counts.running} running` : ''}
                        {counts.queued > 0 ? ` · ${counts.queued} queued` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: fontSizes.caption, color: colors.textQuaternary, flexShrink: 0 }}>
                      {row.groupId.slice(0, 18)}...
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: spacing.xs,
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      marginTop: spacing.xs,
                      background: colors.bgTertiary,
                      borderRadius: radii.md,
                      boxShadow: shadows.neuInsetSm,
                    }}>
                      {row.tasks.map(t => {
                        const ag = agentMap.get(t.agent_id)
                        const sc = STATUS_COLORS[t.status] || colors.textQuaternary
                        return (
                          <div key={t.id} style={{
                            display: 'flex', alignItems: 'center', gap: spacing.sm,
                            padding: `${spacing.xs}px ${spacing.sm}px`,
                            fontSize: fontSizes.caption,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc }} />
                            <span style={{ color: colors.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ag?.role ?? t.agent_id}: {t.action}
                            </span>
                            <span style={{ color: colors.textSecondary }}>{STATUS_LABELS[t.status]}</span>
                            {(t.status === 'running' || t.status === 'done' || t.status === 'failed') && (
                              <button
                                onClick={e => { e.stopPropagation(); handleViewLogs(t.id) }}
                                title="View logs"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textQuaternary, fontSize: fontSizes.caption }}
                              >📋</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
            const task = row.task
            const agent = agentMap.get(task.agent_id)
            const statusColor = STATUS_COLORS[task.status] || colors.textQuaternary
            return (
              <div key={task.id}>
                <div
                  onClick={() => setExpanded(expanded === task.id ? null : task.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing.md,
                    padding: `${spacing.md}px ${spacing.lg}px`,
                    background: colors.bgTertiary,
                    borderRadius: radii.md,
                    cursor: 'pointer',
                    border: 'none',
                    boxShadow: shadows.neuSm,
                    fontSize: fontSizes.label,
                    transition: `box-shadow ${transitions.fast}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = shadows.neuMd }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = shadows.neuSm }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: statusColor, flexShrink: 0,
                    display: 'inline-block',
                    boxShadow: `0 0 0 2px ${statusColor}30`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: fontWeights.medium, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.action}
                    </div>
                    <div style={{ color: colors.textSecondary, fontSize: fontSizes.caption }}>
                      {agent?.role ?? task.agent_id} &middot; {STATUS_LABELS[task.status] || task.status}
                    </div>
                  </div>
                  {(task.chain_to_agent_id || task.chain_from_task_id) && (
                    <span title={task.chain_from_task_id ? 'Chained from another task' : 'Chains to another agent'}
                      style={{ fontSize: fontSizes.caption, color: colors.purple, flexShrink: 0 }}>
                      ⛓️
                    </span>
                  )}
                  {task.status === 'pending_approval' && (
                    <div style={{ display: 'flex', gap: spacing.xs, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <ActionBtn color={colors.green} disabled={acting === task.id} onClick={() => handleApprove(task.id)}>✓</ActionBtn>
                      <ActionBtn color={colors.red} disabled={acting === task.id} onClick={() => handleReject(task.id)}>✕</ActionBtn>
                    </div>
                  )}
                  {task.status === 'done' && task.result && (
                    <span style={{ fontSize: fontSizes.caption, color: colors.green, flexShrink: 0 }}>Done</span>
                  )}
                  {task.status === 'failed' && (
                    <span style={{ fontSize: fontSizes.caption, color: colors.red, flexShrink: 0 }}>Error</span>
                  )}
{(task.status === 'running' || task.status === 'done' || task.status === 'failed') && (
                     <button
                       onClick={e => { e.stopPropagation(); handleViewLogs(task.id) }}
                       title="View live logs"
                       style={{
                         padding: `${spacing.xxs}px ${spacing.sm}px`,
                         background: 'none',
                         border: 'none',
                         cursor: 'pointer',
                         color: colors.textQuaternary,
                         fontSize: fontSizes.body,
                         fontFamily: fonts.ui,
                         transition: `color ${transitions.fast}`,
                       }}
                       onMouseEnter={e => e.currentTarget.style.color = colors.accent}
                       onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
                     >
                       📋
                     </button>
                   )}
                   {(task.status === 'done' || task.status === 'failed') && (
                     <button
                       onClick={e => { e.stopPropagation(); setCommentsTaskId(task.id) }}
                       title="Comments"
                       style={{
                         padding: `${spacing.xxs}px ${spacing.sm}px`,
                         background: 'none',
                         border: 'none',
                         cursor: 'pointer',
                         color: colors.textQuaternary,
                         fontSize: fontSizes.body,
                         fontFamily: fonts.ui,
                         transition: `color ${transitions.fast}`,
                       }}
                       onMouseEnter={e => e.currentTarget.style.color = colors.accent}
                       onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
                     >
                       💬
                     </button>
                   )}
                </div>
                {expanded === task.id && (
                  <div style={{
                    padding: `${spacing.md}px ${spacing.lg}px`,
                    marginTop: spacing.xs,
                    background: colors.bgTertiary,
                    borderRadius: radii.md,
                    border: 'none',
                    boxShadow: shadows.neuInsetSm,
                    fontSize: fontSizes.caption,
                    color: colors.textSecondary,
                    maxHeight: 200, overflow: 'auto',
                  }}>
                    <div><strong>ID:</strong> {task.id}</div>
                    <div><strong>Agent:</strong> {agent?.role} ({task.agent_id})</div>
                    <div><strong>Action:</strong> {task.action}</div>
                    <div><strong>Status:</strong> {STATUS_LABELS[task.status]}</div>
                    {task.error && <div style={{ color: colors.red }}><strong>Error:</strong> {task.error}</div>}
                    {task.result && (
                      <div><strong>Result:</strong> <pre style={{ margin: `${spacing.xs}px 0`, whiteSpace: 'pre-wrap', fontFamily: fonts.mono }}>{JSON.stringify(task.result, null, 2)}</pre></div>
                    )}
                    <div><strong>Created:</strong> {new Date(task.created_at).toLocaleString()}</div>
                    <div><strong>Updated:</strong> {new Date(task.updated_at).toLocaleString()}</div>
                    {task.chain_from_task_id && (() => {
                      const src = taskMap.get(task.chain_from_task_id!)
                      const srcAgent = src ? agentMap.get(src.agent_id) : null
                      return (
                        <div style={{ color: colors.purple }}>
                          <strong>⬅ Chained from:</strong>{' '}
                          {srcAgent?.role || src?.agent_id || task.chain_from_task_id}
                          {src ? ` (${src.action})` : ''}
                        </div>
                      )
                    })()}
                    {task.chain_to_agent_id && (() => {
                      const dstAgent = agentMap.get(task.chain_to_agent_id!)
                      return (
                        <div style={{ color: colors.purple }}>
                          <strong>⛓ Chains to:</strong>{' '}
                          {dstAgent?.role || task.chain_to_agent_id}
                        </div>
                      )
                    })()}
                    {task.status === 'pending_approval' && (
                      <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.md }}>
                        <button onClick={() => handleApprove(task.id)} disabled={acting === task.id} style={{
                          padding: `${spacing.xs}px ${spacing.lg}px`,
                          background: colors.green, color: colors.textInverse,
                          border: 'none', borderRadius: radii.sm,
                          cursor: 'pointer', fontSize: fontSizes.label, fontWeight: fontWeights.semibold,
                          fontFamily: fonts.ui,
                        }}>Approve</button>
                        <button onClick={() => handleReject(task.id)} disabled={acting === task.id} style={{
                          padding: `${spacing.xs}px ${spacing.lg}px`,
                          background: colors.red, color: colors.textInverse,
                          border: 'none', borderRadius: radii.sm,
                          cursor: 'pointer', fontSize: fontSizes.label, fontWeight: fontWeights.semibold,
                          fontFamily: fonts.ui,
                        }}>Reject</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {tasks.length > 20 && (
            <p style={{ fontSize: fontSizes.caption, color: colors.textQuaternary, textAlign: 'center', margin: 0 }}>
              + {tasks.length - 20} more
            </p>
          )}
        </div>
      )}

{/* Live Logs Modal */}
       {logTaskId && (
         <TaskLogPanel
           taskId={logTaskId}
           onClose={() => setLogTaskId(null)}
         />
       )}

       {/* Comments Modal */}
       {commentsTaskId && (
         <CommentsPanel
           topicId={commentsTaskId}
           topicTitle={(() => {
             const t = tasks.find(t => t.id === commentsTaskId)
             return t ? `${t.action} (${t.agent_id})` : ''
           })()}
           onClose={() => setCommentsTaskId(null)}
         />
       )}
     </div>
  )
}

function ActionBtn({ color, disabled, onClick, children }: { color: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 22, height: 22, borderRadius: '50%',
        border: 'none',
        background: colors.bgTertiary,
        boxShadow: shadows.neuInsetSm,
        color, cursor: disabled ? 'default' : 'pointer',
        fontSize: fontSizes.caption, fontWeight: fontWeights.bold,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        fontFamily: fonts.ui,
      }}
    >
      {children}
    </button>
  )
}