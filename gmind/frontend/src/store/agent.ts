import { create } from 'zustand'
import type { AgentInfo, AgentTask, AgentCreateRequest, TaskSubmitRequest, Comment, CreateCommentRequest, AgentLogEntry } from '../types/agent'
import type { AIModelProvider } from '../types/api'
import { agentApi } from '../api/agent'
import { api } from '../api/client'
import { wsClient } from '../api/ws'

interface MaSysPipeline {
  id: string
  name: string
  description?: string
}

interface AgentState {
  agents: AgentInfo[]
  tasks: AgentTask[]
  comments: Comment[]
  loading: boolean
  error: string | null
  agentLogs: Record<string, AgentLogEntry> // agent_id → latest log
  modelPresets: AIModelProvider[]
  masysPipelines: MaSysPipeline[]

  fetchAgents: () => Promise<void>
  fetchTasks: () => Promise<void>
  fetchComments: (topicId: string) => Promise<void>
  fetchModelPresets: () => Promise<void>
  fetchMasysPipelines: () => Promise<void>
  createAgent: (req: AgentCreateRequest) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  stopAgent: (id: string) => Promise<void>
  updateAgent: (id: string, provider?: string, model?: string, systemPrompt?: string) => Promise<AgentInfo>
  submitTask: (agentId: string, req: TaskSubmitRequest) => Promise<string | undefined>
  approveTask: (taskId: string) => Promise<void>
  rejectTask: (taskId: string) => Promise<void>
  addComment: (topicId: string, content: string) => Promise<void>
  removeComment: (id: string) => Promise<void>
  subscribeToEvents: () => () => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  tasks: [],
  comments: [],
  loading: false,
  error: null,
  agentLogs: {},
  modelPresets: [],
  masysPipelines: [],

  fetchAgents: async () => {
    try {
      set({ loading: true })
      const agents = await agentApi.listAgents()
      set({ agents, loading: false, error: null })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch agents' })
    }
  },

  fetchTasks: async () => {
    try {
      const tasks = await agentApi.listTasks()
      set({ tasks: tasks ?? [] })
    } catch {
      // silent
    }
  },

  fetchMasysPipelines: async () => {
    try {
      const res = await api.listMasysPipelines()
      const pipelines = Array.isArray(res.pipelines) ? res.pipelines : []
      set({ masysPipelines: pipelines })
    } catch {
      // MASys not running — silent
    }
  },

  fetchComments: async (topicId: string) => {
    try {
      const comments = await agentApi.listComments(topicId)
      set({ comments: comments ?? [] })
    } catch {
      // silent
    }
  },

  fetchModelPresets: async () => {
    try {
      const { providers } = await api.getAIModels()
      set({ modelPresets: providers })
    } catch {
      // silent — keep empty, UI will show a fallback
    }
  },

  createAgent: async (req: AgentCreateRequest) => {
    try {
      await agentApi.createAgent(req)
      await get().fetchAgents()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create agent' })
      throw err
    }
  },

deleteAgent: async (id: string) => {
    try {
      await agentApi.deleteAgent(id)
      await get().fetchAgents()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete agent' })
      throw err
    }
  },

  stopAgent: async (id: string) => {
    try {
      await agentApi.stopAgent(id)
      set((state) => ({
        agents: state.agents.map(a => a.id === id ? { ...a, status: 'idle' as const } : a),
      }))
      await get().fetchTasks()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to stop agent' })
      throw err
    }
  },

   updateAgent: async (id: string, provider?: string, model?: string, systemPrompt?: string) => {
     try {
       const updated = await agentApi.updateAgent(id, provider, model, systemPrompt)
       set((state) => ({
         agents: state.agents.map(a => a.id === id ? { ...a, ...updated } : a),
       }))
       return updated
     } catch (err) {
       set({ error: err instanceof Error ? err.message : 'Failed to update agent' })
       throw err
     }
   },

   submitTask: async (agentId: string, req: TaskSubmitRequest) => {
    try {
      const { task_id } = await agentApi.submitTask(agentId, req)
      await get().fetchTasks()
      return task_id
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to submit task' })
      throw err
    }
  },

  approveTask: async (taskId: string) => {
    try {
      await agentApi.approveTask(taskId)
      await get().fetchTasks()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to approve task' })
      throw err
    }
  },

  rejectTask: async (taskId: string) => {
    try {
      await agentApi.rejectTask(taskId)
      await get().fetchTasks()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to reject task' })
      throw err
    }
  },

  addComment: async (topicId: string, content: string) => {
    try {
      await agentApi.createComment(topicId, content)
      await get().fetchComments(topicId)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add comment' })
      throw err
    }
  },

  removeComment: async (id: string) => {
    try {
      await agentApi.deleteComment(id)
      const topicId = get().comments.find(c => c.id === id)?.topic_id
      if (topicId) await get().fetchComments(topicId)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete comment' })
      throw err
    }
  },

  subscribeToEvents: () => {
    const refresh = () => { get().fetchTasks(); get().fetchAgents() }
    const unsub1 = wsClient.on('agent:task_started', refresh)
    const unsub2 = wsClient.on('agent:task_completed', (payload: unknown) => {
      const data = payload as Record<string, unknown>
      const agentId = data?.agent_id as string | undefined
      if (agentId) {
        set((s) => {
          const logs = { ...s.agentLogs }
          delete logs[agentId]
          return { agentLogs: logs }
        })
      }
      refresh()
    })
    const unsub3 = wsClient.on('agent:task_failed', (payload: unknown) => {
      const data = payload as Record<string, unknown>
      const agentId = data?.agent_id as string | undefined
      if (agentId) {
        set((s) => {
          const logs = { ...s.agentLogs }
          delete logs[agentId]
          return { agentLogs: logs }
        })
      }
      refresh()
    })
    const unsub4 = wsClient.on('agent:task_log', (payload: unknown) => {
      const data = payload as Record<string, unknown>
      const taskId = data?.task_id as string | undefined
      if (!taskId) return
      const tasks = get().tasks
      const task = tasks.find(t => t.id === taskId)
      if (!task) return
      const entry: AgentLogEntry = {
        task_id: taskId,
        level: (data?.level as string) || 'info',
        step: (data?.step as number) || 0,
        content: data?.content as string | undefined,
        tool_name: data?.tool_name as string | undefined,
        tool_args: data?.tool_args,
        result: data?.result,
      }
      set((s) => ({
        agentLogs: { ...s.agentLogs, [task.agent_id]: entry },
      }))
    })
    return () => { unsub1(); unsub2(); unsub3(); unsub4() }
  },
}))
