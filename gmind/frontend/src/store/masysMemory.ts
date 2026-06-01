// V6.0 — Zustand store for MASys memory views.
import { create } from 'zustand'
import { masysApi } from '../api/masys'
import type {
  MASysEpisode,
  MASysMemoryEntity,
  MASysSkill,
  MASysConversation,
  MASysWikiPage,
  MASysResult,
  MASysDecision,
  MASysPendingWrite,
  MASysHealthStatus,
} from '../types/masys'

interface MASysMemoryState {
  // Reachability
  health: MASysHealthStatus | null
  health_error: string | null

  // Namespace selection (drives all queries)
  namespaces: string[]
  activeNamespace: string

  // Per-layer data (lazy-loaded)
  episodes: MASysEpisode[]
  entities: MASysMemoryEntity[]
  skills: MASysSkill[]
  conversations: MASysConversation[]
  wiki: MASysWikiPage[]
  results: MASysResult[]
  decisions: MASysDecision[]
  pending: MASysPendingWrite[]

  // Loading flags
  loading: Partial<Record<keyof MASysMemoryState, boolean>>
  lastFetched: Partial<Record<string, number>>  // layer name → ms

  // Actions
  checkHealth: () => Promise<void>
  setActiveNamespace: (ns: string) => void
  fetchNamespaces: () => Promise<void>
  fetchEpisodes: () => Promise<void>
  fetchEntities: () => Promise<void>
  fetchSkills: () => Promise<void>
  fetchConversations: () => Promise<void>
  fetchWiki: () => Promise<void>
  fetchResults: () => Promise<void>
  fetchDecisions: () => Promise<void>
  fetchPending: () => Promise<void>
  refreshAll: () => Promise<void>

  // V6.1 — write-back mutations (each refreshes the affected layer on success)
  deleteEntity: (name: string, type: string) => Promise<void>
  deleteEpisode: (id: string) => Promise<void>
  deleteResult: (id: string) => Promise<void>
  deleteWiki: (slug: string) => Promise<void>
  writeWiki: (page: { slug: string; title: string; content: string; parentSlug?: string; tags?: string[] }) => Promise<void>
  deleteExpiredResults: () => Promise<number>
  forgetSkills: (opts: { minSuccessRate?: number; minUses?: number; unusedDays?: number }) => Promise<number>
  acquireSkills: (opts: { minOccurrences?: number; lookback?: number }) => Promise<void>
}

export const useMASysMemoryStore = create<MASysMemoryState>((set, get) => ({
  health: null,
  health_error: null,
  namespaces: [],
  activeNamespace: 'default',
  episodes: [],
  entities: [],
  skills: [],
  conversations: [],
  wiki: [],
  results: [],
  decisions: [],
  pending: [],
  loading: {},
  lastFetched: {},

  async checkHealth() {
    try {
      const h = await masysApi.health()
      set({ health: h, health_error: null })
    } catch (err: any) {
      set({ health: null, health_error: err?.message ?? String(err) })
    }
  },

  setActiveNamespace(ns) {
    set({ activeNamespace: ns })
  },

  async fetchNamespaces() {
    try {
      const ns = await masysApi.listNamespaces()
      set({ namespaces: Array.isArray(ns) ? ns : [] })
    } catch (err) {
      console.error('MASys namespaces:', err)
    }
  },

  fetchEpisodes: async () => fetchLayer(set, get, 'episodes', () => masysApi.listEpisodes(get().activeNamespace)),
  fetchEntities: async () => fetchLayer(set, get, 'entities', () => masysApi.listEntities(get().activeNamespace)),
  fetchSkills: async () => fetchLayer(set, get, 'skills', () => masysApi.listSkills(get().activeNamespace)),
  fetchConversations: async () => fetchLayer(set, get, 'conversations', () => masysApi.listConversations(get().activeNamespace)),
  fetchWiki: async () => fetchLayer(set, get, 'wiki', () => masysApi.listWiki(get().activeNamespace)),
  fetchResults: async () => fetchLayer(set, get, 'results', () => masysApi.listResults(get().activeNamespace)),
  fetchDecisions: async () => fetchLayer(set, get, 'decisions', () => masysApi.listDecisions(get().activeNamespace)),
  fetchPending: async () => fetchLayer(set, get, 'pending', () => masysApi.listPending(get().activeNamespace)),

  async refreshAll() {
    const s = get()
    await Promise.allSettled([
      s.fetchEpisodes(), s.fetchEntities(), s.fetchSkills(),
      s.fetchConversations(), s.fetchWiki(), s.fetchResults(),
      s.fetchDecisions(), s.fetchPending(),
    ])
  },

  // ── V6.1 mutations ─────────────────────────────────────────────────────────
  async deleteEntity(name, type) {
    await masysApi.deleteEntity(name, type, get().activeNamespace)
    await get().fetchEntities()
  },
  async deleteEpisode(id) {
    await masysApi.deleteEpisode(id)
    await get().fetchEpisodes()
  },
  async deleteResult(id) {
    await masysApi.deleteResult(id)
    await get().fetchResults()
  },
  async deleteWiki(slug) {
    await masysApi.deleteWiki(slug, get().activeNamespace)
    await get().fetchWiki()
  },
  async writeWiki(page) {
    await masysApi.writeWiki({ ...page, namespace: get().activeNamespace })
    await get().fetchWiki()
  },
  async deleteExpiredResults() {
    const { deleted } = await masysApi.deleteExpiredResults()
    await get().fetchResults()
    return deleted
  },
  async forgetSkills(opts) {
    const { deprecated } = await masysApi.forgetSkills({ ...opts, namespace: get().activeNamespace })
    await get().fetchSkills()
    return deprecated
  },
  async acquireSkills(opts) {
    await masysApi.acquireSkills({ ...opts, namespace: get().activeNamespace })
    await Promise.allSettled([get().fetchSkills(), get().fetchEpisodes()])
  },
}))

async function fetchLayer<K extends keyof MASysMemoryState>(
  set: (partial: Partial<MASysMemoryState>) => void,
  get: () => MASysMemoryState,
  key: K,
  fetcher: () => Promise<unknown>,
) {
  const loading = { ...get().loading, [key]: true }
  set({ loading })
  try {
    const data = await fetcher()
    set({ [key]: (Array.isArray(data) ? data : []) as any, lastFetched: { ...get().lastFetched, [String(key)]: Date.now() } })
  } catch (err) {
    console.error(`MASys ${String(key)}:`, err)
    set({ [key]: [] as any })
  } finally {
    set({ loading: { ...get().loading, [key]: false } })
  }
}
