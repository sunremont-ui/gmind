// Радиальные раскладки: несколько видов размещения детей вокруг узла с чётким
// разделением круга и гарантией, что узлы не закрывают друг друга.
//
// Как достигается неперекрытие. Каждому поддереву сопоставляется описанная
// окружность радиуса r = hypot(w, h) / 2 вокруг его центра. Если описанные
// окружности соседей не пересекаются, то не пересекаются и сами габариты —
// при любом угле поворота. Угловой полураствор, который занимает ребёнок на
// расстоянии R, равен asin((r + gap/2) / R). Отсюда радиус подбирается так,
// чтобы сумма угловых секторов уложилась в доступный сектор круга.
//
// Прежняя радиальная раскладка ставила детей по 8 фиксированным направлениям и
// надеялась на общий проход устранения наложений. Здесь наложений не возникает
// по построению.

import type { LayoutNode } from '../types'

export type RadialKind =
  | 'radial-even'    // равные секторы: круг делится нацело на число детей
  | 'radial-packed'  // сектор пропорционален габариту ребёнка — плотно, без дыр
  | 'radial-rings'   // кольцами: что не влезло в кольцо, уходит на следующее
  | 'radial-clock'   // по «часам»: фиксированные 12 позиций циферблата
  | 'radial-sector'  // веер в заданный сектор (например 180° вправо)

export interface RadialOptions {
  /** Минимальный радиус первого кольца (обычно levelGap). */
  levelGap: number
  /** Зазор между соседями по кругу. */
  siblingGap: number
  /** Начальный угол в радианах (0 = вправо, растёт по часовой в SVG). */
  startAngle?: number
  /** Раствор сектора в радианах; по умолчанию полный круг. */
  sweep?: number
  /** Число позиций для 'radial-clock'. */
  clockSlots?: number
}

const TAU = Math.PI * 2

/** Габарит поддерева в текущих координатах. */
function subtreeBox(n: LayoutNode): { w: number; h: number; cx: number; cy: number } {
  let minX = n.x, minY = n.y, maxX = n.x + n.width, maxY = n.y + n.height
  const walk = (m: LayoutNode) => {
    if (m.x < minX) minX = m.x
    if (m.y < minY) minY = m.y
    if (m.x + m.width > maxX) maxX = m.x + m.width
    if (m.y + m.height > maxY) maxY = m.y + m.height
    for (const c of m.children ?? []) walk(c)
  }
  walk(n)
  return { w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

/** Радиус описанной окружности поддерева — безопасная оценка при любом угле. */
function guardRadius(box: { w: number; h: number }): number {
  return Math.hypot(box.w, box.h) / 2
}

/** Угловой полураствор ребёнка на расстоянии R (радианы). */
function halfAngle(guard: number, gap: number, R: number): number {
  const s = (guard + gap / 2) / R
  // s >= 1 значит «на этом радиусе ребёнок не умещается» — считаем полукруг.
  return s >= 1 ? Math.PI / 2 : Math.asin(s)
}

/**
 * Минимальный радиус, при котором сумма угловых секторов детей укладывается в
 * доступный раствор. Монотонно по R, поэтому ищем двоичным поиском.
 */
function fitRadius(guards: number[], gap: number, sweep: number, minR: number): number {
  const need = (R: number) => guards.reduce((sum, g) => sum + 2 * halfAngle(g, gap, R), 0)
  // Полный круг замкнут — на него можно уложить ровно TAU.
  const limit = Math.min(sweep, TAU)

  let lo = Math.max(minR, 1)
  if (need(lo) <= limit) return lo

  // Растим верхнюю границу, пока не влезет (радиус ограничен: сумма ~ 1/R).
  let hi = lo
  for (let i = 0; i < 40 && need(hi) > limit; i++) hi *= 2

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (need(mid) <= limit) hi = mid
    else lo = mid
  }
  return hi
}

/** Ставит центр поддерева в точку (cx, cy), сохраняя внутреннюю раскладку. */
function moveSubtreeCenterTo(child: LayoutNode, cx: number, cy: number) {
  const box = subtreeBox(child)
  const dx = cx - box.cx
  const dy = cy - box.cy
  if (dx === 0 && dy === 0) return
  const shift = (m: LayoutNode) => {
    m.x += dx
    m.y += dy
    for (const c of m.children ?? []) shift(c)
  }
  shift(child)
}

/**
 * Раскладывает детей вокруг узла выбранным способом.
 * Родитель остаётся в (0,0) — как и в остальных раскладках движка.
 */
export function layoutRadialFamily(
  kind: RadialKind,
  n: LayoutNode,
  children: LayoutNode[],
  o: RadialOptions,
) {
  n.x = 0
  n.y = 0
  if (children.length === 0) return

  // Центр родителя — начало отсчёта для углов.
  const pcx = n.width / 2
  const pcy = n.height / 2
  const gap = Math.max(0, o.siblingGap)
  const boxes = children.map(subtreeBox)
  const guards = boxes.map(guardRadius)
  // Радиус первого кольца не должен «сажать» ребёнка на родителя.
  const minR = o.levelGap + Math.max(n.width, n.height) / 2

  switch (kind) {
    case 'radial-even':
      placeEven(children, guards, gap, minR, o.startAngle ?? 0, o.sweep ?? TAU, pcx, pcy)
      return
    case 'radial-sector':
      // Веер: по умолчанию 180° вправо, симметрично оси.
      placePacked(children, guards, gap, minR,
        o.startAngle ?? -Math.PI / 2, o.sweep ?? Math.PI, pcx, pcy)
      return
    case 'radial-rings':
      placeRings(children, guards, gap, minR, o.startAngle ?? 0, o.sweep ?? TAU, pcx, pcy)
      return
    case 'radial-clock':
      placeClock(children, guards, gap, minR, o.startAngle ?? -Math.PI / 2, o.clockSlots ?? 12, pcx, pcy)
      return
    case 'radial-packed':
    default:
      placePacked(children, guards, gap, minR, o.startAngle ?? 0, o.sweep ?? TAU, pcx, pcy)
  }
}

/** Равные секторы: круг делится на n одинаковых долей. */
function placeEven(
  children: LayoutNode[], guards: number[], gap: number, minR: number,
  start: number, sweep: number, pcx: number, pcy: number,
) {
  const n = children.length
  const full = sweep >= TAU - 1e-6
  // На замкнутом круге n секторов, на открытом — n-1 промежуток между краями.
  const slot = full ? TAU / n : (n > 1 ? sweep / (n - 1) : 0)

  // Радиус диктует самый крупный ребёнок: его сектор должен вместить его целиком.
  let R = minR
  if (slot > 0) {
    const half = slot / 2
    for (const g of guards) {
      const needed = (g + gap / 2) / Math.max(Math.sin(Math.min(half, Math.PI / 2)), 1e-6)
      if (needed > R) R = needed
    }
  } else {
    R = Math.max(minR, guards[0] + gap / 2)
  }

  for (let i = 0; i < n; i++) {
    const a = start + slot * i
    moveSubtreeCenterTo(children[i], pcx + Math.cos(a) * R, pcy + Math.sin(a) * R)
  }
}

/** Плотная упаковка: сектор каждого ребёнка пропорционален его габариту. */
function placePacked(
  children: LayoutNode[], guards: number[], gap: number, minR: number,
  start: number, sweep: number, pcx: number, pcy: number,
) {
  const R = fitRadius(guards, gap, sweep, minR)
  const halves = guards.map(g => halfAngle(g, gap, R))
  const used = halves.reduce((s, h) => s + 2 * h, 0)
  const limit = Math.min(sweep, TAU)
  // Остаток раствора распределяем равномерно — дети расходятся, а не липнут.
  const slack = Math.max(0, limit - used) / children.length

  let a = start
  for (let i = 0; i < children.length; i++) {
    a += halves[i] + slack / 2
    moveSubtreeCenterTo(children[i], pcx + Math.cos(a) * R, pcy + Math.sin(a) * R)
    a += halves[i] + slack / 2
  }
}

/**
 * Шаг между кольцами. Центры двух детей на радиусах R1 и R2 удалены минимум на
 * |R2 − R1|, поэтому шаг обязан покрывать габариты обоих: и крупнейшего в
 * текущем кольце, и крупнейшего среди тех, кто ещё не размещён. Иначе большой
 * узел на внешнем кольце «сядет» на маленький с внутреннего.
 */
function ringStep(currentGuards: number[], remainingGuards: number[], gap: number): number {
  const cur = currentGuards.length ? Math.max(...currentGuards) : 0
  const next = remainingGuards.length ? Math.max(...remainingGuards) : 0
  return cur + next + gap
}

/** Кольца: заполняем кольцо, пока хватает раствора, дальше — следующее. */
function placeRings(
  children: LayoutNode[], guards: number[], gap: number, minR: number,
  start: number, sweep: number, pcx: number, pcy: number,
) {
  const limit = Math.min(sweep, TAU)
  let i = 0
  let ringIndex = 0
  let R = minR

  while (i < children.length) {
    // Сколько детей влезает в это кольцо целиком.
    let used = 0
    let count = 0
    while (i + count < children.length) {
      const need = 2 * halfAngle(guards[i + count], gap, R)
      if (count > 0 && used + need > limit) break
      used += need
      count++
    }

    const slice = children.slice(i, i + count)
    const sliceGuards = guards.slice(i, i + count)
    const halves = sliceGuards.map(g => halfAngle(g, gap, R))
    const slack = Math.max(0, limit - used) / count

    // Соседние кольца сдвинуты на полсектора — «шахматка» читается лучше.
    let a = start + (ringIndex % 2 ? limit / (count * 2) : 0)
    for (let k = 0; k < slice.length; k++) {
      a += halves[k] + slack / 2
      moveSubtreeCenterTo(slice[k], pcx + Math.cos(a) * R, pcy + Math.sin(a) * R)
      a += halves[k] + slack / 2
    }

    i += count
    ringIndex++
    R += ringStep(sliceGuards, guards.slice(i), gap)
  }
}

/** Циферблат: фиксированные позиции, при переполнении — следующий круг. */
function placeClock(
  children: LayoutNode[], guards: number[], gap: number, minR: number,
  start: number, slots: number, pcx: number, pcy: number,
) {
  const step = TAU / slots
  // Радиус подбирается так, чтобы ребёнок уместился в свою «часовую» долю.
  let R = minR
  for (const g of guards) {
    const needed = (g + gap / 2) / Math.max(Math.sin(step / 2), 1e-6)
    if (needed > R) R = needed
  }

  for (let i = 0; i < children.length; i++) {
    const slot = i % slots
    if (i > 0 && slot === 0) {
      R += ringStep(guards.slice(i - slots, i), guards.slice(i), gap)
    }
    const a = start + step * slot
    moveSubtreeCenterTo(children[i], pcx + Math.cos(a) * R, pcy + Math.sin(a) * R)
  }
}

/** Является ли структура радиальной — для ветвления в движке раскладки. */
export function isRadialKind(struct: string): struct is RadialKind {
  return struct === 'radial-even' || struct === 'radial-packed'
    || struct === 'radial-rings' || struct === 'radial-clock'
    || struct === 'radial-sector'
}

/** Описания для UI-выбора раскладки. */
export const RADIAL_KINDS: Array<{ id: RadialKind; label: string; hint: string }> = [
  { id: 'radial-even', label: 'Радиально: равные секторы',
    hint: 'Круг делится нацело на число детей — строгая симметрия.' },
  { id: 'radial-packed', label: 'Радиально: плотно',
    hint: 'Сектор пропорционален размеру ветки — компактно, без пустот.' },
  { id: 'radial-rings', label: 'Радиально: кольцами',
    hint: 'Что не влезло в кольцо, уходит на следующее. Для большого числа детей.' },
  { id: 'radial-clock', label: 'Радиально: циферблат',
    hint: 'Фиксированные 12 позиций — узлы всегда на «часах».' },
  { id: 'radial-sector', label: 'Радиально: веер 180°',
    hint: 'Дети раскрываются в полукруг вправо.' },
]
