import { describe, it, expect } from 'vitest'
import type { Topic } from '../types'
import { resolveNodeFont, hasBoldMarkup, BOLD_FONT_WEIGHT, DEFAULT_FONT_WEIGHT } from './nodeFont'
import { buildLayout } from './layout'
import { fonts } from '../styles/tokens'

function topic(o: Partial<Topic> = {}): Topic {
  return { id: 'n', title: 'Заголовок узла карты', folded: false, children: [], ...o }
}

describe('resolveNodeFont', () => {
  it('берёт размер узла, затем значение по умолчанию', () => {
    expect(resolveNodeFont({ font_size: 22 }, 14).size).toBe(22)
    expect(resolveNodeFont({}, 18).size).toBe(18)
    expect(resolveNodeFont(undefined, 0).size).toBe(14)
  })

  it('семейство по умолчанию — общее с измерением', () => {
    expect(resolveNodeFont({}, 14).family).toBe(fonts.ui)
    expect(resolveNodeFont({ font_family: 'Georgia' }, 14).family).toBe('Georgia')
  })

  it('жирная разметка головы даёт жирное начертание', () => {
    expect(resolveNodeFont({ rich_text: '<b>жирно</b>' }, 14).weight).toBe(BOLD_FONT_WEIGHT)
    expect(resolveNodeFont({ rich_text: '<strong>жирно</strong>' }, 14).weight).toBe(BOLD_FONT_WEIGHT)
    expect(resolveNodeFont({ rich_text: '<i>курсив</i>' }, 14).weight).toBe(DEFAULT_FONT_WEIGHT)
    expect(resolveNodeFont({}, 14).weight).toBe(DEFAULT_FONT_WEIGHT)
  })

  it('явный вес пользователя главнее разметки', () => {
    expect(resolveNodeFont({ rich_text: '<b>x</b>', font_weight: 400 }, 14).weight).toBe(400)
  })

  it('распознаёт жирную разметку с атрибутами и не путает с другими тегами', () => {
    expect(hasBoldMarkup('<b style="color:red">x</b>')).toBe(true)
    expect(hasBoldMarkup('<br><span>x</span>')).toBe(false)
    expect(hasBoldMarkup(undefined)).toBe(false)
  })
})

describe('размер узла под жирный текст', () => {
  it('узел с жирной головой не уже обычного', () => {
    const plain = buildLayout(topic())
    const bold = buildLayout(topic({ rich_text: '<b>Заголовок узла карты</b>' }))
    // Жирный текст шире — коробка обязана это учесть, иначе overflow: hidden
    // просто срежет хвост строки.
    expect(bold.width).toBeGreaterThanOrEqual(plain.width)
    expect(bold.width * bold.height).toBeGreaterThan(plain.width * plain.height - 1)
  })
})
