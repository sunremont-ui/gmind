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

## Интерактив якорей

`EdgeAnchorsLayer.tsx` (4 точки на выбранном узле, крестик при наведении):
- драг на узел → связь; клик → меню `AnchorActionMenu.tsx`; драг в пустоту → ребёнок в направлении драга (ghost — `FantomLine.tsx`).
- Логика клик/драг — `useGraphDragTracking.ts`.

## Логи (`frontend/src/renderer/layoutLog.ts`)

```js
gmindLayoutDebug(true)   // вкл/выкл (localStorage 'gmind.layoutDebug'), по умолчанию ВЫКЛ
gmindLastLayout()        // stats последнего прогона
```
Сводка: `[layout] N nodes · M packs · overlaps X/Y · Zms`. Типы: pack/overlap/resolve.

## Тесты

`renderer/layout.test.ts` — `noOverlaps()` (нет наложений) + per-child `child_dir` + направления. 14 тестов.

## Как модифицировать

Новая структура → `case` в `layoutRecursive` + упаковщик по образцу `packVertical/Horizontal` + `run.pack(...)`. Плотность — `DEFAULT_*_GAP` или per-node `level_gap/sibling_gap`. Тонкая настройка sweep — константы вверху layout.ts. Перед правкой читать `docs/layout-algorithm.md` §7.
