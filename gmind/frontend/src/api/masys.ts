// V6.0 — MASys API client (proxies via Gmind backend at /api/v1/masys/*).
import type {
  MASysHealthStatus,
  MASysEpisode,
  MASysMemoryEntity,
  MASysSkill,
  MASysConversation,
  MASysWikiPage,
  MASysResult,
  MASysDecision,
  MASysPendingWrite,
  MASysRun,
  MASysRunEvent,
  MASysRecallResult,
  MASysKGGraph,
  KGSyncRequest,
  KGSyncResponse,
  MASysPushResult,
  MASysRunStarted,
} from '../types/masys'
import { API_ORIGIN } from './base'

const BASE = `${API_ORIGIN}/api/v1/masys`

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(BASE + path)
  if (!resp.ok) {
    throw new Error(`GET ${path} → ${resp.status}: ${await resp.text().catch(() => resp.statusText)}`)
  }
  return resp.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    throw new Error(`POST ${path} → ${resp.status}: ${await resp.text().catch(() => resp.statusText)}`)
  }
  return resp.json() as Promise<T>
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    throw new Error(`PUT ${path} → ${resp.status}: ${await resp.text().catch(() => resp.statusText)}`)
  }
  return resp.json() as Promise<T>
}

async function del<T>(path: string): Promise<T> {
  const resp = await fetch(BASE + path, { method: 'DELETE' })
  if (!resp.ok) {
    throw new Error(`DELETE ${path} → ${resp.status}: ${await resp.text().catch(() => resp.statusText)}`)
  }
  return resp.json() as Promise<T>
}

function ns(namespace?: string): string {
  return namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
}

export const masysApi = {
  /** Кэшированный статус связи; refresh форсирует опрос MASys. */
  health(refresh = false): Promise<MASysHealthStatus> {
    return get(refresh ? '/health?refresh=1' : '/health')
  },
  /** Ручная смена адреса MASys — сохраняется и сразу проверяется. */
  setBaseUrl(baseUrl: string): Promise<MASysHealthStatus> {
    return put('/config', { base_url: baseUrl })
  },
  listNamespaces(): Promise<string[]> {
    return get('/memory/namespaces')
  },
  listEpisodes(namespace?: string, limit?: number): Promise<MASysEpisode[]> {
    const qs = new URLSearchParams()
    if (namespace) qs.set('namespace', namespace)
    if (limit) qs.set('limit', String(limit))
    const s = qs.toString() ? `?${qs.toString()}` : ''
    return get(`/memory/episodes${s}`)
  },
  listEntities(namespace?: string): Promise<MASysMemoryEntity[]> {
    return get(`/memory/entities${ns(namespace)}`)
  },
  listSkills(namespace?: string): Promise<MASysSkill[]> {
    return get(`/memory/skills${ns(namespace)}`)
  },
  listConversations(namespace?: string): Promise<MASysConversation[]> {
    return get(`/memory/conversations${ns(namespace)}`)
  },
  listWiki(namespace?: string): Promise<MASysWikiPage[]> {
    return get(`/memory/wiki${ns(namespace)}`)
  },
  listResults(namespace?: string): Promise<MASysResult[]> {
    return get(`/memory/results${ns(namespace)}`)
  },
  listDecisions(namespace?: string): Promise<MASysDecision[]> {
    return get(`/memory/decisions${ns(namespace)}`)
  },
  listPending(namespace?: string): Promise<MASysPendingWrite[]> {
    return get(`/memory/pending${ns(namespace)}`)
  },
  recall(namespace: string, query: string, limit = 5): Promise<MASysRecallResult[]> {
    return post('/memory/recall', { namespace, query, limit })
  },

  // ─── Запись в память: работа с холста уходит в MASys ───

  /** Записать эпизод — «что произошло» в эпизодической памяти. */
  logEpisode(input: {
    action: string
    namespace?: string
    agentId?: string
    runId?: string
    input?: unknown
    output?: unknown
    status?: 'success' | 'error' | 'pending'
    tags?: string[]
    duration?: number
  }): Promise<unknown> {
    return post('/memory/episodes', input)
  },

  /** Запомнить содержимое — контроллер сам выберет слой памяти. */
  remember(input: {
    content: string
    namespace?: string
    type?: string
    title?: string
    tags?: string[]
    source?: string
    outcome?: 'success' | 'error' | 'pending'
    force?: boolean
  }): Promise<unknown> {
    return post('/memory/remember', input)
  },

  /** Создать или обновить сущность графа знаний. */
  upsertEntity(input: {
    name: string
    type: string
    namespace?: string
    description?: string
    attributes?: Record<string, unknown>
    incrementMentions?: boolean
  }): Promise<unknown> {
    return post('/memory/entities/upsert', input)
  },

  /** Добавить связь в граф знаний. */
  addRelation(input: {
    sourceName: string
    sourceType: string
    predicate: string
    targetName: string
    targetType: string
    namespace?: string
  }): Promise<unknown> {
    return post('/memory/relations', input)
  },

  /** Отправить узлы холста в граф MASys (обратная сторона KG-sync). */
  push(input: {
    workbook_id: string
    sheet_id?: string
    namespace?: string
    topic_ids?: string[]
    include_relations?: boolean
  }): Promise<MASysPushResult> {
    return post('/push', input)
  },

  // ─── Задачи: запуск работы в MASys ───

  /** Поставить задачу: запустить пайплайн, при желании привязав к узлу карты. */
  startRun(input: {
    pipeline_id: string
    inputs?: Record<string, unknown>
    wait?: boolean
    timeout_ms?: number
    workbook_id?: string
    topic_id?: string
  }): Promise<MASysRunStarted> {
    return post('/runs/start', input)
  },

  stopRun(runId: string): Promise<unknown> {
    return post(`/runs/${encodeURIComponent(runId)}/stop`, {})
  },

  // V6.0 Phase 3 — Knowledge Graph
  getGraph(namespace?: string, limit?: number): Promise<MASysKGGraph> {
    const qs = new URLSearchParams()
    if (namespace) qs.set('namespace', namespace)
    if (limit) qs.set('limit', String(limit))
    const s = qs.toString() ? `?${qs.toString()}` : ''
    return get(`/memory/graph${s}`)
  },

  kgSync(req: KGSyncRequest): Promise<KGSyncResponse> {
    return post('/kg-sync', req)
  },
  listRuns(limit?: number): Promise<MASysRun[]> {
    const s = limit ? `?limit=${limit}` : ''
    return get(`/runs${s}`)
  },
  getRun(runID: string): Promise<MASysRun> {
    return get(`/runs/${runID}`)
  },
  getRunEvents(runID: string): Promise<MASysRunEvent[]> {
    return get(`/runs/${runID}/events`)
  },
  /**
   * Opens an EventSource for live run events. Returns the source so caller can close().
   * Listen via `source.addEventListener(eventType, ...)` or `source.onmessage`.
   */
  streamRun(runID: string): EventSource {
    return new EventSource(`${BASE}/runs/${runID}/stream`)
  },

  // ── V6.1 write-back mutations ──────────────────────────────────────────────
  deleteEpisode(id: string): Promise<{ ok: boolean }> {
    return del(`/memory/episodes/${encodeURIComponent(id)}`)
  },
  deleteResult(id: string): Promise<{ ok: boolean }> {
    return del(`/memory/results/${encodeURIComponent(id)}`)
  },
  deleteExpiredResults(): Promise<{ deleted: number }> {
    return post('/memory/results/delete-expired', {})
  },
  writeWiki(page: { slug: string; title: string; content: string; namespace?: string; parentSlug?: string; tags?: string[] }): Promise<MASysWikiPage> {
    return post('/memory/wiki', page)
  },
  deleteWiki(slug: string, namespace?: string): Promise<{ deleted: boolean }> {
    return del(`/memory/wiki/${encodeURIComponent(slug)}${ns(namespace)}`)
  },
  deleteEntity(name: string, type: string, namespace?: string): Promise<{ deleted: boolean }> {
    return post('/memory/entities/delete', { name, type, namespace })
  },
  mergeEntities(sourceId: string, targetId: string): Promise<unknown> {
    return post('/memory/entities/merge', { sourceId, targetId })
  },
  forgetSkills(opts: { namespace?: string; minSuccessRate?: number; minUses?: number; unusedDays?: number }): Promise<{ deprecated: number }> {
    return post('/memory/skills/forget', opts)
  },
  acquireSkills(opts: { namespace?: string; minOccurrences?: number; lookback?: number }): Promise<{ acquired: unknown }> {
    return post('/memory/skills/acquire', opts)
  },
}
