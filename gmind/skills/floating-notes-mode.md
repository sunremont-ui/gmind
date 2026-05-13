# Skill: Floating Notes Mode — Gmind

## Цель
Режим "стикерной доски": клик на пустой канвас → сразу создаётся floating-нода без структуры. Потом одним кликом AI-организация.

## План

1. **Tool Panel: добавить кнопку "Sticky Note" (📝)**
   - `ToolPanel.tsx` — новый Tool `'sticky'`
   - При выборе → следующий клик на canvas создаёт floating topic без prompt'а
   - Тема: `''` (пустая), позиция под курсором

2. **Auto-редактирование после создания**
   - После создания floating ноды — сразу перейти в inline editing
   - Пользователь сразу печатает текст

3. **AI "Organize" кнопка**
   - На каждой floating ноде — кнопка ✨ (как AI Expand, но для одной ноды)
   - При клике: `POST /api/v1/workbooks/{id}/ai/organize-floating`
   - AI анализирует текст ноды → предлагает parent в основном дереве + структурирует

4. **Backend: новый endpoint**
   - `backend/internal/api/ai_handlers.go` — `AIOrganizeFloating`
   - Принимает: `{ workbook_id, sheet_id, floating_topic_id }`
   - Возвращает: `{ suggested_parent_id, restructured_children: Topic[] }`

## Файлы
- `frontend/src/components/ToolPanel/ToolPanel.tsx` — новая кнопка
- `frontend/src/components/MindMap/MindMap.tsx` — обработка sticky tool
- `backend/internal/api/ai_handlers.go` — новый handler
- `backend/internal/ai/ai.go` — `OrganizeFloating()`
