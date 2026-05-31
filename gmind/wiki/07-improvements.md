# Улучшения

## Реализовано (MVP + v2–v3.5)

### Базовый MVP
- [x] REST API (CRUD workbooks/sheets/topics/relationships)
- [x] SVG рендеринг mindmap (layout engine: mindmap, org-chart, tree, radial, fishbone)
- [x] WebSocket real-time коллаборация (курсоры, presence, operation sync)
- [x] AI генерация и чат (OpenAI GPT-4o + Yandex GPT + локальный llama-server)
- [x] Экспорт/импорт .xmind
- [x] Context menu (add/rename/delete topic)
- [x] Zustand state management
- [x] Drag & drop — перетаскивание топиков (long-press)
- [x] 10 тем оформления — Lumen, Vivid, Sunset, Ocean, Forest, Midnight, Silicon, Lavender, Peach, Aurora
- [x] Разные layout — Mindmap, Org-Chart, Tree, Fishbone, Radial
- [x] Multiple sheets — вкладки с разными mindmap в одном workbook
- [x] Properties panel — редактор свойств топика
- [x] Starter nodes — новые mindmap создаются с 3 стартовыми темами
- [x] Keyboard shortcuts — Delete/Backspace для удаления выбранной ноды
- [x] Help overlay — всплывающая подсказка при загрузке
- [x] Canvas context menu — правый клик на пустом поле → Add Topic
- [x] ErrorBoundary — защита от краша рендера

### Производительность и оптимизации
- [x] **React.memo для TopicNode** — кастомная `areEqual`, предотвращает лишние ререндеры
- [x] **Viewport culling** — `isInViewport()` скрывает ноды вне видимой области через `visibility:hidden`
- [x] **useMemo для сборки данных** — `edgeData`, `nodeComponents`, `selSet`, `viewportRect` мемоизированы
- [x] **selSet мемоизация** — `new Set(selectedTopicIds)` в `useMemo`
- [x] **Layout мемоизация** — `buildLayout` + `computeTreeLayout` в `useMemo` от `activeSheet`

### Встроенный экспорт (frontend)
- [x] **Экспорт SVG** — `XMLSerializer` → Blob → download `.svg`
- [x] **Экспорт PNG** — SVG → canvas (2x retina) → `toBlob` → download `.png`
- [x] **Экспорт PDF** — SVG → canvas → `jsPDF.addImage()` → `pdf.save()`
- [x] **Импорт из Markdown (.md)** — парсинг заголовков и списков → рекурсивное создание
- [x] **Импорт из FreeMind (.mm)** — `DOMParser` парсит XML `<node TEXT="...">` → рекурсивное создание
- [x] **Import/Export dropdowns** — группировка форматов в тулбаре

### Коллаборация (Multiplayer)
- [x] **Multiplayer курсоры с именами** — цветные кружки + badge с именем
- [x] **Presence** — 👥 кнопка в тулбаре, список онлайн с цветными точками
- [x] **Operation sync** — broadcast CRUD операций через WebSocket без full reload

### AI фичи
- [x] **AI Inline Expand** — ✨ кнопка на каждой ноде, AI генерирует 3-5 детей
- [x] **AI Summarize** — 📋 кнопка в тулбаре, диалог с суммаризацией mindmap
- [x] **AI Image Generation** — 🎨 DALL-E 3, диалог с preview

### Инфраструктура (выполнено)
- [x] **Frontend тесты** — Vitest + Testing Library, 42 теста, 6 файлов
- [x] **Backend тесты** — Go store/agent/api/ws: 56+ тестов
- [x] **Docker** — docker-compose.yml + Dockerfiles (backend + frontend/nginx)
- [x] **CI/CD** — GitHub Actions (backend lint/test/build, frontend lint/tsc/test/build, docker build)
- [x] **TypeScript strict mode** — включено `strict: true` в tsconfig

### Дизайн-система
- [x] **Apple Design System** — SF Pro typography, 8px grid, frosted glass, macOS-style Header/Sidebar
- [x] **10 тем mindmap** — Lumen (дефолт), Vivid, Sunset, Ocean, Forest, Midnight, Silicon, Lavender, Peach, Aurora
- [x] **Lumen Design System** — токены, UI-примитивы (Box, Forms), компонентный шаблон
- [x] **Тёмная тема (системная)** — авто-переключение по `prefers-color-scheme`

### Модульная архитектура
- [x] **Module System** — core.Module interface, Registry, EventBus, lifecycle с графом зависимостей
- [x] **Agent System (MVP)** — CRUD агентов, 7 ролей, REST API, AgentPanel, per-agent model/provider
- [x] **Wiki Module** — файловое .md хранилище, CRUD, полнотекстовый поиск, тесты
- [x] **MCP Server** — JSON-RPC 2.0, методы initialize/tools/list/tools/call, wiki tools
- [x] **API Typing** — авто-генерация TypeScript типов из Go structs (`gen-ts-types`)
- [x] **Unified Error Handling** — `internalError()` helper, логирование 500 ошибок
- [x] **Code Splitting** — динамический `import()` для export функций, lazy панели

### UX улучшения
- [x] **Quick Capture v2** — мини-окно, авто-вставка `getSelection()`, теги (chips + пресеты), target selector, офлайн
- [x] **Web Share Target** — PWA принимает текст из системного Share → Quick Capture
- [x] **PWA / Offline-first** — Service Worker, IndexedDB кэш, offline queue, install prompt, offline banner
- [x] **Workbook delete button** — × кнопка в Sidebar, hover-показ, confirm перед удалением
- [x] **Command Palette (Ctrl+Alt+Space / ⌘K)** — поиск и запуск команд
- [x] **Session restore** — восстановление lastWorkbookId/lastSheetId при холодном старте офлайн
- [x] **Sync on reconnect** — авто-воспроизведение pending_ops при возврате онлайн
- [x] **Inbox Workbook** — авто-создание при старте, отдельная секция в Sidebar
- [x] **Удаление дублирующейся панели** — всё перенесено в тулбар
- [x] **Responsive sidebar** — toggle collapsible (≡/←), анимация ширины 260↔48px
- [x] **Scrollable panels** — AIPanel/AgentPanel/PropertiesPanel скроллятся при переполнении
- [x] **Comments on Nodes** — 💬 иконка на каждой ноде, модальный CommentsPanel
- [x] **Agent Task Submission** — ⚡ кнопка "Submit Task →" на карточке агента
- [x] **Agent Streaming Indicator** — зелёная строка Working/Thinking/Using tool в AgentCard
- [x] **Agent Chaining Visualization** — ⛓️ иконка + развёрнутая цепочка в TaskList

### Модульная архитектура
- [x] **Module System** — core.Module interface, Registry, EventBus, lifecycle с графом зависимостей
- [x] **Agent System (MVP)** — CRUD агентов, 7 ролей, REST API, AgentPanel, per-agent model/provider
- [x] **Wiki Module** — файловое .md хранилище, CRUD, полнотекстовый поиск, тесты
- [x] **MCP Server** — JSON-RPC 2.0, методы initialize/tools/list/tools/call, wiki tools
- [x] **API Typing** — авто-генерация TypeScript типов из Go structs (`gen-ts-types`)
- [x] **Unified Error Handling** — `internalError()` helper, логирование 500 ошибок
- [x] **Code Splitting** — динамический `import()` для export функций, lazy панели

### Tauri Desktop
- [x] **Tauri v2 sidecar** — Go бэкенд как внешний бинарник, spawn/kill в lib.rs
- [x] **System Tray** — иконка в трее, меню (Show/Hide / Quick Capture / Quit), minimize to tray
- [x] **Tray right-click fix** — правый клик показывает контекстное меню нативно; левый клик = toggle show/hide
- [x] **Stronghold** — зашифрованное OS keychain хранилище (Argon2 + AES-256-GCM), команды store/get/remove
- [x] **Global Shortcut** — Ctrl+Shift+Space открывает Quick Capture; Ctrl+Shift+G — toggle главного окна
- [x] **Quick Capture Tauri command** — `quick_capture(text)` создаёт топик в Inbox через REST
- [x] **build-sidecar.bat** — сборка Go бинарника в src-tauri/binaries/
- [x] **Makefile targets** — tauri-dev, tauri-build, tauri-sidecar

### Agent Ecosystem ✅
- [x] **Agent Zustand store** — `store/agent.ts` с agentLogs и WS подпиской
- [x] **Per-agent model/provider** — выбор модели и провайдера при создании
- [x] **Per-agent SystemPrompt** — `AgentInfo.SystemPrompt`; переопределяет role prompt в ReAct loop; редактируется inline на AgentCard (⚙ кнопка)
- [x] **Inline quick-prompt** — textarea прямо на AgentCard; Enter отправляет задачу без модала
- [x] **Advanced Task Dialog** — полный TaskSubmitDialog с action selector, NL prompt, JSON params, chain
- [x] **Agent streaming** — `agent:task_log` WebSocket события → live индикатор (Working/Thinking/Using tool)
- [x] **Agent chaining** — 003_agent_chaining.up.sql, persistent chain поля, ⛓️ UI
- [x] **Agent Schedule** — планировщик периодических задач (cron, REST API, Scheduler worker)
- [x] **Stop button** — `POST /api/v1/agents/{id}/stop`, кнопка ■ на working агенте

### V3.2 — Редактор
- [x] **Rich text в нодах** — форматирование (bold, italic, list) внутри foreignObject
- [x] **Image nodes** — вставка изображений (URL/base64) в ноды
- [x] **Hyperlink preview** — 🔗 иконка, клик открывает URL, тултип, пункт "Open Link"
- [x] **Callout / Notes popup** — 📄 кликабельная иконка, модальное окно с редактированием
- [x] **Node templates** — сохранение/загрузка стилей ноды как шаблонов (localStorage)

### Многонаправленная раскладка
- [x] **Direction** — единый параметр `'right' | 'left' | 'down' | 'up'`
- [x] **Tree Right/Left/Down/Up** — 4 варианта направления дерева
- [x] **Fishbone (Ishikawa) diagram** — реализован алгоритм
- [x] **Контекстное меню** — 6 пунктов: Mindmap, Tree Right, Tree Left, Tree Down, Tree Up, Radial
- [x] **Collapse/expand animation** — плавная анимация (opacity + transform через `parentFolded`)
- [x] **Per-node spacing override** — `topic.level_gap` / `topic.sibling_gap`
- [x] **Auto-layout button** — ⊞ кнопка в тулбаре
- [x] **Node customization** — `node_height`, `border_color`, `connection_color`, `shadow_type`, `node_style`, `fold_icon`, `show_child_count`

### Yandex GPT
- [x] **Yandex GPT интеграция** — новый AI провайдер
- [x] **SwitchAIProvider folder_id** — `folder_id` в запросе
- [x] **Yandex GPT Config UI** — секция в AIServerPanel (API Key, Folder ID, Model)

---

## Известные проблемы

### Все ранее известные баги исправлены. Нет открытых критических проблем.

---

## История реализованных фич

### Инфраструктура (P0) ✅
- [x] **ESLint + Prettier** — линтеры настроены, все предупреждения исправлены
- [x] **Тесты** — frontend (Vitest + Testing Library, 42 теста) и backend (Go testing, 56+ тестов)
- [x] **Docker** — docker-compose с backend + frontend + nginx
- [x] **CI/CD** — GitHub Actions: lint → test → build → docker build
- [x] **TypeScript strict mode** — включён, все ошибки пройдены

### UX и фичи (P1/P2) ✅
- [x] **Fishbone layout** — Ishikawa diagram
- [x] **Direction UI** — выпадающий список в PropertiesPanel
- [x] **Collapse animation** — плавная анимация при сворачивании/разворачивании
- [x] **Per-node spacing** — настройка gap'ов для отдельных нод
- [x] **Rich text editor** — contentEditable с toolbar
- [x] **Image nodes** — вставка изображений
- [x] **Hyperlink preview** — предпросмотр ссылок
- [x] **Callout/Notes popup** — модальное окно заметок
- [x] **Node templates** — шаблоны стилей
- [x] **Export как отдельный dropdown** — SVG, PNG, PDF, XMind
- [x] **Import как отдельный dropdown** — Markdown, FreeMind, JSON
- [x] **Drag & drop .md/.mm/.xmind на холст**
- [x] **Sticky notes / Canvas** — наклейки на холсте
- [x] **Mindmap presentation mode** — шаг за шагом
- [x] **Infinite canvas minimap** — мини-карта
- [x] **Private mode** — Access Mode (public/collaborators/agents/private)
- [x] **Share/Invite dialog** — управление доступом
- [x] **Collaborator management** — API + UI
- [x] **Yandex GPT** — новый провайдер

### Технический долг ✅
- [x] **Линтер/форматтер** — ESLint + Prettier (фронтенд), golangci-lint (бэк)
- [x] **БД миграции** — SQL-файлы, embed.FS, up/down-миграции
- [x] **App.tsx missing imports** — исправлены (`gradients`, `setInitializing`)
- [x] **Нижняя панель** — удалена дублирующаяся панель

---

## V3.8 — Agent UI Enhancement (roadmap)

> Аудит AgentPanel выявил 5 ключевых векторов улучшений. Roadmap: 5 фаз, 14 шагов.

### Фаза 1 — Agent Creation (P0)

| Шаг | Файлы | Описание |
|-----|-------|----------|
| 1.1 Two-level model selector | `AgentPanel.tsx` (AgentCreateDialog) | `providerSelect` → filtered `modelSelect` + toggle `<input>` для ручного model ID |
| 1.2 Agent Name field | `AgentPanel.tsx`, `types/agent.ts`, `backend/agent/module.go` | Опциональное `name`; `AgentInfo.Name`; хранится в registry |
| 1.3 Custom provider | `AgentCreateDialog`, `api/ai_handlers.go`, `worker.go` | Вариант "Custom endpoint" → Base URL + API Key; per-agent endpoint в worker |

### Фаза 2 — AgentCard inline controls (P0)

| Шаг | Файлы | Описание |
|-----|-------|----------|
| 2.1 Stop button | `AgentPanel.tsx`, `api/agent.ts`, `store/agent.ts`, `api/module.go` | Кнопка "■ Stop" при working; `POST /api/v1/agents/{id}/stop` |
| 2.2 Manual model input | `AgentPanel.tsx` (AgentCard) | Кнопка "✎" переключает `<select>` ↔ `<input>` для model ID |
| 2.3 Name + last task snippet | `AgentPanel.tsx`, `types/agent.ts` | Имя в заголовке; статус последней задачи под Submit |

### Фаза 3 — TaskSubmitDialog context-aware (P1)

| Шаг | Файлы | Описание |
|-----|-------|----------|
| 3.1 Role-filtered actions | `TaskSubmitDialog.tsx`, `types/agent.ts` | `ROLE_ACTIONS` map; только релевантные actions видны сразу |
| 3.2 Natural language prompt | `TaskSubmitDialog.tsx` | Режим Simple / Advanced; Simple = textarea → `{query: text}` |
| 3.3 Params schema hint | `TaskSubmitDialog.tsx` | `ACTION_SCHEMAS` map; пример под textarea + "Use example" |

### Фаза 4 — Provider controls (P2)

| Шаг | Файлы | Описание |
|-----|-------|----------|
| 4.1 Explicit provider select | `AgentPanel.tsx` (AgentCard) | Два раздельных select: provider + model |
| 4.2 Per-agent Stronghold key | `api/secrets.ts`, `AgentCard` | Custom key → Stronghold `agent-{id}-key` |

### Фаза 5 — Bulk & UX (P3)

| Шаг | Описание |
|-----|----------|
| 5.1 Duplicate agent | Кнопка "⧉" → `createAgent` с теми же role/provider/model |
| 5.2 Stop All | Кнопка в хедере + `POST /api/v1/agents/stop-all` |
| 5.3 Drag-to-reorder | Порядок агентов persist в localStorage |
| 5.4 Agent templates | Save/load конфига агента в localStorage |

### Приоритеты

| Фаза.Шаг | Приоритет | Сложность | Ценность | Статус |
|----------|-----------|-----------|----------|--------|
| 1.1, 2.1, 2.2 | P0 | Низкая | Очень высокая | ✅ DONE |
| 3.1, 3.2, 1.2, 2.3 | P1 | Низкая–Средняя | Высокая | ✅ DONE |
| 3.3, 4.1, 4.2 | P2 | Средняя | Средняя | 🔲 TODO |
| 5.1–5.4 | P3 | Низкая–Средняя | Низкая | 🔲 TODO |

**Следующий спринт:** Фазы 4–5 (explicit provider select + bulk ops).

---

## V4.1 — Agent Persistence (2026-05-17) ✅

Агенты теперь хранятся в SQLite. При рестарте сервера — не теряются. Workers авто-стартуют.

| Изменение | Файл |
|-----------|------|
| Миграция `007_agents.up.sql` | `backend/migrations/` |
| `AgentStore`: Insert/Get/List/Update/Delete | `backend/internal/store/agents.go` |
| `PersistAgent`, `RemoveAgent`, `SyncAgent` | `backend/internal/agent/module.go` |
| `InitAgentStore` + worker auto-start on boot | `backend/internal/agent/module.go` |
| `CreateAgent`→`PersistAgent`, `DeleteAgent`→`RemoveAgent` | `backend/internal/api/module.go` |
| `App.tsx` — убран `submitTask __startup__` no-op | `frontend/src/App.tsx` |

---

## V4.2 — RAG Search (2026-05-17) ✅

Семантический поиск по топикам mindmap через embeddings.

| Изменение | Файл |
|-----------|------|
| Миграция `008_embeddings.up.sql` | `backend/migrations/` |
| `EmbeddingStore`: Upsert/Search (cosine similarity) | `backend/internal/store/embeddings.go` |
| `semantic_search` tool для агентов | `backend/internal/agent/tools.go`, `search.go` |
| `GET /api/v1/search?q=...&type=semantic` | `backend/internal/api/router.go` |

---

## V4.3 — Multi-Agent Orchestration (2026-05-22) ✅

Parallel fan-out + supervisor роль для координации нескольких агентов.

| Изменение | Файл |
|-----------|------|
| Миграция `009_parallel_groups.up.sql` — `parallel_group_id` column + index | `backend/migrations/` |
| `Task.ParallelGroupID` + `AgentTaskRecord.ParallelGroupID` | `agent/task.go`, `store/agent_task.go` |
| `parallel_delegate` tool — fan-out до 16 задач, ждёт все, timeout 5 мин | `backend/internal/agent/tools.go`, `executor.go` |
| `list_agents` tool — discovery агентов до делегирования | `backend/internal/agent/tools.go`, `executor.go` |
| `Manager.SubmitTaskInGroup(...)` — submit с групповым ID | `backend/internal/agent/module.go` |
| Роль `supervisor` — categories `agent`, `notes`, `wiki`, `search`, `analysis` | `backend/internal/agent/tools.go` |
| Frontend `AGENT_ROLES` + `ROLE_ACTIONS` + `ACTION_SCHEMAS` для supervisor | `frontend/src/types/agent.ts` |

**Поведение `parallel_delegate`:**
- max 16 одновременных задач
- self-delegation guard (как в `delegate_to_agent`)
- генерирует `group_id = pg_YYYYMMDDhhmmss.SSS_N`
- возвращает `{group_id, results: [{agent_id, task_id, status, result|error}]}`
- timeout 5 мин → status `timeout` для незавершённых

---

## V6.0 — Memory & Pipeline Workbench

### Phase 1 — MASys Bridge ✅ DONE (2026-06-01)

| Изменение | Файл |
|-----------|------|
| Go REST proxy (10 endpoints + helpers callTRPCQuery/Mutation) | `backend/internal/api/masys_memory.go` |
| SSE bridge для run streams (gorilla/websocket → SSE) | `backend/internal/api/masys_sse.go` |
| Routes: `/api/v1/masys/{health,memory/*,runs/*}` | `backend/internal/api/router.go` |
| TS types: 12 интерфейсов | `frontend/src/types/masys.ts` |
| API client: 14 методов, EventSource for stream | `frontend/src/api/masys.ts` |
| Zustand store: health + 8 layers + namespace switcher | `frontend/src/store/masysMemory.ts` |
| Memory Workbench panel skeleton (8 layer cards) | `frontend/src/components/MemoryWorkbench/MemoryWorkbenchPanel.tsx` |
| AppModule (order=5, icon Brain) | `frontend/src/modules/memory-workbench/module.ts` |

Все builds clean: go build/test, tsc --noEmit, Vitest 62/62.

### Phase 2 — Memory Layer Map ✅ DONE (2026-06-01)

6-слойная karp модель поверх 8 MASys layers.

| Изменение | Файл |
|-----------|------|
| Pure-function aggregation (6 layers + health metrics) | `frontend/src/components/MemoryWorkbench/layerMapping.ts` |
| Layer Map 2×3 grid with health badges + parts + notes | `LayerMap.tsx` |
| Drill-down modal (5 list types) | `LayerDrillDown.tsx` |
| Tabs view (Layer Map / Raw layers) | `MemoryWorkbenchPanel.tsx` |

Health heuristics: error_rate, stale_count, low_mention_ratio, low_success_skills, unused_skills, expired_count, pending_queue, old_pending.

### Phase 3-7 — Coming next

## V6.0 — Memory & Pipeline Workbench (planned, 7 phases)

Gmind становится visual workbench для агентской памяти (D:\karp) и пайплайнов (E:\MASys).

**Архитектура:** Gmind UI (2 новых модуля) → Gmind Go backend (proxy) → MASys tRPC/WS.

**Phases (~10 дней):**
1. MASys Bridge & Types — REST proxy + types + WS bridge
2. Memory Layer Map — 6 карточек слоёв с health
3. Knowledge Graph Canvas — sync MASys entities → V5.0 graph
4. Episode Timeline — хронология + filter + reflection actions
5. Context Budget Visualizer — Sankey + sandwich + evicted
6. Skill Evolution Tree — навыки через V5.0 graph
7. Pipeline Trace Map — run timeline + memory recalls links

**Prerequisite:** V5.0 Phase 4-5 (Frontend graph UI — drag-from-edge).

**Файл:** `skills/memory-visualization.md` — полная архитектура.

**Не делаем (V6.1+):** запись в MASys, memory editor, multi-namespace switching, embeddings comparison.

---

## V5.0 — Graph Relationships v2 (2026-05-22, Phase 1-3 backend) ✅

Расширенные связи между топиками — фундамент для памяти агентов и GraphRAG.

| Изменение | Файл |
|-----------|------|
| Skill `graph-relationships.md` (architecture, types, algorithms, roadmap) | `skills/` |
| Миграция `010_relationships.up.sql` — таблица + 4 индекса (workbook, from, to, type) | `backend/migrations/` |
| `model.Relationship` extension — legacy + 17 V5.0 полей (type/direction/weight/notes/cross-scope endpoints) | `backend/internal/model/types.go` |
| `RelationshipStore` — CRUD + ListByWorkbook/ListByTopic + FindBetween + Traverse (BFS) + DetectCycles (DFS) + cascade DeleteByTopic | `backend/internal/store/relationships.go` |
| API endpoints: POST/GET/PUT/DELETE + `/cycles` + `/topics/{id}/related?depth=N` | `backend/internal/api/relationships.go`, `router.go` |
| Backward compat: `EmbedRelationshipsIntoSheet` в GetWorkbook | `backend/internal/api/workbook.go` |
| Cascade delete на DeleteTopic | `backend/internal/api/topic.go` |
| 6 agent tools в category `"graph"`: create_relationship, list_relationships, get_related_topics, detect_cycles, update_relationship, delete_relationship | `backend/internal/agent/tools.go`, `executor.go` |
| Все 8 ролей получили graph category | `backend/internal/agent/tools.go` |

**Решения:**
- Multi-edge: ✅ разрешён
- Направления: forward / bidirectional / undirected
- UI: drag-from-edge (Phase 4)
- Scope: self-loop, cross-sheet, cross-workbook, циклы — всё разрешено
- Хранение: отдельная таблица (не JSON), индексы по всем endpoints
- Cycle prevention: опциональный `?strict=true` query param

**Типы связей по умолчанию:** `relates_to` (slate), `depends_on` (red bold), `supports` (green), `contradicts` (amber dashed), `references` (blue dotted), `blocks` (pink bold), `custom`.

**Тесты:** 4/4 OK (CRUD multi-edge, Traverse depth, DetectCycles A→B→C→A, SelfLoop).

---

## V5.0 Phase 4-5 — Frontend UI (2026-06-01) ✅

UI создан через decorator pattern — без правки TopicNode (огромный).

| Изменение | Файл |
|-----------|------|
| Types extension (Type/Direction/Style + extended Relationship) | `frontend/src/types/api.ts` |
| API client (CRUD + related + cycles) + visual mappings | `frontend/src/api/relationships.ts` |
| Zustand store: data + drag state + filter + popover | `frontend/src/store/relationships.ts` |
| EdgeAnchorsLayer — 4 anchors on selected node | `frontend/src/components/MindMap/EdgeAnchorsLayer.tsx` |
| FantomLine — Bezier follow cursor during drag | `frontend/src/components/MindMap/FantomLine.tsx` |
| ConnectionPopover — type/direction/title после drop | `frontend/src/components/MindMap/ConnectionPopover.tsx` |
| RelationshipLine rewrite — arrows, type styles, multi-edge offset, self-loop arc | `frontend/src/components/MindMap/RelationshipLine.tsx` |
| RelationshipPanel sidebar — edit type/direction/weight/style/notes/delete | `frontend/src/components/RelationshipPanel/RelationshipPanel.tsx` |
| RelationshipFilter — toggle visibility per type with counts | `frontend/src/components/MindMap/RelationshipFilter.tsx` |
| useGraphDragTracking — global pointermove/pointerup + Escape | `frontend/src/components/MindMap/useGraphDragTracking.ts` |
| MindMap integration + renderer multi-edge bundle | `MindMap.tsx`, `renderer.tsx` |

**UX:**
1. Выбрать топик → 4 anchors появляются
2. Drag с anchor → fantom-линия (зелёная при snap)
3. Drop на target → popover (type/direction/title) → Save → API
4. Click на ребро → RelationshipPanel для редактирования
5. Multi-edge: parallel offsets 8px (fan-out)
6. Self-loop: dome arc справа от ноды
7. Hover-highlight: selected node → other edges dimming 18%
8. Filter widget справа внизу — toggle visibility по типу

Frontend: tsc clean, Vitest 62/62 OK.

---

## V5.0 — Graph Relationships v2 (Backend) (2026-05-22, Phase 1-3) ✅

---

## V4.4 — Parallel UI + Export endpoints (2026-05-22) ✅

| Изменение | Файл |
|-----------|------|
| TaskList grouped card по `parallel_group_id` (агрегированный counter) | `frontend/src/components/TaskList/TaskList.tsx` |
| Backend `GET /api/v1/workbooks/{id}/export/freemind` | `backend/internal/api/workbook.go`, `router.go` |
| Backend `GET /api/v1/workbooks/{id}/export/markdown` (уже было) | `backend/internal/api/workbook.go` |
| README.md в корне репо | `/README.md` |

**TaskList row types:**
```ts
type Row = { kind: 'single'; task } | { kind: 'group'; groupId; tasks: [...] }
```
Группы — выше (boxShadow.neuMd), single — стандарт (neuSm). Expandable раскрывает list под собой.

---

## V4.5 — Performance (следующий)

- Web Worker для buildLayout + computeTreeLayout (1000+ нод)
- Виртуальный скроллинг
- Pipeline DAG визуальный редактор (V5.0)

### V3.8 — Prompt UX (2026-05-15) ✅

| Изменение | Файлы |
|-----------|-------|
| `AgentInfo.SystemPrompt` — per-agent prompt, переопределяет role в ReAct loop | `backend/agent/module.go`, `react.go` |
| API accept `system_prompt` в create/patch | `backend/api/module.go` |
| `AgentCard` inline quick-prompt textarea (Enter to send) | `AgentPanel.tsx` |
| `AgentCard` ⚙ system prompt editor (inline, Save/Reset) | `AgentPanel.tsx` |
| `AgentCreateDialog` collapsible system prompt section | `AgentPanel.tsx` |
| Frontend types/api/store обновлены | `types/agent.ts`, `api/agent.ts`, `store/agent.ts` |

### Desktop Tray (2026-05-15) ✅

| Изменение | Деталь |
|-----------|--------|
| Tray right-click fix | `on_tray_icon_event` фильтрует `MouseButton::Left`; правый клик → нативное `.menu()` |
| Tray left-click = toggle | show если скрыто, hide если видно |
| Tray menu order | Show/Hide → Quick Capture → separator → ✕ Quit |

### Исправленные баги

1. **Layout: дети не двигались за родителем** → `shiftSubtree()` — `frontend/src/renderer/layout.ts`
2. **Drag: race condition event listeners** → `useRef` для `handlePointerMove`/`handlePointerUpGlobal`
3. **MoveTopic: удаление раньше поиска** → сначала найти target, потом удалить source
4. **WebSocket: Strict Mode double-mount** → guard `readyState`
5. **Nested SVG: двойной `<svg>`** → renderer возвращает `<g>`
6. **`collectBounds` не вызывался** → добавлен вызов перед shift
7. **App.tsx: missing `gradients` import** → ReferenceError исправлен
8. **App.tsx: `setInitializing` undefined** → мёртвый код удалён
9. **TopicNode.tsx: CSS `font` shorthand** → отдельные свойства
10. **PropertiesPanel/StylePanel: NaN при font size** → `isNaN` guard
11. **Fold Animation: children не анимировали скрытие** → `visibility` применяется после transition
12. **Chevron Hit Area: мелкая область** → увеличена в 2x

---

## Векторы развития (приоритеты)

### V3.7 — Agent Ecosystem (P2)
- [x] **Agent Zustand store** — `store/agent.ts`
- [x] **Per-agent model/provider** — выбор модели и провайдера
- [x] **Agent task submission UI** — кнопка "Submit Task" на AgentCard
- [x] **Agent streaming** — WebSocket стриминг мыслей/действий агента (`agent:task_log`)
- [x] **Agent chaining** — передача результата одного агента другому (persistent + TaskList ⛓️)
- [x] **Per-agent model presets** — динамический список моделей через `GET /api/v1/ai/models`; grouped `<select>` в AgentCreateDialog + AgentCard
- [ ] **Agent schedule** — отложенные/периодические задачи (cron)

### V3.8 — Социальные фичи (P2)
- [x] **OT/CRDT** — операционные трансформации для совместной работы без конфликтов
- [x] **Comments** — комментирование конкретных нод, треды (💬 иконка + CommentsPanel)
- [ ] **History timeline** — временная шкала изменений документа
- [ ] **Shareable links** — публичные ссылки на workbook с read-only доступом

### V3.9 — Экспорт/Импорт (P2)
- [ ] **Export Markdown** — обратный экспорт mindmap в .md
- [ ] **Export FreeMind** — обратный экспорт в .mm
- [ ] **Import XMind v2** — поддержка новой версии .xmind формата
- [ ] **Export OPML** — для совместимости с другими mindmap-инструментами
- [ ] **Batch import** — массовый импорт нескольких файлов

### V4.0 — Производительность (P3)
- [ ] **Worker-based layout** — Web Worker для тяжёлых деревьев (1000+ nodes)
- [ ] **Canvas/SVG hybrid** — Canvas (производительность) + SVG overlay (точность)
- [ ] **Virtual scrolling** — виртуализация для списков
- [ ] **Lazy topic loading** — lazy loading глубоких поддеревьев

### V4.1 — Production Windows Release (P1 — следующий спринт)

**Цель:** рабочий `.msi` инсталлятор для Windows.

#### Фаза 1.1 — Fix Data Paths (КРИТИЧНО)
Go backend использует `./gmind.db`, `./wiki/` — ломается в packaged `.exe`.
- [ ] `backend/cmd/server/main.go` — читать `GMIND_DATA_DIR` из env, fallback `os.UserConfigDir()/Gmind`
- [ ] `backend/internal/store/db.go` — путь к SQLite из конфига
- [ ] `backend/internal/wiki/store.go` — wiki path из конфига
- [ ] `frontend/src-tauri/src/lib.rs` — `cmd.env("GMIND_DATA_DIR", app.path().app_data_dir()?)`

#### Фаза 1.2 — Fix Sidecar Binary Name
- [ ] `Makefile` / `build-sidecar.bat` — выход `gmind-server-x86_64-pc-windows-msvc.exe`

#### Фаза 1.3 — Stronghold → API Keys
Stronghold реализован, но не подключён к UI — ключи в localStorage.
- [ ] `AIServerPanel.tsx` — `invoke('store_secret', {key, value})` вместо localStorage
- [ ] `lib.rs` — при старте: get_secret → POST /api/v1/config на backend
- [ ] `backend/api/router.go` — добавить `POST /api/v1/config`

#### Фаза 1.4 — Backend Robustness
- [ ] `GET /health` endpoint → `{status, version, db_ok}`
- [ ] Graceful shutdown — signal.Notify(SIGTERM) → close DB, stop workers
- [ ] Tauri: poll /health после spawn, показать окно когда backend ready
- [ ] Port fallback: 8080 занят → 8081+

#### Фаза 1.5 — Installer
- [ ] `tauri.conf.json` — bundle.targets: `["nsis"]`, productName, identifier, shortcuts

---

### V4.2 — MASys Integration (P1)

MASys (`E:\MASys`) — visual pipeline платформа с 70+ модулями. `gmind-mindmap` v2.0.0 уже есть в MASys. Нужно замкнуть двустороннюю интеграцию.

#### Фаза 2 — Gmind → MASys (новый tool)
- [ ] `backend/internal/agent/tools.go` — tool `run_masys_pipeline(pipeline_id, inputs_json)`
- [ ] `backend/internal/agent/executor.go` — POST /trpc/runs.start + poll runs.get
- [ ] `frontend/src/components/AgentPanel/AgentPanel.tsx` — секция MASys Pipelines

#### Фаза 3 — MASys → Gmind (gmind-mindmap v2 расширение)
- [ ] Верифицировать 11 операций `gmind-mindmap` против текущего API
- [ ] Добавить операцию `submit-agent-task` в gmind-mindmap
- [ ] Создать эталонный пайплайн: agent-loop + gmind-mindmap как tool

Подробно: [13-masys-integration.md](13-masys-integration.md) · [skills/masys-integration.md](../skills/masys-integration.md)

---

### V4.3 — Нативное приложение (P3)
- [x] **Tauri desktop (Windows)** — sidecar, tray, Stronghold, shortcuts — ВСЁ РЕАЛИЗОВАНО
- [ ] **Auto-updater** — tauri-plugin-updater + GitHub Releases
- [ ] **Mobile PWA** — адаптация интерфейса для мобильных (после V5.0)

### V4.4 — Продвинутый AI (P2)
- [ ] **AI Agent авто-действия** — агенты сами предлагают/выполняют действия
- [ ] **RAG over mindmaps** — sqlite-vec embeddings, семантический поиск по топикам
- [ ] **MASys agent-loop** — визуальный редактор ReAct агентов в MASys с gmind-mindmap как tool