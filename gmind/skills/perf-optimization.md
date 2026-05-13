# Skill: Performance Optimization — Gmind

## 1. React.memo для TopicNode
**Где**: `frontend/src/components/MindMap/TopicNode.tsx`
**Что**: `export const TopicNode = memo(function TopicNode(...), areEqual)`
**Сравнение**: layout reference, isSelected, isDragOver, isDragging, isEditing, hidden, isRoot, searchQuery
**Эффект**: при drag/move мыши перерисовывается только 1-2 ноды вместо всех
**Паттерн**:
```typescript
export const TopicNode = memo(function TopicNode(props: TopicNodeProps) {
  // ... component
}, (prev, next) => {
  return prev.layout === next.layout
    && prev.isSelected === next.isSelected
    && prev.isDragOver === next.isDragOver
    // ... etc
})
```

## 2. Viewport Culling
**Где**: `frontend/src/renderer/renderer.tsx`
**Что**: скрываем ноды и рёбра вне видимой области (viewport) + padding 400px
**Поток**:
1. `MindMap.tsx` вычисляет `viewportRect` из zoom/pan/SVG size через `useMemo`
2. Передаёт `viewportRect` в `MindMapRenderer`
3. `renderer.tsx` использует `isInViewport(nx, ny, nw, nh)` для каждой ноды
4. Culled ноды получают `hidden={true}` → `visibility: hidden` (сохраняют место в DOM)
5. Culled рёбра не рендерятся (skip push в edgeData)
**Эффект**: при большом дереве (100+ нод) и сильном зуме/панорамировании не рендерятся ноды вне экрана
**Константа**: `CULL_PADDING = 400` px буфера вокруг viewport

## 3. useMemo для edgeData + nodeComponents
**Где**: `frontend/src/renderer/renderer.tsx`
**Что**: вся сборка данных (edges, nodes, positions) обёрнута в `useMemo`
**Зависимости**: root, selSet, searchQuery, viewportRect, dragOverTopicId, draggingTopicId,
editingTopicId, все onTopic* callbacks
**Эффект**: при каждом render не пересоздаются массивы нод/рёбер

## 4. selSet мемоизация
**Где**: `frontend/src/renderer/renderer.tsx`
**Что**: `new Set(selectedTopicIds)` обёрнут в `useMemo`
**Зависимости**: `[selectedTopicId, selectedTopicIds]`
**Эффект**: не создаётся новый Set при каждом render

## 5. Viewport rect мемоизация
**Где**: `frontend/src/components/MindMap/MindMap.tsx`
**Что**: `viewportRect` вычисляется через `useMemo` из `zoom` и `pan`
**Эффект**: не пересчитывается каждый render, только при изменении zoom/pan

## 6. Layout optimizations
**Где**: `frontend/src/renderer/layout.ts`
**Уже**: `buildLayout` + `computeTreeLayout` вызываются через `useMemo` в MindMap.tsx
**Зависимости**: `[activeSheet]`
**Эффект**: layout пересчитывается только при изменении sheet'а

## Когда применяем
- **React.memo**: всегда — безопасно, нет оверхеда
- **Viewport culling**: если дерево > 50 нод (для маленьких деревьев оверхед от проверок может превысить выгоду)
- **useMemo на массивы**: если render происходит часто (drag, pan, zoom)

## Измерение
- React DevTools Profiler → Flamegraph
- Проверить кол-во TopicNode renders при drag (должно быть 1-2, а не все)
- Проверить кол-во DOM elements при zoomOut (culled ноды остаются в DOM с visibility:hidden)
