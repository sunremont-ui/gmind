// Сравнение двух прогонов одного замера.
//
// Сравниваются ЯЧЕЙКИ, а не итоговые доли: сводка по варианту говорит, что
// сдвинулось на сколько, но не говорит где — а вопрос к сравнению почти всегда
// именно «что изменилось».
import type { LabRunReport, LabRunRow } from '../../types/lab'
import { buildMatrix, cellMatched } from './labMatrix'

/** Что стало с ячейкой между двумя прогонами. */
export type LabCellChange =
  | 'appeared'   // ячейки не было — кейс или вариант добавлен
  | 'disappeared'// была и пропала
  | 'improved'   // не совпадала с ожидаемым, стала совпадать
  | 'regressed'  // совпадала, перестала
  | 'metric'     // вердикт тот же, но метрики изменились
  | 'same'

export interface LabCellDiff {
  caseId: string
  variantId: string
  change: LabCellChange
  before?: LabRunRow
  after?: LabRunRow
  /** Метрики, изменившие значение: имя → [было, стало]. */
  metrics: Record<string, [string, string]>
}

export interface LabRunDiff {
  cases: string[]
  variants: string[]
  cells: LabCellDiff[]
  counts: Record<LabCellChange, number>
  /** Сдвиг соответствия по вариантам: вариант → [было, стало] из сводок. */
  matched: Record<string, [number | undefined, number | undefined]>
}

function metricDiff(a?: LabRunRow, b?: LabRunRow): Record<string, [string, string]> {
  const out: Record<string, [string, string]> = {}
  const keys = new Set([...Object.keys(a?.metrics ?? {}), ...Object.keys(b?.metrics ?? {})])
  for (const k of keys) {
    const before = a?.metrics?.[k]
    const after = b?.metrics?.[k]
    if (String(before ?? '—') !== String(after ?? '—')) {
      out[k] = [String(before ?? '—'), String(after ?? '—')]
    }
  }
  return out
}

/**
 * `before` — прогон постарше, `after` — посвежее.
 *
 * Кейс без вердикта (expected пуст) не считается ни улучшением, ни регрессом:
 * сравнивать нечего, и «improved» тут означало бы подтверждение, которого не
 * было. Такие ячейки попадают в `metric`, если числа сдвинулись.
 */
export function diffRuns(before: LabRunReport | null, after: LabRunReport | null): LabRunDiff {
  const mb = buildMatrix(before)
  const ma = buildMatrix(after)

  const cases = [...ma.cases, ...mb.cases.filter(c => !ma.cases.includes(c))]
  const variants = [...ma.variants, ...mb.variants.filter(v => !ma.variants.includes(v))]

  const cells: LabCellDiff[] = []
  const counts: Record<LabCellChange, number> = {
    appeared: 0, disappeared: 0, improved: 0, regressed: 0, metric: 0, same: 0,
  }

  for (const c of cases) {
    for (const v of variants) {
      const b = mb.cell(c, v)
      const a = ma.cell(c, v)
      if (!b && !a) continue

      let change: LabCellChange
      if (!b) change = 'appeared'
      else if (!a) change = 'disappeared'
      else {
        const wasOk = cellMatched(b)
        const isOk = cellMatched(a)
        if (wasOk === false && isOk === true) change = 'improved'
        else if (wasOk === true && isOk === false) change = 'regressed'
        else change = Object.keys(metricDiff(b, a)).length > 0 ? 'metric' : 'same'
      }
      counts[change]++
      cells.push({ caseId: c, variantId: v, change, before: b, after: a, metrics: metricDiff(b, a) })
    }
  }

  const matched: Record<string, [number | undefined, number | undefined]> = {}
  for (const v of variants) {
    const sb = before?.summaries?.find(s => s.variantId === v)
    const sa = after?.summaries?.find(s => s.variantId === v)
    if (sb || sa) matched[v] = [sb?.matched, sa?.matched]
  }

  return { cases, variants, cells, counts, matched }
}

/** Изменилось ли хоть что-нибудь — заголовку сравнения нужен короткий ответ. */
export function hasChanges(diff: LabRunDiff): boolean {
  return diff.cells.some(c => c.change !== 'same')
}

export const CHANGE_LABEL: Record<LabCellChange, string> = {
  appeared: 'появилось',
  disappeared: 'пропало',
  improved: 'сошлось',
  regressed: 'разошлось',
  metric: 'числа сдвинулись',
  same: 'без изменений',
}
