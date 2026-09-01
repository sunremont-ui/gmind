import { describe, it, expect } from 'vitest'
import { splitHeadBody, composeEditHtml, HEAD_MAX_CHARS } from './splitNodeText'

describe('splitHeadBody', () => {
  it('короткая строка остаётся головой без тела', () => {
    const r = splitHeadBody('Привет мир')
    expect(r.title).toBe('Привет мир')
    expect(r.body).toBe('')
    expect(r.richText).toBe('')
  })

  it('пустой ввод → всё пустое', () => {
    expect(splitHeadBody('')).toEqual({ title: '', richText: '', body: '' })
    expect(splitHeadBody('<div><br></div>')).toEqual({ title: '', richText: '', body: '' })
  })

  it('многострочный ввод: первая строка — голова, остальное — тело', () => {
    const r = splitHeadBody('Заголовок<div>строка тела 1</div><div>строка тела 2</div>')
    expect(r.title).toBe('Заголовок')
    expect(r.body).toBe('строка тела 1\nстрока тела 2')
  })

  it('длинная одиночная строка переливается в тело по границе слова', () => {
    const long = 'слово '.repeat(40).trim() // ~240 символов
    const r = splitHeadBody(long)
    expect(r.title.length).toBeLessThanOrEqual(HEAD_MAX_CHARS)
    expect(r.title.endsWith('слово')).toBe(true)
    expect(r.body.length).toBeGreaterThan(0)
    expect((r.title + ' ' + r.body).replace(/\s+/g, ' ')).toBe(long.replace(/\s+/g, ' '))
  })

  it('сохраняет форматирование головы в richText', () => {
    const r = splitHeadBody('<b>Жирный</b> заголовок<div>тело</div>')
    expect(r.title).toBe('Жирный заголовок')
    expect(r.richText).toContain('<b>')
    expect(r.body).toBe('тело')
  })

  it('пустые строки в конце отбрасываются', () => {
    const r = splitHeadBody('Заголовок<div>тело</div><div><br></div>')
    expect(r.title).toBe('Заголовок')
    expect(r.body).toBe('тело')
  })
})

describe('composeEditHtml + splitHeadBody (round-trip)', () => {
  it('голова + тело собираются и разбираются без потерь', () => {
    const html = composeEditHtml({ title: 'Голова', body: 'строка 1\nстрока 2' })
    const r = splitHeadBody(html)
    expect(r.title).toBe('Голова')
    expect(r.body).toBe('строка 1\nстрока 2')
  })

  it('узел без тела редактируется как одна строка', () => {
    const html = composeEditHtml({ title: 'Просто узел' })
    expect(html).toBe('Просто узел')
    const r = splitHeadBody(html)
    expect(r.title).toBe('Просто узел')
    expect(r.body).toBe('')
  })

  it('экранирует HTML-символы в plain-тексте', () => {
    const html = composeEditHtml({ title: 'a < b', body: 'x & y' })
    const r = splitHeadBody(html)
    expect(r.title).toBe('a < b')
    expect(r.body).toBe('x & y')
  })
})
