export interface AgentInfo {
  id: string
  role: string
  status: 'idle' | 'working' | 'error'
  provider: string
  model: string
}

export interface AgentCreateRequest {
  role: string
  provider?: string
  model?: string
}

export interface ModuleInfo {
  id: string
  name: string
  version: string
  dependencies: string[]
  health: string
}

export interface AgentTask {
  id: string
  agent_id: string
  action: string
  params: Record<string, unknown>
  workbook_id: string
  sheet_id?: string
  topic_id?: string
  created_at: string
  updated_at: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'pending_approval'
  result?: Record<string, unknown>
  error?: string
  max_calls: number
}

export interface TaskSubmitRequest {
  action: string
  params?: Record<string, unknown>
  workbook_id?: string
  sheet_id?: string
  topic_id?: string
  chain_to_agent_id?: string
  chain_from_task_id?: string
}

export const AGENT_ROLES = [
  { id: 'researcher', label: 'Researcher', desc: 'Searches the web, adds facts as children', color: '#3b82f6' },
  { id: 'organizer', label: 'Organizer', desc: 'Restructures branches, renames topics', color: '#22c55e' },
  { id: 'critic', label: 'Critic', desc: 'Reviews content, leaves notes and feedback', color: '#ef4444' },
  { id: 'expander', label: 'Expander', desc: 'Generates 5-10 subtopics to expand ideas', color: '#a855f7' },
  { id: 'summarizer', label: 'Summarizer', desc: 'Summarizes branches into bullet points', color: '#f59e0b' },
  { id: 'editor', label: 'Editor', desc: 'Checks spelling, style, readability', color: '#06b6d4' },
  { id: 'analyst', label: 'Analyst', desc: 'Finds connections, suggests cross-links', color: '#ec4899' },
]