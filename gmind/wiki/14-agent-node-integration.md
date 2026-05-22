# Agent + Node Integration

Этот документ описывает интерфейс работы с агентами, выбор провайдера и модели, роль, кастомный системный промпт, а также REST API для взаимодействия с узлами mindmap.

## UI для агентов

В `frontend/src/components/AgentPanel/AgentPanel.tsx` уже реализован диалог создания агента:

- выбор роли из списка `AGENT_ROLES`
- выбор провайдера из динамического списка `modelPresets`
- выбор модели для выбранного провайдера
- переключение на ручной ввод модели
- поле `Name (optional)` для именования агента
- collapsible секция `Custom System Prompt` для задания системного промпта

### Удобное добавление провайдера и модели

- при выборе провайдера список моделей фильтруется по выбранному провайдеру
- при общем выборе отображаются все модели, сгруппированные по провайдерам
- кастомный провайдер `Custom endpoint…` открывает поле `Base URL`

### Сохранение системного промпта

- если задан `systemPrompt`, он передаётся вместе с запросом создания агента
- `system_prompt` хранится в агенте и переопределяет стандартный prompt роли

## API для узлов mindmap

### Создание узла

`POST /api/v1/workbooks/{id}/topics`

**Request:**
```json
{
  "title": "New Node",
  "parent_id": "parent-topic-id",
  "position": { "x": 100, "y": 200 }
}
```

### Обновление узла

`PUT /api/v1/workbooks/{id}/topics/{topicId}`

**Request:**
```json
{
  "title": "Updated Title",
  "notes": "New notes",
  "markers": ["star"],
  "labels": ["important"],
  "rich_text": "<b>Bold</b> text",
  "position": { "x": 200, "y": 150 },
  "border_color": "#2563EB",
  "shadow_type": "medium"
}
```

### Удаление узла

`DELETE /api/v1/workbooks/{id}/topics/{topicId}`

- удаляет выбранный topic
- root topic нельзя удалить

### Перемещение узла

`POST /api/v1/workbooks/{id}/topics/{topicId}/move`

**Request:**
```json
{
  "new_parent_id": "new-parent-id",
  "index": 0
}
```

### Работа с плавающими узлами

`POST /api/v1/workbooks/{id}/floating-topics`

`PUT /api/v1/workbooks/{id}/floating-topics/{topicId}`

`DELETE /api/v1/workbooks/{id}/floating-topics/{topicId}`

## Запись/удаление/редактирование узлов

Для записи и удаления узлов используйте REST API:

- `POST /topics` — создание новой ноды
- `PUT /topics/{topicId}` — редактирование содержимого
- `DELETE /topics/{topicId}` — удаление
- `POST /topics/{topicId}/move` — перенос в другое место

## Новые agent tools (V3.9, 2026-05-15)

Добавлены в `ToolRegistry` в `backend/internal/agent/tools.go`:

| Tool | Category | Описание |
|------|----------|---------|
| `delete_topic` | mindmap | Удалить топик + всех детей. Root нельзя удалить |
| `move_topic` | mindmap | Переместить под нового родителя (сохраняет детей) |
| `list_topics` | mindmap | Плоский список всех топиков с id, title, depth, parent_id |
| `delegate_to_agent` | agent | Синхронно делегировать задачу другому агенту (poll 500ms × 240 = 2 мин) |

`delegate_to_agent` — self-delegation защищена: агент не может делегировать себе. Доступен ролям: researcher, organizer, analyst.

`list_topics` — возвращает:
```json
{ "topics": [{"id":"...","title":"...","depth":1,"parent_id":"..."},...], "count": 42 }
```

## Интеграция с wiki и агентами

- агенты могут получать информацию из wiki с помощью **wiki tools** (`wiki_search`, `wiki_read`, `wiki_write`)
- документация по wiki хранится в `backend/internal/wiki/`
- API вики доступен через `GET /api/v1/wiki/{name}` и `PUT /api/v1/wiki/{name}`

## Примеры сценариев

1. Создать агента с ролью `researcher`, выбрать `openai` и модель `gpt-4o`, задать кастомный prompt.
2. Отправить агенту задачу, которая создаёт новые узлы на карте.
3. Сохранить результаты в wiki и использовать их для следующей итерации агента.

## Где искать код

- `frontend/src/components/AgentPanel/AgentPanel.tsx` — интерфейс создания/редактирования агента
- `frontend/src/store/agent.ts` — Zustand store, `fetchModelPresets`, `createAgent`, `updateAgent`
- `frontend/src/api/agent.ts` — клиентские вызовы к `/api/v1/agents`
- `frontend/src/components/MindMap/MindMap.tsx` — операции с топиками и картой
- `backend/internal/api/` — REST обработчики для workbooks/topics/relationships/wiki
- `backend/internal/wiki/` — модуль wiki и CRUD-функции стенда
