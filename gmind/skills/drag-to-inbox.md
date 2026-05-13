# Skill: Drag to Inbox — Gmind

## Цель
Перетаскивание любой ноды (или floating) на 📥 Inbox в Sidebar → нода копируется/перемещается в Inbox для отложенного просмотра.

## План

1. **Inbox как Drop Target**
   - Sidebar: секция Inbox принимает drop
   - При drag'е ноды над Inbox — подсветка (жёлтая рамка)

2. **Backend: move topic между workbook'ами**
   - Новый API: `POST /api/v1/workbooks/{id}/topics/{topicId}/move-to-workbook`
   - Body: `{ target_workbook_id, target_sheet_id, target_parent_id }`
   - Копирует topic со всеми детьми в целевой workbook

3. **Frontend: обработка drop**
   - `MindMap.tsx` — при завершении drag'а проверяем, не над Inbox ли отпустили
   - Если да → вызываем `moveToWorkbook()` API
   - Показываем toast "Moved to Inbox"

4. **DragOverlay на Sidebar**
   - При drag'е ноды над Inbox — визуальная подсветка
   - Использовать `dragOverRef` + проверка координат

## Файлы
- `frontend/src/components/Sidebar/Sidebar.tsx` — drop target + подсветка
- `frontend/src/components/MindMap/MindMap.tsx` — обработка drop на Inbox
- `backend/internal/api/topic.go` — новый handler
- `backend/internal/store/topic.go` — `MoveTopicToWorkbook()`
