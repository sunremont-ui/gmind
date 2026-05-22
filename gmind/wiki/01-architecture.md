# Архитектура Gmind

## Обзор

**Gmind** — desktop + web приложение для создания mind map (интеллект-карт), вдохновлённое XMind. Поддерживает real-time коллаборацию, AI-генерацию, экспорт в `.xmind`, zoom/pan, поиск, undoredo и inline-редактирование через SVG `<foreignObject>`.

**Стек:**
- **Бэкенд:** Go + SQLite (pure Go, без CGO, через `modernc.org/sqlite`)
- **Фронтенд:** React 18 + Vite + TypeScript + SVG (без canvas/WebGL)
- **Desktop:** Tauri v2 (Rust) — Go backend как sidecar, system tray, global shortcut, Stronghold
- **AI:** OpenAI API (GPT-4o) + Yandex GPT + Ollama + локальный llama-server
- **WebSocket:** gorilla/websocket — real-time коллаборация
- **Wiki:** файловое .md хранилище с CRUD и полнотекстовым поиском
- **MCP Server:** JSON-RPC 2.0 протокол для интеграции с AI-агентами
- **MASys:** двусторонняя интеграция — Gmind API доступен из MASys пайплайнов; Gmind-агенты могут запускать MASys пайплайны

## Структура проекта

```
gmind/
├── backend/
│   ├── cmd/server/main.go        # Точка входа, регистрация модулей
│   └── internal/
│       ├── model/                # Модели данных
│       │   ├── workbook.go       # Workbook: контейнер листов
│       │   ├── sheet.go          # Sheet: страница с root topic
│       │   ├── topic.go          # Topic: узел дерева
│       │   └── types.go          # Все типы + request/response
│       ├── store/                # SQLite store
│       │   ├── db.go             # Основное CRUD (workbooks JSON blob)
│       │   └── migrations/       # SQL-миграции (embed.FS)
│       ├── api/                  # HTTP handlers
│       │   ├── router.go         # Chi router + CORS + /ws route
│       │   ├── workbook.go       # CRUD workbooks
│       │   ├── sheet.go          # CRUD sheets
│       │   ├── topic.go          # CRUD topics + move + relationships
│       │   ├── ai_handlers.go    # AI endpoints (generate, chat, provider)
│       │   ├── yandex.go         # Yandex GPT handler
│       │   ├── llama.go          # llama-server управление
│       │   ├── module.go         # Module endpoints (/api/v1/modules)
│       │   ├── agent/            # Agent CRUD endpoints
│       │   ├── wiki/             # Wiki HTTP endpoints
│       │   ├── mcp/              # MCP Server endpoints
│       │   └── middleware.go     # AI context middleware
│       ├── ws/                   # WebSocket
│       │   └── hub.go            # WebSocket hub (register, broadcast)
│       ├── ai/                   # AI интеграция
│       │   └── ai.go             # OpenAI + Yandex GPT + llama-server
│       ├── xmind/                # XMind формат
│       │   ├── export.go         # Экспорт в .xmind
│       │   └── import.go         # Импорт .xmind
│       ├── wiki/                 # Wiki module
│       │   ├── store.go          # Файловое .md хранилище, CRUD, поиск
│       │   └── module.go         # Wiki module (core.Module)
│       ├── mcp/                  # MCP Server
│       │   └── server.go         # JSON-RPC 2.0 protocol handler
│       ├── config/config.go      # Конфигурация (env vars)
│       └── core/                 # Module system ядро
│           ├── module.go         # Module interface, Lifecycle
│           ├── registry.go       # Registry (Register, StartAll, StopAll)
│           ├── eventbus.go       # EventBus (pub-sub)
│           └── dependencies.go   # Dependencies (Logger, Store, Config)
├── frontend/
│   └── src/
│       ├── types/                # TypeScript интерфейсы
│       │   ├── index.ts          # Общие типы (re-export из api.ts)
│       │   ├── api.ts            # API-типы (авто-генерация из Go)
│       │   ├── agent.ts          # Agent типы
│       │   └── theme.ts          # Тема mindmap типы
│       ├── api/                  # HTTP + WS клиенты
│       │   ├── client.ts         # HTTP fetch wrapper
│       │   ├── ws.ts             # WebSocket клиент
│       │   ├── agent.ts          # Agent API клиент
│       │   └── errors.ts         # Error типы
│       ├── store/                # Zustand stores
│       │   ├── mindmap.ts        # Workbook, sheet, selection, CRUD
│       │   ├── theme.ts          # Активная тема
│       │   ├── agent.ts          # Агенты, задачи, WS-подписка
│       │   └── layout.ts         # LayoutGaps (persist в localStorage)
│       ├── renderer/             # Layout + SVG renderer
│       │   ├── layout.ts         # Layout engine (buildLayout, computeTreeLayout)
│       │   └── renderer.tsx      # SVG renderer (MindMapRenderer)
│       └── components/
│           ├── MindMap/          # Основной mindmap компонент
│           │   ├── MindMap.tsx       # Drag, zoom, pan, undo, search
│           │   ├── TopicNode.tsx     # SVG нода (foreignObject, rich text)
│           │   ├── RichTextEditor/   # ContentEditable + toolbar
│           │   ├── RelationshipLine.tsx  # Линия связи
│           │   ├── ErrorBoundary.tsx     # Защита от краша
│           │   ├── HelpOverlay.tsx       # Подсказка с шорткатами
│           │   └── SearchBar.tsx         # Поисковая строка
│           ├── Sidebar/           # Список workbook'ов
│           ├── AIPanel/           # AI панель (generate + chat)
│           ├── AIServerPanel/     # Управление llama-server
│           ├── PropertiesPanel/   # Панель свойств топика
│           ├── ShareDialog/       # Доступ + шаринг
│           ├── PresencePanel/     # Онлайн пользователи
│           ├── StylePanel/        # Стилизация нод (тени, цвета)
│           └── UI/                # UI примитивы (Box, Forms, AnimatedMount)
├── scripts/                       # Dev-утилиты
│   ├── start.ps1                  # Одновременный запуск backend + frontend
│   ├── build.ps1                  # Сборка
│   ├── clean.ps1                  # Очистка кэша
│   └── reset.ps1                  # Полный сброс
├── lumen/                         # Lumen Design System
│   ├── README.md                  # Описание системы
│   ├── SKILL.md                   # Манифест скилла
│   ├── colors_and_type.css        # CSS-переменные токенов
│   ├── assets/                    # Логотипы
│   ├── preview/                   # 60+ HTML specimen
│   └── ui_kits/lumen-app/         # Референсный дашборд (JSX)
└── wiki/                          # Документация (11 страниц)
```

## Data Flow

```
User → React (SVG) → API Client → HTTP/WS → Go API → SQLite
                                               ↓
                                    ┌──→ AI (OpenAI / Yandex GPT / llama-server)
                                    ├──→ XMind Export (ZIP)
                                    ├──→ Wiki (file-based .md storage)
                                    └──→ MCP Server (JSON-RPC 2.0)
```

## Компонентная модель

```
Workbook (1)
  └── Sheet (N)
       ├── RootTopic (1)
       │    └── Topic (N)
       │         └── Topic (N) ...
       └── Relationship (N) ─── связь между двумя Topic

Module System:
  Core (EventBus, Registry, Lifecycle)
    ├── Agent Module (CRUD, WorkerPool, TaskStore)
    ├── Wiki Module (file .md, CRUD, search)
    └── MCP Server (JSON-RPC 2.0, wiki tools)
```

## Key Design Decisions

### 1. JSON blob в SQLite
Вся структура workbook'а хранится как JSON в единственной таблице `workbooks`. Это даёт:
- Гибкость схемы (не нужны миграции при добавлении полей)
- Простоту (один read/write на запрос)
- Минус: конкурентные записи — последний wins

### 2. Pure Go SQLite
`modernc.org/sqlite` вместо `mattn/go-sqlite3` — не требует CGO, работает на любых платформах, в т.ч. Alpine Linux (Docker).

### 3. Плоский layout (абсолютные координаты)
Layout engine вычисляет абсолютные координаты для каждого узла (не относительные). Renderer использует `<g transform="translate(x, y)">` в SVG. Это упрощает расчёт связей и drag-n-drop.

### 4. Zoom/Pan через SVG `<g transform>`
Zoom и pan реализованы через трансформацию общего контейнера: `<g transform="scale(zoom) translate(panX, panY)">`. Все координаты остаются в SVG-пространстве. Для пересчёта viewport → SVG используется `getBoundingClientRect()` + обратная трансформация.

### 5. Undo/Redo через снэпшоты
История основана на полных снэпшотах workbook (JSON). `pushHistory()` сохраняет копию перед каждым изменением. `pop()`/`forward()` восстанавливает снэпшот на клиенте и отправляет PUT на сервер (full restore). Максимум 50 шагов. Плюсы: простота, минус: память.

## Known Gotchas (2026-05-17)

| Проблема | Место | Фикс |
|---------|-------|------|
| `api.New` паникует на nil store | `router.go` health handler + webhook init | nil guard: `if s != nil { ... }` |
| In-memory SQLite — несколько соединений пула | `store/db.go` | `db.SetMaxOpenConns(1)` для `:memory:` |
| `InitTaskStore` stale queue ref | `agent/module.go` | `m.manager.taskQueue = m.TaskQueue` после rebind |
| Go nil-slice → JSON null | Все List-хендлеры | `make([]*T, 0)` вместо `var x []*T` |
| `api.New` signature (5 args) | Тесты | `New(store, hub, cfgPath, registry, scheduleStore)` |
| SSE `taskBrokers` memory leak | `api/sse.go` | TTL cleanup goroutine (30min) + `removeBrokerIfEmpty` на disconnect |
| `TaskQueue.done` unbounded | `agent/task.go` | FIFO cap 500 через `doneOrder []string` + `addDone()` |
| Tauri window white flash | `tauri.conf.json` + `lib.rs` | `visible: false` + `w.show()` после spawn sidecar |
| `update_main_shortcut` hardcoded | `lib.rs` | `CurrentMainShortcut(Mutex<String>)` managed state |

## Зависимости (Go)

- `github.com/go-chi/chi/v5` — HTTP router
- `github.com/go-chi/cors` — CORS middleware
- `github.com/google/uuid` — UUID generation
- `github.com/gorilla/websocket` — WebSocket
- `modernc.org/sqlite` — SQLite (pure Go)
- `github.com/sashabaranov/go-openai` — OpenAI API

## Зависимости (Frontend)

- `react` + `react-dom` (18.x) — UI framework
- `zustand` — State management
- `vite` — Bundler + dev server
- `typescript` — Type safety
