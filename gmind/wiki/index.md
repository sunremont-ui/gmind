# Gmind Wiki

**Gmind** — desktop mindmap-приложение на Go + React + Tauri v2. Аналог XMind с AI-функциями (GPT-4o, Yandex GPT, Ollama, локальный llama-server), real-time коллаборацией и интеграцией с MASys.

## Статус проекта

**V4.1 Agent Persistence — DONE (2026-05-17).** Агенты теперь хранятся в SQLite (таблица `agents`, миграция 007). Workers авто-стартуют при загрузке. Go: 6/6 пакетов зелёные, Vitest: 62/62.

**V4.0 Modular Platform — DONE (2026-05-16).** Nav Rail, 5 модулей, Notes Module, Extensible Tools.

**V4.3 Multi-Agent Orchestration — DONE (2026-05-22).** `parallel_delegate` + `list_agents` tools, роль `supervisor`, `Task.ParallelGroupID`.

**V4.4 Parallel UI + Export — DONE (2026-05-22).** TaskList grouped card по `parallel_group_id`; backend `/export/freemind` endpoint.

**V5.0 Graph Relationships — Backend DONE (2026-05-22).** Phase 1-3: миграция 010, RelationshipStore + Traverse + DetectCycles, REST API, 6 agent tools в category `graph`. Поддержка multi-edge, 3 направлений, cross-sheet/workbook, self-loop, циклов.

**V5.0 Phase 4-5 — Frontend Graph UI DONE (2026-06-01).** EdgeAnchorsLayer + FantomLine + ConnectionPopover + RelationshipPanel + RelationshipFilter, decorator pattern без правки TopicNode. Multi-edge offset, self-loop arcs, hover-highlight, filter по типу.

**Активный roadmap:** V6.0 Memory & Pipeline Workbench (visual workbench для MASys памяти + пайплайнов, см. `skills/memory-visualization.md`).

**Что работает:**
- ✅ REST API (CRUD workbooks/sheets/topics/relationships, floating topics, AI provider, llama-server, import-json, collaborators, MCP)
- ✅ SVG рендеринг mindmap (MindMap, Org-Chart, Tree, Radial, Fishbone)
- ✅ Drag & Drop перетаскивание топиков (long-press + визуальная линия-подтверждение)
- ✅ Inline editing (double-click на ноде через SVG `<foreignObject>`, rich text: bold/italic/lists)
- ✅ Zoom (Scroll) & Pan (левый клик + drag по холсту), 10–500%
- ✅ Поиск (Ctrl+F, подсветка совпадений)
- ✅ Undo/Redo (Ctrl+Z / Ctrl+Shift+Z, история 50 шагов)
- ✅ Copy/Paste (Ctrl+C/V, копирует топики с поддеревьями)
- ✅ Multiple selection (Cmd/Ctrl+Click, массовое удаление)
- ✅ Контекстное меню (правый клик: add/rename/delete/change layout)
- ✅ 10 тем mindmap: Lumen, Vivid, Sunset, Ocean, Forest, Midnight, Silicon, Lavender, Peach, Aurora
- ✅ Multiple sheets (вкладки)
- ✅ WebSocket real-time (курсоры с именами, presence, operation sync)
- ✅ AI генерация и чат (OpenAI GPT-4o + Yandex GPT + локальный llama-server)
- ✅ Dynamic AI provider switching (горячая замена OpenAI ↔ local ↔ Yandex)
- ✅ Экспорт/импорт .xmind
- ✅ Properties panel (редактор свойств топика, auto-save, markers, labels, rich_text, images)
- ✅ Radial layout (8 направлений)
- ✅ Floating topics (независимые узлы вне дерева)
- ✅ Click-to-fold (`+`/`−` на ноде)
- ✅ Collapse/expand animation (плавные SVG transitions + opacity)
- ✅ Защита от цикла при MoveTopic
- ✅ Zoom кнопки (+/-/сброс) в тулбаре
- ✅ Keyboard shortcuts (Del, Ctrl+Z, Ctrl+F, Ctrl+C/V, Scroll, Alt+←→)
- ✅ Help overlay (подсказка при загрузке)
- ✅ View History (◀▶ кнопки, Alt+←→ навигация)
- ✅ Tool Panel (🖱 Pointer / ➕ Add Topic / 📄 Floating)
- ✅ Import Markdown (.md), FreeMind (.mm), JSON
- ✅ Export SVG/PNG/PDF (выпадающее меню)
- ✅ PWA / Offline-first (Service Worker, IndexedDB, offline queue, install prompt)
- ✅ Command Palette (Ctrl+Alt+Space / ⌘K)
- ✅ Quick Capture v2 (мини-окно, теги, авто-вставка, офлайн)
- ✅ Web Share Target (PWA принимает текст из системного Share)
- ✅ Access Mode (Public / Collaborators / Agents / Private)
- ✅ Collaborator management (API + UI)
- ✅ Module System (core.Module, Registry, EventBus, lifecycle)
- ✅ Agent System (CRUD агентов, 7 ролей, REST API, AgentPanel, Submit Task, streaming, chaining)
- ✅ Agent Schedule — планировщик периодических задач (cron)
- ✅ MCP Server (JSON-RPC 2.0, wiki tools)
- ✅ Wiki Module (файловое хранилище, CRUD, полнотекстовый поиск)
- ✅ API Typing (авто-генерация TypeScript типов из Go structs)
- ✅ Responsive layout (toggle sidebar 260↔48px, scrollable panels)
- ✅ Yandex GPT интеграция (API Key, Folder ID, Model)
- ✅ Apple Design System (SF Pro, frosted glass, macOS-style)
- ✅ Node customization (node_height, border_color, connection_color, shadow, node_style, fold_icon, child_count_badge)
- ✅ Image nodes (вставка URL/base64 изображений в ноды)
- ✅ Hyperlink preview (🔗 иконка, тултип, Open Link в контекстном меню)
- ✅ Callout / Notes popup (📄 модальное окно с заметкой)
- ✅ Node templates (сохранение/загрузка стилей)
- ✅ Fishbone layout (Ishikawa diagram)
- ✅ React.memo + Viewport culling + useMemo оптимизации
- ✅ Multiplayer cursors with names
- ✅ Tauri v2 desktop (sidecar + system tray + Stronghold JS + global shortcut Ctrl+Shift+Space + health polling + GMIND_DATA_DIR)
- ✅ Production Windows installer (NSIS, Desktop+StartMenu shortcuts, auto-updater)
- ✅ CI/CD: GitHub Actions → `.msi` artifact + GitHub Release draft
- ✅ MASys интеграция: run_masys_pipeline tool + MaSysPanel + submit-agent-task
- ✅ Agent task streaming live indicator (Working/Thinking/Using tool)
- ✅ Agent chaining (persistent + ⛓️ визуализация)
- ✅ **V4.1 Agent Persistence** — SQLite-backed AgentStore (migrations/007), workers авто-стартуют при рестарте
- ✅ **V4.2 RAG Search** — semantic_search tool + GET /api/v1/search (OpenAI text-embedding-3-small, cosine similarity, pure Go)
- ✅ **V4.3 Multi-Agent Orchestration** — parallel_delegate (до 16 задач), list_agents, роль supervisor, миграция 009_parallel_groups
- ✅ **V4.4 Parallel UI + Export** — grouped TaskList card, backend FreeMind/Markdown endpoints
- ✅ **V5.0 Graph Relationships (backend)** — typed/directional edges, multi-edge, Traverse + DetectCycles, 6 agent tools, migration 010
- ✅ **V5.0 Graph Relationships (frontend Phase 4-5)** — drag-from-edge UI, FantomLine, ConnectionPopover, RelationshipPanel, RelationshipFilter, multi-edge offset, self-loop arcs
- ✅ Comments on nodes (💬 иконка + CommentsPanel)
- ✅ External Model Servers — JSON-конфиг + GET/PUT /api/v1/model-servers + UI таблица в AIServerPanel
- ✅ Port range 1010–1200: backend:1010, vite:1011, docker-nginx:1012, llama.cpp:1100
- ✅ **V4.0 Nav Rail** — 48px Activity Bar (VS Code-стиль): иконки без текста, tooltip, активный модуль
- ✅ **V4.0 Modular Platform** — AppModule interface, MODULE_REGISTRY (5 модулей), useShellStore
- ✅ **V4.0 Notes Module** — быстрые заметки (SQLite таблица notes, /api/v1/notes CRUD, NotesPanel UI)
- ✅ **V4.0 MaSys Module** — MaSysPanel выделен из AgentPanel как самостоятельный модуль
- ✅ **V4.0 Extensible Tools** — RegisterTool() + RegisterCallback() для плагинных agent tools
- ✅ **V4.0 Agent Tools** — save_note (notes) + search_notes (notes) в ToolRegistry

**Известные проблемы:** нет открытых критических багов. Последний баг-фикс (2026-05-17): nil panic в api.New + in-memory SQLite multi-conn в тестах — исправлены.

**Production Windows Desktop готов:** `cargo tauri dev` запускается, GMIND_DATA_DIR, Stronghold JS API, NSIS installer, CI/CD (GitHub Actions → `.msi`), auto-updater — всё реализовано.

## Содержание

| Раздел | Описание |
|---|---|
| [01 — Архитектура](01-architecture.md) | Стек, структура, data flow, key decisions |
| [02 — API Reference](02-api-reference.md) | Все REST endpoints + MCP + Wiki |
| [03 — WebSocket Protocol](03-websocket.md) | Real-time коллаборация |
| [04 — XMind Format](04-xmind-format.md) | Экспорт/импорт .xmind |
| [05 — Layout Engine](05-layout-engine.md) | SVG рендеринг, алгоритмы, баги |
| [06 — AI Integration](06-ai-integration.md) | OpenAI, Yandex GPT, llama-server |
| [07 — Улучшения](07-improvements.md) | Реализовано, проблемы, roadmap |
| [08 — Дизайн-система](08-design-system.md) | Lumen Design System, токены, темы |
| [09 — Layout Directions](09-layout-directions.md) | Многонаправленная раскладка |
| [10 — Privacy & Sharing](10-privacy-sharing.md) | Access modes, collaborators, private |
| [11 — Responsive Layout](11-responsive-layout.md) | Sidebar toggle, scrollable panels |
| [12 — Improvement Vectors](12-improvement-vectors.md) | Анализ векторов развития, приоритеты |
| [13 — MASys Integration](13-masys-integration.md) | Gmind ↔ MASys интеграция, gmind-mindmap, agent-loop |
| [14 — Agent/Node Integration](14-agent-node-integration.md) | Интерфейс агентов и REST API узлов mindmap |
| [15 — Modular Platform](15-modular-platform.md) | V4.0: Nav Rail, AppModule, Notes, MaSys, Extensible Tools |

## Быстрый старт

Самый простой способ — двойной клик на `run.bat`, или:

```bash
# Оба сервера одновременно:
cd gmind && powershell -ExecutionPolicy Bypass -File scripts/start.ps1

# Или раздельно:
cd gmind/backend && go run ./cmd/server   # терминал 1
cd gmind/frontend && npm run dev          # терминал 2
```

Откройте http://localhost:1011

## Структура репозитория

```
gmind/
├── backend/              # Go (chi, SQLite, WebSocket, AI, Wiki, MCP, Notes)
│   └── cmd/server/       # main.go — точка входа
│   └── internal/
│       ├── store/notes.go        # Notes CRUD
│       ├── api/notes.go          # /api/v1/notes handlers
│       └── migrations/006_notes  # Notes SQLite schema
├── frontend/             # React + Vite + TypeScript
│   └── src/
│       ├── modules/      # Модульная система (types, registry, 5 модулей)
│       ├── store/        # Zustand (mindmap, theme, agent, layout, shell, notes)
│       ├── components/
│       │   ├── NavRail/      # 48px Activity Bar
│       │   ├── NotesPanel/   # Quick Notes UI
│       │   └── MaSysPanel/   # MASys Pipelines
│       └── ...
│   └── src-tauri/        # Tauri v2 desktop обёртка (sidecar)
├── scripts/              # Dev-утилиты (start, build, clean, reset, build-sidecar)
├── lumen/                # Lumen Design System (токены, UI-кит)
├── wiki/                 # Документация (15 страниц)
├── run.bat               # Двойной клик → запуск обоих серверов
└── Makefile              # make dev, make build, make clean, tauri-*
```

Или раздельно:

```bash
# 1. Бэкенд
cd gmind/backend
go run ./cmd/server

# 2. Фронтенд (другой терминал)
cd gmind/frontend
npm run dev
```

Откройте http://localhost:1011

## Wiki

1. [Architecture](01-architecture.md)
2. [API Reference](02-api-reference.md)
3. [WebSocket](03-websocket.md)
4. [XMind Format](04-xmind-format.md)
5. [Layout Engine](05-layout-engine.md)
6. [AI Integration](06-ai-integration.md)
7. [Improvements & Roadmap](07-improvements.md)
8. [Design System](08-design-system.md)
9. [Layout Directions](09-layout-directions.md)
10. [Privacy & Sharing](10-privacy-sharing.md)
11. [Responsive Layout](11-responsive-layout.md)
12. [Improvement Vectors](12-improvement-vectors.md)
13. [MASys Integration](13-masys-integration.md)
14. [Agent/Node Integration](14-agent-node-integration.md)
15. [Modular Platform](15-modular-platform.md)

## Структура репозитория

```
gmind/
├── backend/        # Go (chi router, SQLite, WebSocket, AI)
│   └── cmd/server/ # main.go — точка входа
├── frontend/       # React + Vite + TypeScript
│   └── src/        # Компоненты, store, renderer, API
├── scripts/        # dev-утилиты (start.ps1, build, clean, etc.)
├── run.bat         # Двойной клик → запуск обоих серверов
├── Makefile        # Команды: make dev, make build, etc.
└── wiki/           # Эта документация
```
