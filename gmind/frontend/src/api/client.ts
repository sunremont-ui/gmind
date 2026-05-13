import type {
  Workbook, Sheet, Topic, Relationship, Position, ErrorResponse,
  CreateWorkbookRequest, CreateSheetRequest, CreateTopicRequest, UpdateTopicRequest,
  MoveTopicRequest, CreateRelationshipRequest, CopyTopicToWorkbookRequest,
  SwitchAIProviderRequest, AIGenerateRequest,
  AddCollaboratorRequest, ListCollaboratorsResponse,
} from '../types/api'
import { ApiError } from './errors'
import { offlineQueue } from '../utils/offline'

const API_BASE = '/api/v1'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body: ErrorResponse = await res.json().catch(() => ({ error: res.statusText, code: 'UNKNOWN' as const, status: res.status }))
    throw new ApiError(body.error || `HTTP ${res.status}`, body.code || 'UNKNOWN', body.status || res.status)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text)
}

async function mutatingRequest<T>(url: string, options: RequestInit & { method: string }): Promise<T> {
  if (!navigator.onLine) {
    await offlineQueue.add({
      type: options.method === 'DELETE' ? 'delete' : options.method === 'PUT' ? 'update' : 'create',
      endpoint: url,
      body: options.body ? JSON.parse(options.body as string) : undefined,
    })
    throw new ApiError('You are offline. Changes will sync when connected.', 'OFFLINE', 0)
  }
  return request<T>(url, options)
}

export const api = {
  // Workbooks
  listWorkbooks: () =>
    request<Workbook[]>('/workbooks'),

  createWorkbook: (title: string) =>
    mutatingRequest<Workbook>('/workbooks', {
      method: 'POST',
      body: JSON.stringify({ title } satisfies CreateWorkbookRequest),
    }),

  getWorkbook: (id: string) =>
    request<Workbook>(`/workbooks/${id}`),

  updateWorkbook: (id: string, data: Partial<Workbook>) =>
    mutatingRequest<Workbook>(`/workbooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteWorkbook: (id: string) =>
    mutatingRequest<void>(`/workbooks/${id}`, { method: 'DELETE' }),

  // Sheets
  createSheet: (workbookId: string, title: string) =>
    mutatingRequest<Sheet>(`/workbooks/${workbookId}/sheets`, {
      method: 'POST',
      body: JSON.stringify({ title } satisfies CreateSheetRequest),
    }),

  updateSheet: (workbookId: string, sheetId: string, data: Partial<Sheet>) =>
    mutatingRequest<Sheet>(`/workbooks/${workbookId}/sheets/${sheetId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSheet: (workbookId: string, sheetId: string) =>
    mutatingRequest<void>(`/workbooks/${workbookId}/sheets/${sheetId}`, { method: 'DELETE' }),

  // Topics
  createTopic: (workbookId: string, parentId: string, title: string, position?: Position) =>
    mutatingRequest<Topic>(`/workbooks/${workbookId}/topics`, {
      method: 'POST',
      body: JSON.stringify({ title, parent_id: parentId, position } satisfies CreateTopicRequest),
    }),

  updateTopic: (workbookId: string, topicId: string, data: Partial<UpdateTopicRequest>) =>
    mutatingRequest<void>(`/workbooks/${workbookId}/topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTopic: (workbookId: string, topicId: string) =>
    mutatingRequest<void>(`/workbooks/${workbookId}/topics/${topicId}`, { method: 'DELETE' }),

  moveTopic: (workbookId: string, topicId: string, newParentId: string, index?: number) =>
    mutatingRequest<void>(`/workbooks/${workbookId}/topics/${topicId}/move`, {
      method: 'POST',
      body: JSON.stringify({ new_parent_id: newParentId, index: index ?? 0 } satisfies MoveTopicRequest),
    }),

  copyTopicToWorkbook: (workbookId: string, topicId: string, targetWorkbookId: string, targetParentId?: string) =>
    mutatingRequest<Topic>(`/workbooks/${workbookId}/topics/${topicId}/copy-to-workbook`, {
      method: 'POST',
      body: JSON.stringify({ target_workbook_id: targetWorkbookId, target_parent_id: targetParentId } satisfies CopyTopicToWorkbookRequest),
    }),

  // Relationships
  createRelationship: (workbookId: string, end1Id: string, end2Id: string, title?: string) =>
    mutatingRequest<Relationship>(`/workbooks/${workbookId}/relationships`, {
      method: 'POST',
      body: JSON.stringify({ end1_id: end1Id, end2_id: end2Id, title } satisfies CreateRelationshipRequest),
    }),

  deleteRelationship: (workbookId: string, relId: string) =>
    mutatingRequest<void>(`/workbooks/${workbookId}/relationships/${relId}`, { method: 'DELETE' }),

  // Floating Topics
  createFloatingTopic: (workbookId: string, title: string, position?: Position) =>
    mutatingRequest<Topic>(`/workbooks/${workbookId}/floating-topics`, {
      method: 'POST',
      body: JSON.stringify({ title, position }),
    }),

  updateFloatingTopic: (workbookId: string, topicId: string, data: Partial<Topic>) =>
    mutatingRequest<void>(`/workbooks/${workbookId}/floating-topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteFloatingTopic: (workbookId: string, topicId: string) =>
    mutatingRequest<void>(`/workbooks/${workbookId}/floating-topics/${topicId}`, { method: 'DELETE' }),

  // Local AI Server
  getLlamaStatus: () =>
    request<{ running: boolean; config: any }>('/llama/status'),

  startLlama: () =>
    request<{ status: string; config: any }>('/llama/start', { method: 'POST' }),

  stopLlama: () =>
    request<{ status: string }>('/llama/stop', { method: 'POST' }),

  updateLlamaConfig: (config: any) =>
    request<{ status: string; config: any }>('/llama/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  saveLlamaConfig: () =>
    request<{ status: string }>('/llama/config/save', { method: 'POST' }),

  // Export/Import XMind
  exportXMind: (workbookId: string) =>
    fetch(`${API_BASE}/workbooks/${workbookId}/export`).then(r => r.blob()),

  importXMind: async (file: File): Promise<Workbook> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/workbooks/import`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Import failed: ${res.statusText}${errBody ? ` — ${errBody}` : ''}`)
    }
    const text = await res.text()
    if (!text) throw new Error('Import returned empty response')
    return JSON.parse(text)
  },

  // AI
  aiGenerate: (workbookId: string, prompt: string, sheetId: string, parentId?: string) =>
    request<{ topics: Topic[] }>(`/workbooks/${workbookId}/ai/generate`, {
      method: 'POST',
      body: JSON.stringify({ prompt, workbook_id: workbookId, sheet_id: sheetId, parent_id: parentId } satisfies AIGenerateRequest),
    }),

  aiChat: (workbookId: string, sheetId: string, message: string) =>
    request<{ reply: string; suggestions: unknown[] }>(`/workbooks/${workbookId}/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ sheet_id: sheetId, message }),
    }),

  aiExpandTopic: (workbookId: string, sheetId: string, parentId: string, title: string, children: string[]) =>
    request<{ topics: Topic[] }>(`/workbooks/${workbookId}/ai/expand`, {
      method: 'POST',
      body: JSON.stringify({ sheet_id: sheetId, parent_id: parentId, title, children }),
    }),

  aiGenerateImage: (prompt: string) =>
    request<{ b64_json: string }>('/ai/image', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  aiSummarize: (workbookId: string, sheetId: string) =>
    api.aiChat(workbookId, sheetId, 'Summarize this mind map in 3-5 concise bullet points. Focus on the main topics and their relationships.'),

  // AI Provider switching
  switchAIProvider: (provider: 'openai' | 'local' | 'yandex', endpoint?: string, model?: string, apiKey?: string, folderId?: string) =>
    request<{ status: string; provider: string }>('/ai/provider', {
      method: 'POST',
      body: JSON.stringify({ provider, endpoint, model, api_key: apiKey, folder_id: folderId } satisfies SwitchAIProviderRequest),
    }),

  // Import topic tree recursively (from markdown/freemind)
  importTopicTree: async (workbookId: string, parentId: string, tree: { title: string; children: any[] }): Promise<void> => {
    const topic = await api.createTopic(workbookId, parentId, tree.title)
    for (const child of tree.children || []) {
      await api.importTopicTree(workbookId, topic.id, child)
    }
  },

  // Import JSON
  importJSON: (workbookId: string, sheetId: string, data: string) =>
    request<{ status: string }>(`/workbooks/${workbookId}/import-json`, {
      method: 'POST',
      body: JSON.stringify({ sheet_id: sheetId, data }),
    }),

  clearImportedData: (workbookId: string, sheetId: string) =>
    request<{ status: string }>(`/workbooks/${workbookId}/import-json`, {
      method: 'DELETE',
      body: JSON.stringify({ sheet_id: sheetId }),
    }),

  // Collaborators
  addCollaborator: (workbookId: string, userId: string, role?: string) =>
    mutatingRequest<{ status: string }>(`/workbooks/${workbookId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role } satisfies AddCollaboratorRequest),
    }),

  removeCollaborator: (workbookId: string, userId: string) =>
    mutatingRequest<{ status: string }>(`/workbooks/${workbookId}/collaborators/${userId}`, {
      method: 'DELETE',
    }),

  listCollaborators: (workbookId: string) =>
    request<ListCollaboratorsResponse>(`/workbooks/${workbookId}/collaborators`),
}
