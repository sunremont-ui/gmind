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

---

## Локальные llama.cpp модели (2026-06-01)

Выбор локальной модели для запуска — **выпадающим списком** в секции llama.cpp той же панели Local AI Server. Модели сканируются рекурсивно из `E:\LlamaCpp\models` (подпапки llm/code/vision/stt/tts + корень).

### Backend — multi-instance менеджер

```
backend/internal/llama/manager.go   — Manager: List/Start/Stop/StopAll
backend/internal/api/llama.go       — LlamaFleetHandler
```

- `List()` — рекурсивный скан (.gguf/.bin/.safetensors), категория = подпапка.
- `Start(req)` — запуск модели на порту (несколько инстансов одновременно, защита от коллизий портов).
- Бинарь авто-детект: `E:\LlamaCpp\llama-bin\llama-server.exe` → fallback build-путь.
- `StopAll()` на graceful shutdown (`main.go` defer).
- Тесты: `manager_test.go` — скан/категории/сортировка `List`, guard'ы `Start` (пустой путь, порт, missing binary, коллизии модель/порт), `Stop` non-running. Процессы не спавнятся.

### API

```
GET  /api/v1/llama/models        → { models_dir, models:[{path,name,category,size,running,port}], running:[...] }
POST /api/v1/llama/models/start  → { path, port, context?, gpu_layers?, threads? }
POST /api/v1/llama/models/stop   → { path }
```

(Прежние одиночные `/api/v1/llama/{status,start,stop,config}` остались — их использует Start/Stop сервера в панели.)

### Frontend

- `frontend/src/api/llamaFleet.ts` — `listLlamaModels`, `startLlamaModel`, `stopLlamaModel`.
- AIServerPanel, две независимые секции:
  - **Основной сервер**: `<select>` Model (optgroup по категориям) → подставляет полный путь в `config.model_path`; Start/Stop поднимает один сервер (переключает AI-провайдера на `local`). Текстовое поле «Model Path» убрано (дублировало список).
  - **Параллельные инстансы (fleet)**: список запущенных моделей с портом/ctx/gpu и кнопкой Stop у каждой; снизу — `<select>` модели (relative path, запущенные `disabled`) + порт + Start. Порт авто-инкрементится после старта. Поллинг `refreshFleet()` каждые 5 c обновляет состояние. Это управление **не** трогает основной сервер и не переключает провайдера — чистый supervisor процессов.

### История

Отдельная вкладка/модуль **«Local Models»** в NavRail (`modules/llama-fleet/`, `components/LlamaFleetPanel/`) была удалена — управление перенесено в Local AI Server. Multi-instance start/stop восстановлен inline-секцией «Параллельные инстансы» (2026-06-08). Фичур «создать N агентов от модели» по-прежнему отсутствует (восстанавливать из git при необходимости).
