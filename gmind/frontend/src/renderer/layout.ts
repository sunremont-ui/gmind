import type { Topic, LayoutNode, StructureClass } from '../types'
import { LayoutRun } from './layoutLog'
import { measureNodeSize, nodePad } from './measure'
import { shapeGrow, shapeTextInset } from './shapes'
import { topicShape } from './memoryPackages'
import { layoutRadialFamily, isRadialKind, type RadialKind } from './radialLayout'
import { resolveNodeFont } from './nodeFont'
import {
  CHILD_DIRECTIONS,
  defaultPortForDirection,
  DIRECTION_VECTORS,
  isChildDirection,
  isNodeSide,
  oppositeNodeSide,
  type NodeSide,
  type ChildDirection,
} from '../components/MindMap/nodeDirections'

/** Axis-aligned bounding box в мировых координатах. */
export interface BBox { minX: number; minY: number; maxX: number; maxY: number }

// Зазор устранения наложений: проникновение меньше этого порога (px) считаем
// касанием, а не наложением, и не трогаем. См. docs/layout-algorithm.md.
const OVERLAP_EPSILON = 1
// Sweep идёт по равномерной сетке: сравниваются только узлы соседних ячеек,
// поэтому цена ≈ O(n) и ограничение по размеру карты больше не нужно —
// раньше карты крупнее 300 узлов оставались с наложениями.
const SWEEP_PASSES = 6
// Сторона ячейки сетки: должна быть не меньше типичного узла, иначе крупный
// узел занимает слишком много ячеек.
const SWEEP_CELL = 160
// Зазор между группами разных направлений одного родителя.
const GROUP_CLEARANCE = 12

export const DEFAULT_NODE_HEIGHT = 40
export const DEFAULT_NODE_MIN_WIDTH = 60
export const DEFAULT_NODE_MAX_WIDTH = 320
export const DEFAULT_NODE_PADDING = 20
export const DEFAULT_LEVEL_GAP = 100
export const DEFAULT_SIBLING_GAP = 24
export const DEFAULT_CHILD_GAP = 16
// Space for a shared port trunk, the thickest tree stroke and its hit/hover area.
export const MIN_EDGE_CORRIDOR = 64
// Between two sibling subtrees only a single branch lane has to fit, so the
// floor here is the routing lane offset (EDGE_NODE_CLEARANCE + 10), not the
// full port corridor. Forcing MIN_EDGE_CORRIDOR here made every map airy and
// silently ignored the user's Sibling Gap setting below 64.
export const MIN_SIBLING_GAP = 24

export type Direction = 'right' | 'left' | 'down' | 'up'

export interface LayoutGaps {
  levelGap: number
  siblingGap: number
  childGap?: number
}

export function estimateTextWidth(text: string, maxChars = 30, fontSize = 14): number {
  if (!text) return DEFAULT_NODE_MIN_WIDTH
  const charsWidth = maxChars * fontSize * 0.6 + DEFAULT_NODE_PADDING
  const textWidth = text.length * 8 + DEFAULT_NODE_PADDING
  return Math.max(DEFAULT_NODE_MIN_WIDTH, Math.min(DEFAULT_NODE_MAX_WIDTH, Math.min(charsWidth, textWidth)))
}

export function buildLayout(topic: Topic, depth = 0, maxChars = 30, fontSize = 14, nodePadding = 10): LayoutNode {
  if (!topic) {
    return { topic: { id: 'unknown', title: '?' } as Topic, x: 0, y: 0, width: DEFAULT_NODE_MIN_WIDTH, height: DEFAULT_NODE_HEIGHT, children: [] }
  }
  const { size: fs, family: ff, weight: fw } = resolveNodeFont(topic, fontSize)
  // Ширина переноса выводится из настройки maxChars: пользователь по-прежнему
  // управляет тем, насколько широким станет узел до переноса строк.
  const wrapWidth = Math.max(140, Math.min(DEFAULT_NODE_MAX_WIDTH, maxChars * fs * 0.6))
  const fixedWidth = topic.node_width
    ? Math.max(DEFAULT_NODE_MIN_WIDTH, Math.min(DEFAULT_NODE_MAX_WIDTH, topic.node_width))
    : undefined
  const { padH, padV } = nodePad(topic.padding ?? nodePadding)
  const measured = measureNodeSize({
    title: topic.title || '',
    body: topic.body,
    fontSize: fs,
    fontFamily: ff,
    fontWeight: fw,
    padH,
    padV,
    maxContentWidth: wrapWidth,
    minWidth: DEFAULT_NODE_MIN_WIDTH,
    minHeight: Math.max(DEFAULT_NODE_HEIGHT, topic.node_height || 0),
    fixedWidth,
    hasImage: !!topic.image,
  })
  // Непрямоугольные формы сначала получают приблизительный grow, затем
  // уточняются по реальному textInset. Одного коэффициента недостаточно:
  // более узкий inset переносит тело на дополнительные строки, а у
  // ромба/эллипса/облака inset забирает ещё и часть высоты.
  // Форма берётся ровно та же, что нарисует TopicNode: у узла без явной
  // shape её может задать корпус вида памяти (ромб решения, гайка навыка).
  const shape = topicShape(topic)
  const grow = shapeGrow(shape)
  let width = fixedWidth ?? Math.ceil(measured.width * grow.w)
  let height = Math.ceil(measured.height * grow.h)

  for (let i = 0; i < 8; i++) {
    let inset = shapeTextInset(shape, width, height)

    // Автоматическую ширину увеличиваем до полного measured box внутри формы.
    // Явную node_width пользователя сохраняем и компенсируем высотой.
    if (!fixedWidth && inset.w < measured.width + 2) {
      width = Math.ceil(width * ((measured.width + 2) / Math.max(1, inset.w)))
      inset = shapeTextInset(shape, width, height)
    }

    // Пересчитываем реальный перенос под ширину inset, а затем расширяем
    // высоту, пока все строки вместе с padding не помещаются без overflow.
    const fitted = measureNodeSize({
      title: topic.title || '',
      body: topic.body,
      fontSize: fs,
      fontFamily: ff,
      fontWeight: fw,
      padH,
      padV,
      maxContentWidth: wrapWidth,
      minWidth: DEFAULT_NODE_MIN_WIDTH,
      minHeight: Math.max(DEFAULT_NODE_HEIGHT, topic.node_height || 0),
      fixedWidth: Math.max(40, inset.w),
      hasImage: !!topic.image,
    })
    const requiredInsetHeight = fitted.height + 2 // запас под дробный line-height браузера
    if (inset.h >= requiredInsetHeight) break
    height = Math.ceil(height * (requiredInsetHeight / Math.max(1, inset.h)))
  }
  const rawChildren = Array.isArray(topic.children) ? topic.children : []
  const children: LayoutNode[] = rawChildren
    .map(child => buildLayout(child, depth + 1, maxChars, fontSize, nodePadding))

  return {
    topic,
    x: 0,
    y: 0,
    width,
    height,
    children: children ?? [],
  }
}

export interface LayoutResult {
  root: LayoutNode
  width: number
  height: number
}

export function computeTreeLayout(
  root: LayoutNode,
  defaultStructure: StructureClass = 'mindmap',
  topicStructureMap?: Map<string, StructureClass>,
  gaps?: LayoutGaps,
): LayoutResult {
  const levelGap = Math.max(gaps?.levelGap ?? DEFAULT_LEVEL_GAP, MIN_EDGE_CORRIDOR)
  const siblingGap = Math.max(gaps?.siblingGap ?? DEFAULT_SIBLING_GAP, MIN_SIBLING_GAP)
  const childGap = gaps?.childGap ?? DEFAULT_CHILD_GAP

  const getStructure = (node: LayoutNode): StructureClass => {
    if (!node?.topic) return defaultStructure
    const topicStruct = node.topic.structure_class as StructureClass | undefined
    if (topicStruct) return topicStruct
    if (topicStructureMap?.has(node.topic.id)) {
      return topicStructureMap.get(node.topic.id)!
    }
    return defaultStructure
  }

  return computeLayout(root, getStructure, levelGap, siblingGap, childGap)
}

function ensureArray<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : []
}

function collapseDescendants(n: LayoutNode, px: number, py: number) {
  for (const child of ensureArray(n.children)) {
    child.x = px
    child.y = py
    collapseDescendants(child, px, py)
  }
}

function postProcessFolded(n: LayoutNode) {
  if (n.topic?.folded) {
    for (const child of ensureArray(n.children)) {
      child.x = n.x
      child.y = n.y
      collapseDescendants(child, n.x, n.y)
    }
  }
  for (const child of ensureArray(n.children)) {
    postProcessFolded(child)
  }
}

function shiftSubtree(n: LayoutNode, dx: number, dy: number) {
  if (dx === 0 && dy === 0) return
  for (const child of ensureArray(n.children)) {
    child.x += dx
    child.y += dy
    shiftSubtree(child, dx, dy)
  }
}

/** Сдвигает узел вместе со всем поддеревом (включая сам узел). */
export function translate(n: LayoutNode, dx: number, dy: number) {
  if (dx === 0 && dy === 0) return
  n.x += dx
  n.y += dy
  for (const child of ensureArray(n.children)) translate(child, dx, dy)
}

/**
 * Реальный bbox поддерева в текущих координатах (узел + все потомки).
 * Это ключ к упаковке без наложений: вместо эвристической «высоты поддерева»
 * мы меряем фактический габарит — он корректен даже для смешанных направлений
 * (например, потомок растёт вниз, а его сосед — вправо).
 */
function measureSubtree(n: LayoutNode): BBox {
  let minX = n.x, minY = n.y, maxX = n.x + n.width, maxY = n.y + n.height
  for (const child of ensureArray(n.children)) {
    const b = measureSubtree(child)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  return { minX, minY, maxX, maxY }
}

function computeLayout(
  root: LayoutNode,
  getStructure: (n: LayoutNode) => StructureClass,
  levelGap: number,
  siblingGap: number,
  childGap: number,
): LayoutResult {
  let minX = 0, maxX = 1200, minY = 0, maxY = 800

  const collectBounds = (n: LayoutNode) => {
    minX = Math.min(minX, n.x)
    maxX = Math.max(maxX, n.x + n.width)
    minY = Math.min(minY, n.y)
    maxY = Math.max(maxY, n.y + n.height)
    ensureArray(n.children).forEach(collectBounds)
  }

  const shiftGlobal = (n: LayoutNode, ox: number, oy: number) => {
    n.x += ox
    n.y += oy
    ensureArray(n.children).forEach(c => shiftGlobal(c, ox, oy))
  }

  const run = new LayoutRun()
  let nodeCount = 0

  const layoutRecursive = (n: LayoutNode, depth: number) => {
    nodeCount++
    const struct = getStructure(n)
    const children = ensureArray(n.children)

    // Per-node gap overrides
    const nlGap = Math.max(n.topic?.level_gap || levelGap, MIN_EDGE_CORRIDOR)
    const nsGap = Math.max(n.topic?.sibling_gap || siblingGap, MIN_SIBLING_GAP)

    if (children.length === 0) {
      n.x = 0
      n.y = 0
      return
    }

    for (let i = 0; i < children.length; i++) {
      layoutRecursive(children[i], depth + 1)
    }

    // Radial / fishbone — особые раскладки, направление per-child не применяем.
    if (struct === 'radial' || isRadialKind(struct)) {
      // 'radial' — историческое имя равносекторной раскладки.
      const kind: RadialKind = struct === 'radial' ? 'radial-even' : struct
      layoutRadialFamily(kind, n, children, { levelGap: nlGap + childGap, siblingGap: nsGap })
      run.pack(n.topic.id, kind, children.length)
    } else if (struct === 'fishbone') {
      layoutFishbone(n, children, nlGap + childGap, nsGap)
      run.pack(n.topic.id, 'fishbone', children.length)
    } else {
      // Древовидные структуры: каждый ребёнок может иметь своё направление
      // (child_dir); кто без него — идёт в направлении по умолчанию для
      // структуры родителя. Так новый ребёнок встаёт в выбранную сторону, а
      // остальные остаются там, где были.
      packDirectional(n, children, nlGap + childGap, nsGap, defaultDir(struct, n.topic?.branch_side), run)
    }
  }

  layoutRecursive(root, 0)
  postProcessFolded(root)
  run.setNodeCount(nodeCount)
  // Safety net: устранить любые оставшиеся наложения (радиал/ёлочка/смешанные).
  resolveOverlaps(root, run)
  collectBounds(root)
  const offsetX = -minX + 80
  const offsetY = -minY + 100
  shiftGlobal(root, offsetX, offsetY)
  run.finish()

  return { root, width: maxX - minX + 160, height: Math.max(maxY - minY + 200, 400) }
}

/**
 * Глобальная проверка наложений после раскладки. Основные коллизии уже
 * предотвращены упаковкой по измеренным bbox; этот проход — страховка для
 * радиальной/ёлочной раскладок, смешанных направлений и пограничных случаев.
 *
 * Двигается всегда целое поддерево, а не отдельный узел: сдвиг одного листа
 * оставлял его детей на прежнем месте и рвал ветку. Кого двигать, решают два
 * правила: предок не уступает потомку (он утащил бы его за собой), а из
 * независимых веток уступает меньшая.
 *
 * Пары-кандидаты берутся из равномерной сетки, поэтому проход линеен по числу
 * узлов и выполняется на картах любого размера (раньше карты крупнее 300
 * узлов проход пропускали и оставались с наложениями).
 */
interface SweepNode {
  node: LayoutNode
  /** Порядковый номер входа в DFS — по нему определяется родство. */
  enter: number
  exit: number
  /** Число видимых узлов в поддереве: меньшая ветка уступает большей. */
  size: number
}

function indexVisible(root: LayoutNode): SweepNode[] {
  const out: SweepNode[] = []
  let counter = 0
  const walk = (n: LayoutNode): SweepNode => {
    const enter = counter++
    const entry: SweepNode = { node: n, enter, exit: enter, size: 1 }
    out.push(entry)
    if (!n.topic?.folded) {
      for (const child of ensureArray(n.children)) {
        entry.size += walk(child).size
      }
    }
    entry.exit = counter
    return entry
  }
  walk(root)
  return out
}

function isAncestor(a: SweepNode, b: SweepNode): boolean {
  return a.enter < b.enter && b.exit <= a.exit
}

function buildSweepGrid(entries: SweepNode[]): Map<string, SweepNode[]> {
  const grid = new Map<string, SweepNode[]>()
  for (const entry of entries) {
    const n = entry.node
    const x0 = Math.floor(n.x / SWEEP_CELL)
    const x1 = Math.floor((n.x + n.width) / SWEEP_CELL)
    const y0 = Math.floor(n.y / SWEEP_CELL)
    const y1 = Math.floor((n.y + n.height) / SWEEP_CELL)
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const key = `${gx}:${gy}`
        const cell = grid.get(key)
        if (cell) cell.push(entry)
        else grid.set(key, [entry])
      }
    }
  }
  return grid
}

/**
 * Кто уступает в паре. Предок не двигается от своего потомка — он утащил бы
 * его за собой; из независимых веток уступает та, что меньше.
 */
function yieldingNode(a: SweepNode, b: SweepNode): { target: SweepNode; other: SweepNode } {
  if (isAncestor(a, b)) return { target: b, other: a }
  if (isAncestor(b, a)) return { target: a, other: b }
  return b.size < a.size ? { target: b, other: a } : { target: a, other: b }
}

/** Накопленный сдвиг узла за прогон — по нему видно, куда он уже уходит. */
type Drift = Map<string, { x: number; y: number }>

function addDrift(drift: Drift, id: string, dx: number, dy: number) {
  const d = drift.get(id)
  if (d) { d.x += dx; d.y += dy } else drift.set(id, { x: dx, y: dy })
}

function reverses(d: { x: number; y: number } | undefined, dx: number, dy: number): boolean {
  if (!d) return false
  return (dx !== 0 && d.x !== 0 && Math.sign(dx) !== Math.sign(d.x))
    || (dy !== 0 && d.y !== 0 && Math.sign(dy) !== Math.sign(d.y))
}

/**
 * Уводит поддерево target из-под ВСЕХ узлов, с которыми оно сейчас
 * пересекается, одним сдвигом. Нужен там, где парных толчков не хватает: узел,
 * зажатый между родителем и дедом, качался от одного к другому до конца
 * проходов и оставался поверх обоих. Направления, которые вернули бы узел
 * назад по его же накопленному сдвигу, из выбора исключаются — иначе качели
 * повторяются на большем шаге.
 */
function escapeAll(target: SweepNode, obstacles: LayoutNode[], run: LayoutRun, drift: Drift): boolean {
  const t = target.node
  let right = 0, left = 0, down = 0, up = 0
  let hit = 0
  for (const o of obstacles) {
    const penX = Math.min(t.x + t.width, o.x + o.width) - Math.max(t.x, o.x)
    const penY = Math.min(t.y + t.height, o.y + o.height) - Math.max(t.y, o.y)
    if (penX <= OVERLAP_EPSILON || penY <= OVERLAP_EPSILON) continue
    hit++
    run.overlap(t.topic.id, o.topic.id, { penX, penY })
    right = Math.max(right, o.x + o.width + OVERLAP_EPSILON - t.x)
    left = Math.max(left, t.x + t.width + OVERLAP_EPSILON - o.x)
    down = Math.max(down, o.y + o.height + OVERLAP_EPSILON - t.y)
    up = Math.max(up, t.y + t.height + OVERLAP_EPSILON - o.y)
  }
  if (!hit) return false

  const d = drift.get(t.topic.id)
  const options: Array<{ dx: number; dy: number; cost: number }> = [
    { dx: right, dy: 0, cost: right },
    { dx: -left, dy: 0, cost: left },
    { dx: 0, dy: down, cost: down },
    { dx: 0, dy: -up, cost: up },
  ]
  const forward = options.filter(o => !reverses(d, o.dx, o.dy))
  const pool = forward.length ? forward : options
  const best = pool.reduce((acc, o) => (o.cost < acc.cost ? o : acc))
  translate(t, best.dx, best.dy)
  addDrift(drift, t.topic.id, best.dx, best.dy)
  run.resolve(t.topic.id, best.dx, best.dy)
  return true
}

/** Узлы-кандидаты рядом с данным: соседи по ячейкам сетки, кроме его поддерева. */
function neighbours(entry: SweepNode, grid: Map<string, SweepNode[]>): LayoutNode[] {
  const n = entry.node
  const out: LayoutNode[] = []
  const seen = new Set<number>()
  const x0 = Math.floor(n.x / SWEEP_CELL)
  const x1 = Math.floor((n.x + n.width) / SWEEP_CELL)
  const y0 = Math.floor(n.y / SWEEP_CELL)
  const y1 = Math.floor((n.y + n.height) / SWEEP_CELL)
  for (let gx = x0 - 1; gx <= x1 + 1; gx++) {
    for (let gy = y0 - 1; gy <= y1 + 1; gy++) {
      const cell = grid.get(`${gx}:${gy}`)
      if (!cell) continue
      for (const other of cell) {
        if (other === entry || seen.has(other.enter)) continue
        seen.add(other.enter)
        // Потомки едут вместе с узлом — от них уходить некуда.
        if (isAncestor(entry, other)) continue
        out.push(other.node)
      }
    }
  }
  return out
}

function resolveOverlaps(root: LayoutNode, run: LayoutRun) {
  const drift: Drift = new Map()
  for (let pass = 0; pass < SWEEP_PASSES; pass++) {
    const entries = indexVisible(root)
    const grid = buildSweepGrid(entries)
    const seen = new Set<string>()
    let moved = 0
    for (const cell of grid.values()) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = cell[i]
          const b = cell[j]
          const key = a.enter < b.enter ? `${a.enter}|${b.enter}` : `${b.enter}|${a.enter}`
          if (seen.has(key)) continue
          seen.add(key)
          const na = a.node
          const nb = b.node
          const penX = Math.min(na.x + na.width, nb.x + nb.width) - Math.max(na.x, nb.x)
          const penY = Math.min(na.y + na.height, nb.y + nb.height) - Math.max(na.y, nb.y)
          if (penX <= OVERLAP_EPSILON || penY <= OVERLAP_EPSILON) continue
          run.overlap(na.topic.id, nb.topic.id, { penX, penY })

          const { target, other } = yieldingNode(a, b)
          if (target.node === root) continue
          const t = target.node
          const o = other.node

          // Обычный случай — короткий толчок по оси наименьшего проникновения.
          let dx = 0
          let dy = 0
          if (penX < penY) {
            dx = (t.x + t.width / 2 <= o.x + o.width / 2 ? -1 : 1) * (penX + OVERLAP_EPSILON)
          } else {
            dy = (t.y + t.height / 2 <= o.y + o.height / 2 ? -1 : 1) * (penY + OVERLAP_EPSILON)
          }

          if (reverses(drift.get(t.topic.id), dx, dy)) {
            // Толчок возвращает узел туда, откуда его уже двигали: значит он
            // зажат между двумя соседями — уходим сразу от всех.
            if (escapeAll(target, neighbours(target, grid), run, drift)) moved++
            continue
          }
          translate(t, dx, dy)
          addDrift(drift, t.topic.id, dx, dy)
          run.resolve(t.topic.id, dx, dy)
          moved++
        }
      }
    }
    if (moved === 0) return
  }
  run.info(`overlap sweep hit the pass limit (${SWEEP_PASSES})`)
}

// Вертикальная стопка поддеревьев по одну сторону от узла (mindmap, tree
// влево/вправо). Слоты по высоте = реальные bbox, поэтому соседние поддеревья
// не накладываются даже при разных направлениях вложенных веток.
function packVertical(
  n: LayoutNode,
  children: LayoutNode[],
  gap: number,
  siblingGap: number,
  side: 'left' | 'right',
) {
  const bounds = children.map(measureSubtree)
  const heights = bounds.map(b => b.maxY - b.minY)
  let top = 0
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const b = bounds[i]
    // По вертикали: верх поддерева → текущий «top». Слот меряем по bbox, иначе
    // соседние поддеревья налезут друг на друга.
    const dy = top - b.minY
    // По горизонтали расстояние отсчитываем от САМОГО узла, а не от габарита
    // его поддерева. Иначе ветка, растущая назад (вложенный child_dir), уносит
    // своего носителя на ширину всего поддерева — узел уезжает от родителя на
    // пол-карты вместо выбранной стороны на расстоянии levelGap.
    const dx = side === 'right'
      ? (n.width + gap) - child.x
      : -gap - (child.x + child.width)
    translate(child, dx, dy)
    top += heights[i] + siblingGap
  }
  centreOnNodes(n, children, 'y')
  n.x = 0
  n.y = 0
}

/**
 * Выравнивает группу по центрам самих узлов, а не по габаритам их поддеревьев.
 * Слоты по-прежнему нарезаны по bbox (соседи не пересекаются), но ветка с
 * широким поддеревом больше не утаскивает свой узел вбок от родителя.
 */
function centreOnNodes(n: LayoutNode, children: LayoutNode[], axis: 'x' | 'y') {
  let min = Infinity
  let max = -Infinity
  for (const child of children) {
    const centre = axis === 'y' ? child.y + child.height / 2 : child.x + child.width / 2
    if (centre < min) min = centre
    if (centre > max) max = centre
  }
  const parentCentre = axis === 'y' ? n.height / 2 : n.width / 2
  const shift = parentCentre - (min + max) / 2
  if (!shift) return
  for (const child of children) {
    translate(child, axis === 'x' ? shift : 0, axis === 'y' ? shift : 0)
  }
}

// Горизонтальная стопка поддеревьев сверху/снизу от узла (tree вверх/вниз,
// org-chart). Слоты по ширине = реальные bbox.
function packHorizontal(
  n: LayoutNode,
  children: LayoutNode[],
  gap: number,
  siblingGap: number,
  direction: 'up' | 'down',
) {
  const bounds = children.map(measureSubtree)
  const widths = bounds.map(b => b.maxX - b.minX)
  let left = 0
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const b = bounds[i]
    const dx = left - b.minX
    // См. packVertical: глубину отсчитываем от самого узла, а не от bbox.
    const dy = direction === 'down'
      ? (n.height + gap) - child.y
      : -gap - (child.y + child.height)
    translate(child, dx, dy)
    left += widths[i] + siblingGap
  }
  centreOnNodes(n, children, 'x')
  n.x = 0
  n.y = 0
}

type Dir4 = 'up' | 'down' | 'left' | 'right'

// Направление по умолчанию для детей данной структуры родителя.
function defaultDir(struct: StructureClass | string, branchSide?: string): Dir4 {
  switch (struct) {
    case 'tree-left': return 'left'
    case 'tree-up': return 'up'
    case 'tree-down':
    case 'org-chart': return 'down'
    case 'tree':
    case 'tree-right': return 'right'
    case 'mindmap':
    default: return branchSide === 'left' ? 'left' : 'right'
  }
}

function normalizeDir(d: string | undefined): ChildDirection | null {
  return isChildDirection(d) ? d : null
}

function sideUnit(side: NodeSide) {
  switch (side) {
    case 'top': return { x: 0, y: -1 }
    case 'right': return { x: 1, y: 0 }
    case 'bottom': return { x: 0, y: 1 }
    case 'left': return { x: -1, y: 0 }
  }
}

// Диагональная полоса. Поддеревья ставятся вдоль луча 45°, а несколько детей
// одного луча пакуются поперёк него по реальным bbox. Описывающие окружности
// гарантируют зазор и с родителем, и между соседними поддеревьями.
function packDiagonal(
  n: LayoutNode,
  children: LayoutNode[],
  levelGap: number,
  siblingGap: number,
  direction: 'up-left' | 'up-right' | 'down-left' | 'down-right',
) {
  const vector = DIRECTION_VECTORS[direction]
  const unit = Math.SQRT1_2
  const vx = vector.x * unit
  const vy = vector.y * unit
  const px = -vy
  const py = vx
  const bounds = children.map(measureSubtree)
  const spans = bounds.map(b =>
    Math.abs(px) * (b.maxX - b.minX) + Math.abs(py) * (b.maxY - b.minY))
  // A child must approach the opposite physical port from outside its shape.
  // Therefore siblings using the same parent port occupy one ordered side of
  // the 45-degree ray instead of being mirrored across it (which makes their
  // branch lines cross). Children moved to another port use the matching side.
  const laneSigns = children.map(child => {
    const fromSide = isNodeSide(child.topic?.parent_anchor)
      ? child.topic.parent_anchor
      : defaultPortForDirection(direction)
    const targetOutward = sideUnit(oppositeNodeSide(fromSide))
    const dot = px * targetOutward.x + py * targetOutward.y
    return dot > 0 ? -1 : 1
  })
  const totals = { '-1': 0, '1': 0 }
  for (let index = 0; index < children.length; index++) {
    const key = String(laneSigns[index]) as '-1' | '1'
    if (totals[key] > 0) totals[key] += siblingGap
    totals[key] += spans[index]
  }
  const parentRadius = Math.hypot(n.width, n.height) / 2
  const parentCx = n.width / 2
  const parentCy = n.height / 2
  // The first child sits exactly on the selected 45-degree ray. Additional
  // siblings occupy ordered one-sided lanes around it, with real subtree
  // half-spans and the configured sibling corridor between their centres.
  const used = { '-1': 0, '1': 0 }
  let hasCentralLane = false

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const sign = laneSigns[i]
    const key = String(sign) as '-1' | '1'
    let acrossMagnitude = 0
    if (!hasCentralLane) {
      hasCentralLane = true
      used['-1'] = spans[i] / 2
      used['1'] = spans[i] / 2
    } else {
      acrossMagnitude = used[key] + siblingGap + spans[i] / 2
      used[key] = acrossMagnitude + spans[i] / 2
    }
    const acrossCenter = sign * acrossMagnitude
    // Дистанция по лучу — от габарита самого узла, не его поддерева: ветка
    // должна начинаться рядом с родителем в выбранном направлении, а её
    // потомки пусть растут дальше сами. Учёт габарита поддерева здесь уносил
    // диагонального ребёнка на тысячи пикселей — «через всю карту».
    const childRadius = Math.hypot(child.width, child.height) / 2
    // Внешние полосы отходят чуть дальше по лучу, чтобы их подводящая ветка
    // проходила за спиной предыдущих соседей, а не сквозь них. Коэффициент
    // держим маленьким: он умножается на габарит соседних поддеревьев.
    const along = parentRadius + levelGap + childRadius + acrossMagnitude * 0.2
    const targetCx = parentCx + vx * along + px * acrossCenter
    const targetCy = parentCy + vy * along + py * acrossCenter
    const currentCx = child.x + child.width / 2
    const currentCy = child.y + child.height / 2
    translate(child, targetCx - currentCx, targetCy - currentCy)
  }
  n.x = 0
  n.y = 0
}

// Раскладывает детей с учётом индивидуального направления (child_dir): дети
// группируются по сторонам и каждая группа пакуется независимо. Дети без
// child_dir идут в направлении по умолчанию (dflt). Группы занимают разные
// полуплоскости/квадранты; редкие угловые наложения добивает глобальный sweep.
function packDirectional(
  n: LayoutNode,
  children: LayoutNode[],
  levelGap: number,
  siblingGap: number,
  dflt: Dir4,
  run: LayoutRun,
) {
  const groups = Object.fromEntries(
    CHILD_DIRECTIONS.map(direction => [direction, [] as LayoutNode[]]),
  ) as Record<ChildDirection, LayoutNode[]>
  for (const c of children) {
    const d = normalizeDir(c.topic?.child_dir) ?? dflt
    // Фиксируем фактическое направление: рендер рёбер берёт порт отсюда,
    // а не восстанавливает сторону по координатам.
    c.placedDir = d
    groups[d].push(c)
  }

  // Каждое направление ставит своих детей на один и тот же levelGap от узла и
  // центрирует их по собственной оси. Группы разных направлений расходятся уже
  // за счёт этого; раздувать ради развода сам levelGap значит уносить ветку
  // через всю карту, а двигать группы целиком — тем более.
  if (groups.right.length) packVertical(n, groups.right, levelGap, siblingGap, 'right')
  if (groups.left.length) packVertical(n, groups.left, levelGap, siblingGap, 'left')
  if (groups.down.length) packHorizontal(n, groups.down, levelGap, siblingGap, 'down')
  if (groups.up.length) packHorizontal(n, groups.up, levelGap, siblingGap, 'up')
  if (groups['up-left'].length) packDiagonal(n, groups['up-left'], levelGap, siblingGap, 'up-left')
  if (groups['up-right'].length) packDiagonal(n, groups['up-right'], levelGap, siblingGap, 'up-right')
  if (groups['down-left'].length) packDiagonal(n, groups['down-left'], levelGap, siblingGap, 'down-left')
  if (groups['down-right'].length) packDiagonal(n, groups['down-right'], levelGap, siblingGap, 'down-right')
  separateGroups(groups)
  n.x = 0
  n.y = 0

  const summary = CHILD_DIRECTIONS
    .filter(d => groups[d].length)
    .map(d => `${d}:${groups[d].length}`)
    .join(',')
  run.pack(n.topic.id, `dir[${summary}]`, children.length)
}

/** Единичный вектор направления (у диагоналей — нормированный). */
function dirUnit(direction: ChildDirection): { x: number; y: number } {
  const v = DIRECTION_VECTORS[direction]
  const len = Math.hypot(v.x, v.y) || 1
  return { x: v.x / len, y: v.y / len }
}

function unionBox(nodes: LayoutNode[]): BBox {
  const box = measureSubtree(nodes[0])
  for (let i = 1; i < nodes.length; i++) {
    const b = measureSubtree(nodes[i])
    if (b.minX < box.minX) box.minX = b.minX
    if (b.minY < box.minY) box.minY = b.minY
    if (b.maxX > box.maxX) box.maxX = b.maxX
    if (b.maxY > box.maxY) box.maxY = b.maxY
  }
  return box
}

function boxesClear(a: BBox, b: BBox, margin: number): boolean {
  return a.maxX + margin <= b.minX || b.maxX + margin <= a.minX
    || a.maxY + margin <= b.minY || b.maxY + margin <= a.minY
}

/**
 * Насколько нужно сдвинуть box вдоль u, чтобы он разошёлся с obstacle.
 * Для AABB достаточно развести по одной оси, поэтому берём меньший из
 * доступных вариантов. Infinity — вдоль этого направления развести нельзя.
 */
function pushToClear(box: BBox, obstacle: BBox, u: { x: number; y: number }, margin: number): number {
  if (boxesClear(box, obstacle, margin)) return 0
  let best = Infinity
  if (u.x > 0) best = Math.min(best, (obstacle.maxX + margin - box.minX) / u.x)
  if (u.x < 0) best = Math.min(best, (box.maxX + margin - obstacle.minX) / -u.x)
  if (u.y > 0) best = Math.min(best, (obstacle.maxY + margin - box.minY) / u.y)
  if (u.y < 0) best = Math.min(best, (box.maxY + margin - obstacle.minY) / -u.y)
  return best
}

function shiftBox(box: BBox, dx: number, dy: number): BBox {
  return { minX: box.minX + dx, minY: box.minY + dy, maxX: box.maxX + dx, maxY: box.maxY + dy }
}

/**
 * Группы разных направлений пакуются независимо, поэтому широкое поддерево
 * одной группы наезжало на соседнюю (например, ветка «вверх» на ветку
 * «вверх-влево»). Разводим группы вдоль их собственных направлений — так
 * выбранная сторона сохраняется, — и уступает та, которой нужен меньший сдвиг.
 */
function separateGroups(groups: Record<ChildDirection, LayoutNode[]>) {
  const dirs = CHILD_DIRECTIONS.filter(d => groups[d].length)
  if (dirs.length < 2) return
  const boxes = new Map<ChildDirection, BBox>()
  for (const d of dirs) boxes.set(d, unionBox(groups[d]))

  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const di = dirs[i]
        const dj = dirs[j]
        const bi = boxes.get(di)!
        const bj = boxes.get(dj)!
        if (boxesClear(bi, bj, GROUP_CLEARANCE)) continue
        const ui = dirUnit(di)
        const uj = dirUnit(dj)
        const ti = pushToClear(bi, bj, ui, GROUP_CLEARANCE)
        const tj = pushToClear(bj, bi, uj, GROUP_CLEARANCE)
        if (!Number.isFinite(ti) && !Number.isFinite(tj)) continue
        const [dir, unit, dist, box] = tj <= ti
          ? [dj, uj, tj, bj] as const
          : [di, ui, ti, bi] as const
        const dx = unit.x * dist
        const dy = unit.y * dist
        for (const child of groups[dir]) translate(child, dx, dy)
        boxes.set(dir, shiftBox(box, dx, dy))
        moved = true
      }
    }
    if (!moved) return
  }
}

// Радиальные раскладки живут в renderer/radialLayout.ts: там круг делится по
// угловому габариту поддерева, поэтому узлы не накладываются по построению.

function layoutFishbone(n: LayoutNode, children: LayoutNode[], levelGap: number, siblingGap: number) {
  const spineEnd = n.width
  const childCount = children.length
  if (childCount === 0) return

  for (let i = 0; i < childCount; i++) {
    const child = children[i]
    const oldX = child.x
    const oldY = child.y
    const subW = subtreeWidth(child, siblingGap)
    const isUp = i % 2 === 0
    const stagger = Math.floor(i / 2) + 1
    const xOff = -(stagger * levelGap + subW)
    const yOff = isUp
      ? -(stagger * siblingGap + child.height / 2)
      : stagger * siblingGap + child.height / 2
    child.x = xOff
    child.y = yOff - child.height / 2
    shiftSubtree(child, child.x - oldX, child.y - oldY)
  }
  n.x = spineEnd
  n.y = 0
}

function subtreeHeight(n: LayoutNode, siblingGap: number): number {
  const children = ensureArray(n.children)
  if (children.length === 0) return n.height
  let h = 0
  for (const c of children) {
    h += subtreeHeight(c, siblingGap)
  }
  h += siblingGap * (children.length - 1)
  return Math.max(n.height, h)
}

function subtreeWidth(n: LayoutNode, siblingGap: number): number {
  const nw = Math.min(n.width, 200)
  const children = ensureArray(n.children)
  if (children.length === 0) return nw
  let w = 0
  for (const c of children) {
    w += subtreeWidth(c, siblingGap)
  }
  w += siblingGap * (children.length - 1)
  return Math.max(nw, w)
}
