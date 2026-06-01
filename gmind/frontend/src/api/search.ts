// GI-7: Full-text search over mindmap topics (SQLite FTS5 backend).
// Keyword search — no embeddings API key required, always available.

export interface FTSResult {
  topic_id: string
  workbook_id: string
  workbook_title: string
  sheet_id: string
  title: string
  notes?: string
  context: string // snippet with <mark> highlights
  rank: number // bm25 score (lower = better)
}

interface FTSResponse {
  results: FTSResult[]
  count: number
  query: string
}

export const searchApi = {
  // Full-text search. Pass workbookId to scope to one workbook.
  async fullText(
    query: string,
    opts?: { limit?: number; workbookId?: string },
  ): Promise<FTSResult[]> {
    const qs = new URLSearchParams({ q: query })
    if (opts?.limit) qs.set('limit', String(opts.limit))
    if (opts?.workbookId) qs.set('workbook_id', opts.workbookId)
    const resp = await fetch(`/api/v1/search/text?${qs.toString()}`)
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`search/text ${resp.status}: ${text || resp.statusText}`)
    }
    const data = (await resp.json()) as FTSResponse
    return data.results ?? []
  },
}
