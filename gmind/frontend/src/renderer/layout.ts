import type { Topic, LayoutNode, StructureClass } from '../types'

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

  const layoutRecursive = (n: LayoutNode, depth: number) => {
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

    switch (struct) {
      case 'org-chart':
      case 'tree-down':
        layoutTreeVertical(n, children, 'down', nsGap, nlGap + childGap)
        break
      case 'tree-up':
        layoutTreeVertical(n, children, 'up', nsGap, nlGap + childGap)
        break
      case 'tree':
      case 'tree-right':
        layoutTreeHorizontal(n, children, 'right', nsGap, nlGap + childGap)
        break
      case 'tree-left':
        layoutTreeHorizontal(n, children, 'left', nsGap, nlGap + childGap)
        break
      case 'radial':
        layoutRadial(n, children, nlGap + childGap, nsGap)
        break
      case 'fishbone':
        layoutFishbone(n, children, nlGap + childGap, nsGap)
        break
      case 'mindmap':
      default:
        layoutMindMap(n, children, nlGap + childGap, nsGap)
        break
    }
  }

  layoutRecursive(root, 0)
  postProcessFolded(root)
  collectBounds(root)
  const offsetX = -minX + 80
  const offsetY = -minY + 100
  shiftGlobal(root, offsetX, offsetY)

  return { root, width: maxX - minX + 160, height: Math.max(maxY - minY + 200, 400) }
}

function layoutMindMap(n: LayoutNode, children: LayoutNode[], levelGap: number, siblingGap: number) {
  const childHeights: number[] = []
  let totalHeight = 0
  const branchSide = n.topic.branch_side || 'auto'

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const subTreeHeight = subtreeHeight(child, siblingGap)
    childHeights.push(subTreeHeight)
    totalHeight += subTreeHeight
  }
  totalHeight += siblingGap * (children.length - 1)

  const isLeft = branchSide === 'left'

  let currentY = -totalHeight / 2
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const oldX = child.x
    const oldY = child.y
    child.y = currentY + childHeights[i] / 2
    child.x = isLeft
      ? -(child.width + levelGap)
      : n.width + levelGap
    shiftSubtree(child, child.x - oldX, child.y - oldY)
    currentY += childHeights[i] + siblingGap
  }
  n.x = 0
  n.y = 0
}

function layoutTreeVertical(n: LayoutNode, children: LayoutNode[], direction: Direction, siblingGap: number, levelGap: number) {
  const childWidths: number[] = []
  let totalWidth = 0

  for (let i = 0; i < children.length; i++) {
    const w = subtreeWidth(children[i], siblingGap)
    childWidths.push(w)
    totalWidth += w
  }
  totalWidth += siblingGap * (children.length - 1)

  const isDown = direction === 'down'
  let currentX = -totalWidth / 2
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const oldX = child.x
    const oldY = child.y
    child.x = currentX + childWidths[i] / 2 - child.width / 2
    child.y = isDown
      ? n.height + levelGap
      : -(child.height + levelGap)
    shiftSubtree(child, child.x - oldX, child.y - oldY)
    currentX += childWidths[i] + siblingGap
  }
  n.x = 0
  n.y = 0
}

function layoutTreeHorizontal(n: LayoutNode, children: LayoutNode[], direction: Direction, siblingGap: number, levelGap: number) {
  const childHeights: number[] = []
  let totalHeight = 0

  for (let i = 0; i < children.length; i++) {
    const h = subtreeHeight(children[i], siblingGap)
    childHeights.push(h)
    totalHeight += h
  }
  totalHeight += siblingGap * (children.length - 1)

  const isRight = direction === 'right'
  let currentY = -totalHeight / 2
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const oldX = child.x
    const oldY = child.y
    child.y = currentY + childHeights[i] / 2
    child.x = isRight
      ? n.width + levelGap
      : -(child.width + levelGap)
    shiftSubtree(child, child.x - oldX, child.y - oldY)
    currentY += childHeights[i] + siblingGap
  }
  n.x = 0
  n.y = 0
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
