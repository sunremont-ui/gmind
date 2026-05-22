# Skill: External Model Servers — Gmind

## Статус: ✅ Реализовано (2026-05-15)

Поддержка внешних OpenAI-совместимых model-серверов (LM Studio, Jan, llama.cpp и др.) через JSON-конфиг + REST API + UI в AIServerPanel.

---

## Порты (диапазон 1010–1200)

| Сервис | Порт |
|--------|------|
| Gmind backend API | **1010** |
| Vite dev server | **1011** |
| Docker frontend nginx | **1012** |
| llama.cpp (managed by Gmind) | **1100** |
| LM Studio (default) | 1234 |
| Jan (default) | 1337 |
| Ollama | 11434 (стандарт) |

---

## Архитектура

```
model-servers.json (в GMIND_DATA_DIR)
  ↓ Load/Save
backend/internal/model_servers/model_servers.go
  ↓ GET/PUT /api/v1/model-servers
backend/internal/api/model_servers.go
  ↓ fetch
frontend/src/api/modelServers.ts
  ↓ render
frontend/src/components/AIServerPanel/AIServerPanel.tsx (секция External Model Servers)
```

---

## Backend: model_servers package

```go
// backend/internal/model_servers/model_servers.go
type Server struct {
    Name     string `json:"name"`
    Endpoint string `json:"endpoint"` // http://localhost:1100/v1
    Type     string `json:"type"`     // "openai" | "ollama" | "llama"
    Port     int    `json:"port"`
}
type Config struct {
    Servers []Server `json:"servers"`
}

func Load(path string) (*Config, error)   // возвращает Default() если файл отсутствует
func Save(path string, cfg *Config) error
func Default() *Config                    // llama.cpp:1100, LM Studio:1234, Jan:1337
```

**Config path:** `MODEL_SERVERS_CONFIG` env → default `GMIND_DATA_DIR/model-servers.json`

---

## API endpoints

```
GET  /api/v1/model-servers  → { servers: [...] }
PUT  /api/v1/model-servers  → { servers: [...] }  (body: Config JSON)
```

Handler: `backend/internal/api/model_servers.go` → `NewModelServersHandler(cfg.ModelServersConfigPath)`

Роуты в `router.go`:
```go
msHandler := NewModelServersHandler(cfg.ModelServersConfigPath)
r.Get("/api/v1/model-servers", msHandler.List)
r.Put("/api/v1/model-servers", msHandler.Save)
```

---

## Frontend API

```ts
// frontend/src/api/modelServers.ts
interface ModelServer { name: string; endpoint: string; type: 'openai'|'ollama'|'llama'; port: number }
interface ModelServersConfig { servers: ModelServer[] }

getModelServers(): Promise<ModelServersConfig>
saveModelServers(cfg: ModelServersConfig): Promise<ModelServersConfig>
```

---

## UI (AIServerPanel)

Секция «External Model Servers» между Ollama и OpenAI:
- Таблица: Name | Endpoint | Type | [Use] | [✕]
- Кнопка **«Use»** → `api.switchAIProvider('local', srv.endpoint)`
- Кнопка **«+ Add»** → инлайн-форма (name, endpoint, type, port)
- Кнопка **«✕»** → удалить и сохранить
- Дефолтный endpoint в форме: `http://localhost:1100/v1`, port fallback: 1100

---

## Расширение: добавить новый model-сервер

1. Пользователь вводит name/endpoint/type в AIServerPanel → «Save»
2. PUT `/api/v1/model-servers` обновляет `model-servers.json`
3. «Use» переключает активный provider → `POST /api/v1/ai/provider {provider: "local", endpoint: "..."}`

---

## Связанные файлы

| Файл | Назначение |
|------|-----------|
| `backend/internal/model_servers/model_servers.go` | Load/Save/Default |
| `backend/internal/api/model_servers.go` | HTTP handler (List/Save) |
| `backend/internal/api/router.go` | Регистрация GET/PUT /api/v1/model-servers |
| `backend/internal/config/config.go` | `ModelServersConfigPath` + `MODEL_SERVERS_CONFIG` env |
| `frontend/src/api/modelServers.ts` | API клиент |
| `frontend/src/components/AIServerPanel/AIServerPanel.tsx` | UI таблица |
