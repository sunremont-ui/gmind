// V5.0 Graph Relationships API client.
import type {
  Relationship,
  CreateRelationshipRequest,
  UpdateRelationshipRequest,
} from '../types/api'

const BASE = ''

async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`${method} ${path} ${resp.status}: ${text || resp.statusText}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json() as Promise<T>
}

export const relationshipsApi = {
  async list(workbookID: string, opts?: { topicId?: string; type?: string }): Promise<Relationship[]> {
    const qs = new URLSearchParams()
    if (opts?.topicId) qs.set('topic_id', opts.topicId)
    if (opts?.type) qs.set('type', opts.type)
    const q = qs.toString() ? `?${qs.toString()}` : ''
    return http<Relationship[]>('GET', `/api/v1/workbooks/${workbookID}/relationships${q}`)
  },

  async create(workbookID: string, req: CreateRelationshipRequest, strict = false): Promise<Relationship> {
    const q = strict ? '?strict=true' : ''
    return http<Relationship>('POST', `/api/v1/workbooks/${workbookID}/relationships${q}`, req)
  },

  async update(relID: string, req: UpdateRelationshipRequest): Promise<Relationship> {
    return http<Relationship>('PUT', `/api/v1/relationships/${relID}`, req)
  },

  async remove(relID: string): Promise<void> {
    return http<void>('DELETE', `/api/v1/relationships/${relID}`)
  },

  async related(workbookID: string, topicID: string, opts?: { depth?: number; types?: string[] }): Promise<{
    topic_id: string
    depth: number
    types?: string[]
    topics: string[]
    relationships: Relationship[]
  }> {
    const qs = new URLSearchParams()
    if (opts?.depth) qs.set('depth', String(opts.depth))
    if (opts?.types?.length) qs.set('types', opts.types.join(','))
    const q = qs.toString() ? `?${qs.toString()}` : ''
    return http('GET', `/api/v1/workbooks/${workbookID}/topics/${topicID}/related${q}`)
  },

  async cycles(workbookID: string, opts?: { type?: string }): Promise<{
    workbook_id: string
    type?: string
    cycles: string[][]
  }> {
    const q = opts?.type ? `?type=${encodeURIComponent(opts.type)}` : ''
    return http('GET', `/api/v1/workbooks/${workbookID}/cycles${q}`)
  },
}

// Visual mappings for relationship types
export const RELATIONSHIP_TYPE_COLORS: Record<string, string> = {
  relates_to: '#94a3b8',
  depends_on: '#ef4444',
  supports: '#22c55e',
  contradicts: '#f59e0b',
  references: '#3b82f6',
  blocks: '#ec4899',
  custom: '#a855f7',
}

export const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  relates_to: 'Связан с',
  depends_on: 'Зависит от',
  supports: 'Поддерживает',
  contradicts: 'Противоречит',
  references: 'Ссылается',
  blocks: 'Блокирует',
  custom: 'Своё',
}

export const RELATIONSHIP_TYPE_STYLES: Record<string, { style: 'solid' | 'dashed' | 'dotted'; weight: number }> = {
  relates_to: { style: 'solid', weight: 1 },
  depends_on: { style: 'solid', weight: 2 },
  supports: { style: 'solid', weight: 1.5 },
  contradicts: { style: 'dashed', weight: 1.5 },
  references: { style: 'dotted', weight: 1 },
  blocks: { style: 'solid', weight: 2 },
  custom: { style: 'solid', weight: 1 },
}
