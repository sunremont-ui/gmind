import type { Topic, LayoutNode, StructureClass } from '../types'
import { LayoutRun } from './layoutLog'

/** Axis-aligned bounding box в мировых координатах. */
export interface BBox { minX: number; minY: number; maxX: number; maxY: number }

// Зазор устранения наложений: проникновение меньше этого порога (px) считаем
// касанием, а не наложением, и не трогаем. См. docs/layout-algorithm.md.
const OVERLAP_EPSILON = 1
// Глобальный sweep — O(n²); на очень больших картах пропускаем ради скорости.
const SWEEP_MAX_NODES = 300
const SWEEP_PASSES = 4

export const DEFAULT_NODE_HEIGHT = 40
export const DEFAULT_NODE_MIN_WIDTH = 60
export const DEFAULT_NODE_MAX_WIDTH = 200
export const DEFAULT_NODE_PADDING = 20
export const DEFAULT_LEVEL_GAP = 100
export const DEFAULT_SIBLING_GAP = 24
export const DEFAULT_CHILD_GAP = 16

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

export function buildLayout(topic: Topic, depth = 0, maxChars = 30, fontSize = 14): LayoutNode {
  if (!topic) {
    return { topic: { id: 'unknown', title: '?' } as Topic, x: 0, y: 0, width: DEFAULT_NODE_MIN_WIDTH, height: DEFAULT_NODE_HEIGHT, children: [] }
  }
  const customWidth = topic.node_width ? Math.max(DEFAULT_NODE_MIN_WIDTH, Math.min(DEFAULT_NODE_MAX_WIDTH, topic.node_width)) : 0
  const width = customWidth || estimateTextWidth(topic.title, maxChars, fontSize)
  const rawChildren = Array.isArray(topic.children) ? topic.children : []
  const children: LayoutNode[] = rawChildren
    .map(child => buildLayout(child, depth + 1, maxChars, fontSize))

  return {
    topic,
    x: 0,
    y: 0,
    width,
    height: topic.node_height || DEFAULT_NODE_HEIGHT,
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
  const levelGap = gaps?.levelGap ?? DEFAULT_LEVEL_GAP
  const siblingGap = gaps?.siblingGap ?? DEFAULT_SIBLING_GAP
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
function translate(n: LayoutNode, dx: number, dy: number) {
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
    const nlGap = n.topic?.level_gap || levelGap
    const nsGap = n.topic?.sibling_gap || siblingGap

    if (children.length === 0) {
      n.x = 0
      n.y = 0
      return
    }

    for (let i = 0; i < children.length; i++) {
      layoutRecursive(children[i], depth + 1)
    }

    // Radial / fishbone — особые раскладки, направление per-child не применяем.
    if (struct === 'radial') {
      layoutRadial(n, children, nlGap + childGap, nsGap)
      run.pack(n.topic.id, 'radial', children.length)
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
 * радиальной/ёлочной раскладок и пограничных случаев. Двигаем только листья
 * (или свёрнутые узлы), чтобы не рвать связи поддеревьев.
 */
function resolveOverlaps(root: LayoutNode, run: LayoutRun) {
  const visible: LayoutNode[] = []
  const collect = (n: LayoutNode) => {
    visible.push(n)
    if (n.topic?.folded) return // дети свёрнуты на родителя — не считаем
    for (const c of ensureArray(n.children)) collect(c)
  }
  collect(root)

  if (visible.length > SWEEP_MAX_NODES) {
    run.info(`overlap sweep skipped (${visible.length} > ${SWEEP_MAX_NODES} nodes)`)
    return
  }

  const isMovable = (n: LayoutNode) => n.topic?.folded || ensureArray(n.children).length === 0

  for (let pass = 0; pass < SWEEP_PASSES; pass++) {
    let moved = 0
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i]
        const b = visible[j]
        const penX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const penY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        if (penX <= OVERLAP_EPSILON || penY <= OVERLAP_EPSILON) continue // нет наложения

        run.overlap(a.topic.id, b.topic.id, { penX, penY })

        // Двигаем подвижный (лист/свёрнутый). Если оба неподвижны — пропускаем.
        const target = isMovable(b) ? b : isMovable(a) ? a : null
        if (!target) continue
        const other = target === b ? a : b

        // Сдвиг по оси наименьшего проникновения, прочь от центра соседа.
        let dx = 0, dy = 0
        if (penX < penY) {
          const ac = target.x + target.width / 2
          const oc = other.x + other.width / 2
          dx = (ac <= oc ? -1 : 1) * (penX + OVERLAP_EPSILON)
        } else {
          const ac = target.y + target.height / 2
          const oc = other.y + other.height / 2
          dy = (ac <= oc ? -1 : 1) * (penY + OVERLAP_EPSILON)
        }
        translate(target, dx, dy)
        run.resolve(target.topic.id, dx, dy)
        moved++
      }
    }
    if (moved === 0) break
  }
}

// Вертикальная стопка поддеревьев по одну сторону от узла (mindmap, tree
// влево/вправо). Слоты по высоте = реальные bbox, поэтому соседние поддеревья
// не накладываются даже при разных направлениях вложенных веток.
function packVertical(n: LayoutNode, children: LayoutNode[], levelGap: number, siblingGap: number, side: 'left' | 'right') {
  const bounds = children.map(measureSubtree)
  const heights = bounds.map(b => b.maxY - b.minY)
  let totalHeight = siblingGap * (children.length - 1)
  for (const h of heights) totalHeight += h

  let top = -totalHeight / 2
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const b = bounds[i]
    // По вертикали: верх поддерева → текущий «top».
    const dy = top - b.minY
    // По горизонтали: прижать поддерево к нужной стороне на расстоянии levelGap.
    const dx = side === 'right'
      ? (n.width + levelGap) - b.minX
      : -levelGap - b.maxX
    translate(child, dx, dy)
    top += heights[i] + siblingGap
  }
  n.x = 0
  n.y = 0
}

// Горизонтальная стопка поддеревьев сверху/снизу от узла (tree вверх/вниз,
// org-chart). Слоты по ширине = реальные bbox.
function packHorizontal(n: LayoutNode, children: LayoutNode[], levelGap: number, siblingGap: number, direction: 'up' | 'down') {
  const bounds = children.map(measureSubtree)
  const widths = bounds.map(b => b.maxX - b.minX)
  let totalWidth = siblingGap * (children.length - 1)
  for (const w of widths) totalWidth += w

  let left = -totalWidth / 2
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const b = bounds[i]
    const dx = left - b.minX
    const dy = direction === 'down'
      ? (n.height + levelGap) - b.minY
      : -levelGap - b.maxY
    translate(child, dx, dy)
    left += widths[i] + siblingGap
  }
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

function normalizeDir(d: string | undefined): Dir4 | null {
  return d === 'up' || d === 'down' || d === 'left' || d === 'right' ? d : null
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
  const groups: Record<Dir4, LayoutNode[]> = { up: [], down: [], left: [], right: [] }
  for (const c of children) {
    const d = normalizeDir(c.topic?.child_dir) ?? dflt
    groups[d].push(c)
  }

  if (groups.right.length) packVertical(n, groups.right, levelGap, siblingGap, 'right')
  if (groups.left.length) packVertical(n, groups.left, levelGap, siblingGap, 'left')
  if (groups.down.length) packHorizontal(n, groups.down, levelGap, siblingGap, 'down')
  if (groups.up.length) packHorizontal(n, groups.up, levelGap, siblingGap, 'up')
  n.x = 0
  n.y = 0

  const summary = (['up', 'down', 'left', 'right'] as Dir4[])
    .filter(d => groups[d].length)
    .map(d => `${d}:${groups[d].length}`)
    .join(',')
  run.pack(n.topic.id, `dir[${summary}]`, children.length)
}

function layoutRadial(n: LayoutNode, children: LayoutNode[], levelGap: number, siblingGap: number) {
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: 0.707, dy: 0.707 },
    { dx: 0, dy: 1 },
    { dx: -0.707, dy: 0.707 },
    { dx: -1, dy: 0 },
    { dx: -0.707, dy: -0.707 },
    { dx: 0, dy: -1 },
    { dx: 0.707, dy: -0.707 },
  ]
  const childCount = children.length
  if (childCount === 0) return

  for (let i = 0; i < childCount; i++) {
    const child = children[i]
    const dirIdx = i % 8
    const ring = Math.floor(i / 8)
    const { dx, dy } = dirs[dirIdx]

    const subW = subtreeWidth(child, siblingGap)
    const subH = subtreeHeight(child, siblingGap)
    const dist = levelGap + Math.max(subW, subH) / 2 + ring * 60

    const oldX = child.x
    const oldY = child.y
    const cx = dx * dist
    const cy = dy * dist
    child.x = cx - child.width / 2
    child.y = cy - child.height / 2
    shiftSubtree(child, child.x - oldX, child.y - oldY)
  }
  n.x = 0
  n.y = 0
}

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
