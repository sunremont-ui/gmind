# Gmind — Agent Memory
# ВАЖНО: Агент всегда отвечает на русском языке. Все сообщения только на русском.
# Это обязательное правило. Нарушение недопустимо.

> Этот файл читается в начале каждой сессии, чтобы восстановить контекст проекта.

## Стек

| Компонент | Технология | Примечание |
|---|---|---|
| Backend | Go | chi router, modernc.org/sqlite, gorilla/websocket |
| Frontend | React 18 + Vite + TypeScript | Zustand store, SVG rendering |
| AI | OpenAI GPT-4o / Local llama-server / Yandex GPT / Ollama (auto-detect) | generate / chat / expand; dynamic provider switching, `folder_id` |
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
│   ├── src/
│   │   ├── types/     # TypeScript interfaces
│   │   ├── api/       # HTTP + WS clients (client, agent, notes, ws)
│   │   ├── store/     # Zustand stores (mindmap, theme, agent, layout, shell, notes)
│   │   ├── renderer/  # Layout engine + SVG renderer
│   │   ├── modules/   # Модульная система (AppModule interface + registry)
│   │   │   ├── types.ts          # AppModule, ModulePanelProps, ModuleCommand interfaces
│   │   │   ├── registry.ts       # MODULE_REGISTRY (5 модулей) + getModule()
│   │   │   ├── mindmap/module.ts # Home module (canvas, не открывает панель)
│   │   │   ├── notes/module.ts   # Notes module → NotesPanel
│   │   │   ├── agent-sandbox/module.ts # Agent Sandbox → AgentPanel
│   │   │   ├── masys/module.ts   # MaSys → MaSysPanel
│   │   │   └── ai/module.ts      # AI → AIPanel
│   │   └── components/
│   │       ├── NavRail/    # 48px Activity Bar (иконки, tooltip, активный модуль)
│   │       ├── MindMap/    # MindMap, TopicNode, ErrorBoundary
│   │       ├── Sidebar/    # Workbook list
│   │       ├── AIPanel/    # AI chat/generate (workbookId: string | null)
│   │       ├── AIServerPanel/  # AI сервер (llama-server + Yandex GPT)
│   │       ├── PropertiesPanel/  # Редактор свойств топика
│   │       ├── ShareDialog/  # Доступ и шаринг
│   │       ├── PresencePanel/  # Онлайн пользователи
│   │       ├── AgentPanel/  # Агенты: список, карточки, Submit Task (только agents/tasks)
│   │       ├── TaskList/   # Задачи агентов с цепочками
│   │       ├── NotesPanel/ # Быстрые заметки (Quick Notes module)
│   │       ├── MaSysPanel/ # MASys пайплайны (выделен из AgentPanel)
│   │       └── StylePanel/ # Стилизация нод
│   └── src-tauri/     # Tauri v2 desktop обёртка (sidecar)
├── scripts/           # Dev utilities (start.ps1, build.ps1, clean.ps1, reset.ps1)
├── lumen/             # Lumen Design System (токены, UI-кит, превью)
└── wiki/              # Документация (12 страниц)
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

### ✅ Реализовано (V3.9 Desktop Settings, 2026-05-14)

- ✅ **Desktop startup optimization** — убран 500ms sleep в lib.rs, ранний TCP-listener в Go (atomicRouter), splash screen в React, поллинг /health из фронтенда каждые 150ms; итого ~400ms vs ~750ms
- ✅ **tauri.conf.json** — `visible: true` для main window (окно показывается сразу)
- ✅ **SplashScreen** — брендированный экран (lumen-logo + aurora gradient + "Starting…") до `backendReady`
- ✅ **Parallel secrets load** — `Promise.all([loadOpenAIConfig, loadYandexConfig])` вместо sequential

### ✅ Реализовано (V3.9 Desktop Settings — полностью, 2026-05-14)

- ✅ **Global scroll support** — `lumen.css` скроллбар (4px, индиго), `.lumen-scroll` утилита; все панели
- ✅ **tauri-plugin-autostart** — OS startup registration (Windows Registry), команды `enable/disable/is_autostart_enabled`
- ✅ **tauri-plugin-store** — persistентный JSON `settings.json`
- ✅ **SettingsModal** — 3 секции: Запуск (autostart + startMinimized) / Агенты при старте (чеклист) / Горячие клавиши (ShortcutInput record mode)
- ✅ **Configurable main window shortcut** — `update_main_shortcut` Tauri команда; `CurrentMainShortcut(Mutex<String>)` managed state; default `Ctrl+Shift+G`
- ✅ **Startup agents** — `startupAgentIds` в settings; `App.tsx` submitTask на `__startup__` для выбранных агентов после backendReady

### ✅ Реализовано (V4.1 Agent Persistence, 2026-05-17)

- ✅ **AgentStore SQLite** — таблица `agents(id, name, role, provider, model, system_prompt, created_at)`, миграция `007_agents.up.sql`
- ✅ **store/agents.go** — `AgentStore`: `Insert`, `Get`, `List`, `Update`, `Delete`
- ✅ **PersistAgent / RemoveAgent / SyncAgent** — `agent/module.go` синхронизирует Registry ↔ SQLite
- ✅ **Worker auto-start on boot** — `InitAgentStore` загружает агентов из БД + запускает `WorkerPool.StartWorker` для каждого
- ✅ **App.tsx cleanup** — убран `submitTask __startup__` no-op; только `fetchAgents()` при старте

### ✅ Реализовано (V4.2 RAG Search, 2026-05-17)

- ✅ **Embeddings store** — `store/embeddings.go` + таблица `topic_embeddings`, миграция `008_embeddings.up.sql`
- ✅ **semantic_search tool** — agent tool: cosine similarity по теме, возвращает топики JSON; роль `researcher` + `analyst`
- ✅ **GET /api/v1/search?q=...&type=semantic** — поиск для фронтенда
- ✅ **Pure Go embeddings** — `text-embedding-3-small` через OpenAI, CGO-free (нет sqlite-vec)

### ✅ Реализовано (V4.0 — Модульная платформа, 2026-05-16)

- ✅ **Nav Rail** — 48px Activity Bar (VS Code-стиль): иконки без текста, tooltip, активная иконка = открытая панель, повторный клик закрывает
- ✅ **AppModule interface** — TypeScript контракт для всех модулей: `id`, `name`, `icon`, `order`, `tooltip`, `panel`, `commands`, `agentTools`
- ✅ **MODULE_REGISTRY** — реестр 5 модулей: MindMap (canvas, order:0), Notes (order:1), AgentSandbox (order:2), MaSys (order:3), AI (order:4)
- ✅ **useShellStore** — Zustand shell store: `activeModuleId`, `toggleModule`, `closeModule`, `setActiveModule`
- ✅ **Notes Module** — быстрые заметки: NotesPanel (textarea + поиск + карточки), notes API, notes store
- ✅ **Notes SQLite** — таблица `notes` (id, content, tags JSON, source, workbook_id, pinned, timestamps), миграция `006_notes.up.sql`
- ✅ **Notes API** — `GET/POST/PUT/DELETE /api/v1/notes`; поддержка `?q=` для поиска
- ✅ **MaSysPanel** — MASys пайплайны выделены из AgentPanel в отдельный компонент + модуль
- ✅ **AgentPanel** — masys tab удалён, только agents/tasks; `workbookId: string | null`
- ✅ **Extensible Tool Registry** — `RegisterTool(t ToolDef)` + `GetRegistry() []ToolDef` с `sync.RWMutex`
- ✅ **RegisterCallback** — `ToolExecutor.RegisterCallback(name, fn)` для модулей-плагинов
- ✅ **save_note tool** — agent tool: сохраняет заметку с тегами и workbook ассоциацией
- ✅ **search_notes tool** — agent tool: поиск по заметкам (контент + теги)
- ✅ **App.tsx refactor** — убраны showAIPanel/showAgentPanel, добавлен NavRail + useShellStore + модульные команды в CommandPalette
- ✅ **CommandPalette агрегация** — `MODULE_REGISTRY.flatMap(m => m.commands?.(ctx) ?? [])` собирает команды всех модулей

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
- ✅ **Tauri desktop sidecar** — Go бэкенд запускается как sidecar Tauri v2 (spawn в `setup()`, kill в `RunEvent::Exit`); `tauri.conf.json` + `externalBin`; `build-sidecar.bat`
- ✅ **Agent UI: Submit Task** — ⚡ иконка заменена на полноправную `Submit Task →` кнопку во всю ширину карточки агента
- ✅ **Agent Chaining persistence** — `003_agent_chaining.up.sql` (колонки `chain_to_agent_id`, `chain_from_task_id`); store/agent_task.go + task.go — chain поля персистентны; фронтенд `AgentTask` тип + визуализация в `TaskList`
- ✅ **Agent Streaming live indicator** — `store/agent.ts`: `agentLogs` + подписка на `agent:task_log` WebSocket; `AgentCard`: зелёная строка с `Working...` / `Thinking...` / `Using <tool>...` в реальном времени
- ✅ **Comments on Nodes** — 💬 иконка на каждой ноде холста (TopicNode + renderer + MindMap.tsx handler); `CommentsPanel` открывается как модалка
- ✅ **start.bat rewritten** — совместимость с Git Bash (`ping`, `set /p`)
- ✅ **Ollama Auto-Detect** — авто-обнаружение Ollama на localhost:11434, показ доступных моделей, кнопка «Use Ollama» в AIServerPanel
- ✅ **Per-agent model presets** — `GET /api/v1/ai/models` агрегирует модели OpenAI/Ollama/Yandex; grouped `<select>` в AgentCreateDialog и AgentCard вместо хардкода
- ✅ **External Model Servers** — `model-servers.json` (Load/Save/Default); API `GET/PUT /api/v1/model-servers`; секция в AIServerPanel с таблицей Add/Edit/Delete/Use; дефолты: llama.cpp:1100, LM Studio:1234, Jan:1337
- ✅ **Port range 1010–1200** — backend:1010, vite:1011, docker-fe:1012, llama.cpp:1100; 5173 и 8081 не используются

### ✅ Реализовано (V3.8 Prompt UX + Desktop, 2026-05-15)

- ✅ **Per-agent SystemPrompt** — `AgentInfo.SystemPrompt string`; если задан, переопределяет role prompt в ReAct loop; `PATCH /api/v1/agents/{id}` принимает `system_prompt` (не требует provider/model)
- ✅ **Inline quick-prompt на AgentCard** — textarea прямо на карточке + `→` кнопка; Enter (без Shift) отправляет; action = текст запроса; без открытия модала
- ✅ **System prompt editor на AgentCard** — кнопка `⚙` в header; inline textarea 4 строки; Save / ✕ Reset; тег "custom prompt" если активен
- ✅ **AgentCreateDialog system prompt** — коллапсируемая секция `▶ Custom System Prompt` с textarea; передаётся при создании
- ✅ **Tray right-click fix** — `on_tray_icon_event` фильтрует только `MouseButton::Left`; правый клик показывает меню через нативный `.menu()` автоматически
- ✅ **Tray toggle** — левый клик = show/hide (раньше только show); меню "Show/Hide" тоже toggle
- ✅ **Tray menu order** — Show/Hide → Quick Capture → separator → ✕ Quit

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

- ✅ **Frontend тесты** — Vitest + Testing Library, 43 теста, 6 файлов
- ✅ **Backend тесты** — Go store/agent/api/ws: 56+ тестов
- ✅ **Docker** — docker-compose.yml + Dockerfiles (backend + frontend/nginx)
- ✅ **CI/CD** — GitHub Actions (ci.yml: backend lint/test/build, frontend lint/tsc/test/build, docker build)
- ✅ **Module System** — core.Module interface, Registry, EventBus, lifecycle с графом зависимостей
- ✅ **Agent System (MVP)** — CRUD агентов, 7 ролей, REST API, AgentPanel, Submit Task, streaming, chaining
- ✅ **Tauri desktop** — Tauri v2 sidecar: Go бэкенд как внешний бинарник, spawn/kill в lib.rs
- ✅ **Tauri System Tray** — иконка в трее, меню (Show / Quick Capture / Quit), minimize to tray вместо закрытия
- ✅ **Tauri Stronghold** — зашифрованное хранилище секретов (OS keychain), команды `store_secret`, `get_secret`, `remove_secret`
- ✅ **Tauri Global Shortcut** — `Ctrl+Shift+Space` открывает Quick Capture из любого приложения
- ✅ **run.bat** — один двойной клик для запуска обоих серверов

## MASys Integration

**MASys** (Modular Agent System, `E:\MASys`) — visual pipeline платформа: граф-редактор (React Flow) + DAG executor + 70+ модулей. Интеграция двусторонняя.

### Что уже есть в MASys для Gmind

| Модуль | Путь | Описание |
|--------|------|----------|
| `gmind-mindmap` v2.0.0 | `E:\MASys\modules\gmind-mindmap\` | Полное управление Gmind: create, add-topics, batch-create, update-topic, delete-topic, get-workbook, list-workbooks, generate, chat, export-markdown, submit-agent-task |
| `gmind-agent` v1.0.0 | `E:\MASys\modules\gmind-agent\` | Отправить задачу конкретному агенту + polling до завершения. Inputs: action, params, workbookId. Config: agentId, baseUrl, timeoutMs |
| `agent-loop` v1.0.0 | `E:\MASys\modules\agent-loop\` | ReAct-агент: использует MASys пайплайны как tools. Поддерживает Anthropic / OpenAI / llama-cpp |
| `mcp-server` | `E:\MASys\packages\mcp-server\` | MCP-протокол (JSON-RPC) |

### /agents страница в MASys

`http://localhost:5173/agents` — полноценный интерфейс управления Gmind-агентами из MASys:
- Создание/удаление агентов с выбором роли, модели, system prompt
- Quick-prompt input прямо на карточке агента
- TaskLogDrawer — SSE-стриминг логов напрямую из Gmind (прямой EventSource, без прокси)
- Connection status, auto-refresh каждые 5 сек
- Ссылка в DashboardPage navigation: кнопка «Агенты»

**tRPC роутер:** `apps/server/src/router/gmindAgents.ts`
- `list`, `create`, `update`, `delete`, `stop`
- `listTasks(agentId?)`, `submitTask`, `getTask`, `getTaskLogs`, `getBaseUrl`
- Gmind baseUrl берётся из MASys secret `gmind-base-url` (default `http://localhost:1010`)

### Архитектура интеграции

```
GMIND (:1010)                    MASYS (:3000)
──────────────────────────────   ──────────────────────────────────
Go Backend                       Fastify + tRPC
  └── MCP Server (JSON-RPC)  ←── mcp-server package
  └── REST API /api/v1        ←── gmind-mindmap (create/add-topics/…)
  └── Agent System            ──→ run_masys_pipeline tool (Фаза 2)
                                   └── agent-loop + gmind-mindmap tools
```

### Production Roadmap (Фазы)

```
Фаза 1 — Gmind Windows Desktop (критично):
  1.1 Fix data paths (SQLite/wiki используют ./relative → %APPDATA%\Gmind)
  1.2 Fix sidecar binary name (Tauri triple convention)
  1.3 Подключить Stronghold к UI (AI ключи → OS keychain)
  1.4 Backend robustness (health endpoint, graceful shutdown, port fallback)
  1.5 Installer config (NSIS, shortcuts, productName)

Фаза 2 — Gmind → MASys (делегирование):
  2.1 Tool run_masys_pipeline в ToolRegistry + executor
  2.2 MASys Pipelines list в AgentPanel UI

Фаза 3 — MASys → Gmind (расширение gmind-mindmap):
  3.1 Верификация 11 операций против текущего API
  3.2 Новая операция submit-agent-task
  3.3 Эталонный пайплайн: agent-loop + gmind-mindmap

Фаза 4 — Build & Release:
  4.1 GitHub Actions Windows build (.msi artifact)
  4.2 Auto-update через GitHub Releases
```

Подробно в [PLANS.md](PLANS.md) и [wiki/13-masys-integration.md](wiki/13-masys-integration.md).

## Порты (зафиксированы, диапазон 1010–1200)

| Сервис | Порт |
|--------|------|
| Gmind backend API | **1010** |
| Vite dev server | **1011** |
| Docker frontend nginx | **1012** |
| llama.cpp (default) | **1100** |
| Ollama | 11434 (стандарт) |
| MASys | 3000 (внешний) |

**Конфиг:** `MODEL_SERVERS_CONFIG` env → `model-servers.json` (список внешних model-серверов: name/endpoint/type/port). API: `GET/PUT /api/v1/model-servers`. UI: секция «External Model Servers» в AIServerPanel.

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

## Module System

- **`backend/internal/core/`** — ядро: Module interface, Registry, EventBus, Lifecycle с графом зависимостей
- **`backend/internal/agent/`** — Agent Module: Registry + Manager (implements core.Module), WorkerPool, TaskStore
  - `tools.go` — ToolRegistry: create_topic, update_topic, create_multiple_topics, add_note, get_topic, get_workbook, summarize_topics, search_web, wiki_search, wiki_read, wiki_write, run_masys_pipeline, delete_topic, move_topic, list_topics, delegate_to_agent, save_note, search_notes, parallel_delegate, list_agents, semantic_search, **create_relationship**, **list_relationships**, **get_related_topics**, **detect_cycles**, **update_relationship**, **delete_relationship** (V5.0 graph); `RegisterTool(t)` + `GetRegistry()` с mutex для расширяемости
  - `executor.go` — `getCallbacks(task *Task)`: task передаётся для делегирования (delegate_to_agent знает caller); `RegisterCallback(name, fn)` для плагинов; `saveNote`/`searchNotes` handlers
  - `module.go` — `Manager.GetTask(id)` публичный геттер для polling в delegate_to_agent
- **`backend/internal/api/module.go`** — HTTP handlers для агентов (CRUD), модульные endpoints
- **`backend/internal/wiki/`** — Wiki Module: файловое .md хранилище, CRUD, полнотекстовый поиск, тесты
- **`backend/internal/mcp/`** — MCP Server: JSON-RPC 2.0 protocol (initialize, tools/list, tools/call), wiki tools
- **Frontend**: `store/agent.ts` (Zustand store), `AgentPanel.tsx`, `AgentCard.tsx`, `types/agent.ts`, `api/agent.ts`
- **Пер‑агент модель/провайдер** — `AgentCreateRequest` поддерживает `provider`/`model`, UI в `AgentCreateDialog`
- **Yandex GPT** — новый провайдер в AI модуле, `folder_id` в `SwitchAIProviderRequest`

### Как добавить новый backend-модуль
1. Создать `internal/<name>/` с реализацией `core.Module`
2. В `Init()` подписаться на события через `deps.EventBus.Subscribe()`
3. Зарегистрировать в `main.go`: `registry.Register(myModule)`
4. Если нужны HTTP руты — создать handler и добавить в chi router
5. Если нужны agent tools — `agent.RegisterTool(t ToolDef)` + `executor.RegisterCallback(name, fn)`

### Как добавить новый frontend-модуль (v4.0)
1. Создать `frontend/src/modules/{id}/module.ts` с объектом типа `AppModule`
2. Добавить в `MODULE_REGISTRY` в `registry.ts`
3. Создать панель-компонент, принимающий `ModulePanelProps` (`workbookId: string | null`, `onClose`)
4. Опционально: добавить `commands(ctx)` для CommandPalette и `agentTools` для UI-описания tools

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
| GET | /api/v1/ollama/status | Ollama: статус обнаружения + список моделей |
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
| GET | /api/v1/agents/tasks/{taskID}/stream | Agent task SSE streaming |
| GET | /api/v1/agents/tasks/{taskID}/logs | Agent task logs |
| GET | /api/v1/notes | Список заметок (поддерживает ?q= для поиска) |
| POST | /api/v1/notes | Создать заметку |
| PUT | /api/v1/notes/{noteID} | Обновить заметку |
| DELETE | /api/v1/notes/{noteID} | Удалить заметку |

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
- `useShellStore` — activeModuleId (string | null), toggleModule, closeModule, setActiveModule (v4.0)
- `useNotesStore` — notes[], loading, searchQuery, fetchNotes, createNote, updateNote, deleteNote (v4.0)

## Wiki

- `wiki/` — 15 страниц документации
- `index.md` — обзор, статус, оглавление, структура репозитория, быстрый старт
- `07-improvements.md` — road-map, известные проблемы, история реализованных фич
- `09-layout-directions.md` — spec многонаправленной раскладки
- `15-modular-platform.md` — v4.0 Nav Rail, AppModule interface, ModuleRegistry, Notes, MaSys (v4.0)

## Dev-инструменты

- `scripts/start.ps1` — одновременный запуск backend + frontend
- `scripts/build.ps1` — сборка всего
- `scripts/clean.ps1` — очистка кэша
- `scripts/reset.ps1` — полный сброс (БД + кэш)
- `Makefile` — цели: dev, build, clean, lint, test
- `run.bat` — двойной клик для запуска обоих серверов (Windows)

## Task Plans

### V3.3 — Коллаборация — частично реализовано
- [x] **OT/CRDT** — операционные трансформации для настоящей совместной работы без конфликтов
- [x] **Comments** — комментирование конкретных нод, треды (💬 иконка + CommentsPanel)
- [ ] **History timeline** — временная шкала изменений документа
- [ ] **Shareable links** — публичные ссылки на workbook с read-only доступом

### V3.4 — Экспорт/Импорт
- [ ] **Export Markdown** — обратный экспорт mindmap в .md
- [ ] **Export FreeMind** — обратный экспорт в .mm
- [ ] **Import OPML** — для совместимости с другими mindmap-инструментами
- [ ] **Batch import** — массовый импорт нескольких файлов

### V3.7 — Agent Ecosystem ✅
- [x] **Agent Zustand store** — `store/agent.ts`
- [x] **Per-agent model/provider** — выбор модели и провайдера
- [x] **Agent task submission UI** — кнопка "Submit Task" на AgentCard
- [x] **Agent streaming** — WebSocket стриминг мыслей/действий агента (`agent:task_log`)
- [x] **Agent chaining** — передача результата одного агента другому (persistent, с визуализацией в TaskList)
- [x] **Per-agent model presets** — динамический список моделей через `GET /api/v1/ai/models`; grouped `<select>` в AgentCreateDialog + AgentCard

### V3.8 — Agent UI Enhancement (в работе)

**Аудит выявил:** нет ручного ввода model ID; нет Stop-кнопки; TASK_ACTIONS не фильтруются по роли; провайдер не выбирается явно.

#### Фаза 1 — Agent Creation (P0) ✅
- [x] **Two-level model selector** — `providerSelect` → filtered `modelSelect` + "✎" toggle на `<input>`
- [x] **Agent Name field** — опциональное `name` поле; `AgentInfo.Name` на бэкенде
- [x] **Custom provider** — вариант "Custom endpoint…" → поле `Base URL`

#### Фаза 2 — AgentCard inline controls (P0) ✅
- [x] **Stop button** — "■ Stop" при `status === 'working'`; `POST /api/v1/agents/{id}/stop`
- [x] **Manual model input toggle** — "✎" переключает select ↔ input
- [x] **Name display + last task snippet** — `agent.name || role+id`; `✓`/`✗` под Submit

#### Фаза 3 — TaskSubmitDialog context-aware (P1) ✅
- [x] **Role-filtered actions** — `ROLE_ACTIONS` map; `roleId` prop вместо label; "+ Show all" toggle
- [x] **Natural language prompt** — Simple/JSON toggle; Simple → `{query: text}`
- [x] **Params schema hint** — `ACTION_SCHEMAS`; "Use example" кнопка в JSON mode

#### Фаза 4 — Provider controls (P2)
- [ ] **Explicit provider select** — раздельные контролы provider + model в AgentCard
- [ ] **Per-agent Stronghold key** — custom API key в Stronghold по ключу `agent-{id}-key`

#### Фаза 5 — Bulk & UX (P3)
- [ ] **Duplicate agent** — кнопка "⧉" на AgentCard
- [ ] **Stop All** — кнопка в хедере + `POST /api/v1/agents/stop-all`
- [ ] **Drag-to-reorder** — порядок в localStorage
- [ ] **Agent templates** — save/load конфига агента в localStorage

### V4.0 — Performance & Native
- [ ] **Worker-based layout** — Web Worker для тяжёлых деревьев (1000+ nodes)
- [ ] **Canvas/SVG hybrid** — Canvas для рендера + SVG overlay
- [ ] **Virtual scrolling** — виртуализация для списков
- [ ] **Lazy topic loading** — lazy loading глубоких поддеревьев
- [x] **Tauri desktop** — нативное приложение с Tauri v2 (sidecar, build-sidecar.bat)

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
- `skills/*.md` — 26 скилов-документов
- `lumen/` — Lumen Design System (токены, UI-кит, превью)
- `frontend/src-tauri/` — Tauri v2 desktop обёртка
- `frontend/src-tauri/src/lib.rs` — sidecar spawn/kill в setup/RunEvent::Exit
- `frontend/src-tauri/tauri.conf.json` — +externalBin: ["binaries/gmind-server"]
- `frontend/src-tauri/capabilities/default.json` — +shell:allow-execute
- `scripts/build-sidecar.bat` — сборка Go бинарника в src-tauri/binaries/
- `backend/migrations/003_agent_chaining.up.sql` — chain_to_agent_id, chain_from_task_id
- `frontend/src/components/TaskList/TaskList.tsx` — ⛓️ chain details в expanded view
- `frontend/src/components/MindMap/TopicNode.tsx` — 💬 comments иконка
- `backend/internal/ai/ollama.go` — OllamaDetector: health check, model list, периодический polling
- `backend/internal/api/ollama.go` — OllamaHandler: GET /api/v1/ollama/status
- `frontend/src/components/AIServerPanel/AIServerPanel.tsx` — Ollama секция (detected/not detected, модели, Use Ollama)

## Анализ векторов развития (2026)

### 1. RAG over Mindmaps — Векторный поиск по mindmap + wiki

**Суть:** Добавить векторные эмбеддинги (embeddings) всех mindmap-топиков и wiki-страниц в SQLite через `sqlite-vec`. При AI-запросе находить семантически близкие топики и подмешивать их в контекст. Это даст RAG (Retrieval-Augmented Generation) для агентов и чата.

**Технологии:**
- `github.com/viant/sqlite-vec` (v0.3) — векторный поиск в SQLite на чистом Go, CGO-free, работает с `modernc.org/sqlite` (уже используется в проекте)
- `github.com/viant/embedius` (v0.5) — готовый сервис индексации файлов с эмбеддингами поверх sqlite-vec
- Embedding-провайдеры: OpenAI (`text-embedding-3-small`), Ollama (локально), ONNX (полностью офлайн)

**Плюсы:**
- Нет внешних зависимостей — всё в SQLite, без отдельной векторной БД
- sqlite-vec уже совместим с нашим стеком (modernc.org/sqlite)
- Даёт качественный семантический поиск (не просто keyword match)
- Улучшает AI-генерацию: AI получает релевантные топики из всех карт пользователя
- Относительно прост в реализации — ~2-3 дня на прототип

**Минусы:**
- Нужен embedding-сервис (внешний API или локальная модель) — добавляет latency
- sqlite-vec пока v0.3, may be unstable под нагрузкой
- Индексация при каждом изменении mindmap (нужна фоновая синхронизация)
- Размер БД растёт (embeddings — это float32[] для каждого топика)
- Неочевидная польза для пользователя без конкретного use-case

**Оценка:** ⭐⭐⭐⭐⭐ (5/5) — Стоит делать. Это фундаментальное улучшение AI-возможностей: агенты смогут находить информацию через semantic search, а не только через keyword search. sqlite-vec идеально ложится на существующую архитектуру.

**Как улучшить/внедрить:**
1. Добавить `sqlite-vec` как модуль в Go backend
2. CRON-задача переиндексации всех mindmap + wiki при изменениях
3. UI: кнопка «AI Search по всем картам» в toolbar
4. Для агентов: новый tool `semantic_search(query string)` вместо `wiki_search`
5. Embedding провайдер — переиспользовать текущий AI provider (OpenAI/Yandex/Ollama)

---

### 2. Multi-Agent Orchestration — Supervisor/Worker, Parallel, Pipeline

**Суть:** Расширить текущее sequential chaining до полноценной оркестрации: supervisor-агент распределяет subtasks между worker-агентами, parallel fan-out нескольких агентов одновременно, pipeline с разветвлениями.

**Технологии:**
- **Своя реализация** (рекомендуется) — поверх текущей архитектуры `WorkerPool` + `TaskStore`
- **zenflow** — YAML-декларативные DAG workflows, coordinator-агент с mailboxes, можно встроить как библиотеку
- **agenticgokit** (v0.5) — streaming-first, sequential/parallel/DAG/loop orchestration, OpenTelemetry

**Плюсы:**
- Покрывает реальные сценарии: «напиши код → проверь → исправь» (pipeline)
- Параллельный запуск даёт прирост скорости (несколько агентов работают одновременно)
- Supervisor-агент может динамически выбирать, кого вызвать
- Наша архитектура (свои WorkerPool + TaskStore) позволяет гибко расширять
- Можно начать с малого: просто добавить parallel fan-out к текущему chaining

**Минусы:**
- Supervisor добавляет latency (один LLM-вызов на планирование)
- Отладка сложных DAG — нетривиальна
- Готовые библиотеки (zenflow, orloj) могут конфликтовать с нашей модульной архитектурой
- Координация состояния между параллельными агентами — сложно
- Риск переусложнить: текущее sequential chaining покрывает 80% сценариев

**Оценка:** ⭐⭐⭐⭐ (4/5) — Стоит делать, но поэтапно. Начать с parallel fan-out (запустить N агентов одновременно и собрать результаты), потом supervisor.

**Как улучшить/внедрить:**
1. **Phase 1:** Parallel fan-out — `POST /api/v1/agents/tasks` с `parallel_to: ["agent1", "agent2"]`
2. **Phase 2:** Supervisor pattern — новый tool `delegate_subtask(task, agent_id)` для агентов
3. **Phase 3:** Pipeline — визуальный редактор DAG в UI (как n8n, но упрощённый)
4. **Phase 4:** Вложенность — задача-родитель ждёт все дочерние, собирает результаты

---

### 3. Tauri Production Hardening — Stronghold, Tray, Auto-Update, CSP

**Суть:** Усилить Tauri desktop: (а) безопасное хранение API-ключей через `tauri-plugin-stronghold` (AES-256-GCM в OS keychain), (б) system tray для фоновой работы, (в) auto-update, (г) правильный CSP.

**Технологии:**
- `tauri-plugin-stronghold` — IOTA Stronghold secret management, шифрование ключей в vault.hold
- `tauri-plugin-autoupdater` — встроенный механизм обновлений
- `tauri-plugin-tray` — system tray icon + меню
- `tauri-plugin-global-shortcut` — глобальные хоткеи (показать/скрыть окно)

**Плюсы:**
- **Stronghold:** API-ключи не хранятся в .env или config — шифрованы в OS keychain
- **Tray:** приложение работает в трее, не занимая панель задач
- **Auto-update:** пользователи автоматически получают новые версии
- **CSP:** защита от XSS, контроль WebSocket origins
- Паттерн «Rust владеет ключами, фронтенд — IPC» подтверждён индустрией (ChatML, OpenPawz, World Monitor)

**Минусы:**
- Stronghold требует Rust-кода (надо писать на Rust, не на Go)
- Vault password management — нетривиально (как хранить ключ от хранилища ключей?)
- Auto-update требует сервер для хостинга обновлений или GitHub Releases
- На Windows tray и global shortcuts требуют дополнительных разрешений
- CSP может сломать существующие WebSocket подключения, если не настроить `connect-src`

**Оценка:** ⭐⭐⭐⭐ (4/5) — Важно для production-релиза, но не критично для текущей стадии. Stronghold — приоритет, когда появятся реальные пользователи.

**Как улучшить/внедрить:**
1. **Stronghold (P1):** `npm run tauri add stronghold`, Rust код для инициализации vault, JS API для get/set secrets. Перенести API-ключи AI провайдеров в Stronghold.
2. **Tray (P2):** `tauri-plugin-tray`, сворачивание в трей при закрытии окна, возврат по клику
3. **Global Shortcut (P2):** `tauri-plugin-global-shortcut`, Alt+Space для показа/скрытия из любого приложения
4. **CSP (P0):** Сейчас — проверить, что `connect-src ws://localhost:* http://localhost:*` уже есть в `tauri.conf.json`
5. **Auto-update (P3):** Настроить GitHub Releases + tauri-plugin-autoupdater

---

### 4. Local AI Auto-Detect — Ollama Discovery

**Суть:** Автоматически определять запущенный Ollama на `localhost:11434` и показывать его как доступный AI-провайдер без ручной настройки. Если Ollama не запущен — предлагать установить/запустить.

**Технологии:**
- `github.com/ollama/ollama/api` — официальный Go SDK, `api.ClientFromEnvironment()` уважает `OLLAMA_HOST`
- `GET http://localhost:11434/api/tags` — список доступных моделей
- Health check: `HEAD http://localhost:11434/` — проверка, запущен ли Ollama

**Плюсы:**
- Zero-config для пользователей с установленным Ollama
- Список моделей динамический (pull новой модели → сразу видна в Gmind)
- Уже есть `backend/internal/ai/llama.go` — можно переиспользовать часть кода
- Ollama поддерживает OpenAI-совместимый API — можно через существующий compat provider
- Официальный Go SDK — production-ready, используется самим Ollama CLI

**Минусы:**
- Health check каждые N секунд — лишние сетевые вызовы (можно кэшировать)
- Ollama может быть на нестандартном порту (OLLAMA_HOST) — надо учитывать
- На Windows Ollama требует установки отдельно
- Если Ollama не установлен — пользователю придётся ставить вручную (можно ссылку на ollama.com)

**Оценка:** ⭐⭐⭐⭐⭐ (5/5) — Must-have. Простой в реализации, огромная польза для пользователя. 1 день на реализацию.

**Как улучшить/внедрить:**
1. Добавить health check в `backend/internal/ai/ollama_detect.go`: `GET /api/tags` при старте и каждые 30s
2. Если Ollama найден — добавить провайдер `ollama` в список AI providers
3. UI: индикатор «Ollama detected ✓» в AIServerPanel с выбором модели
4. Использовать официальный Go SDK для chat/generate через Ollama
5. Support Open WebUI (authenticated) через `go-ollama` — если пользователь использует Open WebUI

---

### 5. Mobile PWA / Tauri Mobile

**Суть:** Запустить Gmind на iOS и Android через Tauri Mobile target. Фронтенд — React (уже есть), нативный рендеринг через WebView + Rust API.

**Технологии:**
- `tauri android init` / `tauri ios init` — генерация нативных проектов
- `tauri-plugin-http` — если нужен прямой HTTP доступ
- Push notifications через `tauri-plugin-notification`

**Плюсы:**
- Единая кодовая база (React) — desktop и mobile из одного проекта
- Нативное распространение через App Store и Google Play
- Tauri v2 официально поддерживает mobile (Android 7+, iOS 14+)
- Доступ к нативным API (камера, геолокация, файловая система)

**Минусы:**
- iOS требует Mac + Apple Developer Program ($99/год)
- Android требует Java KeyStore + Google Play Console ($25)
- Go backend не работает на мобильном устройстве (sidecar не запустится)
- Нужен отдельный backend-сервер (не sidecar) для mobile — надо перепроектировать архитектуру
- UI не адаптирован под touch-интерфейсы (drag & drop, zoom/pan, контекстное меню)
- Нужно переписывать компоненты под mobile-first или responsive-first

**Оценка:** ⭐⭐ (2/5) — Пока рано. Требует серьёзной архитектурной переработки (выделение backend как сервиса), адаптации UI под мобильные устройства. Стоит отложить до V5.0.

**Как улучшить/внедрить (когда придёт время):**
1. **Phase 0:** Выделить backend в отдельный сервис (уже есть Dockerfile) — mobile будет подключаться к удалённому серверу
2. **Phase 1:** Responsive AI chat (уже частично есть) — мобильная версия чата
3. **Phase 2:** Tauri android init — тестовый билд
4. **Phase 3:** Адаптация MindMap под touch (жесты, long-press, pinch-to-zoom)

---

### 6. MCP Bridge — Интеграция с n8n и внешними Workflow-движками

**Суть:** Позволить агентам вызывать внешние workflow (n8n, Zapier, Make) через MCP протокол. MCP сервер уже есть, нужно расширить его инструментами для внешних workflow.

**Технологии:**
- Embedded n8n (как в OpenPawz) — Docker-контейнер или npx n8n
- MCP Streamable HTTP transport — `POST /api/v1/mcp` уже есть
- Workflow-level MCP tools: `search_workflows`, `execute_workflow`, `get_workflow_details`

**Плюсы:**
- Огромный потенциал: n8n имеет 400+ интеграций (Slack, Gmail, GitHub, Telegram, Notion, и т.д.)
- MCP сервер уже работает — добавляем 3 новых tool
- Открывает сценарии: «найди в Notion → создай mindmap → отправь в Slack»
- Агенты могут автоматизировать бизнес-процессы

**Минусы:**
- n8n — это Java-скрипт (через npx) или Docker — добавляет ~500MB к дистрибутиву
- Если n8n не установлен — надо управлять его установкой/запуском
- Поверхностная интеграция (просто вызов workflow) — мало пользы
- Глубокая интеграция (auto-deploy workflow) — сложная инженерия (как в OpenPawz)
- Риск безопасности: внешние workflow имеют доступ к API

**Оценка:** ⭐⭐⭐ (3/5) — Перспективно, но не сейчас. Стоит делать после того, как базовая агентская система будет стабильна и будет понятен спрос от пользователей.

**Как улучшить/внедрить (когда придёт время):**
1. **Phase 1:** Добавить MCP tools: `n8n_execute_workflow`, `n8n_list_workflows`, `n8n_get_workflow_status`
2. **Phase 2:** Docker Compose profile для n8n (опциональный запуск)
3. **Phase 3:** Conditional execution — агент сам решает, когда вызвать n8n workflow

---

### 7. Knowledge Graph Fusion — Mindmap → Knowledge Graph → GraphRAG

**Суть:** Преобразовать mindmap-структуру (узлы + связи) в Knowledge Graph (nodes + edges), затем использовать GraphRAG для AI-запросов. В отличие от простого RAG (п.1), GraphRAG учитывает не только текст, но и топологию связей.

**Технологии:**
- **Microsoft GraphRAG** — community detection (Leiden), hierarchical summaries
- **Neo4j + LLM Graph Builder** — извлечение knowledge graph из текста
- **CogGRAG** — mindmap-inspired tree-structured reasoning (буквально наша тема!)
- Neo4j или локально: Memgraph (in-memory + persistent)

**Плюсы:**
- Mindmap — уже knowledge graph по своей сути (узлы → отношения → структура)
- CogGRAG (2025) — показал, что mindmap-структурированное мышление улучшает RAG
- GraphRAG даёт ответы на глобальные вопросы («какие основные темы во всех моих картах?»)
- Hierarchical community summaries — LLM может понять общую картину
- Отличает от конкурентов (XMind, Miro не имеют GraphRAG)

**Минусы:**
- Очень сложная реализация (community detection, hierarchical summaries — это research)
- Neo4j — тяжёлая зависимость (Java, ~500MB + Docker)
- GraphRAG Microsoft — Python, требует отдельного сервиса
- Понятна польза для enterprise, но не для solopreneur
- Research-риск: GraphRAG может не дать значимого улучшения над простым RAG

**Оценка:** ⭐⭐⭐ (3/5) — Технически красиво, но сложно и ресурсоёмко. Стоит как P4 (после базового RAG).

**Как улучшить/внедрить (когда придёт время):**
1. **Phase 0:** Сначала внедрить базовый RAG (п.1) — это foundation
2. **Phase 1:** Добавить relation embedding — при индексации сохранять не только текст, но и связи между узлами
3. **Phase 2:** Graph community detection на mindmap топиках (используя структуру дерева)
4. **Phase 3:** GraphRAG query — при запросе искать через traversal дерева + semantic similarity
5. Альтернатива: вместо Neo4j использовать SQLite с self-referencing таблицами (уже есть topics.parent_id)

---

## Итоговая матрица приоритетов

| # | Вектор | Приоритет | Сложность | Влияние | Статус |
|---|--------|-----------|-----------|---------|--------|
| 4 | Local AI Auto-Detect (Ollama) | P0 ✅ | Низкая | Высокое | **DONE** — реализовано |
| 1 | RAG over Mindmaps (sqlite-vec) | P1 ⭐ | Средняя | Очень высокое | Следующий спринт |
| 2 | Multi-Agent Orchestration (parallel) | P1 ⭐ | Средняя | Высокое | Через спринт |
| 3 | Tauri Hardening (Stronghold, CSP) | P2 | Средняя | Среднее | Перед production-релизом |
| 6 | MCP Bridge (n8n) | P3 | Высокая | Среднее | После стабильных агентов |
| 7 | Knowledge Graph Fusion (GraphRAG) | P4 | Очень высокая | Среднее | После RAG |
| 5 | Mobile PWA (Tauri Mobile) | P4 | Очень высокая | Низкое | Отложено до V5.0 |

**Рекомендация:** Ollama auto-detect — ✅ выполнено. Следом п.1 (RAG) — фундамент для всех AI-улучшений. Потом п.2 (multi-agent orchestration). Остальное — по мере готовности.

---

> Последнее обновление: см. git log.
> Синхронизация с wiki/ при каждом изменении — через auto-update skill.
