# AI Integration

Gmind поддерживает три AI провайдера: **OpenAI GPT-4o**, **Yandex GPT** и **локальный llama-server** (Qwen 2.5 Coder).

## Настройка OpenAI

```bash
export AI_API_KEY="sk-your-key-here"
export AI_MODEL="gpt-4o"         # опционально, по умолчанию gpt-4o
export AI_ENDPOINT="https://api.openai.com/v1"  # опционально
```

Если `AI_API_KEY` не задан — сервер запускается в динамическом режиме. Провайдера можно переключить через API позже.

## Настройка Yandex GPT

```bash
export YANDEX_API_KEY="yandex-api-key"
export YANDEX_FOLDER_ID="b1g123456789"
export YANDEX_MODEL="yandexgpt-latest"  # или "yandexgpt-lite", "yandexgpt-plus"
```

## Динамическое переключение провайдера

### POST /api/v1/ai/provider

```json
{ "provider": "openai" }
```
Переключает на OpenAI (использует env-конфиг).

```json
{ "provider": "local", "endpoint": "http://localhost:8081/v1" }
```
Переключает на локальный llama-server.

```json
{ "provider": "yandex" }
```
Переключает на Yandex GPT (использует YANDEX_* env vars или `/api/v1/ai/yandex/config`).

**На фронтенде:** при старте/остановке llama-server через 🤖 кнопку провайдер переключается автоматически.

## Yandex GPT API Config

### POST /api/v1/ai/yandex/config

Настроить API Key и Folder ID для Yandex GPT.

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

## Local AI Server (llama-server)

### Управление через UI
Кнопка 🤖 в тулбаре MindMap открывает модалку `AIServerPanel`:

- **Server Path** — путь к `llama-server.exe`
- **Model Path** — путь к GGUF-модели
- **Port** — порт (по умолч. 8081)
- **Context Size** — контекст в токенах
- **GPU Layers** — сколько слоёв на GPU (-ngl)
- **Threads** — количество потоков
- **Presets:** Full GPU (33), Partial (20), CPU only
- **Start/Stop** — управление процессом

Статус опрашивается каждые 5 секунд.

### Бэкенд
- `backend/internal/llama/server.go` — управление процессом (spawn/kill)
- `backend/internal/api/llama.go` — HTTP хендлеры (status/start/stop/config)
- Эндпоинты: `GET /api/v1/llama/status`, `POST /llama/start`, `POST /llama/stop`, `PUT /llama/config`, `POST /llama/config/save`

## AI Endpoints

### POST /api/v1/workbooks/{id}/ai/generate
Генерация mindmap по текстовому описанию.

```json
{
  "prompt": "Create a mind map about machine learning",
  "sheet_id": "sheet-uuid",
  "parent_id": "optional-parent-uuid"
}
```

**Response:** `{ "topics": [Topic, ...] }`

### POST /api/v1/workbooks/{id}/ai/chat
Чат с AI по содержимому mindmap.

```json
{
  "sheet_id": "sheet-uuid",
  "message": "What is this mind map about?"
}
```

**Response:** `{ "reply": "...", "suggestions": [...] }`

### POST /api/v1/workbooks/{id}/ai/expand
AI inline expand — генерация 3-5 дочерних тем для конкретного topic.

```json
{
  "topic_id": "topic-uuid",
  "count": 3
}
```

**Response:** `{ "topics": [Topic, ...] }`

### POST /api/v1/ai/image
Генерация изображения через DALL-E 3.

```json
{
  "prompt": "A futuristic city at sunset, digital art style",
  "size": "1024x1024"
}
```

**Response:** `{ "image_base64": "data:image/png;base64,..." }`

## Как это работает

### System Prompt (Generate)
```
You are a mind map generator. Create a hierarchical mind map structure
based on the user's request. Respond ONLY with valid JSON in format:
{
  "topics": [
    { "title": "...", "children": [...] }
  ]
}
Keep topics concise (2-5 words each). Maximum 3 levels deep.
```

### System Prompt (Expand)
```
Generate 3-5 concise child topics that logically expand the given topic.
Respond with valid JSON: { "topics": [{ "title": "..." }, ...] }
```

### Context (Chat)
AI получает:
1. Текущую mindmap в формате XMind JSON
2. Импортированные данные (если загружены через 📥 JSON) — секция "--- Импортированные данные ---"
3. Сообщение пользователя
4. System prompt с инструкцией анализировать и предлагать изменения

### Middleware
AI клиент внедряется через middleware и поддерживает горячую замену:

```go
type AI struct {
    mu     sync.RWMutex
    client *openai.Client
    model  string
    providerType string  // "openai", "local", "yandex"
}

func (a *AI) UpdateEndpoint(apiKey, baseURL, modelName string) {
    // thread-safe замена клиента
}
```

В `main.go` клиент создаётся всегда (даже без API_KEY), чтобы `POST /api/v1/ai/provider` мог переключить его позже.

## Структура на бэкенде

**Файл:** `backend/internal/ai/ai.go`
- `GenerateMindMap(ctx, prompt)` — генерация дерева
- `Chat(ctx, message, mindMapData)` — чат
- `ExpandTopic(ctx, topic, count)` — расширение топика
- `GenerateImage(ctx, prompt)` — генерация изображения
- `UpdateEndpoint(apiKey, baseURL, model)` — горячая замена провайдера

**Хендлеры:** `backend/internal/api/ai_handlers.go`
- `AIGenerate`, `AIChat`, `AIExpand`, `AIImage`, `SwitchAIProvider`, `YandexConfig`

**Yandex GPT:** `backend/internal/api/yandex.go`
- Интеграция с Yandex GPT API

**Управление сервером:** `backend/internal/api/llama.go`, `backend/internal/llama/server.go`

## UI

- **AIPanel** (`frontend/src/components/AIPanel/`) — Generate + Chat + Expand, вызывается из хедера App
- **AIServerPanel** (`frontend/src/components/AIServerPanel/`) — управление локальным сервером, 🤖 в тулбаре MindMap
- **AIToolbar** — кнопки ✨ Expand и 🎨 Image на контекстной панели TopicNode
