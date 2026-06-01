// V6.1 phase C — Cross-namespace comparison.
// Pure helpers to turn per-namespace layer counts into a comparison matrix:
// one row per memory layer with the per-namespace values, the row max (for
// highlighting the leading namespace) and a row total.

export const COMPARE_LAYERS = [
  { key: 'episodes', label: '⏱ Episodes' },
  { key: 'entities', label: '👤 Entities' },
  { key: 'skills', label: '⚡ Skills' },
  { key: 'conversations', label: '💬 Conversations' },
  { key: 'wiki', label: '📖 Wiki' },
  { key: 'results', label: '📦 Results' },
] as const

export type CompareLayerKey = typeof COMPARE_LAYERS[number]['key']

export type NsCounts = Partial<Record<CompareLayerKey, number>>

export interface CompareRow {
  key: CompareLayerKey
  label: string
  counts: Record<string, number>  // namespace → count
  max: number
  total: number
  leaders: string[]               // namespaces holding the row max (only when max > 0)
}

export interface Comparison {
  rows: CompareRow[]
  totals: Record<string, number>  // namespace → sum across layers
  grandTotal: number
}

export function buildComparison(
  namespaces: string[],
  data: Record<string, NsCounts>,
): Comparison {
  const totals: Record<string, number> = {}
  for (const ns of namespaces) totals[ns] = 0

  const rows: CompareRow[] = COMPARE_LAYERS.map(({ key, label }) => {
    const counts: Record<string, number> = {}
    let max = 0
    let total = 0
    for (const ns of namespaces) {
      const v = data[ns]?.[key] ?? 0
      counts[ns] = v
      total += v
      totals[ns] += v
      if (v > max) max = v
    }
    const leaders = max > 0 ? namespaces.filter(ns => counts[ns] === max) : []
    return { key, label, counts, max, total, leaders }
  })

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
  return { rows, totals, grandTotal }
}
