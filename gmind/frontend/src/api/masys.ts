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
} from '../types/masys'

const BASE = '/api/v1/masys'

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

function ns(namespace?: string): string {
  return namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
}

export const masysApi = {
  health(): Promise<MASysHealthStatus> {
    return get('/health')
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
}
