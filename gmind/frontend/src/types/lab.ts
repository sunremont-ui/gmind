// Слой лабы: типы отражают то, что отдаёт /api/v1/lab/* — реестр проектов,
// состояние трека из MASys и отчёты замеров с диска.

/** Вид записи. Шесть видов дают шесть РАЗНЫХ ответов, а не рубрикацию. */
export type LabKind = 'fact' | 'decision' | 'gate' | 'tail' | 'next' | 'lesson'

/** `accepted` даётся только со ссылкой в git — принятым делает git, а не запись. */
export type LabStatus = 'proposed' | 'accepted' | 'superseded' | 'revoked'

/**
 * `self_declared` — факт совпал, но сверка прошла в том же прогоне, что и запись:
 * совпадение гарантировано построением, а не наблюдением.
 */
export type LabVerdict = 'match' | 'drift' | 'unverifiable' | 'self_declared'

/** Насколько независим источник факта. */
export type LabOracleLevel = 'self' | 'out-of-process' | 'independent'

export type LabOracleKind = 'doctor' | 'ledger' | 'git' | 'audit' | 'none'

export interface LabEntry {
  id: string
  namespace: string
  track: string
  wave: string | null
  kind: LabKind
  statement: string
  body: string | null
  status: LabStatus
  supersedesId: string | null
  runId: string | null
  traceId: string | null
  oracleKind: LabOracleKind
  oracleQuery: string | null
  oracleExpected: string | null
  lastVerifiedAt: string | null
  lastVerdict: LabVerdict | null
  lastVerdictLevel: LabOracleLevel | null
  lastVerifiedRunId: string | null
  sourceRef: string | null
  tags: string[]
  createdAt: string
}

export interface LabCounters {
  entries: number
  accepted: number
  proposed: number
  openTails: number
  staleEntries: number
  driftEntries: number
  confirmed: { independent: number; outOfProcess: number; self: number }
  selfDeclared: number
  unverifiable: number
}

export interface LabTrackState {
  track: string
  namespace: string
  wave: string | null
  next: LabEntry | null
  openTails: LabEntry[]
  decisions: LabEntry[]
  gates: LabEntry[]
  counters: LabCounters
  lastEntryAt: string | null
  /** В каких ДРУГИХ namespace нашёлся трек с таким кодом — «спросили не там». */
  foundElsewhere: string[]
}

/**
 * Строка реестра вместе с прочитанным lab.config.json. `error` не делает ответ
 * ошибочным: каталог мог исчезнуть, и это надо показать, а не скрыть.
 */
export interface LabProject {
  path: string
  label: string
  track: string
  namespace: string
  export_path?: string
  oracle?: string
  labs: string[]
  reports: string[]
  error?: string
}

export interface LabVariantSummary {
  variantId: string
  total: number
  ok: number
  failed: number
  avgMs: number
  costRub: number
  matched?: number
  expected?: number
  noVerdict?: number
}

export interface LabRunSummary {
  lab: string
  question?: string
  track?: string
  started_at?: string
  finished_at?: string
  paid: boolean
  estimate_rub: number
  gate: boolean
  gate_failed: boolean
  summaries?: LabVariantSummary[]
  has_report: boolean
  has_script: boolean
  error?: string
}

/** Ячейка матрицы: один кейс в одном варианте. */
export interface LabRunRow {
  caseId: string
  variantId: string
  ok: boolean
  ms?: number
  costRub?: number
  matched?: number
  expected?: number
  metrics?: Record<string, string | number>
  note?: string
  judgeNote?: string
  result?: unknown
  error?: string
}

export interface LabRunReport {
  lab: string
  question?: string
  track?: string
  startedAt?: string
  finishedAt?: string
  paid?: boolean
  estimateRub?: number
  gate?: boolean
  gateFailed?: boolean
  skipped?: string[]
  summaries?: LabVariantSummary[]
  rows?: LabRunRow[]
}

/**
 * Слой памяти MASys в namespace проекта. `capped` — число упёрлось в потолок
 * выборки: это нижняя граница, а не размер слоя.
 */
export interface LabMemoryLayer {
  key: string
  label: string
  count: number
  capped: boolean
  error?: string
}

/** Состояние прогона замера, запущенного из панели. */
export interface LabRunProcess {
  id: string
  path: string
  lab: string
  started_at: string
  done: boolean
  exit_code: number
  failure?: string
  lines: number
}

/** Шапка архивного отчёта: один прошлый прогон замера. */
export interface LabHistoryEntry {
  at: string
  started_at?: string
  finished_at?: string
  gate: boolean
  gate_failed: boolean
  estimate_rub: number
  rows: number
  variants: number
}
