# Gmind — Agent Memory
# ВАЖНО: Агент всегда отвечает на русском языке. Все сообщения только на русском.
# Это обязательное правило. Нарушение недопустимо.

> Этот файл читается в начале каждой сессии, чтобы восстановить контекст проекта.

## Стек

| Компонент | Технология | Примечание |
|---|---|---|
| Backend | Go | chi router, modernc.org/sqlite, gorilla/websocket |
| Frontend | React 18 + Vite + TypeScript | Zustand store, SVG rendering |
| AI | OpenAI GPT-4o / Local llama-server / Yandex GPT | generate / chat / expand; dynamic provider switching, `folder_id` |
| Wiki | Файловое .md хранилище | CRUD, полнотекстовый поиск, wiki-tools для агентов |
| MCP Server | JSON-RPC 2.0 | initialize, tools/list, tools/call, wiki tools |
| Export | .xmind (ZIP + JSON) | совместимость с XMind 2020+ |

## Структура

```
gmind/
├── backend/           # Go backend
│   ├── cmd/server/    # main.go — точка входа, регистрация модулей
│   └── internal/
│       ├── model/     # Topic, Sheet, Workbook, types
│       ├── store/     # SQLite CRUD
│       ├── api/       # HTTP handlers (chi router)
│       ├── ws/        # WebSocket hub
│       ├── ai/        # AI integration (OpenAI, Yandex GPT, llama-server)
│       ├── xmind/     # .xmind import/export
│       ├── wiki/      # Wiki module — файловое .md хранилище, CRUD, поиск
│       ├── mcp/       # MCP Server — JSON-RPC 2.0 protocol
│       └── config/    # Env config
├── frontend/          # React app
│   └── src/
│       ├── types/     # TypeScript interfaces
│       ├── api/       # HTTP + WS clients
│       ├── store/     # Zustand stores (mindmap, theme, agent, layout)
│       ├── renderer/  # Layout engine + SVG renderer
│       └── components/
│           ├── MindMap/    # MindMap, TopicNode, ErrorBoundary
│           ├── Sidebar/    # Workbook list
│           ├── AIPanel/    # AI chat/generate
│           ├── AIServerPanel/  # Локальный AI сервер (llama-server)
│           ├── PropertiesPanel/  # Редактор свойств топика
│           ├── ShareDialog/  # Доступ и шаринг
│           ├── PresencePanel/  # Онлайн пользователи
│           └── StylePanel/  # Стилизация нод
├── scripts/           # Dev utilities (start.ps1, build.ps1, clean.ps1, reset.ps1)
├── lumen/             # Lumen Design System (токены, UI-кит, превью)
└── wiki/              # Документация (11 страниц)
```

## Статус (MVP done, активная разработка)

### ✅ Реализовано (базовый MVP + v2–v3.2)

- ✅ REST API — CRUD workbooks/sheets/topics/relationships
- ✅ SVG mindmap render — MindMap, Org-Chart, Tree layouts
- ✅ Drag & Drop — long-press + connection line to target
- ✅ Inline editing — double-click редактор на ноде (foreignObject)
- ✅ Zoom & Pan — Ctrl+Scroll zoom, Shift+Drag pan, кнопки +/- в тулбаре
- ✅ Search — Ctrl+F, подсветка совпадений
- ✅ Undo/Redo — Ctrl+Z / Ctrl+Shift+Z, история 50 шагов
- ✅ WebSocket — real-time коллаборация (курсоры, уведомления)
- ✅ AI — generate + chat (GPT-4o / локальный llama-server / Yandex GPT)
- ✅ Dynamic AI provider switching — горячая замена OpenAI ↔ local ↔ Yandex GPT
- ✅ Export/Import .xmind
- ✅ 10 тем — Lumen (дефолт), Vivid, Sunset, Ocean, Forest, Midnight, Silicon, Lavender, Peach, Aurora
- ✅ Multiple sheets — вкладки в workbook
- ✅ Properties panel — редактор свойств топика (auto-save, markers, labels, rich_text)
- ✅ Multiple selection — Cmd/Ctrl+Click toggle, Delete all selected, Properties показывает count
- ✅ Pan by left-click drag на пустом холсте — Scroll=zoom, Alt больше не нужен
- ✅ Cycle protection в MoveTopic — `isDescendantOf()` проверка на бэкенде
- ✅ Copy/Paste — Ctrl+C/V с рекурсивным созданием через API
- ✅ Auto-layout animation — SVG transition на transform/opacity
- ✅ Tool Panel — 🖱 ➕ 📄 панель инструментов слева от холста
- ✅ View History — ◀▶ кнопки, Alt+←→ навигация по выбору топиков
- ✅ Keyboard shortcuts — Del, Ctrl+Z, Ctrl+F, Ctrl+C/V, Alt+←→, Scroll
- ✅ ErrorBoundary — защита от краша
- ✅ Help overlay — подсказка при загрузке
- ✅ Drag connection line — визуальная линия при перетаскивании к цели
- ✅ Radial layout — 8-направленное расположение (4 кардинальных + 4 диагональных)
- ✅ Floating topics — независимые узлы вне дерева, свободное перемещение
- ✅ Click-to-fold — клик по `+/−` на ноде сворачивает/разворачивает детей
- ✅ Collapse/expand animation — плавная анимация (opacity + transform)

### ✅ Реализовано (v2.5 — Apple Design + Node Customization)

- ✅ **Apple Design System** — SF Pro typography, 8px grid, frosted glass (backdrop-filter), macOS-style Header/Sidebar, pill buttons
- ✅ **Layout Spacing UI** — ползунки Level Gap / Sibling Gap / Child Gap, persist в localStorage
- ✅ **Node Height** — `topic.node_height` (28–120px), override дефолтных 40px
- ✅ **Border Color** — `topic.border_color` (color picker), per-node
- ✅ **Connection Color** — `topic.connection_color` (color picker), per-node
- ✅ **Shadow Presets** — 4 уровня: None / Soft / Medium / Strong (SVG feDropShadow)
- ✅ **Node Style** — 4 стиля: Solid / Gradient / Glass (backdrop-filter blur) / Outline (transparent fill)
- ✅ **Fold Icon** — 4 варианта: Chevron / Cross / Dot / Plus-Minus
- ✅ **Child Count Badge** — число детей на ноде, toggle в PropertiesPanel
- ✅ **Topic extended** — `node_height`, `border_color`, `connection_color`, `shadow_type`, `node_style`, `fold_icon`, `show_child_count`
- ✅ **Shadow filters** — 3 новых SVG фильтра в `<defs>`: `#shadow-soft`, `#shadow-medium`, `#shadow-strong`

### ✅ Реализовано (текущий спринт)

- ✅ **Yandex GPT Config UI** — секция Yandex GPT в AIServerPanel (API Key, Folder ID, Model поля + кнопки Use Yandex GPT / Use OpenAI)
- ✅ **SwitchAIProvider folder_id** — `folder_id` в `SwitchAIProviderRequest` (TS + Go), клиент `switchAIProvider` принимает `folderId`
- ✅ **Wiki Module** — `backend/internal/wiki/` с файловым .md хранилищем: CRUD, полнотекстовый поиск, тесты
- ✅ **Wiki Tools для агентов** — `wiki_search`, `wiki_read`, `wiki_write` в ToolRegistry + executor handlers; роль `writer` с доступом к wiki
- ✅ **MCP Server** — `backend/internal/mcp/`: JSON-RPC 2.0 протокол, методы `initialize`, `tools/list`, `tools/call`, HTTP эндпоинт `POST /api/v1/mcp`, 3 wiki tool
- ✅ **Конфиг WIKI_PATH** — env var `WIKI_PATH` (default `./wiki`)
- ✅ **API Typing** — авто-генерация TypeScript типов из Go structs (`gen-ts-types`), re-export в `index.ts`
- ✅ **Unified Error Handling** — `internalError()` helper, логирование 500 ошибок, generic message клиенту
- ✅ **Code Splitting** — динамический `import()` для export функций (SVG/PNG/PDF), `jspdf` загружается лениво
- ✅ **Quick Capture v2** — мини-окно (без overlay), авто-вставка `getSelection()`, теги (chips + пресеты), target selector (Inbox/любой workbook), офлайн
- ✅ **Web Share Target** — PWA принимает текст из системного Share (манифест `share_target` → `?text=` → Quick Capture)
- ✅ **Удаление дублирующейся панели** — нижняя правая панель удалена (Export/Import/Theme/Presence/AI — всё в тулбаре)

### ✅ Реализовано (V3.2 Editor)

- ✅ **Rich text в нодах** — форматирование (bold, italic, list) внутри foreignObject; `RichTextEditor.tsz`; `rich_text` поле в Go/TS моделях
- ✅ **Image nodes** — вставка изображений (URL/base64) в ноды; рендеринг через foreignObject + `<img>`
- ✅ **Hyperlink preview** — 🔗 иконка на ноде при наличии hyperlink; клик открывает URL; тултип с URL; пункт "Open Link" в контекстном меню
- ✅ **Callout / Notes popup** — клик по 📄 иконке открывает модальное окно с редактируемым текстом заметки
- ✅ **Node templates** — сохранение/загрузка стилей ноды как шаблонов; localStorage; UI в StylePanel
- ✅ **Fishbone layout** — Ishikawa diagram: root-эффект справа, причины чередуются по диагонали вверх/вниз
- ✅ **Multi-directional Layout** — единый параметр direction (right/left/down/up), 4 направления дерева
- ✅ **Контекстное меню** — 6 пунктов: Mindmap, Tree Right, Tree Left, Tree Down, Tree Up, Radial
- ✅ **Access Mode** — 4 режима: Public / Collaborators only / Agents only / Private
- ✅ **Share/Invite dialog** — приглашение collaborators по User ID, список collaborator'ов, toggle private/public
- ✅ **Collaborator API** — `POST/DELETE /workbooks/{id}/collaborators`, `GET /workbooks/{id}/collaborators`
- ✅ **Auto-layout button** — ⊞ кнопка в тулбаре: сброс gap'ов на дефолты + reset zoom/pan
- ✅ **Per-node spacing override** — `topic.level_gap` / `topic.sibling_gap` поля, UI в PropertiesPanel Advanced

### ✅ Реализовано (V3.3 — Коллаборация + V3.4 — Экспорт/Импорт)

- ✅ **PWA / Offline-first** — Service Worker, IndexedDB кэш, offline queue, install prompt, offline banner
- ✅ **PWA Install Prompt** — `beforeinstallprompt`, UI-компонент с кнопкой установки
- ✅ **Workbook delete button** — × кнопка на каждом workbook в Sidebar, hover-показ, confirm перед удалением
- ✅ **Quick Capture (Ctrl+Shift+I)** — глобальное модальное окно для быстрого ввода, сохранение в 📥 Inbox workbook
- ✅ **Inbox Workbook** — авто-создание при старте, отображается в Sidebar как отдельная секция
- ✅ **Command Palette (Ctrl+Alt+Space)** — поиск и запуск команд, ⌘K кнопка в хедере
- ✅ **Session restore** — сохранение lastWorkbookId/lastSheetId в offlineSettings, восстановление при офлайн старте
- ✅ **Sync on reconnect** — авто-воспроизведение pending_ops при возврате онлайн
- ✅ **Экспорт SVG/PNG/PDF** — выпадающее меню Export, jspdf для PDF
- ✅ **Импорт Markdown (.md)** — парсинг заголовков и списков
- ✅ **Импорт FreeMind (.mm)** — парсинг XML `<node TEXT="...">`
- ✅ **Import/Export dropdowns** — группировка форматов в тулбаре
- ✅ **Drag-and-drop file import** — перетаскивание .md/.mm/.xmind прямо на холст

### ✅ Реализовано (V3.5 — AI и UX)

- ✅ **AI Inline Expand** — ✨ кнопка на ноде, генерирует 3-5 детей через `ExpandTopic`
- ✅ **AI Summarize** — 📋 кнопка в тулбаре, диалог с суммаризацией mindmap
- ✅ **AI Image Generation** — 🎨 DALL-E 3, диалог с preview
- ✅ **Responsive sidebar** — toggle collapsible (≡/←), анимация ширины 260↔48px
- ✅ **Scrollable panels** — AIPanel/AgentPanel/PropertiesPanel скроллятся при переполнении
- ✅ **Sticky notes / Canvas** — наклейки на холсте (независимо от дерева)
- ✅ **Mindmap presentation mode** — режим презентации: шаг за шагом по узлам
- ✅ **Infinite canvas minimap** — мини-карта для навигации по большому холсту

### ✅ Инфраструктура и качество

- ✅ **Frontend тесты** — Vitest + Testing Library, 42 теста, 6 файлов
- ✅ **Backend тесты** — Go store/agent/api/ws: 56+ тестов
- ✅ **Docker** — docker-compose.yml + Dockerfiles (backend + frontend/nginx)
- ✅ **CI/CD** — GitHub Actions (ci.yml: backend lint/test/build, frontend lint/tsc/test/build, docker build)
- ✅ **Module System** — core.Module interface, Registry, EventBus, lifecycle с графом зависимостей
- ✅ **Agent System (MVP)** — CRUD агентов, 7 ролей, REST API, AgentPanel
- ✅ **run.bat** — один двойной клик для запуска обоих серверов

## Баги (все исправлены)

1. Layout: дети не двигались за родителем → `shiftSubtree`
2. Drag: race condition event listeners → `useRef`
3. MoveTopic: удаление раньше поиска → порядок операций
4. WebSocket: Strict Mode double-mount → guard `readyState`
5. Nested SVG: двойной `<svg>` → renderer возвращает `<g>`
6. `collectBounds` не вызывался → добавлен вызов
7. App.tsx: missing `gradients` import → ReferenceError
8. App.tsx: `setInitializing` undefined → мёртвый код удалён
9. TopicNode.tsx: CSS `font` shorthand в SVG → отдельные свойства
10. PropertiesPanel/StylePanel: NaN при вводе font size → `isNaN` guard
11. Fold Animation: children не анимировали скрытие → `visibility` применяется после transition
12. Chevron Hit Area: мелкая хит-область → увеличена в 2x

## Баги (все исправлены, задокументированы в wiki/07-improvements.md)

1. Layout: дети не двигались за родителем → shiftSubtree
2. Drag: race condition event listeners → useRef
3. MoveTopic: удаление раньше поиска → порядок операций
4. WebSocket: Strict Mode double-mount → guard readyState
5. Nested SVG: двойной <svg> → renderer возвращает <g>
6. collectBounds не вызывался → добавлен вызов
7. App.tsx: missing `gradients` import → ReferenceError
8. App.tsx: `setInitializing` undefined → мёртвый код удалён
9. TopicNode.tsx: CSS `font` shorthand в SVG → отдельные свойства
10. PropertiesPanel/StylePanel: NaN при вводе font size → isNaN guard

## Module System

- **`backend/internal/core/`** — ядро: Module interface, Registry, EventBus, Lifecycle с графом зависимостей
- **`backend/internal/agent/`** — Agent Module: Registry + Manager (implements core.Module), WorkerPool, TaskStore
- **`backend/internal/api/module.go`** — HTTP handlers для агентов (CRUD), модульные endpoints
- **`backend/internal/wiki/`** — Wiki Module: файловое .md хранилище, CRUD, полнотекстовый поиск, тесты
- **`backend/internal/mcp/`** — MCP Server: JSON-RPC 2.0 protocol (initialize, tools/list, tools/call), wiki tools
- **Frontend**: `store/agent.ts` (Zustand store), `AgentPanel.tsx`, `AgentCard.tsx`, `types/agent.ts`, `api/agent.ts`
- **Пер‑агент модель/провайдер** — `AgentCreateRequest` поддерживает `provider`/`model`, UI в `AgentCreateDialog`
- **Yandex GPT** — новый провайдер в AI модуле, `folder_id` в `SwitchAIProviderRequest`

### Как добавить новый модуль
1. Создать `internal/<name>/` с реализацией `core.Module`
2. В `Init()` подписаться на события через `deps.EventBus.Subscribe()`
3. Зарегистрировать в `main.go`: `registry.Register(myModule)`
4. Если нужны HTTP руты — создать handler и добавить в chi router

## Критические API эндпоинты

| Метод | Path | Назначение |
|---|---|---|
| GET | /api/v1/workbooks | Список workbook'ов |
| POST | /api/v1/workbooks | Создать workbook |
| GET | /api/v1/workbooks/{id} | Получить workbook |
| PUT | /api/v1/workbooks/{id} | Обновить (в т.ч. полный restore) |
| DELETE | /api/v1/workbooks/{id} | Удалить workbook |
| POST | /api/v1/workbooks/{id}/sheets | Создать sheet |
| POST | /api/v1/workbooks/{id}/topics | Создать topic |
| PUT | /api/v1/workbooks/{id}/topics/{topicId} | Обновить topic |
| DELETE | /api/v1/workbooks/{id}/topics/{topicId} | Удалить topic |
| POST | /api/v1/workbooks/{id}/topics/{topicId}/move | Move topic |
| POST | /api/v1/workbooks/{id}/floating-topics | Создать floating topic |
| PUT | /api/v1/workbooks/{id}/floating-topics/{topicId} | Обновить floating topic |
| DELETE | /api/v1/workbooks/{id}/floating-topics/{topicId} | Удалить floating topic |
| GET | /api/v1/workbooks/{id}/export | .xmind export |
| POST | /api/v1/workbooks/import | .xmind import |
| POST | /api/v1/workbooks/{id}/collaborators | Добавить collaborator'а |
| DELETE | /api/v1/workbooks/{id}/collaborators/{userId} | Удалить collaborator'а |
| GET | /api/v1/workbooks/{id}/collaborators | Список collaborator'ов |
| POST | /api/v1/workbooks/{id}/import-json | Import JSON для AI контекста |
| DELETE | /api/v1/workbooks/{id}/import-json | Очистить импортированные данные |
| — | `api.importTopicTree()` | Client-side: рекурсивный импорт (markdown/freemind) |
| — | `api.importXMind(file)` | Client-side: FormData upload → Workbook |
| WS | /ws | WebSocket |
| GET | /api/v1/modules | Список модулей |
| GET | /api/v1/agents | Список агентов |
| POST | /api/v1/agents | Создать агента |
| DELETE | /api/v1/agents/{id} | Удалить агента |
| GET | /health | Health check |
| POST | /api/v1/ai/provider | Switch AI provider (openai / local / yandex) |
| POST | /api/v1/ai/yandex/config | Yandex GPT: настроить API Key + Folder ID |
| GET | /api/v1/llama/status | Статус локального AI сервера |
| POST | /api/v1/llama/start | Запустить llama-server |
| POST | /api/v1/llama/stop | Остановить llama-server |
| PUT | /api/v1/llama/config | Обновить конфиг |
| POST | /api/v1/llama/config/save | Сохранить конфиг |
| POST | /api/v1/mcp | MCP Server — JSON-RPC 2.0 (initialize, tools/list, tools/call) |
| GET | /api/v1/wiki/search | Wiki: полнотекстовый поиск |
| GET | /api/v1/wiki/{name} | Wiki: получить страницу |
| PUT | /api/v1/wiki/{name} | Wiki: обновить страницу |
| GET | /api/v1/wiki/list | Wiki: список страниц |

## Команды запуска

```bash
# Backend
cd gmind/backend && go run ./cmd/server

# Frontend
cd gmind/frontend && npm run dev

# Всё сразу (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts/start.ps1

# Или через run.bat (двойной клик)
```

## WebSocket

- Эндпоинт: `ws://localhost:8080/ws` (через Vite proxy: `ws://localhost:5173/ws`)
- Клиент: `WSClient` (frontend/src/api/ws.ts)
- Подключение: `connect(workbookId, userId, userName, userColor)` → `join` message
- Синхронизация: REST + WS (update broadcast → reload)
- Phase 1: курсоры + presence (on/off)
- Phase 2: operation sync (CRUD broadcast без full reload)

## Layout Engine (frontend/src/renderer/layout.ts)

- `buildLayout(topic)` → LayoutNode tree (x=0, y=0, все children включая folded)
- `computeTreeLayout(root, structure, structMap, gaps)` → позиции + сдвиг
- `Direction` type: `'right' | 'left' | 'down' | 'up'`
- 7 layout algorithms: mindmap, tree-right, tree-left, tree-down, tree-up, org-chart (синоним tree-down), radial
- `layoutTreeVertical(n, children, direction, siblingGap, levelGap)` — down/up
- `layoutTreeHorizontal(n, children, direction, siblingGap, levelGap)` — right/left
- `shiftSubtree(child, dx, dy)` — коррекция потомков при перепозиционировании
- `postProcessFolded()` — коллапс свёрнутых поддеревьев к позиции parent

## Frontend State (Zustand)

- `useMindMapStore` — workbook, activeSheetId, selectedTopicId, CRUD-методы
- `useThemeStore` — активная тема
- `useAgentStore` — агенты, задачи, подписка на WS-события, per-agent model/provider
- `useLayoutStore` — LayoutGaps (siblingGap, levelGap, childGap), persist в localStorage

## Wiki

- `wiki/` — 11 страниц документации
- `index.md` — обзор, статус, оглавление, структура репозитория, быстрый старт
- `07-improvements.md` — road-map, известные проблемы, история реализованных фич
- `09-layout-directions.md` — spec многонаправленной раскладки

## Dev-инструменты

- `scripts/start.ps1` — одновременный запуск backend + frontend
- `scripts/build.ps1` — сборка всего
- `scripts/clean.ps1` — очистка кэша
- `scripts/reset.ps1` — полный сброс (БД + кэш)
- `Makefile` — цели: dev, build, clean, lint, test
- `run.bat` — двойной клик для запуска обоих серверов (Windows)

## Task Plans

### Коллаборация (V3.3) — частично реализовано
- [x] **OT/CRDT** — операционные трансформации для настоящей совместной работы без конфликтов
- [ ] **Comments** — комментирование конкретных нод, треды
- [ ] **History timeline** — временная шкала изменений документа
- [ ] **Shareable links** — публичные ссылки на workbook с read-only доступом

### V3.4 — Экспорт/Импорт
- [ ] **Export Markdown** — обратный экспорт mindmap в .md
- [ ] **Export FreeMind** — обратный экспорт в .mm
- [ ] **Import OPML** — для совместимости с другими mindmap-инструментами
- [ ] **Batch import** — массовый импорт нескольких файлов

### V3.7 — Agent Ecosystem
- [x] **Agent Zustand store** — `store/agent.ts`
- [x] **Per-agent model/provider** — выбор модели и провайдера
- [ ] **Agent task submission UI** — кнопка "Submit Task" на AgentCard
- [ ] **Agent streaming** — WebSocket стриминг мыслей/действий агента
- [ ] **Agent chaining** — передача результата одного агента другому
- [ ] **Per-agent model presets** — выпадающий список моделей
- [ ] **Agent schedule** — отложенные/периодические задачи

### V4.0 — Performance & Native
- [ ] **Worker-based layout** — Web Worker для тяжёлых деревьев (1000+ nodes)
- [ ] **Canvas/SVG hybrid** — Canvas для рендера + SVG overlay
- [ ] **Virtual scrolling** — виртуализация для списков
- [ ] **Lazy topic loading** — lazy loading глубоких поддеревьев
- [ ] **Tauri desktop** — нативное приложение с Tauri v2

## Новые файлы (накопившиеся)
- `frontend/src/store/agent.ts` — Zustand store для агентов
- `frontend/src/store/layout.ts` — Zustand store для LayoutGaps
- `frontend/src/utils/export.ts` — SVG/PNG/PDF export
- `frontend/src/utils/markdown.ts` — Markdown парсер
- `frontend/src/utils/freemind.ts` — FreeMind XML парсер
- `frontend/src/utils/opmlExport.ts` — OPML export
- `frontend/src/utils/sync.ts` — sync utilities
- `frontend/src/utils/templates.ts` — Node templates (save/load)
- `frontend/src/utils/inbox.ts` — Inbox workbook utilities
- `frontend/src/components/PresencePanel/PresencePanel.tsx` — панель онлайн пользователей
- `frontend/src/components/ShareDialog/ShareDialog.tsx` — шаринг и доступ
- `frontend/src/components/AIServerPanel/AIServerPanel.tsx` — управление llama-server
- `skills/*.md` — 20 скилов-документов
- `lumen/` — Lumen Design System (токены, UI-кит, превью)

---

> Последнее обновление: см. git log.
> Синхронизация с wiki/ при каждом изменении — через auto-update skill.
