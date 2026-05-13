# Layout Engine

Gmind использует собственный SVG layout engine, вдохновлённый Snowbrush от XMind. Алгоритм вычисляет абсолютные координаты для каждого узла, затем рендерит через SVG `<g transform="translate(x,y)">`.

## Architecture

```
Topic tree → buildLayout() → LayoutNode tree (x=0, y=0, все children включая folded)
                            → computeTreeLayout() → LayoutNode tree (с координатами)
                                ├── layoutRecursive() — рекурсивная раскладка
                                ├── postProcessFolded() — коллапс folded subtrees к parent
                                ├── collectBounds() — вычисление границ
                                └── shiftGlobal() — сдвиг в положительную область
                                                   → SVG renderer (MindMapRenderer)
```

## Файлы

- `frontend/src/renderer/layout.ts` — построение дерева + расчёт координат
- `frontend/src/renderer/renderer.tsx` — SVG рендеринг
- `frontend/src/components/MindMap/TopicNode.tsx` — отрисовка одной ноды

## Этапы вычисления

### 1. buildLayout(topic)
Обходит дерево `Topic`, создаёт `LayoutNode[]` с начальными `x=0, y=0`.
Вычисляет `width` по длине текста (estimateTextWidth).
Не фильтрует по `folded` — все children включаются в LayoutNode tree (фильтрация происходит позже, в `postProcessFolded`).

### 2. computeTreeLayout(root)
Вызывает `computeLayout()`, который:

#### Фаза 1: Рекурсивная раскладка (layoutRecursive)
Для каждого узла:
- Если лист: `x=0, y=0`
- Если есть дети: раскладывает детей рекурсивно, затем применяет layout-алгоритм

#### Фаза 1.5: Collapse folded subtrees (postProcessFolded)
Обходит дерево после раскладки. Для каждого узла с `topic.folded=true`:
- Устанавливает всех прямых детей на позицию родителя (`child.x = n.x, child.y = n.y`)
- Рекурсивно коллапсирует всех потомков (`collapseDescendants`) к той же позиции
- Это обеспечивает плавную анимацию: при сворачивании дети через CSS transition перемещаются с computed-позиции на позицию родителя, при разворачивании — обратно

#### Фаза 2: Сбор границ (collectBounds)
Обходит всё дерево, вычисляет `minX, maxX, minY, maxY`.

#### Фаза 3: Сдвиг (shiftGlobal)
Сдвигает всё дерево на `(offsetX, offsetY)` так, чтобы верхний левый угол был в (80, 100).

### 3. Коррекция при перепозиционировании
Когда layout-алгоритм перемещает дочернюю ноду, все её потомки сдвигаются на ту же дельту через `shiftSubtree(child, dx, dy)`. Это гарантирует, что поддерево не «разваливается» при перепозиционировании родителя.

## Алгоритмы раскладки

### MindMap (по умолчанию)

Центральный root topic, дочерние узлы располагаются справа, вертикально центрируются.

```
          [Child A]
         /
[Root] ——— [Child B]
         \
          [Child C]
```

**Расчёт:**
1. Для каждого ребёнка рекурсивно вычислить высоту поддерева через `subtreeHeight()`
2. Общая высота = сумма высот детей + отступы между ними
3. Дети располагаются вертикально от `-totalHeight/2` до `+totalHeight/2`
4. Все дети на `x = levelGap` от родителя (настраивается, по умолчанию 100px)

### Org-Chart / Tree-Down

Иерархическая раскладка сверху вниз. Синоним: `tree-down`.

```
         [Root]
      /    |    \
    [A]   [B]   [C]
    / \         / \
  [A1][A2]    [C1][C2]
```

### Tree / Tree-Right

Горизонтальная раскладка слева направо (как дерево директорий). Синоним: `tree`.

```
[Root] —— [A] —— [A1]
        —— [B] —— [B1]
                —— [B2]
```

### Tree-Left

Зеркало Tree-Right: root справа, дети слева.

```
[A1] —— [A] —— [Root]
[B] —— [B1]
       [B2]
```

### Tree-Up

Перевёрнутый org-chart: root снизу, дети растут вверх.

```
[A]   [B]
 \   /
 [Root]
```

### Fishbone (Ishikawa)

Root-эффект справа, причины чередуются по диагонали вверх/вниз от позвоночника.

```
        [Cause1]
                 \
          [Cause2]—— [Root Effect]
                           /
                 [Cause3]—— [Cause4]
```

## Direction (направление роста)

Каждый алгоритм (кроме radial) использует параметр `direction: 'right' | 'left' | 'down' | 'up'`:

| Direction | Ось | Siblings | Где применяется |
|---|---|---|---|
| `right` | X | Вертикально (stack) | `tree-right`, `tree`, `mindmap` |
| `left` | X | Вертикально (stack) | `tree-left` |
| `down` | Y | Горизонтально (рядом) | `tree-down`, `org-chart` |
| `up` | Y | Горизонтально (рядом) | `tree-up` |

### Маппинг алгоритмов

| StructureClass | Функция | Direction | Siblings |
|---|---|---|---|
| `mindmap` | `layoutMindMap` | right/left(branch_side) | stack |
| `tree` / `tree-right` | `layoutTreeHorizontal` | right | stack |
| `tree-left` | `layoutTreeHorizontal` | left | stack |
| `org-chart` / `tree-down` | `layoutTreeVertical` | down | рядом |
| `tree-up` | `layoutTreeVertical` | up | рядом |
| `radial` | `layoutRadial` | 8dir | polar |
| `fishbone` | `layoutFishbone` | alternating | diagonal |

## Параметры (дефолтные)

| Параметр | Дефолт | Описание |
|---|---|---|
| DEFAULT_NODE_HEIGHT | 40px | Высота узла (можно переопределить через `topic.node_height`) |
| DEFAULT_NODE_MIN_WIDTH | 60px | Минимальная ширина |
| DEFAULT_NODE_PADDING | 20px | Внутренний отступ текста |
| DEFAULT_LEVEL_GAP | 100px | Расстояние между уровнями (**настраивается** в UI) |
| DEFAULT_SIBLING_GAP | 24px | Расстояние между соседними узлами (**настраивается** в UI) |
| DEFAULT_CHILD_GAP | 16px | Отступ в org-chart (**настраивается** в UI) |

## Настройка расстояний (Layout Spacing)

В правом нижнем углу холста есть кнопка `↔ {levelGap}/{siblingGap}`. При нажатии открывается popover с тремя ползунками:
- **Level Gap** (40–300px) — расстояние между уровнями (по горизонтали для mindmap/tree, по вертикали для org-chart)
- **Sibling Gap** (4–120px) — расстояние между соседними узлами одного уровня
- **Child Gap** (4–80px) — расстояние между детьми в org-chart

Значения сохраняются в `localStorage` и восстанавливаются при перезагрузке.

### Параметры функции

```typescript
interface LayoutGaps {
  levelGap: number
  siblingGap: number
  childGap?: number
}

// computeTreeLayout теперь принимает gaps
computeTreeLayout(root, structure, structMap, gaps)
```

## Исправленные баги

### 1. Дети не двигались за родителем
При перепозиционировании ребёнка его потомки оставались на старых местах.
**Фикс:** `shiftSubtree()` сдвигает всех потомков на дельту перемещения родителя.

### 2. collectBounds() не вызывался
Функция была определена, но ни разу не вызвана → offsetX/offsetY вычислялись из начальных значений (0, 0, 1200, 800).
**Фикс:** вызов `collectBounds(root)` перед вычислением offset.

### 3. Размер поддеревьев считался некорректно
Старая формула `children.length * (NODE_HEIGHT + SIBLING_GAP)` не учитывала вложенность.
**Фикс:** рекурсивные `subtreeHeight()`/`subtreeWidth()` вычисляют реальную высоту/ширину поддерева.

## Типы

```typescript
interface LayoutNode {
  topic: Topic        // ссылка на исходный Topic
  x: number           // абсолютная координата X
  y: number           // абсолютная координата Y
  width: number       // ширина узла (от текста)
  height: number      // высота узла (40px)
  children: LayoutNode[]  // дочерние узлы
}
```

## Использование

```typescript
import { buildLayout, computeTreeLayout } from './renderer/layout'

// 1. Построить LayoutNode из Topic
const root = buildLayout(topic)

// 2. Вычислить позиции (с учётом structure_class)
const structMap = new Map<string, StructureClass>()
const result = computeTreeLayout(root, 'mindmap', structMap)

// 3. result.root — дерево с x, y координатами
```

## Collapse Animation

Сворачивание/разворачивание веток анимируется через комбинацию:

1. **buildLayout** больше не фильтрует `topic.folded` — все children остаются в LayoutNode tree
2. **postProcessFolded** (Phase 1.5) коллапсирует детей folded-узлов к позиции родителя после раскладки, но до shiftGlobal
3. **parentFolded prop** — MindMapRenderer передаёт дочерним `TopicNode` флаг, что их родитель свёрнут
4. **TopicNode** при `parentFolded=true` устанавливает:
   - `opacity: 0` (через CSS transition 0.15s)
   - `pointer-events: none`
5. **collectEdges** в MindMapRenderer пропускает рендер линий к свёрнутым поддеревьям: `if (node.topic.folded) return`

**Визуальный эффект:**
- При сворачивании: дети плавно перемещаются со своих computed-позиций на позицию родителя, одновременно исчезая
- При разворачивании: дети появляются на позиции родителя и плавно перемещаются на computed-позиции

**Ключевые функции:**
```typescript
function collapseDescendants(n: LayoutNode, px: number, py: number) {
  // Рекурсивно устанавливает всех потомков на позицию (px, py)
}

function postProcessFolded(n: LayoutNode) {
  // Обходит дерево, коллапсируя детей folded-узлов
}
```
