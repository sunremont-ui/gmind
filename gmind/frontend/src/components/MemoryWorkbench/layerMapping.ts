// V6.0 Phase 2 — bridge between MASys 8 raw layers and karp 6-layer memory model.
// karp model (from D:\karp\agent-system-next): Working / Episodic / Semantic /
//   Procedural / Artifact / Meta. Each maps to one or more MASys tables.
import type {
  MASysEpisode, MASysMemoryEntity, MASysSkill, MASysConversation,
  MASysWikiPage, MASysResult, MASysDecision, MASysPendingWrite,
} from '../../types/masys'

export type KarpLayer = 'working' | 'episodic' | 'semantic' | 'procedural' | 'artifact' | 'meta'

export interface HealthStatus {
  level: 'ok' | 'warn' | 'crit'
  notes: string[]   // human-readable issues
}

export interface AggregatedLayer {
  key: KarpLayer
  icon: string
  label: string
  description: string
  count: number
  parts: Array<{ label: string; count: number }>
  health: HealthStatus
}

interface Inputs {
  episodes: MASysEpisode[]
  entities: MASysMemoryEntity[]
  skills: MASysSkill[]
  conversations: MASysConversation[]
  wiki: MASysWikiPage[]
  results: MASysResult[]
  decisions: MASysDecision[]
  pending: MASysPendingWrite[]
}

const NOW_MS = () => Date.now()
const DAYS = (n: number) => n * 24 * 3600 * 1000

function tsAge(ts?: string): number {
  if (!ts) return Infinity
  const t = Date.parse(ts)
  if (isNaN(t)) return Infinity
  return NOW_MS() - t
}

// Working — current conversation buffer + recent context.
function workingLayer(c: Inputs): AggregatedLayer {
  const recentConvos = c.conversations.length
  const totalMsgs = c.conversations.reduce(
    (sum, cv) => sum + (cv.messageCount ?? 0), 0)
  const compressed = c.conversations.filter(cv =>
    (cv.summary?.length ?? 0) > 0).length

  const issues: string[] = []
  if (recentConvos === 0) issues.push('нет активных сессий')
  if (compressed === 0 && totalMsgs > 100) issues.push('нет суммаризированных сессий')

  return {
    key: 'working',
    icon: '💭',
    label: 'Working',
    description: 'Контекстное окно: текущие диалоги и compressed summaries',
    count: recentConvos,
    parts: [
      { label: 'сессий', count: recentConvos },
      { label: 'сообщений', count: totalMsgs },
      { label: 'compressed', count: compressed },
    ],
    health: { level: issues.length === 0 ? 'ok' : 'warn', notes: issues },
  }
}

// Episodic — hronological actions of the agent.
function episodicLayer(c: Inputs): AggregatedLayer {
  const total = c.episodes.length
  const errors = c.episodes.filter(e => e.status === 'error').length
  const recent = c.episodes.filter(e => tsAge(e.timestamp) < DAYS(1)).length
  const stale = c.episodes.filter(e => tsAge(e.timestamp) > DAYS(30)).length

  const issues: string[] = []
  if (errors > total * 0.3 && total > 5)
    issues.push(`высокий процент ошибок: ${errors}/${total}`)
  if (stale > total * 0.7 && total > 10)
    issues.push(`${stale} устаревших эпизодов (>30 дней)`)

  return {
    key: 'episodic',
    icon: '⏱',
    label: 'Episodic',
    description: 'Хронология действий агента: input → action → output',
    count: total,
    parts: [
      { label: 'эпизодов', count: total },
      { label: 'ошибок', count: errors },
      { label: 'за 24ч', count: recent },
    ],
    health: { level: errors > total * 0.5 ? 'crit' : issues.length ? 'warn' : 'ok', notes: issues },
  }
}

// Semantic — facts: entities + wiki pages.
function semanticLayer(c: Inputs): AggregatedLayer {
  const ents = c.entities.length
  const pages = c.wiki.length
  const total = ents + pages
  const lowMention = c.entities.filter(e => (e.mentions ?? 0) < 2).length
  const stale = c.entities.filter(e => tsAge(e.lastSeen) > DAYS(60)).length

  const issues: string[] = []
  if (lowMention > ents * 0.4 && ents > 5)
    issues.push(`${lowMention} entities с <2 упоминаниями`)
  if (stale > 0) issues.push(`${stale} stale entities (>60 дней)`)

  return {
    key: 'semantic',
    icon: '📚',
    label: 'Semantic',
    description: 'Факты, концепции, связи: entities + wiki',
    count: total,
    parts: [
      { label: 'entities', count: ents },
      { label: 'wiki pages', count: pages },
      { label: 'low-mention', count: lowMention },
    ],
    health: { level: issues.length === 0 ? 'ok' : 'warn', notes: issues },
  }
}

// Procedural — skills: trigger → body → success rate.
function proceduralLayer(c: Inputs): AggregatedLayer {
  const total = c.skills.length
  const active = c.skills.filter(s => s.active !== false).length
  const successAvg = total === 0
    ? 0
    : c.skills.reduce((s, sk) => s + (sk.successRate ?? 0), 0) / total
  const lowSuccess = c.skills.filter(s => (s.successRate ?? 1) < 0.5).length
  const unused = c.skills.filter(s => (s.usageCount ?? 0) === 0).length

  const issues: string[] = []
  if (lowSuccess > 0) issues.push(`${lowSuccess} skills с success<50%`)
  if (unused > total / 2 && total > 4) issues.push(`${unused} skills ни разу не запускались`)

  return {
    key: 'procedural',
    icon: '⚡',
    label: 'Procedural',
    description: 'Навыки: trigger → action graph → success rate',
    count: total,
    parts: [
      { label: 'навыков', count: total },
      { label: 'активных', count: active },
      { label: `avg success ${(successAvg * 100).toFixed(0)}%`, count: -1 },
    ],
    health: { level: lowSuccess > total * 0.3 ? 'crit' : issues.length ? 'warn' : 'ok', notes: issues },
  }
}

// Artifact — results store (text/json/file outputs).
function artifactLayer(c: Inputs): AggregatedLayer {
  const total = c.results.length
  const expiringSoon = c.results.filter(r => {
    if (!r.expiresAt) return false
    const t = Date.parse(r.expiresAt)
    if (isNaN(t)) return false
    return t - NOW_MS() < DAYS(7) && t > NOW_MS()
  }).length
  const expired = c.results.filter(r => {
    if (!r.expiresAt) return false
    const t = Date.parse(r.expiresAt)
    if (isNaN(t)) return false
    return t < NOW_MS()
  }).length

  const issues: string[] = []
  if (expired > 0) issues.push(`${expired} артефактов просрочены`)
  if (expiringSoon > 0) issues.push(`${expiringSoon} истекают в течение 7 дней`)

  return {
    key: 'artifact',
    icon: '📦',
    label: 'Artifact',
    description: 'Артефакты: тексты, JSON, файлы (с TTL)',
    count: total,
    parts: [
      { label: 'артефактов', count: total },
      { label: '⏰ истекают', count: expiringSoon },
      { label: '❌ просрочены', count: expired },
    ],
    health: { level: expired > 0 ? 'warn' : 'ok', notes: issues },
  }
}

// Meta — decisions log + pending writes (salience queue).
function metaLayer(c: Inputs): AggregatedLayer {
  const decisionsCount = c.decisions.length
  const pendingCount = c.pending.length
  const recallOps = c.decisions.filter(d => d.op === 'recall').length
  const rememberOps = c.decisions.filter(d => d.op === 'remember').length
  const oldPending = c.pending.filter(p => tsAge(p.createdAt) > DAYS(7)).length

  const issues: string[] = []
  if (pendingCount > 50) issues.push(`очередь >50 (${pendingCount})`)
  if (oldPending > 0) issues.push(`${oldPending} pending старше 7 дней`)

  return {
    key: 'meta',
    icon: '🧠',
    label: 'Meta',
    description: 'Решения Controller + очередь salience',
    count: decisionsCount + pendingCount,
    parts: [
      { label: 'decisions', count: decisionsCount },
      { label: 'pending', count: pendingCount },
      { label: `recall/remember ${recallOps}/${rememberOps}`, count: -1 },
    ],
    health: { level: oldPending > 0 || pendingCount > 100 ? 'warn' : 'ok', notes: issues },
  }
}

export function aggregateLayers(c: Inputs): AggregatedLayer[] {
  return [
    workingLayer(c),
    episodicLayer(c),
    semanticLayer(c),
    proceduralLayer(c),
    artifactLayer(c),
    metaLayer(c),
  ]
}

export function healthColor(level: 'ok' | 'warn' | 'crit'): string {
  switch (level) {
    case 'ok': return '#22c55e'    // green
    case 'warn': return '#f59e0b'  // amber
    case 'crit': return '#ef4444'  // red
  }
}

export function healthLabel(level: 'ok' | 'warn' | 'crit'): string {
  switch (level) {
    case 'ok': return '✓ healthy'
    case 'warn': return '⚠ warning'
    case 'crit': return '✗ critical'
  }
}
