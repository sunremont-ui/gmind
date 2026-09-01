// Формы узлов: единый реестр, из которого берут и рендер (SVG path),
// и layout (насколько форму нужно раздуть, чтобы текст влез),
// и панель свойств (список для выбора).
//
// Все пути строятся в локальных координатах узла: (0,0) — левый верхний угол
// bounding box, (w,h) — правый нижний. Голова и тело узла живут внутри
// textInset — прямоугольника, гарантированно лежащего внутри формы.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface ShapeDef {
  id: string
  label: string
  /** Контур формы для box w×h; r — базовый радиус скругления темы. */
  path: (w: number, h: number, r: number) => string
  /**
   * Во сколько раз нужно увеличить box, чтобы текст той же длины поместился
   * внутрь непрямоугольной формы (ромб/эллипс сильно срезают углы).
   */
  grow: { w: number; h: number }
  /** Прямоугольник под текст внутри формы (доли от w/h). */
  textInset?: (w: number, h: number) => Rect
}

export const DEFAULT_SHAPE = 'rounded'

function roundedRect(w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (rr <= 0) return `M0,0 H${w} V${h} H0 Z`
  return [
    `M${rr},0`,
    `H${w - rr}`,
    `A${rr},${rr} 0 0 1 ${w},${rr}`,
    `V${h - rr}`,
    `A${rr},${rr} 0 0 1 ${w - rr},${h}`,
    `H${rr}`,
    `A${rr},${rr} 0 0 1 0,${h - rr}`,
    `V${rr}`,
    `A${rr},${rr} 0 0 1 ${rr},0`,
    'Z',
  ].join(' ')
}

const num = (v: number) => Math.round(v * 100) / 100

export const NODE_SHAPES: ShapeDef[] = [
  {
    id: 'rounded',
    label: 'Скруглённый',
    path: (w, h, r) => roundedRect(w, h, r),
    grow: { w: 1, h: 1 },
  },
  {
    id: 'rectangle',
    label: 'Прямоугольник',
    path: (w, h) => roundedRect(w, h, 0),
    grow: { w: 1, h: 1 },
  },
  {
    id: 'pill',
    label: 'Капсула',
    path: (w, h) => roundedRect(w, h, Math.min(w, h) / 2),
    grow: { w: 1.12, h: 1 },
    textInset: (w, h) => ({ x: num(h * 0.16), y: 0, w: num(w - h * 0.32), h }),
  },
  {
    id: 'ellipse',
    label: 'Эллипс',
    path: (w, h) => {
      const rx = num(w / 2)
      const ry = num(h / 2)
      return `M0,${ry} A${rx},${ry} 0 0 1 ${num(w)},${ry} A${rx},${ry} 0 0 1 0,${ry} Z`
    },
    grow: { w: 1.3, h: 1.25 },
    textInset: (w, h) => ({ x: num(w * 0.15), y: num(h * 0.13), w: num(w * 0.7), h: num(h * 0.74) }),
  },
  {
    id: 'diamond',
    label: 'Ромб',
    path: (w, h) => `M${num(w / 2)},0 L${num(w)},${num(h / 2)} L${num(w / 2)},${num(h)} L0,${num(h / 2)} Z`,
    grow: { w: 1.6, h: 1.5 },
    textInset: (w, h) => ({ x: num(w * 0.22), y: num(h * 0.2), w: num(w * 0.56), h: num(h * 0.6) }),
  },
  {
    id: 'triangle',
    label: 'Треугольник',
    path: (w, h) => `M${num(w / 2)},0 L${num(w)},${num(h)} L0,${num(h)} Z`,
    // Треугольник срезает текст сильнее всех форм: узкая вершина оставляет
    // под текст только нижнюю часть, поэтому box растёт заметно.
    grow: { w: 1.9, h: 1.75 },
    textInset: (w, h) => ({ x: num(w * 0.25), y: num(h * 0.44), w: num(w * 0.5), h: num(h * 0.54) }),
  },
  {
    id: 'hexagon',
    label: 'Шестиугольник',
    path: (w, h) => {
      const cut = num(Math.min(w * 0.18, h / 2))
      return `M${cut},0 H${num(w - cut)} L${num(w)},${num(h / 2)} L${num(w - cut)},${num(h)} H${cut} L0,${num(h / 2)} Z`
    },
    grow: { w: 1.25, h: 1 },
    textInset: (w, h) => {
      const cut = num(Math.min(w * 0.18, h / 2))
      return { x: cut, y: 0, w: num(w - cut * 2), h }
    },
  },
  {
    id: 'parallelogram',
    label: 'Параллелограмм',
    path: (w, h) => {
      const skew = num(Math.min(w * 0.16, h * 0.6))
      return `M${skew},0 H${num(w)} L${num(w - skew)},${num(h)} H0 Z`
    },
    grow: { w: 1.2, h: 1 },
    textInset: (w, h) => {
      const skew = num(Math.min(w * 0.16, h * 0.6))
      return { x: skew, y: 0, w: num(w - skew * 2), h }
    },
  },
  {
    id: 'note',
    label: 'Лист',
    path: (w, h) => {
      const fold = num(Math.min(16, w * 0.25, h * 0.5))
      return `M0,0 H${num(w - fold)} L${num(w)},${fold} V${num(h)} H0 Z`
    },
    grow: { w: 1.08, h: 1 },
    textInset: (w, h) => {
      const fold = num(Math.min(16, w * 0.25, h * 0.5))
      return { x: 0, y: 0, w: num(w - fold), h }
    },
  },
  {
    id: 'cloud',
    label: 'Облако',
    path: (w, h) =>
      [
        `M${num(w * 0.2)},${num(h)}`,
        `C${num(-w * 0.15)},${num(h * 0.85)} ${num(-w * 0.1)},${num(h * 0.15)} ${num(w * 0.25)},${num(h * 0.15)}`,
        `C${num(w * 0.25)},${num(-h * 0.2)} ${num(w * 0.75)},${num(-h * 0.2)} ${num(w * 0.8)},${num(h * 0.15)}`,
        `C${num(w * 1.15)},${num(h * 0.1)} ${num(w * 1.2)},${num(h * 0.85)} ${num(w * 0.8)},${num(h)}`,
        'Z',
      ].join(' '),
    grow: { w: 1.1, h: 1.15 },
    textInset: (w, h) => ({ x: num(w * 0.08), y: num(h * 0.18), w: num(w * 0.84), h: num(h * 0.7) }),
  },
]

const BY_ID = new Map(NODE_SHAPES.map(s => [s.id, s]))

/** Определение формы; неизвестный id (старый файл, чужой импорт) → скруглённый. */
export function shapeDef(shape: string | undefined): ShapeDef {
  return BY_ID.get(shape || DEFAULT_SHAPE) ?? BY_ID.get(DEFAULT_SHAPE)!
}

export function shapePath(shape: string | undefined, w: number, h: number, r: number): string {
  return shapeDef(shape).path(Math.max(1, w), Math.max(1, h), r)
}

/** Коэффициенты роста box под форму — используются в layout при измерении узла. */
export function shapeGrow(shape: string | undefined): { w: number; h: number } {
  return shapeDef(shape).grow
}

/** Прямоугольник под текст внутри формы (до вычета внутренних отступов узла). */
export function shapeTextInset(shape: string | undefined, w: number, h: number): Rect {
  const def = shapeDef(shape)
  if (!def.textInset) return { x: 0, y: 0, w, h }
  const r = def.textInset(w, h)
  // Форма может оказаться меньше своей врезки на крошечных узлах — страхуемся.
  return {
    x: Math.max(0, Math.min(r.x, w)),
    y: Math.max(0, Math.min(r.y, h)),
    w: Math.max(1, Math.min(r.w, w)),
    h: Math.max(1, Math.min(r.h, h)),
  }
}
