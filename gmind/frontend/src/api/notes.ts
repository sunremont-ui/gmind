const BASE = '/api/v1/notes'

export interface Note {
  id: string
  content: string
  tags: string[]
  source: 'manual' | 'quick_capture' | 'agent'
  workbook_id?: string
  topic_id?: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface CreateNoteRequest {
  content: string
  tags?: string[]
  source?: string
  workbook_id?: string
  topic_id?: string
  pinned?: boolean
}

export interface UpdateNoteRequest {
  content?: string
  tags?: string[]
  pinned?: boolean
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const notesApi = {
  list: (query?: string): Promise<Note[]> => {
    const url = query ? `${BASE}?q=${encodeURIComponent(query)}` : BASE
    return req('GET', url)
  },
  create: (r: CreateNoteRequest): Promise<Note> => req('POST', BASE, r),
  update: (id: string, r: UpdateNoteRequest): Promise<Note> => req('PUT', `${BASE}/${id}`, r),
  delete: (id: string): Promise<void> => req('DELETE', `${BASE}/${id}`),
}
