// V6.0 Phase 5 — Context Budget estimation.
// Estimates the token "footprint" each karp memory layer would occupy if its
// full contents were injected into an LLM context window. Real agents recall a
// subset, so comparing footprint vs the window budget reveals which layers are
// too large to fit and must rely on selective retrieval / compression.
import type {
  MASysEpisode, MASysMemoryEntity, MASysSkill, MASysConversation,
  MASysWikiPage, MASysResult, MASysDecision, MASysPendingWrite,
} from '../../types/masys'
import type { KarpLayer } from './layerMapping'

export interface BudgetInputs {
  episodes: MASysEpisode[]
  entities: MASysMemoryEntity[]
  skills: MASysSkill[]
  conversations: MASysConversation[]
  wiki: MASysWikiPage[]
  results: MASysResult[]
  decisions: MASysDecision[]
  pending: MASysPendingWrite[]
}

export interface LayerBudget {
  key: KarpLayer
  label: string
  icon: string
  color: string
  tokens: number
  pct: number // share of total footprint, 0..1
}

export interface BudgetEstimate {
  layers: LayerBudget[]   // ordered, zero-token layers dropped
  totalTokens: number
  capTokens: number
  fitsTokens: number      // min(total, cap)
  overflowTokens: number  // max(0, total - cap)
  withinBudget: boolean
}

// Common context-window presets (tokens).
export const BUDGET_PRESETS = [8000, 32000, 128000, 200000] as const
export const DEFAULT_CAP = 32000

const LAYER_COLORS: Record<KarpLayer, string> = {
  working: '#5B6CFF',    // indigo (accent)
  episodic: '#06b6d4',   // cyan
  semantic: '#22c55e',   // green
  procedural: '#f59e0b', // amber
  artifact: '#a855f7',   // purple
  meta: '#ec4899',       // pink
}

// Rough token estimate: ~4 chars per token for serialized content.
function estTokens(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'string') return Math.ceil(value.length / 4)
  try {
    return Math.ceil(JSON.stringify(value).length / 4)
  } catch {
    return 0
  }
}

// Per-message overhead assumed when only a message count is known.
const TOKENS_PER_MESSAGE = 60

function workingTokens(c: BudgetInputs): number {
  return c.conversations.reduce((sum, cv) => {
    const summary = cv.summaryTokens ?? estTokens(cv.summary)
    // Uncompressed sessions carry their raw turns; approximate from count.
    const raw = cv.summary ? 0 : (cv.messageCount ?? 0) * TOKENS_PER_MESSAGE
    return sum + summary + raw
  }, 0)
}

function episodicTokens(c: BudgetInputs): number {
  return c.episodes.reduce(
    (sum, e) => sum + estTokens(e.action) + estTokens(e.input) + estTokens(e.output),
    0,
  )
}

function semanticTokens(c: BudgetInputs): number {
  const ent = c.entities.reduce(
    (s, e) => s + estTokens(e.name) + estTokens(e.description) + estTokens(e.attributes),
    0,
  )
  const pages = c.wiki.reduce((s, p) => s + estTokens(p.title) + estTokens(p.content), 0)
  return ent + pages
}

function proceduralTokens(c: BudgetInputs): number {
  return c.skills.reduce(
    (s, sk) => s + estTokens(sk.name) + estTokens(sk.trigger) + estTokens(sk.body) + estTokens(sk.preconditions),
    0,
  )
}

// Artifacts only expose metadata over the bridge (no body). Approximate a
// modest fixed footprint per stored result so the layer is not invisible.
const TOKENS_PER_ARTIFACT = 40
function artifactTokens(c: BudgetInputs): number {
  return c.results.reduce((s, r) => s + estTokens(r.name) + TOKENS_PER_ARTIFACT, 0)
}

function metaTokens(c: BudgetInputs): number {
  const dec = c.decisions.reduce((s, d) => s + estTokens(d.op) + estTokens(d.detail), 0)
  const pend = c.pending.reduce((s, p) => s + estTokens(p.value), 0)
  return dec + pend
}

interface LayerDef {
  key: KarpLayer
  label: string
  icon: string
  fn: (c: BudgetInputs) => number
}

const LAYER_DEFS: LayerDef[] = [
  { key: 'working', label: 'Working', icon: '💭', fn: workingTokens },
  { key: 'episodic', label: 'Episodic', icon: '⏱', fn: episodicTokens },
  { key: 'semantic', label: 'Semantic', icon: '📚', fn: semanticTokens },
  { key: 'procedural', label: 'Procedural', icon: '⚡', fn: proceduralTokens },
  { key: 'artifact', label: 'Artifact', icon: '📦', fn: artifactTokens },
  { key: 'meta', label: 'Meta', icon: '🧠', fn: metaTokens },
]

export function estimateBudget(c: BudgetInputs, capTokens: number = DEFAULT_CAP): BudgetEstimate {
  const raw = LAYER_DEFS.map(d => ({
    key: d.key,
    label: d.label,
    icon: d.icon,
    color: LAYER_COLORS[d.key],
    tokens: Math.max(0, Math.round(d.fn(c))),
  }))
  const totalTokens = raw.reduce((s, l) => s + l.tokens, 0)
  const layers: LayerBudget[] = raw
    .filter(l => l.tokens > 0)
    .map(l => ({ ...l, pct: totalTokens > 0 ? l.tokens / totalTokens : 0 }))

  const fitsTokens = Math.min(totalTokens, capTokens)
  const overflowTokens = Math.max(0, totalTokens - capTokens)

  return {
    layers,
    totalTokens,
    capTokens,
    fitsTokens,
    overflowTokens,
    withinBudget: overflowTokens === 0,
  }
}

export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}
