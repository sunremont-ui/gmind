# Реализация: Многонаправленная раскладка дерева

## Структура

### 1. Direction — направление роста
```typescript
export type Direction = 'right' | 'left' | 'down' | 'up'
```

### 2. StructureClass — расширение (types/index.ts:44)
```typescript
export type StructureClass = 'mindmap' | 'org-chart' | 'fishbone' | 'tree'
  | 'tree-right' | 'tree-left' | 'tree-down' | 'tree-up' | 'radial'
```
Совместимость: `'tree'` = `'tree-right'`, `'org-chart'` = `'tree-down'`.

### 3. Маппинг алгоритмов

| StructureClass | Функция | Direction | Siblings |
|---|---|---|---|
| `mindmap` | `layoutMindMap` | right/left(branch_side) | stack |
| `tree` / `tree-right` | `layoutTreeHorizontal` | right | stack |
| `tree-left` | `layoutTreeHorizontal` | left | stack |
| `org-chart` / `tree-down` | `layoutTreeVertical` | down | рядом |
| `tree-up` | `layoutTreeVertical` | up | рядом |
| `radial` | `layoutRadial` | 8dir | polar |

## layout.ts — изменения

### Добавить Direction
```typescript
export type Direction = 'right' | 'left' | 'down' | 'up'
```

### `layoutTreeVertical` — замена `layoutOrgChart`
```typescript
function layoutTreeVertical(n: LayoutNode, children: LayoutNode[], direction: Direction, siblingGap: number, levelGap: number) {
  const childWidths: number[] = []
  let totalWidth = 0
  for (const child of children) {
    const w = subtreeWidth(child, siblingGap)
    childWidths.push(w)
    totalWidth += w
  }
  totalWidth += siblingGap * (children.length - 1)
  const isDown = direction === 'down'
  let currentX = -totalWidth / 2
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const oldX = child.x, oldY = child.y
    child.x = currentX + childWidths[i] / 2 - child.width / 2
    child.y = isDown ? n.height + levelGap : -(child.height + levelGap)
    shiftSubtree(child, child.x - oldX, child.y - oldY)
    currentX += childWidths[i] + siblingGap
  }
  n.x = 0; n.y = 0
}
```

### `layoutTreeHorizontal` — добавить direction
```typescript
function layoutTreeHorizontal(n: LayoutNode, children: LayoutNode[], direction: Direction, siblingGap: number, levelGap: number) {
  const childHeights: number[] = []
  let totalHeight = 0
  for (const child of children) {
    const h = subtreeHeight(child, siblingGap)
    childHeights.push(h)
    totalHeight += h
  }
  totalHeight += siblingGap * (children.length - 1)
  const isRight = direction === 'right'
  let currentY = -totalHeight / 2
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const oldX = child.x, oldY = child.y
    child.y = currentY + childHeights[i] / 2
    child.x = isRight ? n.width + levelGap : -(child.width + levelGap)
    shiftSubtree(child, child.x - oldX, child.y - oldY)
    currentY += childHeights[i] + siblingGap
  }
  n.x = 0; n.y = 0
}
```

### `layoutRecursive` — switch
```typescript
switch (struct) {
  case 'org-chart': case 'tree-down':
    layoutTreeVertical(n, children, 'down', siblingGap, childGap); break
  case 'tree-up':
    layoutTreeVertical(n, children, 'up', siblingGap, childGap); break
  case 'tree': case 'tree-right':
    layoutTreeHorizontal(n, children, 'right', siblingGap, levelGap); break
  case 'tree-left':
    layoutTreeHorizontal(n, children, 'left', siblingGap, levelGap); break
  case 'radial':
    layoutRadial(n, children, levelGap, siblingGap); break
  case 'mindmap': default:
    layoutMindMap(n, children, levelGap, siblingGap); break
}
```

### Удалить
- `layoutOrgChart` — заменена на `layoutTreeVertical`

## Collapse Animation

При `topic.folded = true`:
1. `buildLayout` сохраняет всех children в LayoutNode tree (не фильтрует)
2. `postProcessFolded()` коллапсирует children к позиции parent после `layoutRecursive`
3. `collapseDescendants()` рекурсивно сдвигает всех потомков к той же позиции
4. `MindMapRenderer` передаёт `parentFolded` prop в `TopicNode`
5. `TopicNode` при `parentFolded` → `opacity: 0` + `pointer-events: none`
6. CSS transition `transform 0.25s ease, opacity 0.15s ease` анимирует появление/исчезновение
7. `collectEdges` пропускает рендер линий к folded поддеревьям

## Per-node Spacing Override

Каждый топик может переопределить глобальные gaps:
- `topic.level_gap` (number, optional) — заменяет `levelGap` для layout этого узла
- `topic.sibling_gap` (number, optional) — заменяет `siblingGap` для layout этого узла

В `layoutRecursive`:
```typescript
const nlGap = n.topic?.level_gap || levelGap
const nsGap = n.topic?.sibling_gap || siblingGap
// используются nlGap и nsGap вместо глобальных
```

UI: PropertiesPanel → Advanced → Level Gap / Sibling Gap (number input, placeholder "default")

## Порядок выполнения

1. **types/index.ts** — расширить `StructureClass`
2. **layout.ts** — Direction, layoutTreeVertical, layoutTreeHorizontal(direction), layoutRecursive, удалить layoutOrgChart
3. **MindMap.tsx** — контекстное меню (Tree Right, Tree Left, Tree Down, Tree Up)
4. Проверка: tsc, dev-сервер, ручное тестирование

## Проверка

- `tree-right`: root слева, дети справа, siblings стопкой
- `tree-left`: root справа, дети слева — зеркало
- `tree-down`: root сверху, дети снизу, siblings рядом (= org-chart)
- `tree-up`: root снизу, дети сверху — перевёрнутый org-chart
- Смешанный layout: родитель `tree-right`, ребёнок `tree-up`
- `mindmap` и `radial` не сломаны
- Collapse animation: дети плавно исчезают/появляются, линии пропадают
- Per-node spacing: Level Gap и Sibling Gap в PropertiesPanel переопределяют глобальные
