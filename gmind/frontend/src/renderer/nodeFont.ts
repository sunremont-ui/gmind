// Единый источник шрифта узла: и раскладка (measure → размер коробки), и
// отрисовка (TopicNode) обязаны спрашивать одно и то же. Пока правила жили в
// двух местах, они разошлись: узел с жирным rich_text мерился обычным
// начертанием, а рисовался жирным — текст не влезал и обрезался по overflow.

import { fonts } from '../styles/tokens'

export const DEFAULT_FONT_WEIGHT = 500
export const BOLD_FONT_WEIGHT = 700

export interface NodeFontSource {
  font_size?: number
  font_family?: string
  font_weight?: number
  rich_text?: string
}

export interface NodeFont {
  size: number
  family: string
  weight: number
}

/** Есть ли в HTML головы жирное начертание (contentEditable даёт <b> или <strong>). */
export function hasBoldMarkup(html?: string): boolean {
  if (!html) return false
  return /<(b|strong)(\s[^>]*)?>/i.test(html)
}

export function resolveNodeFont(topic: NodeFontSource | undefined, defaultSize = 14): NodeFont {
  const size = topic?.font_size || defaultSize || 14
  const family = topic?.font_family || fonts.ui
  // Явный вес пользователя главнее; иначе жирная разметка головы даёт 700 —
  // меряем ровно то начертание, которым узел будет нарисован.
  const weight = topic?.font_weight
    || (hasBoldMarkup(topic?.rich_text) ? BOLD_FONT_WEIGHT : DEFAULT_FONT_WEIGHT)
  return { size, family, weight }
}
