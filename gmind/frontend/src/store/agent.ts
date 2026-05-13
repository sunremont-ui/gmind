import { create } from 'zustand'
import type { AgentInfo, AgentTask, AgentCreateRequest, TaskSubmitRequest } from '../types/agent'
import { agentApi } from '../api/agent'
import { wsClient } from '../api/ws'

interface AgentState {
  agents: AgentInfo[]
  tasks: AgentTask[]
  loading: boolean
  error: string | null

  fetchAgents: () => Promise<void>
  fetchTasks: () => Promise<void>
  createAgent: (req: AgentCreateRequest) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  updateAgent: (id: string, provider?: string, model?: string) => Promise<AgentInfo>
  submitTask: (agentId: string, req: TaskSubmitRequest) => Promise<string | undefined>
  approveTask: (taskId: string) => Promise<void>
  rejectTask: (taskId: string) => Promise<void>
  subscribeToEvents: () => () => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  tasks: [],
  loading: false,
  error: null,

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
      set({ tasks })
    } catch {
      // silent
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

   updateAgent: async (id: string, provider?: string, model?: string) => {
     try {
       const updated = await agentApi.updateAgent(id, provider, model)
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

  subscribeToEvents: () => {
    const refresh = () => { get().fetchTasks(); get().fetchAgents() }
    const unsub1 = wsClient.on('agent:task_started', refresh)
    const unsub2 = wsClient.on('agent:task_completed', refresh)
    const unsub3 = wsClient.on('agent:task_failed', refresh)
    return () => { unsub1(); unsub2(); unsub3() }
  },
}))
