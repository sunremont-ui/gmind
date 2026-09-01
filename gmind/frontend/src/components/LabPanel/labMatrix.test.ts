import { describe, it, expect } from 'vitest'
import { buildMatrix, cellMatched, cellLabel } from './labMatrix'
import type { LabRunReport } from '../../types/lab'

const report: LabRunReport = {
  lab: 'demo',
  summaries: [
    { variantId: 'по-пакету', total: 2, ok: 2, failed: 0, avgMs: 0, costRub: 0, matched: 1, expected: 2 },
    { variantId: 'сквозной', total: 2, ok: 2, failed: 0, avgMs: 0, costRub: 0, matched: 2, expected: 2 },
    // Вариант без единой строки — пропущен целиком.
    { variantId: 'пропущенный', total: 0, ok: 0, failed: 0, avgMs: 0, costRub: 0 },
  ],
  rows: [
    { caseId: 'internal/api', variantId: 'по-пакету', ok: true, matched: 1, expected: 1, metrics: { 'доля': '4.7%', 'операторов': 26704 } },
    { caseId: 'internal/api', variantId: 'сквозной', ok: true, matched: 1, expected: 1, metrics: { 'доля': '4.7%' } },
    { caseId: 'cmd/server', variantId: 'по-пакету', ok: true, matched: 0, expected: 1, metrics: { 'доля': '0.0%' } },
    { caseId: 'cmd/server', variantId: 'сквозной', ok: true, matched: 1, expected: 1, metrics: { 'доля': '0.0%' } },
  ],
}

describe('buildMatrix', () => {
  it('держит порядок осей из отчёта, а не алфавитный', () => {
    const m = buildMatrix(report)
    expect(m.cases).toEqual(['internal/api', 'cmd/server'])
    expect(m.variants.slice(0, 2)).toEqual(['по-пакету', 'сквозной'])
  })

  it('даёт колонку варианту, у которого нет ни одной строки', () => {
    expect(buildMatrix(report).variants).toContain('пропущенный')
  })

  it('собирает названия метрик в порядке первого появления', () => {
    expect(buildMatrix(report).metricKeys).toEqual(['доля', 'операторов'])
  })

  it('возвращает ячейку по паре и пусто там, где кейс не прогонялся', () => {
    const m = buildMatrix(report)
    expect(m.cell('cmd/server', 'сквозной')?.matched).toBe(1)
    expect(m.cell('cmd/server', 'пропущенный')).toBeUndefined()
  })

  it('не падает на пустом отчёте', () => {
    const m = buildMatrix(null)
    expect(m.cases).toEqual([])
    expect(m.variants).toEqual([])
    expect(m.cell('a', 'b')).toBeUndefined()
  })
})

describe('cellMatched', () => {
  it('различает совпадение и расхождение', () => {
    const m = buildMatrix(report)
    expect(cellMatched(m.cell('cmd/server', 'по-пакету'))).toBe(false)
    expect(cellMatched(m.cell('cmd/server', 'сквозной'))).toBe(true)
  })

  it('кейс без ожидаемого вердикта не считается ни совпавшим, ни провалившимся', () => {
    expect(cellMatched({ caseId: 'a', variantId: 'v', ok: true })).toBeUndefined()
    expect(cellMatched({ caseId: 'a', variantId: 'v', ok: true, expected: 0, matched: 0 })).toBeUndefined()
    expect(cellMatched(undefined)).toBeUndefined()
  })
})

describe('cellLabel', () => {
  it('показывает первую доступную метрику', () => {
    const m = buildMatrix(report)
    expect(cellLabel(m.cell('internal/api', 'по-пакету'), m.metricKeys)).toBe('4.7%')
  })

  it('без метрик сводится к исходу прогона', () => {
    expect(cellLabel({ caseId: 'a', variantId: 'v', ok: false }, ['доля'])).toBe('сбой')
    expect(cellLabel(undefined, [])).toBe('—')
  })
})
