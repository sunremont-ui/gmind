# API Reference

Базовый URL: `/api/v1`

## Workbooks

### GET /workbooks
Список всех workbook'ов.

**Response 200:**
```json
[
  {
    "id": "uuid-string",
    "title": "My Mind Map",
    "sheets": [...],
    "access_mode": "public",
    "private": false,
    "owner_id": "user-uuid",
    "created_at": "2026-05-09T01:00:00Z",
    "updated_at": "2026-05-09T01:00:00Z"
  }
]
```

### POST /workbooks
Создать новый workbook.

**Request:**
```json
{ "title": "My Mind Map", "access_mode": "public" }
```

**Response 201:** Workbook object

### GET /workbooks/{id}
Получить workbook по ID.

### PUT /workbooks/{id}
Обновить workbook (включая `access_mode`, `private`).

**Request:**
```json
{ "title": "New Title", "access_mode": "collaborators" }
```

### DELETE /workbooks/{id}
Удалить workbook.

---

## Sheets

### POST /workbooks/{id}/sheets
Создать sheet в workbook.

**Request:**
```json
{ "title": "New Sheet" }
```

### PUT /workbooks/{id}/sheets/{sheetId}
Обновить sheet.

### DELETE /workbooks/{id}/sheets/{sheetId}
Удалить sheet (минимум 1 sheet остаётся).

---

## Topics

### POST /workbooks/{id}/topics
Создать topic.

**Request:**
```json
{
  "title": "New Topic",
  "parent_id": "parent-topic-id",
  "position": { "x": 100, "y": 200 }
}
```
`position` — опционально (для detached/floating topics).

### PUT /workbooks/{id}/topics/{topicId}
Обновить topic.

**Request:**
```json
{
  "title": "Updated",
  "rich_text": "<b>Bold</b> and <i>italic</i> text",
  "notes": "Some notes",
  "markers": ["star", "priority"],
  "labels": ["urgent"],
  "hyperlink": "https://...",
  "folded": false,
  "position": { "x": 150, "y": 250 },
  "structure_class": "org-chart",
  "branch_side": "left",
  "edge_style": "angled",
  "edge_dash": "dashed",
  "font_size": 18,
  "font_color": "#ef4444",
  "node_width": 180,
  "node_height": 48,
  "border_color": "#5B6CFF",
  "connection_color": "#10B981",
  "shadow_type": "medium",
  "node_style": "gradient",
  "fold_icon": "chevron",
  "show_child_count": true,
  "level_gap": 80,
  "sibling_gap": 24
}
```
`rich_text` — опциональное HTML-содержимое (bold, italic, списки). Если передано, нода отображается через `foreignObject` + `dangerouslySetInnerHTML`. `title` всегда хранит plain-text версию для поиска.

### DELETE /workbooks/{id}/topics/{topicId}
Удалить topic (нельзя удалить root topic).

### POST /workbooks/{id}/topics/{topicId}/move
Переместить topic к новому родителю.

**Request:**
```json
{
  "new_parent_id": "new-parent-id",
  "index": 0
}
```

---

## Relationships

### POST /workbooks/{id}/relationships
Создать связь между двумя topics.

**Request:**
```json
{
  "end1_id": "topic-a-id",
  "end2_id": "topic-b-id",
  "title": "relates to"
}
```

### DELETE /workbooks/{id}/relationships/{relId}
Удалить связь.

---

## AI

### POST /api/v1/ai/provider
Переключить AI провайдера (OpenAI ↔ local ↔ Yandex GPT).

**Request:**
```json
{
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "api_key": "sk-..."
}
```
Параметры `endpoint`, `model`, `api_key` опциональны. Для `provider: "local"` endpoint по умолчанию `http://localhost:8081/v1`. Для `provider: "yandex"` используется Yandex GPT API.

**Response 200:**
```json
{ "status": "ok", "provider": "openai" }
```

### POST /api/v1/ai/yandex/config
Настроить Yandex GPT API Key и Folder ID.

**Request:**
```json
{
  "api_key": "yandex-api-key",
  "folder_id": "b1g123456789",
  "model": "yandexgpt-latest"
}
```

**Response 200:**
```json
{ "status": "ok", "provider": "yandex" }
```

### POST /workbooks/{id}/ai/generate
Сгенерировать mindmap через AI.

**Request:**
```json
{
  "prompt": "Create a mind map about machine learning",
  "sheet_id": "sheet-id",
  "parent_id": "optional-parent-id"
}
```

**Response 200:**
```json
{
  "topics": [
    { "id": "...", "title": "ML", "children": [...] }
  ]
}
```

### POST /workbooks/{id}/ai/chat
Чат с AI по содержимому mindmap.

**Request:**
```json
{
  "sheet_id": "sheet-id",
  "message": "What is this mind map about?"
}
```

**Response 200:**
```json
{
  "reply": "This mind map covers...",
  "suggestions": [...]
}
```

### POST /workbooks/{id}/ai/expand
Расширить topic через AI (inline expand).

**Request:**
```json
{
  "topic_id": "topic-uuid",
  "count": 5
}
```

**Response 200:**
```json
{
  "topics": [
    { "id": "...", "title": "New child 1" },
    { "id": "...", "title": "New child 2" }
  ]
}
```

### POST /api/v1/ai/image
Генерация изображения через DALL-E 3.

**Request:**
```json
{
  "prompt": "A futuristic city at sunset, digital art style",
  "size": "1024x1024"
}
```

**Response 200:**
```json
{
  "image_base64": "data:image/png;base64,..."
}
```

---

## Local AI Server (llama-server)

### GET /api/v1/llama/status
Статус локального сервера.

**Response:**
```json
{
  "running": true,
  "config": { "server_path": "...", "model_path": "...", "port": 8081, ... }
}
```

### POST /api/v1/llama/start
Запустить llama-server.

### POST /api/v1/llama/stop
Остановить llama-server.

### PUT /api/v1/llama/config
Обновить конфигурацию.

### POST /api/v1/llama/config/save
Сохранить конфигурацию на диск.

---

## Collaborators

### POST /workbooks/{id}/collaborators
Добавить collaborator'а в workbook (для private/collaborators mode).

**Request:**
```json
{
  "user_id": "user-abc123",
  "role": "editor"
}
```

**Response 200:**
```json
{ "status": "added" }
```

### DELETE /workbooks/{id}/collaborators/{userId}
Удалить collaborator'а из workbook.

**Response 200:**
```json
{ "status": "removed" }
```

### GET /workbooks/{id}/collaborators
Получить список collaborator'ов.

**Response 200:**
```json
{ "users": ["user-abc123", "user-def456"] }
```

---

## Import JSON

### POST /workbooks/{id}/import-json
Загрузить JSON-данные для AI контекста.

**Request:**
```json
{
  "sheet_id": "sheet-id",
  "data": "{\"key\": \"value\", ...}"
}
```

**Response 200:**
```json
{ "status": "imported" }
```

### DELETE /workbooks/{id}/import-json
Очистить импортированные данные.

---

## MCP Server (JSON-RPC 2.0)

### POST /api/v1/mcp
JSON-RPC 2.0 эндпоинт для интеграции с AI-агентами.

**Доступные методы:**
- `initialize` — инициализация соединения
- `tools/list` — список доступных инструментов
- `tools/call` — вызов инструмента (wiki_search, wiki_read, wiki_write)

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "tool": "wiki_search",
    "arguments": { "query": "API endpoints" }
  }
}
```

**Response 200:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}
```

---

## Wiki

### GET /api/v1/wiki/search
Полнотекстовый поиск по wiki-страницам.

**Query params:** `?q=search+query`

**Response 200:**
```json
{
  "results": [
    { "name": "01-architecture", "title": "Архитектура", "snippet": "..." }
  ]
}
```

### GET /api/v1/wiki/list
Список всех wiki-страниц.

**Response 200:**
```json
{
  "pages": [
    { "name": "01-architecture", "title": "Архитектура", "updated_at": "..." },
    { "name": "02-api-reference", "title": "API Reference", "updated_at": "..." }
  ]
}
```

### GET /api/v1/wiki/{name}
Получить содержимое wiki-страницы.

**Response 200:**
```json
{
  "name": "01-architecture",
  "title": "Архитектура",
  "content": "# Архитектура\n..."
}
```

### PUT /api/v1/wiki/{name}
Обновить wiki-страницу.

**Request:**
```json
{
  "content": "# Новое содержимое\n..."
}
```

---

## Export

### GET /api/v1/workbooks/{id}/export
Скачать workbook в формате `.xmind`.

**Response:** application/zip (бинарник `.xmind`)

### GET /api/v1/workbooks/{id}/export/svg
Экспорт в SVG.

### GET /api/v1/workbooks/{id}/export/png
Экспорт в PNG.

### GET /api/v1/workbooks/{id}/export/pdf
Экспорт в PDF.

---

## Health

### GET /health
```json
{ "status": "ok" }
```

---

## Client-Side Export / Import (не REST-endpoints)

Следующие функции работают на фронтенде без серверных роутов:

### Export SVG/PNG/PDF
- **Файл:** `frontend/src/utils/export.ts`
- SVG: `XMLSerializer` → Blob → download
- PNG: SVG → Image → canvas 2x → `toBlob()`
- PDF: canvas → `jsPDF.addImage()` → `save()`
- Доступны через выпадающее меню Export в тулбаре

### Import Markdown (.md)
- **Файл:** `frontend/src/utils/markdown.ts`
- Парсит заголовки (`# ## ###`) и списки (`- * +`)
- Создаёт топики рекурсивно через `api.createTopic()`

### Import FreeMind (.mm)
- **Файл:** `frontend/src/utils/freemind.ts`
- Парсит XML `<node TEXT="...">` через `DOMParser`
- Создаёт топики рекурсивно через `api.createTopic()`

### Import XMind (.xmind)
- **Клиент:** `api.importXMind(file)` — FormData upload
- Серверный endpoint: `POST /api/v1/workbooks/import`
