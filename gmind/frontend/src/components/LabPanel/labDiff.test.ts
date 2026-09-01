import { describe, it, expect } from 'vitest'
import { diffRuns, hasChanges } from './labDiff'
import type { LabRunReport } from '../../types/lab'

const before: LabRunReport = {
  lab: 'demo',
  summaries: [{ variantId: 'v1', total: 3, ok: 3, failed: 0, avgMs: 0, costRub: 0, matched: 1, expected: 3 }],
  rows: [
    { caseId: 'a', variantId: 'v1', ok: true, matched: 0, expected: 1, metrics: { доля: '4.7%' } },
    { caseId: 'b', variantId: 'v1', ok: true, matched: 1, expected: 1, metrics: { доля: '10.0%' } },
    { caseId: 'c', variantId: 'v1', ok: true, metrics: { доля: '0.0%' } }, // вердикта нет
    { caseId: 'd', variantId: 'v1', ok: true, matched: 1, expected: 1, metrics: { доля: '5.0%' } },
  ],
}

const after: LabRunReport = {
  lab: 'demo',
  summaries: [{ variantId: 'v1', total: 4, ok: 4, failed: 0, avgMs: 0, costRub: 0, matched: 2, expected: 3 }],
  rows: [
    { caseId: 'a', variantId: 'v1', ok: true, matched: 1, expected: 1, metrics: { доля: '9.1%' } }, // сошлось
    { caseId: 'b', variantId: 'v1', ok: true, matched: 0, expected: 1, metrics: { доля: '2.0%' } }, // разошлось
    { caseId: 'c', variantId: 'v1', ok: true, metrics: { доля: '1.5%' } },                          // только числа
    // d пропал
    { caseId: 'e', variantId: 'v1', ok: true, matched: 1, expected: 1, metrics: { доля: '3.0%' } }, // появился
  ],
}

describe('diffRuns', () => {
  const diff = diffRuns(before, after)
  const cell = (c: string) => diff.cells.find(x => x.caseId === c)!

  it('различает улучшение и регресс по соответствию ожидаемому', () => {
    expect(cell('a').change).toBe('improved')
    expect(cell('b').change).toBe('regressed')
  })

  it('кейс без вердикта не объявляется сошедшимся — только сдвиг чисел', () => {
    expect(cell('c').change).toBe('metric')
    expect(cell('c').metrics['доля']).toEqual(['0.0%', '1.5%'])
  })

  it('видит появившиеся и пропавшие ячейки', () => {
    expect(cell('e').change).toBe('appeared')
    expect(cell('d').change).toBe('disappeared')
  })

  it('считает изменения по видам', () => {
    expect(diff.counts).toMatchObject({
      improved: 1, regressed: 1, metric: 1, appeared: 1, disappeared: 1,
    })
  })

  it('показывает сдвиг соответствия по варианту из сводок', () => {
    expect(diff.matched['v1']).toEqual([1, 2])
  })

  it('оси включают кейсы обоих прогонов', () => {
    expect(diff.cases.sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('diffRuns — вырожденные случаи', () => {
  it('одинаковые прогоны не дают изменений', () => {
    const diff = diffRuns(before, before)
    expect(hasChanges(diff)).toBe(false)
    expect(diff.counts.same).toBe(4)
  })

  it('пустая сторона не роняет сравнение', () => {
    expect(diffRuns(null, after).counts.appeared).toBe(4)
    expect(diffRuns(before, null).counts.disappeared).toBe(4)
    expect(diffRuns(null, null).cells).toEqual([])
  })
})
