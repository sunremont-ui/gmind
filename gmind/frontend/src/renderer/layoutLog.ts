// Layout debug logging.
//
// Цель: видеть «где, когда и как» отработал алгоритм раскладки — какие узлы
// паковались, какой структурой, сколько наложений нашли и устранили, сколько
// времени заняло. По умолчанию выключено (нулевая стоимость). Включается из
// консоли браузера: `gmindLayoutDebug(true)` либо localStorage
// `gmind.layoutDebug = '1'`.
//
// Подробности и формат событий описаны в docs/layout-algorithm.md.

export type LayoutEventType =
  | 'pack'        // упаковка детей одного узла
  | 'measure'     // измерен bbox поддерева
  | 'overlap'     // обнаружено наложение
  | 'resolve'     // наложение устранено сдвигом
  | 'info'

export interface LayoutEvent {
  type: LayoutEventType
  /** id узла, к которому относится событие (если применимо) */
  nodeId?: string
  message: string
  data?: Record<string, unknown>
}

export interface LayoutRunStats {
  nodeCount: number
  packCount: number
  overlapsFound: number
  overlapsResolved: number
  durationMs: number
  events: LayoutEvent[]
  startedAt: number
}

// Выключено по умолчанию (нулевая стоимость в проде); включить можно через
// gmindLayoutDebug(true) или localStorage 'gmind.layoutDebug' = '1'.
let enabled = false
try {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem('gmind.layoutDebug')
    if (v === '1') enabled = true
  }
} catch {
  /* SSR / private mode */
}

/** Последний завершённый прогон — доступен из консоли как `gmindLastLayout`. */
let lastRun: LayoutRunStats | null = null

export function isLayoutDebug(): boolean {
  return enabled
}

export function setLayoutDebug(on: boolean): void {
  enabled = on
  try {
    localStorage.setItem('gmind.layoutDebug', on ? '1' : '0')
  } catch {
    /* ignore */
  }
  // eslint-disable-next-line no-console
  console.info(`[layout] debug logging ${on ? 'ENABLED' : 'disabled'}`)
}

export function getLastLayoutRun(): LayoutRunStats | null {
  return lastRun
}

/**
 * Лёгкий сборщик событий одного прогона раскладки. Когда логи выключены,
 * методы — почти no-op (только инкремент счётчиков), накопления массива нет.
 */
export class LayoutRun {
  private stats: LayoutRunStats = {
    nodeCount: 0,
    packCount: 0,
    overlapsFound: 0,
    overlapsResolved: 0,
    durationMs: 0,
    events: [],
    startedAt: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  }

  setNodeCount(n: number) {
    this.stats.nodeCount = n
  }

  pack(nodeId: string, structure: string, childCount: number, extra?: Record<string, unknown>) {
    this.stats.packCount++
    if (enabled) {
      this.stats.events.push({
        type: 'pack',
        nodeId,
        message: `pack ${childCount} children as "${structure}"`,
        data: extra,
      })
    }
  }

  overlap(aId: string, bId: string, data?: Record<string, unknown>) {
    this.stats.overlapsFound++
    if (enabled) {
      this.stats.events.push({ type: 'overlap', message: `overlap ${aId} ↔ ${bId}`, data })
    }
  }

  resolve(nodeId: string, dx: number, dy: number) {
    this.stats.overlapsResolved++
    if (enabled) {
      this.stats.events.push({
        type: 'resolve',
        nodeId,
        message: `nudged by (${dx.toFixed(1)}, ${dy.toFixed(1)})`,
      })
    }
  }

  info(message: string, data?: Record<string, unknown>) {
    if (enabled) this.stats.events.push({ type: 'info', message, data })
  }

  /** Завершает прогон, печатает сводку (если логи включены) и сохраняет stats. */
  finish(): LayoutRunStats {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.stats.durationMs = now - this.stats.startedAt
    lastRun = this.stats

    if (enabled) {
      const s = this.stats
      // eslint-disable-next-line no-console
      console.groupCollapsed(
        `[layout] ${s.nodeCount} nodes · ${s.packCount} packs · ` +
        `overlaps ${s.overlapsResolved}/${s.overlapsFound} · ${s.durationMs.toFixed(1)}ms`,
      )
      for (const e of s.events) {
        // eslint-disable-next-line no-console
        console.log(`  ${e.type.padEnd(8)} ${e.nodeId ? e.nodeId.slice(0, 8) + ' ' : ''}${e.message}`, e.data ?? '')
      }
      // eslint-disable-next-line no-console
      console.groupEnd()
    }
    return this.stats
  }
}

// Экспорт в window для ручного управления из консоли.
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).gmindLayoutDebug = setLayoutDebug
  ;(window as unknown as Record<string, unknown>).gmindLastLayout = getLastLayoutRun
}
