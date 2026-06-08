# Layout Engine

Gmind использует собственный SVG layout engine, вдохновлённый Snowbrush от XMind. Алгоритм вычисляет абсолютные координаты для каждого узла, затем рендерит через SVG `<g transform="translate(x,y)">`.

> **Актуальное (2026-06-01):** раскладка переписана на **паковку по измеренным bbox** (без наложений) + **per-child направление** (`child_dir`) + **глобальный sweep** + **логи**. Полное описание и «как модифицировать» — в [`docs/layout-algorithm.md`](../docs/layout-algorithm.md). Этот файл — обзор; детали ниже синхронизированы.

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

#### Фаза 1.7: Устранение наложений (resolveOverlaps)
Глобальная страховка после раскладки: находит пары с реальным наложением AABB и
двигает **только листья/свёрнутые** узлы (чтобы не рвать связи поддеревьев).
Основные коллизии уже предотвращены паковкой по bbox; этот проход добивает
радиал/ёлочку/пограничные случаи. Константы: `OVERLAP_EPSILON=1`,
`SWEEP_MAX_NODES=300`, `SWEEP_PASSES=4`.

#### Фаза 2: Сбор границ (collectBounds)
Обходит всё дерево, вычисляет `minX, maxX, minY, maxY`.

#### Фаза 3: Сдвиг (shiftGlobal)
Сдвигает всё дерево на `(offsetX, offsetY)` так, чтобы верхний левый угол был в (80, 100).

Каждый прогон логируется через `LayoutRun` (`renderer/layoutLog.ts`).

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

**Расчёт (packVertical):**
1. Для каждого ребёнка измерить **реальный bbox** уже разложенного поддерева (`measureSubtree`)
2. Общая высота = сумма высот bbox + отступы; стопка от `-total/2`
3. Верх каждого поддерева ставится вплотную к низу предыдущего + `siblingGap` → полосы не пересекаются (нет наложений)
4. Поддерево прижимается к стороне на `levelGap` от родителя через `translate(child, dx, dy)`

> Раньше использовалась эвристика `subtreeHeight()` (сумма высот детей). Она ломалась на смешанных направлениях; заменена на измерение реального bbox.

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

Древовидные структуры проходят через `packDirectional` (группирует детей по `child_dir`, см. ниже), который вызывает:

| StructureClass | Упаковщик | Direction по умолчанию | Siblings |
|---|---|---|---|
| `mindmap` | `packVertical` | right/left (branch_side) | stack |
| `tree` / `tree-right` | `packVertical` | right | stack |
| `tree-left` | `packVertical` | left | stack |
| `org-chart` / `tree-down` | `packHorizontal` | down | рядом |
| `tree-up` | `packHorizontal` | up | рядом |
| `radial` | `layoutRadial` | 8dir | polar |
| `fishbone` | `layoutFishbone` | alternating | diagonal |

### Per-child направление (child_dir)

Поле `topic.child_dir` (`up|down|left|right`) задаёт направление **конкретного ребёнка** относительно родителя. `packDirectional` группирует детей по `child_dir` и пакует каждую группу независимо; дети без `child_dir` идут в направлении по умолчанию (`defaultDir` из таблицы). Это даёт разнонаправленную (в т.ч. балансную лево/право) раскладку: новый ребёнок встаёт в выбранную сторону, остальные не двигаются.

Создаётся кликом/драгом по якорю узла (`EdgeAnchorsLayer` → `AnchorActionMenu`/drag → `MindMap.createChildInDirection`). Персист: backend `model.Topic.ChildDir`.

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
**Фикс (этап 1):** рекурсивные `subtreeHeight()`/`subtreeWidth()`.
**Фикс (этап 2, 2026-06-01):** замена эвристики на `measureSubtree()` — реальный AABB поддерева. Корректен даже при смешанных направлениях вложенных веток → ветки не наезжают.

## Логи раскладки

`renderer/layoutLog.ts` собирает по каждому прогону события `pack/overlap/resolve` + тайминг. Выключены по умолчанию (нулевая стоимость в проде). Управление из консоли браузера:

```js
gmindLayoutDebug(true)   // вкл/выкл (сохраняется в localStorage 'gmind.layoutDebug')
gmindLastLayout()        // stats последнего прогона
```

Сводка в консоли: `[layout] N nodes · M packs · overlaps X/Y · Zms`.

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
