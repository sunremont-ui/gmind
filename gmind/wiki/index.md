# Gmind Wiki

**Gmind** — облачное mindmap-приложение на Go + React. Аналог XMind с AI-функциями (GPT-4o, Yandex GPT, локальный llama-server) и real-time коллаборацией.

## Статус проекта

MVP готов, активная разработка. Backend и frontend собраны и работают. Основные фичи реализованы, известные баги исправлены.

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
- ✅ Agent System (CRUD агентов, 7 ролей, REST API, AgentPanel)
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

**Известные проблемы:** нет открытых критических багов.

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

## Быстрый старт

Самый простой способ — двойной клик на `run.bat`, или:

```bash
# Оба сервера одновременно:
cd gmind && powershell -ExecutionPolicy Bypass -File scripts/start.ps1

# Или раздельно:
cd gmind/backend && go run ./cmd/server   # терминал 1
cd gmind/frontend && npm run dev          # терминал 2
```

Откройте http://localhost:5173

## Структура репозитория

```
gmind/
├── backend/              # Go (chi, SQLite, WebSocket, AI, Wiki, MCP)
│   └── cmd/server/       # main.go — точка входа
├── frontend/             # React + Vite + TypeScript
│   └── src/              # Компоненты, store, renderer, API
├── scripts/              # Dev-утилиты (start, build, clean, reset)
├── lumen/                # Lumen Design System (токены, UI-кит)
├── wiki/                 # Документация (11 страниц)
├── run.bat               # Двойной клик → запуск обоих серверов
└── Makefile              # make dev, make build, make clean
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

Откройте http://localhost:5173

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
