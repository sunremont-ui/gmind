// Реальное измерение текста для расчёта размеров узла: canvas measureText
// с фолбэком на ширину символа (jsdom в тестах не имеет 2d-контекста).
// Узел = «голова» (title) + опциональное «тело» (body) меньшим шрифтом.

export const HEAD_LINE_HEIGHT = 1.3
export const BODY_LINE_HEIGHT = 1.45
export const BODY_FONT_SCALE = 0.85
// Зона разделителя между головой и телом: margin 4 + border 1 + padding 5.
export const BODY_GAP = 10

let ctx2d: CanvasRenderingContext2D | null | undefined

function get2d(): CanvasRenderingContext2D | null {
  if (ctx2d === undefined) {
    try { ctx2d = document.createElement('canvas').getContext('2d') } catch { ctx2d = null }
  }
  return ctx2d ?? null
}

const widthCache = new Map<string, number>()

export function lineWidth(text: string, fontSize: number, fontFamily: string, fontWeight = 500): number {
  const font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const key = `${font}${text}`
  const hit = widthCache.get(key)
  if (hit !== undefined) return hit
  const c = get2d()
  let w: number
  if (c) {
    c.font = font
    w = c.measureText(text).width
  } else {
    // Фолбэк без canvas (jsdom, SSR): грубая оценка по числу символов.
    // Начертание учитываем — жирный текст шире, и узел под него должен быть
    // шире тоже, иначе в этой среде дефект «текст не влез» просто не виден.
    w = text.length * fontSize * 0.6 * (fontWeight >= 600 ? 1.06 : 1)
  }
  if (widthCache.size > 20000) widthCache.clear()
  widthCache.set(key, w)
  return w
}

// Слишком длинное слово не влезает даже одно на строку: ломаем по символам.
// Полные куски уходят в lines, возвращается незавершённый хвост.
function breakWord(word: string, maxWidth: number, fontSize: number, fontFamily: string, fontWeight: number, lines: string[]): string {
  let chunk = ''
  for (const ch of word) {
    if (chunk && lineWidth(chunk + ch, fontSize, fontFamily, fontWeight) > maxWidth) {
      lines.push(chunk)
      chunk = ch
    } else {
      chunk += ch
    }
  }
  return chunk
}

/** Перенос текста по словам в строки шириной не более maxWidth; \n учитывается. */
export function wrapText(text: string, maxWidth: number, fontSize: number, fontFamily: string, fontWeight = 500): string[] {
  const lines: string[] = []
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word
      if (lineWidth(probe, fontSize, fontFamily, fontWeight) <= maxWidth) {
        line = probe
        continue
      }
      if (line) lines.push(line)
      line = lineWidth(word, fontSize, fontFamily, fontWeight) <= maxWidth
        ? word
        : breakWord(word, maxWidth, fontSize, fontFamily, fontWeight, lines)
    }
    lines.push(line)
  }
  return lines
}

/** Внутренние отступы узла — единый источник для layout и TopicNode. */
export function nodePad(padding: number): { padH: number; padV: number } {
  return { padH: Math.max(8, padding), padV: Math.max(6, Math.round(padding * 0.8)) }
}

export interface NodeMetrics {
  width: number
  height: number
}

export interface MeasureOpts {
  title: string
  body?: string
  fontSize: number
  fontFamily: string
  fontWeight?: number
  padH: number
  padV: number
  /** Максимальная ширина текстового содержимого до переноса. */
  maxContentWidth: number
  minWidth: number
  minHeight: number
  /** node_width пользователя: фиксированная внешняя ширина, перенос под неё. */
  fixedWidth?: number
  /** Узел с картинкой получает добавку по высоте. */
  hasImage?: boolean
}

const sizeCache = new Map<string, NodeMetrics>()

export function measureNodeSize(o: MeasureOpts): NodeMetrics {
  const fontWeight = o.fontWeight ?? 500
  const key = [o.title, o.body ?? '', o.fontSize, o.fontFamily, fontWeight, o.padH, o.padV, o.maxContentWidth, o.minWidth, o.minHeight, o.fixedWidth ?? 0, o.hasImage ? 1 : 0].join('')
  const hit = sizeCache.get(key)
  if (hit) return hit

  const contentMax = o.fixedWidth ? Math.max(40, o.fixedWidth - o.padH * 2) : o.maxContentWidth
  const headLines = wrapText(o.title || ' ', contentMax, o.fontSize, o.fontFamily, fontWeight)
  const bodyFontSize = Math.max(10, Math.round(o.fontSize * BODY_FONT_SCALE))
  const bodyLines = o.body ? wrapText(o.body, contentMax, bodyFontSize, o.fontFamily, 400) : []

  let longest = 0
  for (const l of headLines) longest = Math.max(longest, lineWidth(l, o.fontSize, o.fontFamily, fontWeight))
  for (const l of bodyLines) longest = Math.max(longest, lineWidth(l, bodyFontSize, o.fontFamily, 400))

  const width = o.fixedWidth ?? Math.max(o.minWidth, Math.ceil(Math.min(contentMax, longest) + o.padH * 2))
  const headH = headLines.length * o.fontSize * HEAD_LINE_HEIGHT
  const bodyH = bodyLines.length ? BODY_GAP + bodyLines.length * bodyFontSize * BODY_LINE_HEIGHT : 0
  const imageH = o.hasImage ? 56 : 0
  const height = Math.max(o.minHeight, Math.ceil(headH + bodyH + imageH + o.padV * 2))

  const m = { width, height }
  if (sizeCache.size > 5000) sizeCache.clear()
  sizeCache.set(key, m)
  return m
}
