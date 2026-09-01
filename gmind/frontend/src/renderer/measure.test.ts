import { describe, it, expect } from 'vitest'
import { wrapText, measureNodeSize, nodePad } from './measure'

// В jsdom canvas.getContext('2d') → null, работает фолбэк: ширина символа
// = fontSize * 0.6. Тесты опираются на это детерминированное поведение.

describe('wrapText', () => {
  it('короткий текст — одна строка', () => {
    expect(wrapText('hello', 200, 14, 'Inter')).toEqual(['hello'])
  })

  it('переносит по словам под maxWidth', () => {
    // 14 * 0.6 = 8.4px/символ; 'aaaa bbbb' (9 симв.) > 50px → перенос
    const lines = wrapText('aaaa bbbb', 50, 14, 'Inter')
    expect(lines).toEqual(['aaaa', 'bbbb'])
  })

  it('ломает слово длиннее строки по символам', () => {
    const lines = wrapText('abcdefghijklmnop', 50, 14, 'Inter')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe('abcdefghijklmnop')
  })

  it('учитывает явные \\n', () => {
    expect(wrapText('a\nb', 200, 14, 'Inter')).toEqual(['a', 'b'])
  })
})

describe('measureNodeSize', () => {
  const base = {
    fontSize: 14,
    fontFamily: 'Inter',
    padH: 10,
    padV: 8,
    maxContentWidth: 250,
    minWidth: 60,
    minHeight: 40,
  }

  it('соблюдает минимальные размеры', () => {
    const m = measureNodeSize({ ...base, title: 'a' })
    expect(m.width).toBeGreaterThanOrEqual(60)
    expect(m.height).toBeGreaterThanOrEqual(40)
  })

  it('тело увеличивает высоту узла', () => {
    const noBody = measureNodeSize({ ...base, title: 'Заголовок' })
    const withBody = measureNodeSize({ ...base, title: 'Заголовок', body: 'длинное тело узла\nещё строка' })
    expect(withBody.height).toBeGreaterThan(noBody.height)
  })

  it('длинный текст растит высоту (перенос), а не сжимает шрифт', () => {
    const short = measureNodeSize({ ...base, title: 'кратко' })
    const long = measureNodeSize({ ...base, title: 'очень длинный заголовок узла который обязательно переносится на несколько строк' })
    expect(long.height).toBeGreaterThan(short.height)
    expect(long.width).toBeLessThanOrEqual(250 + base.padH * 2)
  })

  it('фиксированная ширина (node_width) уважается', () => {
    const m = measureNodeSize({ ...base, title: 'длинный заголовок с фиксированной шириной', fixedWidth: 120 })
    expect(m.width).toBe(120)
  })
})

describe('nodePad', () => {
  it('возвращает горизонтальный и уменьшенный вертикальный отступы', () => {
    expect(nodePad(10)).toEqual({ padH: 10, padV: 8 })
    expect(nodePad(0)).toEqual({ padH: 8, padV: 6 })
  })
})
