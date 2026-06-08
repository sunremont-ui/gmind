# Skill: Layout без наложений + per-child направление — Gmind

## Статус: ✅ Реализовано (2026-06-01)

Раскладка узлов переписана: паковка по измеренным bbox (без наложений),
per-child направление (`child_dir`), глобальный sweep, логи.

Канон: [`docs/layout-algorithm.md`](../docs/layout-algorithm.md). Обзор:
[`wiki/05-layout-engine.md`](../wiki/05-layout-engine.md).

---

## Ядро (`frontend/src/renderer/layout.ts`)

- `measureSubtree(n): BBox` — реальный AABB уже разложенного поддерева. Заменил
  эвристику `subtreeHeight/Width` (она ломалась на смешанных направлениях).
- `packVertical(n, children, lvl, sib, side)` — стопка сбоку (mindmap, tree-left/right). Слот = высота bbox.
- `packHorizontal(n, children, lvl, sib, dir)` — стопка сверху/снизу (tree-up/down, org-chart). Слот = ширина bbox.
- `translate(n, dx, dy)` — двигает узел **вместе** с поддеревом (vs `shiftSubtree` — только потомки).
- `packDirectional(n, children, lvl, sib, dflt, run)` — группирует детей по `child_dir`, каждую группу пакует независимо; без `child_dir` → `defaultDir(structure_class, branch_side)`.
- `resolveOverlaps(root, run)` — sweep-страховка: двигает только листья/свёрнутые. Константы: `OVERLAP_EPSILON=1`, `SWEEP_MAX_NODES=300`, `SWEEP_PASSES=4`.

Инвариант упаковщика: в конце `n.x = n.y = 0` (глобальный сдвиг — `shiftGlobal`).

## Per-child направление (`child_dir`)

- Поле `up|down|left|right` НА РЕБЁНКЕ. Новый ребёнок встаёт в выбранную сторону,
  остальные не двигаются (раскладку родителя не трогаем).
- Backend: `model.Topic.ChildDir` (+ Create/Update Request + хендлеры `api/topic.go` + `DeepCopy`). Хранится в JSON-блобе воркбука.
- Frontend: `Topic.child_dir` (types/api.ts), `createTopic(..., {childDir})` (client.ts).
- Создание: якорь узла → `MindMap.createChildInDirection(topicId, side)` → `createChildOptimistic(parent, idx, childDir)`.

## Интерактив якорей (2026-06-08)

`EdgeAnchorsLayer.tsx` (4 точки на выбранном узле, увеличиваются при наведении):
- **левый клик по точке** → сразу создаёт ребёнка в сторону точки (`createChildInDirection`);
- **правый клик** → меню выбора направления `AnchorActionMenu.tsx` (заголовок «Направление»);
- драг на узел → связь; драг в пустоту → ребёнок в направлении драга (ghost — `FantomLine.tsx`).
- Логика клик/драг — `useGraphDragTracking.ts` (`onPointerDown` только ЛКМ; ПКМ → `onContextMenu`).
- Внутри каждой точки — **число детей** в этом направлении; точка-«полая» = сторона свёрнута.

## Drag тела узла: swap / child / свободный (2026-06-08)

`MindMap.handlePointerMove/Up` + `dropZone` (центр vs край цели):
- отпустил в **центр** другого узла → поменять местами (`swapTopics`, backend `POST /topics/{id}/swap`);
- отпустил у **края** (точки) → стать ребёнком в ту сторону (`moveTopic` + `child_dir`); активная точка цели увеличивается;
- отпустил в **пустоте** → свободный floating-узел **с поддеревом** (`detachToFloating`, backend `POST /topics/{id}/detach`).
- Оптимистичные хелперы стора: `mindmap.ts` `swapTopics` / `detachToFloating`. Тесты: `mindmap.test.ts`, backend `topic_swap_detach_test.go`.

Floating-узлы теперь раскладываются как самостоятельные корни поддерева (`MindMap.floatingLayouts` → `renderer` через `floatingRoots`), а не как одиночный лист.

## Рёбра дерева (`renderer.tsx`, 2026-06-08)

- **Точки выхода/входа по направлению ребёнка** (`edgeEndpoints` + `axis` в `edgePath`): право/лево/низ/верх, а не всегда «право родителя → лево ребёнка».
- **Толщина = размер поддерева** (`thicknessForSubtree(sizeMap)`): ствол толще веток.
- **Цвет = вес ребра** `topic.edge_weight` (`weightToColor`, холодный→горячий, HSL 220°→0°). Без веса — цвет темы. Контрол «Edge Weight» в PropertiesPanel; backend `model.Topic.EdgeWeight`.

## Бейджи числа детей + per-side fold (2026-06-08)

- На **каждом** узле — кружок с числом детей в каждом направлении, где есть дети (`childBadges` в `renderer.tsx`; сторона — `sideOf` по геометрии). У выбранного узла их заменяет `EdgeAnchorsLayer`.
- **Клик по бейджу сворачивает только эту сторону** (`onToggleChildSide` → `topic.folded_sides: string[]`), БЕЗ переракладки — дети просто скрываются на местах, соседи/кружки не двигаются. Свёрнутая сторона — полый кружок. Backend: `model.Topic.FoldedSides` (Update via `*[]string`).
- Общий счётчик с узла убран — общее число только в PropertiesPanel («N children»).

## Логи (`frontend/src/renderer/layoutLog.ts`)

```js
gmindLayoutDebug(true)   // вкл/выкл (localStorage 'gmind.layoutDebug'), по умолчанию ВЫКЛ
gmindLastLayout()        // stats последнего прогона
```
Сводка: `[layout] N nodes · M packs · overlaps X/Y · Zms`. Типы: pack/overlap/resolve.

## Известные ограничения (2026-06-08, accepted)

- **Per-side fold у выбранного узла** — рядом с якорем стороны с детьми есть кнопка −/+ (`EdgeAnchorsLayer onToggleSide` → `handleToggleChildSide`); у НЕвыбранного узла то же делает клик по бейджу.
- **Per-side fold не делает reflow** — by design (требование «не перемещается»): дети свёрнутой стороны прячутся на местах, пустота остаётся.
- **Drop тела узла на floating-узел** — теперь явный no-op (snap back), без рассинхрона: `targetFloating`-гард в `handlePointerUpGlobal`. Floating-источник на center другого узла → reparent (swap только для tree-источника).
- **Floating-родители теперь полноценны (2026-06-08)** — `EdgeAnchorsLayer` ищет выбранный узел и в `floatingLayouts`, поэтому у floating-узлов есть якоря (создать ребёнка/связь). Стор-хелперы `addTopic`/`addTopicAt`/`removeTopic`/`updateTopicInTree`/`getTopic` обходят floating-поддеревья как корни; backend `CreateTopic`/`UpdateTopic` уже работали через `sheet.FindTopic`.

## Тесты

- `renderer/layout.test.ts` — `noOverlaps()` + per-child `child_dir` + направления (14).
- `renderer/edgeVisuals.test.ts` — `weightToColor`/`thicknessForSubtree`/`sideOf` (8).
- `store/mindmap.test.ts` — `swapTopics`/`detachToFloating` (+ остальные).
- backend `api/topic_swap_detach_test.go` — swap/detach + guard'ы.

## Как модифицировать

Новая структура → `case` в `layoutRecursive` + упаковщик по образцу `packVertical/Horizontal` + `run.pack(...)`. Плотность — `DEFAULT_*_GAP` или per-node `level_gap/sibling_gap`. Тонкая настройка sweep — константы вверху layout.ts. Перед правкой читать `docs/layout-algorithm.md` §7.
