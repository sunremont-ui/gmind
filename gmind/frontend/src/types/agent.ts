export interface AgentInfo {
  id: string
  name?: string
  role: string
  status: 'idle' | 'working' | 'error'
  provider: string
  model: string
  system_prompt?: string
}

export interface AgentCreateRequest {
  role: string
  provider?: string
  model?: string
  name?: string
  system_prompt?: string
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
  chain_to_agent_id?: string
  chain_from_task_id?: string
}

export interface Comment {
  id: string
  topic_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface CreateCommentRequest {
  topic_id: string
  content: string
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

export interface AgentLogEntry {
  task_id: string
  level: string
  step: number
  content?: string
  tool_name?: string
  tool_args?: unknown
  result?: unknown
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

export const ROLE_ACTIONS: Record<string, string[]> = {
  researcher: ['search_web', 'wiki_search', 'get_workbook', 'custom'],
  organizer:  ['create_multiple_topics', 'update_topic', 'summarize_topics', 'custom'],
  critic:     ['add_note', 'summarize_topics', 'get_workbook', 'custom'],
  expander:   ['create_multiple_topics', 'create_topic', 'get_workbook', 'custom'],
  summarizer: ['summarize_topics', 'add_note', 'get_workbook', 'custom'],
  editor:     ['update_topic', 'add_note', 'search_web', 'custom'],
  analyst:    ['get_workbook', 'search_web', 'wiki_search', 'custom'],
}

export const ACTION_SCHEMAS: Record<string, string> = {
  create_topic:           '{"parent_id": "abc123", "title": "New Topic"}',
  create_multiple_topics: '{"parent_id": "abc123", "titles": ["Idea A", "Idea B", "Idea C"]}',
  update_topic:           '{"topic_id": "abc123", "title": "Updated title", "notes": "Additional notes"}',
  add_note:               '{"topic_id": "abc123", "note": "Note text here"}',
  summarize_topics:       '{"topic_id": "abc123"}',
  search_web:             '{"query": "search terms here"}',
  wiki_search:            '{"query": "search terms here"}',
  get_workbook:           '{}',
}