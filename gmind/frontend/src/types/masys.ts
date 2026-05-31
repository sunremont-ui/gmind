// V6.0 — TypeScript types for MASys memory engine entities (mirror of Prisma schema + native tables).
// All types use `unknown` for free-form JSON to stay forward-compatible.

export interface MASysHealthStatus {
  base_url: string
  reachable: boolean
  error?: string
}

export interface MASysEpisode {
  id: string
  agentId?: string
  pipelineId?: string
  namespace: string
  action: string
  input?: unknown
  output?: unknown
  status?: 'success' | 'error' | string
  tags?: string[]
  timestamp: string
}

export interface MASysMemoryEntity {
  id: string
  name: string
  type: 'person' | 'place' | 'org' | 'concept' | string
  namespace: string
  description?: string
  attributes?: Record<string, unknown>
  mentions?: number
  firstSeen?: string
  lastSeen?: string
}

export interface MASysSkill {
  id: string
  name: string
  trigger?: string
  body?: unknown
  preconditions?: unknown[]
  successRate?: number
  usageCount?: number
  successCount?: number
  active?: boolean
  derivedFrom?: string[]
  namespace?: string
  createdAt?: string
}

export interface MASysConversation {
  sessionId: string
  algorithm?: string
  namespace: string
  summary?: string
  summaryTokens?: number
  messageCount?: number
  updatedAt?: string
}

export interface MASysWikiPage {
  slug: string
  namespace: string
  title: string
  content?: string
  parentId?: string
  tags?: string[]
  version?: number
  updatedAt?: string
}

export interface MASysResult {
  id: string
  name: string
  type: 'text' | 'json' | 'file' | 'binary' | 'structured' | string
  namespace: string
  pipelineId?: string
  tags?: string[]
  expiresAt?: string
  createdAt?: string
}

export interface MASysDecision {
  id: string
  namespace: string
  op: 'recall' | 'remember' | 'consolidate' | string
  detail?: unknown
  ts: string
}

export interface MASysPendingWrite {
  id: string
  namespace: string
  value: unknown
  type: 'fact' | 'episode' | 'entity' | 'preference' | 'skill' | 'result' | string
  createdAt: string
}

export interface MASysRun {
  id: string
  pipelineId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | string
  startedAt?: string
  completedAt?: string
  durationMs?: number
}

export interface MASysRunEvent {
  id?: string
  runId: string
  type: string // node.started, node.completed, node.failed, agent.task.*, pipeline.cancelled
  nodeId?: string
  payload?: unknown
  timestamp: string
}

export interface MASysRecallResult {
  source: string  // conversation | episode | wiki | result | entity | vector
  score: number
  text?: string
  meta?: Record<string, unknown>
}
