# Gmind

Desktop mindmap-приложение с AI-агентами, real-time коллаборацией и интеграцией с MASys.

Аналог XMind, написанный на Go + React + Tauri v2.

[![Build Windows .msi](https://github.com/sunremont-ui/gmind/actions/workflows/build.yml/badge.svg)](https://github.com/sunremont-ui/gmind/actions/workflows/build.yml)

---

## Возможности

**Mindmap-редактор:**
- 7 раскладок (Mindmap, Tree right/left/down/up, Org-Chart, Radial, Fishbone)
- Inline-редактирование с rich text (bold/italic/lists/images)
- Drag & drop, Undo/Redo (50 шагов), Copy/Paste, Multiple selection
- 10 тем, кастомизация нод (тени, стили, цвета границ/связей)
- Comments, hyperlinks, image nodes, sticky notes

**AI:**
- Поддержка OpenAI GPT-4o, Yandex GPT, Ollama (auto-detect), llama-server, любые OpenAI-совместимые endpoint'ы
- `Submit Task` для агентов с per-agent моделью
- AI-команды: Generate, Expand (✨), Summarize (📋), Image (DALL-E 3), Chat
- Semantic search (RAG) — text-embedding-3-small, cosine similarity

**Multi-Agent System (V4.3):**
- 8 ролей: Researcher, Organizer, Critic, Expander, Summarizer, Editor, Analyst, **Supervisor**
- Tools: 19+ инструментов (create/update/delete topic, wiki, MASys pipeline, semantic_search, delegate_to_agent, parallel_delegate, list_agents)
- ReAct loop с streaming, agent chaining, parallel fan-out (до 16 задач)
- Persistence: агенты переживают рестарт сервера

**Desktop (Tauri v2, V1.0.0):**
- Windows .msi инсталлятор (NSIS)
- System tray (left-click = toggle, right-click = меню)
- Global shortcut Ctrl+Shift+Space → Quick Capture
- Configurable shortcut главного окна (default Ctrl+Shift+G)
- Stronghold-зашифрованное хранение AI ключей (OS keychain)
- Autostart, startup agents, settings modal
- Auto-updater через GitHub Releases

**Collaboration & PWA:**
- WebSocket real-time (cursors, presence, operation sync)
- 4 access mode (Public / Collaborators / Agents only / Private)
- Offline-first PWA, Service Worker, IndexedDB, offline queue
- Quick Capture (Ctrl+Shift+I), Command Palette (Ctrl+Alt+Space)

**Import/Export:**
- Export: SVG, PNG, PDF, XMind 2020+
- Import: Markdown, FreeMind (.mm), XMind, JSON
- Drag-and-drop файлов на холст

**Модульная платформа (V4.0):**
- NavRail (48px Activity Bar) с 5 модулями: MindMap, Notes, Agent Sandbox, MASys, AI
- Extensible Tool Registry — добавление tools через `RegisterTool()` + `RegisterCallback()`
- AppModule interface для frontend-плагинов

**MASys Integration:**
- Tool `run_masys_pipeline` — Gmind агент вызывает MASys pipeline
- Module `gmind-mindmap` v2.0.0 — MASys управляет mindmap'ами (11 операций)
- Module `gmind-agent` v1.0.0 — MASys отправляет задачи Gmind-агентам
- Страница `/agents` в MASys web app — управление Gmind-агентами

---

## Установка для пользователя

1. Скачать `Gmind_X.Y.Z_x64-setup.exe` со страницы [Releases](https://github.com/sunremont-ui/gmind/releases)
2. Запустить установщик → Next → Install
3. Открыть **Gmind** из меню Пуск или с рабочего стола
4. Данные хранятся в `%APPDATA%\Gmind\` (SQLite, wiki, Stronghold-vault)

AI ключи добавить через UI: Settings → AIServerPanel → ввести ключи → ключи шифруются в OS keychain.

---

## Запуск из исходников

### Требования

| Инструмент | Версия |
|------------|--------|
| Go         | 1.22+  |
| Node       | 20+    |
| Rust       | stable (для desktop-режима) |
| cargo-tauri | `cargo install tauri-cli --version "^2"` |
| Git        | 2.40+  |

### Клонирование

```bash
git clone https://github.com/sunremont-ui/gmind.git
cd gmind
```

### Режим 1: Веб (быстрый старт)

Два терминала:

```bash
# Терминал 1 — backend
cd gmind/backend
go run ./cmd/server
# → http://localhost:1010
```

```bash
# Терминал 2 — frontend
cd gmind/frontend
npm install
npm run dev
# → http://localhost:1011
```

Или одной командой (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File gmind/scripts/start.ps1
```

Открыть: **http://localhost:1011**

### Режим 2: Desktop (Tauri)

```bat
gmind\dev-desktop.bat
```

Делает:
1. Убивает старые процессы `gmind-server.exe` / `gmind.exe`
2. Собирает Go sidecar → `src-tauri/binaries/gmind-server-x86_64-pc-windows-msvc.exe`
3. Запускает `npx tauri dev` (Vite + Rust HMR)

Первый запуск Rust — ~5–8 минут (компиляция зависимостей).

### Режим 3: Docker

```powershell
cd gmind
docker-compose up
# backend → :1010, frontend nginx → :1012
```

---

## Production-сборка

### Локально (требует Rust)

```bash
cd gmind
make tauri-build
# Результат: gmind/frontend/src-tauri/target/release/bundle/nsis/Gmind_X.Y.Z_x64-setup.exe
```

### Через CI (GitHub Actions)

Workflow `.github/workflows/build.yml` триггерится на push тега `v*`:

```bash
git tag v1.0.1
git push origin v1.0.1
# CI: Go sidecar → tests → tauri-action → GitHub Release Draft с .msi
```

Прогресс: [Actions tab](https://github.com/sunremont-ui/gmind/actions). После завершения — опубликовать Release Draft вручную.

---

## Структура проекта

```
gmind/
├── backend/                Go бэкенд (порт 1010)
│   ├── cmd/server/         main.go — entrypoint
│   ├── internal/
│   │   ├── agent/          Agent Module (ReAct, tools, worker pool, scheduler)
│   │   ├── ai/             AI providers (OpenAI, Yandex, Ollama, llama-server)
│   │   ├── api/            HTTP handlers (chi router)
│   │   ├── config/         GMIND_DATA_DIR, MASYS_BASE_URL, env config
│   │   ├── core/           Module interface, EventBus, Lifecycle
│   │   ├── mcp/            MCP Server (JSON-RPC 2.0)
│   │   ├── model/          Domain types (Topic, Sheet, Workbook)
│   │   ├── rag/            RAG service (embeddings, semantic search)
│   │   ├── store/          SQLite CRUD (workbooks, agents, tasks, notes, embeddings)
│   │   ├── webhook/        Webhooks
│   │   ├── wiki/           Wiki Module (файловое .md хранилище)
│   │   ├── ws/             WebSocket hub
│   │   └── xmind/          .xmind import/export
│   └── migrations/         001-009_*.up.sql/.down.sql
├── frontend/               React + Vite + TypeScript (порт 1011 dev)
│   ├── src/
│   │   ├── api/            HTTP+WS клиенты (client, agent, notes, ws, secrets)
│   │   ├── components/     UI компоненты (MindMap, Sidebar, AgentPanel, MaSysPanel, ...)
│   │   ├── modules/        Modular platform (AppModule + registry + 5 модулей)
│   │   ├── renderer/       Layout engine + SVG renderer
│   │   ├── store/          Zustand stores (mindmap, agent, shell, notes, theme, layout)
│   │   └── types/          TypeScript interfaces
│   └── src-tauri/          Tauri v2 Rust обёртка (sidecar, tray, Stronghold, shortcuts)
├── scripts/                Dev utilities (start.ps1, build.ps1, clean.ps1)
├── lumen/                  Lumen Design System (токены, UI-кит, превью)
├── wiki/                   Документация (15 страниц markdown)
├── skills/                 Технические скилл-файлы (28 шт.)
├── dev-desktop.bat         Запуск Tauri dev (Windows)
├── build-release.bat       Сборка production .msi
├── docker-compose.yml      Docker setup
├── Makefile                Цели: dev, build, test, tauri-dev, tauri-build, release
└── AGENTS.md / PLANS.md    Контекст и план сессии (для AI)
```

---

## Порты

| Сервис | Порт |
|--------|------|
| Gmind backend API | **1010** |
| Vite dev server | **1011** |
| Docker frontend nginx | **1012** |
| llama.cpp (default) | **1100** |
| Ollama | 11434 (стандарт) |
| MASys | 3000 (если запущен) |

Конфиг внешних model-серверов — `MODEL_SERVERS_CONFIG` env → `model-servers.json`.

---

## Архитектура

```
┌──────────────────────────────────────────────────┐
│   Tauri v2 Desktop (Rust shell + WebView)         │
│   ├─ System Tray, Global Shortcuts, Stronghold    │
│   └─ Sidecar process: gmind-server (Go)           │
└──────────────────────────────────────────────────┘
                       │
       ┌───────────────┼─────────────────┐
       ↓               ↓                 ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Frontend    │  │  Backend     │  │  Wiki        │
│  React+Vite  │  │  Go+chi+SQLite│  │  .md files   │
│  Zustand     │←→│  WebSocket   │  │              │
│  SVG render  │  │  REST API    │  │              │
└──────────────┘  │  Agent Module│  └──────────────┘
                  │  ReAct + Tools│
                  │  MCP Server   │
                  └──────────────┘
                       │
                       ↓
              ┌──────────────────┐
              │  AI Providers    │
              │  OpenAI/Yandex   │
              │  Ollama/llama    │
              └──────────────────┘
```

**Module System (backend):**
- `core.Module` интерфейс с `Init/Start/Stop`
- `Registry` + `EventBus` + `Lifecycle` (graph of dependencies)
- Модули: agent, wiki, mcp, scheduler, webhook

**Tool Registry (extensible):**
```go
// Backend: добавить tool
agent.RegisterTool(agent.ToolDef{Name: "my_tool", ...})
executor.RegisterCallback("my_tool", func(raw json.RawMessage) (any, error) { ... })
```

**AppModule (frontend):**
```ts
// Frontend: добавить модуль
// 1. frontend/src/modules/my-module/module.ts с объектом AppModule
// 2. Добавить в MODULE_REGISTRY в registry.ts
// 3. Создать панель-компонент с ModulePanelProps
```

---

## Команды

| Команда | Описание |
|---------|----------|
| `make dev` | Запустить backend + frontend (dev) |
| `make build` | Собрать backend + frontend (production) |
| `make test` | Прогнать все тесты (Go + Vitest) |
| `make tauri-dev` | Desktop dev режим |
| `make tauri-sidecar` | Собрать только Go sidecar |
| `make tauri-build` | Собрать production .msi |
| `make release` | Альяс для tauri-build с release-флагами |
| `make lint` | Линтинг (Go vet + ESLint) |
| `make clean` | Очистить артефакты |

PowerShell-скрипты:
- `scripts/start.ps1` — одновременный запуск backend+frontend
- `scripts/build.ps1` — production-сборка
- `scripts/clean.ps1` — очистка кэша
- `scripts/reset.ps1` — полный сброс (БД + кэш)

---

## Использование

### Создание mindmap

1. Открыть Gmind → **+ New Workbook** в Sidebar
2. Двойной клик на ноде → редактирование
3. **Drag** ноду на другую → переподчинить
4. **Ctrl+Click** для множественного выбора
5. **Ctrl+F** — поиск, **Ctrl+Z/Shift+Z** — undo/redo

### AI-генерация

1. Открыть AI Panel (иконка в NavRail)
2. Настроить провайдера (OpenAI/Yandex/Ollama) → ввести ключ
3. Generate / Chat / Expand (✨ кнопка на ноде) / Summarize (📋) / Image (🎨 DALL-E 3)

### Агенты

1. Открыть Agent Sandbox (иконка в NavRail)
2. **+ New Agent** → выбрать роль (researcher, organizer, supervisor, ...)
3. На карточке агента: ввести промпт → **Submit Task →**
4. Реал-тайм стрим действий агента (Working... / Thinking... / Using <tool>)
5. **⛓️ Chain to** — передать результат другому агенту

**Supervisor с parallel_delegate:**
```
1. Создать Supervisor агента
2. Submit Task: "Compare AI from OpenAI vs Anthropic vs Google"
3. Supervisor → list_agents → выбирает 3 researcher
4. → parallel_delegate({tasks: [...]}) → 3 задачи параллельно
5. После завершения всех → агрегирует результат
```

### MASys интеграция

Если MASys запущен на :3000, во вкладке MaSys видны его пайплайны. Можно запустить пайплайн напрямую из UI или из агента через `run_masys_pipeline`.

### Wiki + MCP

- Wiki хранится в `%APPDATA%\Gmind\wiki\` (файлы .md)
- MCP Server: `POST http://localhost:1010/api/v1/mcp` — JSON-RPC 2.0
- Tools для агентов: `wiki_search`, `wiki_read`, `wiki_write`

### Quick Capture

- **Ctrl+Shift+Space** (глобально, даже когда Gmind свёрнут) → открывает мини-окно
- Текст автоматически попадает в **📥 Inbox** workbook
- Поддержка тегов, target selector, offline-режима

---

## Документация

- [wiki/](gmind/wiki/) — 15 страниц концептов и архитектуры
- [AGENTS.md](gmind/AGENTS.md) — полный контекст проекта (для AI-сессий)
- [PLANS.md](gmind/PLANS.md) — roadmap и лог сессий
- [skills/](gmind/skills/) — 28 технических скиллов с деталями реализации

---

## Roadmap

**Готово (V1.0.0):**
- ✅ V4.1 Agent Persistence (SQLite-backed registry)
- ✅ V4.2 RAG Search (semantic_search via OpenAI embeddings)
- ✅ V4.3 Multi-Agent Orchestration (parallel_delegate, supervisor role)

**Следующее (V4.4):**
- 🟠 TaskList grouped UI по `parallel_group_id`
- 🟠 Export Markdown / FreeMind
- 🟡 Drag-and-drop импорт файлов

**Будущее:**
- 🟡 V4.5 Web Worker layout (1000+ нод)
- 🟢 V4.6 MCP Bridge (n8n, Zapier)
- 🟢 V5.0 Knowledge Graph + GraphRAG, Pipeline DAG UI

Подробно: [PLANS.md](gmind/PLANS.md), [wiki/07-improvements.md](gmind/wiki/07-improvements.md).

---

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Go 1.22, chi router, gorilla/websocket, modernc.org/sqlite (pure Go, no CGO) |
| Frontend | React 18, Vite, TypeScript, Zustand, SVG renderer |
| Desktop | Tauri v2 (Rust shell), Go sidecar, NSIS installer |
| AI | OpenAI GPT-4o, Yandex GPT, Ollama (auto-detect), llama-server, custom endpoints |
| Secrets | Tauri Stronghold (OS keychain, AES-256-GCM) |
| Design | Lumen Design System (Indigo #5B6CFF, Inter, neumorphism) |
| Tests | Vitest (frontend, 62 тестов), Go testing (backend, 56+ тестов) |
| CI/CD | GitHub Actions → Windows `.msi` artifact + Release Draft |

---

## Лицензия

Личный проект. Использование, форки, доработка — свободно.

---

## Контакты

- GitHub: [github.com/sunremont-ui/gmind](https://github.com/sunremont-ui/gmind)
- Issues: [github.com/sunremont-ui/gmind/issues](https://github.com/sunremont-ui/gmind/issues)
