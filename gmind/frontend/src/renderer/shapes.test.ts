import { describe, it, expect } from 'vitest'
import { NODE_SHAPES, shapeDef, shapePath, shapeGrow, shapeTextInset, DEFAULT_SHAPE } from './shapes'

describe('реестр форм', () => {
  it('содержит базовый набор с уникальными id', () => {
    const ids = NODE_SHAPES.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ['rounded', 'rectangle', 'pill', 'ellipse', 'diamond', 'triangle', 'hexagon', 'parallelogram', 'note']) {
      expect(ids).toContain(id)
    }
  })

  it('неизвестная форма откатывается к скруглённой', () => {
    expect(shapeDef('нет-такой').id).toBe(DEFAULT_SHAPE)
    expect(shapeDef(undefined).id).toBe(DEFAULT_SHAPE)
  })
})

describe('shapePath', () => {
  it.each(NODE_SHAPES.map(s => s.id))('%s даёт замкнутый путь', id => {
    const d = shapePath(id, 160, 48, 10)
    expect(d.startsWith('M')).toBe(true)
    expect(d.trim().endsWith('Z')).toBe(true)
    expect(d).not.toMatch(/NaN|Infinity|undefined/)
  })

  it.each(NODE_SHAPES.map(s => s.id))('%s не ломается на вырожденных размерах', id => {
    for (const [w, h] of [[1, 1], [0, 0], [400, 4], [4, 400]] as const) {
      expect(shapePath(id, w, h, 12)).not.toMatch(/NaN|Infinity|undefined/)
    }
  })

  it('прямоугольник без скругления не содержит дуг', () => {
    expect(shapePath('rectangle', 100, 40, 12)).not.toContain('A')
  })

  it('капсула скругляется по меньшей стороне', () => {
    expect(shapePath('pill', 200, 40, 4)).toContain('A20,20')
  })

  it('радиус скругления не превышает половину стороны', () => {
    // r=999 не должен вывернуть контур наизнанку
    expect(shapePath('rounded', 40, 20, 999)).toContain('A10,10')
  })
})

describe('shapeGrow', () => {
  it('прямоугольные формы не растут', () => {
    expect(shapeGrow('rounded')).toEqual({ w: 1, h: 1 })
    expect(shapeGrow('rectangle')).toEqual({ w: 1, h: 1 })
  })

  it('ромб и эллипс растут — иначе текст выйдет за срезанные углы', () => {
    expect(shapeGrow('diamond').w).toBeGreaterThan(1.3)
    expect(shapeGrow('ellipse').w).toBeGreaterThan(1.1)
  })

  it.each(NODE_SHAPES.map(s => s.id))('%s: коэффициенты роста не меньше 1', id => {
    const g = shapeGrow(id)
    expect(g.w).toBeGreaterThanOrEqual(1)
    expect(g.h).toBeGreaterThanOrEqual(1)
  })
})

describe('shapeTextInset', () => {
  it.each(NODE_SHAPES.map(s => s.id))('%s: врезка не выходит за границы узла', id => {
    const w = 200
    const h = 60
    const r = shapeTextInset(id, w, h)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(w + 0.01)
    expect(r.y + r.h).toBeLessThanOrEqual(h + 0.01)
    expect(r.w).toBeGreaterThan(0)
    expect(r.h).toBeGreaterThan(0)
  })

  it('прямоугольные формы отдают весь бокс', () => {
    expect(shapeTextInset('rectangle', 120, 40)).toEqual({ x: 0, y: 0, w: 120, h: 40 })
  })

  it('ромб сжимает текстовую область', () => {
    const r = shapeTextInset('diamond', 200, 100)
    expect(r.w).toBeLessThan(200)
    expect(r.h).toBeLessThan(100)
  })

  it('вырожденный узел не даёт нулевую или отрицательную врезку', () => {
    const r = shapeTextInset('diamond', 1, 1)
    expect(r.w).toBeGreaterThan(0)
    expect(r.h).toBeGreaterThan(0)
  })
})
