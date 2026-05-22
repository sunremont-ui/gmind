import type { AgentInfo, AgentCreateRequest, AgentTask, ModuleInfo, TaskSubmitRequest, Comment, CreateCommentRequest } from '../types/agent'
import { ApiError } from './errors'

const API_BASE = '/api/v1'

async function agentFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText, code: 'UNKNOWN', status: res.status }))
    throw new ApiError(body.error || `HTTP ${res.status}`, body.code || 'UNKNOWN', body.status || res.status)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as Promise<T>
}

export const agentApi = {
  listModules: () =>
    agentFetch<ModuleInfo[]>('/modules'),

  listAgents: () =>
    agentFetch<AgentInfo[]>('/agents'),

  createAgent: (req: AgentCreateRequest) =>
    agentFetch<AgentInfo>('/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),

deleteAgent: (id: string) =>
    agentFetch<void>(`/agents/${id}`, { method: 'DELETE' }),

  stopAgent: (id: string) =>
    agentFetch<void>(`/agents/${id}/stop`, { method: 'POST' }),

   updateAgent: (id: string, provider?: string, model?: string, systemPrompt?: string) =>
     agentFetch<AgentInfo>(`/agents/${id}`, {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         ...(provider !== undefined ? { provider } : {}),
         ...(model !== undefined ? { model } : {}),
         ...(systemPrompt !== undefined ? { system_prompt: systemPrompt } : {}),
       }),
     }),

   listTasks: (agentID?: string) => {
    const params = agentID ? `?agent_id=${agentID}` : ''
    return agentFetch<AgentTask[]>(`/agents/tasks${params}`)
  },

  getTask: (id: string) =>
    agentFetch<AgentTask>(`/agents/tasks/${id}`),

  submitTask: (agentID: string, req: TaskSubmitRequest, idempotencyKey?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey
    }
    return agentFetch<{ task_id: string }>(`/agents/${agentID}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
    })
  },

  approveTask: (taskID: string) =>
    agentFetch<void>(`/agents/tasks/${taskID}/approve`, { method: 'POST' }),

rejectTask: (taskID: string) =>
     agentFetch<void>(`/agents/tasks/${taskID}/reject`, { method: 'POST' }),

  listComments: (topicID: string) =>
    agentFetch<Comment[]>(`/agents/topics/${topicID}/comments`),

  createComment: (topicID: string, content: string) =>
    agentFetch<Comment>(`/agents/topics/${topicID}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicID, content }),
    }),

  deleteComment: (id: string) =>
    agentFetch<void>(`/agents/comments/${id}`, { method: 'DELETE' }),
}
