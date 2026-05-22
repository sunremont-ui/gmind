# Skill: Collaboration (Multiplayer) — Gmind

## Архитектура

```
Frontend A ──REST API──→ Backend (persist)
Frontend A ──WS op─────→ Backend (relay) ──WS op────→ Frontend B
Frontend B ──WS op─────→ Backend (relay) ──WS op────→ Frontend A
```

## User Identity

**Где**: `MindMap.tsx`
```typescript
const userIdRef = useRef('user-' + Math.random().toString(36).slice(2, 8))
const userNameRef = useRef(makeUserName())
const userColorRef = useRef(makeUserColor())
```
- Имена из пула: `Alpha, Beta, Gamma, Delta, Epsilon, Zeta, Eta, Theta`
- Суффикс: 3 символа рандом (hex)
- Цвета: 8 предопределённых цветов

## WebSocket Protocol

### Join
```json
{
  "type": "join",
  "payload": {
    "workbook_id": "...",
    "user_id": "...",
    "user_name": "Alpha-A3F",
    "user_color": "#6366f1"
  }
}
```

### Cursor
```json
{
  "type": "cursor",
  "payload": {
    "user_id": "...",
    "user_name": "Alpha-A3F",
    "user_color": "#6366f1",
    "x": 123.45,
    "y": 67.89
  }
}
```
- Throttle 50ms на `pointermove` событии SVG
- Принимающая сторона рендерит курсор + имя в badge

### Presence
```json
{
  "type": "presence",
  "payload": {
    "users": [
      {"user_id": "...", "user_name": "Alpha-A3F", "user_color": "#6366f1"}
    ]
  }
}
```
- Бродкастится при каждом join/leave
- Backend: `broadcastPresence(workbookID)` собирает список всех клиентов

### Operation (sync)
```json
{
  "type": "operation",
  "payload": {
    "op": "topic_created",
    "data": { "parent_id": "...", "topic": {...} }
  }
}
```

**Поддерживаемые операции:**
| op | data | Store action |
|---|---|---|
| `topic_created` | `{parent_id, topic}` | `addTopic(parentId, topic)` |
| `topic_updated` | `{topic_id, updates}` | `updateTopicInTree(id, updates)` |
| `topic_deleted` | `{topic_id}` | `removeTopic(id)` |
| `floating_created` | `{topic}` | `addFloatingTopic(topic)` |
| `floating_updated` | `{topic_id, updates}` | `updateFloatingTopic(id, updates)` |
| `floating_deleted` | `{topic_id}` | `removeFloatingTopic(id)` |
| `move` (complex) | `{topic_id, new_parent_id}` | full reload via `loadWorkbook()` |

## Backend (hub.go)

**Client struct:**
```go
type Client struct {
    ID, WorkbookID, UserID, UserName, UserColor string
    Conn *websocket.Conn
    Send chan []byte
}
```

**Key methods:**
- `register(client)` — добавляет в workbook map, вызывает `broadcastPresence()`
- `unregister(client)` — удаляет, закрывает канал, вызывает `broadcastPresence()`
- `broadcastPresence(workbookID)` — собирает `{user_id, user_name, user_color}` всех клиентов, бродкастит `presence`
- `readPump()` — парсит `user_name`/`user_color` из join, релеит `operation` как есть

## Presence Panel

**Где**: `frontend/src/components/PresencePanel/PresencePanel.tsx`
- 👥 кнопка в правом нижнем углу тулбара
- Показывает количество онлайн пользователей
- Открывает панель со списком: цветная точка + имя

## Comments on Nodes

**Где**: `frontend/src/components/Comments/CommentsPanel.tsx`, `backend/internal/store/comment.go`, `backend/migrations/002_comments.up.sql`

Реализована система комментариев к топикам mindmap:

- **Иконка 💬** на каждой ноде холста (TopicNode.tsx + renderer.tsx + MindMap.tsx handler)
- Клик по 💬 открывает `CommentsPanel` как модальное окно
- **API endpoints:**
  - `GET /api/v1/topics/{topicID}/comments` — список комментариев топика
  - `POST /api/v1/topics/{topicID}/comments` — добавить комментарий (требует `X-User-ID`)
  - `DELETE /api/v1/comments/{id}` — удалить комментарий
- **Backend:** `backend/internal/store/comment.go` — CRUD + миграция `002_comments.up.sql`
- Комментарии имеют `id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`

## Особенности
- Сервер **не хранит** операции — только релеит. Консистентность через REST API (full reload при переподключении / сложных операциях)
- `update` message остаётся как fallback для полной перезагрузки
- Курсоры не сохраняются между реконнектами
- Presence обновляется при каждом join/leave (не по таймеру)
