# Skill: Auto-Save Indicator — Gmind

## Цель
Показывать статус сохранения: синхронизировано / ожидание / офлайн-очередь.

## План

1. **SaveStatusBar компонент**
   - `frontend/src/components/SaveStatus/SaveStatusBar.tsx`
   - Отображается в правом нижнем углу
   - 3 статуса:
     - 🟢 Saved — всё синхронизировано
     - 🟡 Saving... — идёт запрос
     - 🔴 Offline (X pending) — есть неотправленные операции

2. **Интеграция**
   - Подписаться на `offlineQueue.count()` через polling (уже есть `pendingCount` в App)
   - Добавить `isSaving` флаг в Zustand store
   - Обновлять при каждом API вызове

3. **История изменений**
   - При клике на статус — показать список последних операций
   - В офлайн-режиме — показать сколько операций в очереди

## Файлы
- `frontend/src/components/SaveStatus/SaveStatusBar.tsx` — компонент
- `frontend/src/App.tsx` — добавить в render
- `frontend/src/store/mindmap.ts` — `isSaving` поле
