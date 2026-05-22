# Skill: MASys Integration — Gmind ↔ MASys

> MASys: `E:\MASys` · Gmind backend: `http://localhost:1010` · MASys server: `http://localhost:3000`

## Что такое MASys

**MASys (Modular Agent System)** — визуальная платформа построения AI-пайплайнов через граф-редактор. Узлы = модули с типизированными портами. Рёбра = потоки данных между портами.

**Стек:** React 19 + React Flow + Zustand (frontend) · Fastify + tRPC + Prisma + SQLite (backend) · pnpm monorepo

**70+ модулей** в `E:\MASys\modules/`: LLM Call, agent-loop (ReAct), web-search, html-extract, browser automation, pdf/docx/xlsx readers, vector-store, embedder, whisper-stt, vision, TTS, telegram, email, code (vm sandbox), db-query, pipeline-call, и др.

---

## Интеграционная архитектура

```
┌──────────────────────────────────────────────────┐
│            GMIND DESKTOP (Tauri v2)               │
│  React UI ←→ Go Backend :8080                    │
│  ┌────────────────────────────────────────────┐  │
│  │  Agent System (ReAct + ToolRegistry)       │  │
│  │  Tool: run_masys_pipeline ──────────────┐  │  │
│  └─────────────────────────────────────────┼──┘  │
│  MCP Server (JSON-RPC :8080/api/v1/mcp)    │     │
└────────────────────────────────────────────┼─────┘
     ↑ HTTP /api/v1/*                        │ HTTP
     │                                       ↓
┌────┴───────────────────────────────────────────┐
│            MASYS PLATFORM (:3000)               │
│  Graph Editor (React Flow)                      │
│  DAG Executor + Event Bus                       │
│  tRPC: pipelines.list, runs.start, runs.get     │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  gmind-mindmap module v2.0.0             │  │
│  │  Operations:                             │  │
│  │  create · add-topics · batch-create      │  │
│  │  update-topic · delete-topic             │  │
│  │  get-workbook · list-workbooks           │  │
│  │  generate (AI) · chat · export-markdown  │  │
│  │  submit-agent-task (v2.1, Фаза 3.2 ✅)  │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  agent-loop module v1.0.0                │  │
│  │  ReAct: task → [think → tool call] × N  │  │
│  │  Tools = MASys пайплайны                 │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## MASys → Gmind (уже работает)

### gmind-agent v1.0.0

Файл: `E:\MASys\modules\gmind-agent\`

Dedicated модуль: отправить задачу конкретному Gmind-агенту + polling до завершения.

```
pipeline-input(action="Research topic", workbookId="wb_123")
  → gmind-agent(config: { agentId: "<id>", timeoutMs: 120000 })
  → logger(result)
```

Реализован как `fetch POST /tasks` → loop с `await sleep(pollIntervalMs)` + AbortController.
Смотреть: `index.ts` функция `execute()`.

### /agents страница (http://localhost:5173/agents)

MASys получил полноценный agent management UI. Ключевые файлы:

```
E:\MASys\apps\server\src\router\gmindAgents.ts   ← tRPC прокси к Gmind API
E:\MASys\apps\web\src\pages\AgentsPage.tsx        ← UI страница
E:\MASys\apps\web\src\App.tsx                     ← маршрут /agents
E:\MASys\apps\web\src\pages\DashboardPage.tsx     ← кнопка «Агенты» в навигации
```

`gmindAgents` tRPC роутер: `list`, `create`, `update`, `delete`, `stop`, `listTasks`, `submitTask`, `getTask`, `getTaskLogs`, `getBaseUrl`.

Gmind URL: secret `gmind-base-url` в MASys (через Settings → Secrets).

TaskLogDrawer — прямой SSE к Gmind без прокси:
```ts
const es = new EventSource(`${gmindBaseUrl}/api/v1/agents/tasks/${taskId}/stream`)
es.addEventListener('log', (e) => setLogs(prev => [...prev, JSON.parse(e.data)]))
```

### gmind-mindmap v2.0.0
Файл: `E:\MASys\modules\gmind-mindmap\`

Использование в пайплайне MASys:
```
pipeline-input(operation="create", title="My Map")
  → gmind-mindmap(config.baseUrl="http://localhost:1010")
  → logger(workbookId)
```

**Конфигурация модуля:**
```json
{
  "baseUrl": "http://localhost:1010",
  "defaultTitle": "MASys Pipeline Map",
  "maxDepth": 5
}
```

**Все операции:**

| Operation | Обязательные inputs | Выходы |
|-----------|---------------------|--------|
| `create` | `title` | `workbookId`, `sheetId`, `url` |
| `add-topics` | `workbookId`, `topics` (дерево) | `topicIds` |
| `batch-create` | `workbookId`, `topics` (flat [{parent_id, title}]) | `topicIds` |
| `update-topic` | `workbookId`, `topicId`, `updateFields` | - |
| `delete-topic` | `workbookId`, `topicId` | - |
| `get-workbook` | `workbookId` | `tree`, `url` |
| `list-workbooks` | - | `workbooks` [{id, title}] |
| `delete-workbook` | `workbookId` | - |
| `generate` | `workbookId`, `prompt` | `reply` |
| `chat` | `workbookId`, `prompt` | `reply` |
| `export-markdown` | `workbookId` | `markdown` |
| `submit-agent-task` | `agentId`, `action`, `taskParams` | `taskId` |

**Пример: создать mindmap из текста:**
```
pipeline-input(text="Write about AI trends") →
  llm-call(prompt="Generate mindmap structure as JSON: {title, children:[{title, children:[...]}]}") →
  json-parser →
  gmind-mindmap(operation="create") →
  gmind-mindmap(operation="add-topics") →
  logger
```

### agent-loop + gmind-mindmap как tool
Использование agent-loop с gmind-mindmap в качестве инструмента:

1. Создать вспомогательный пайплайн `"create-mindmap-helper"`:
   ```
   pipeline-input(data={operation, title, topics, workbookId}) →
     gmind-mindmap →
     pipeline-input.output
   ```

2. В agent-loop config → toolsJson:
   ```json
   [{
     "name": "create_mindmap",
     "description": "Creates a mindmap in Gmind. Params: title (string), topics (array of {title, children})",
     "pipelineId": "<id-of-create-mindmap-helper>",
     "resultPath": "gmind-mindmap-1.workbookId",
     "inputSchema": {
       "type": "object",
       "properties": {
         "title": {"type": "string"},
         "topics": {"type": "array"}
       },
       "required": ["title"]
     }
   }]
   ```

---

## Gmind → MASys (Фаза 2 — ✅ DONE, 2026-05-14)

### Tool: run_masys_pipeline ✅

Реализован в `backend/internal/agent/tools.go` + `executor.go`.

```
MASYS_BASE_URL env → default http://localhost:3000
GET /api/v1/masys/pipelines  — proxy к MASys tRPC (для UI)
```

Агент вызывает `run_masys_pipeline(pipeline_id, inputs)` → POST `/trpc/runs.start` → poll `/trpc/runs.get` каждые 2s → результат или таймаут 5 мин.

MaSysPanel в Gmind UI — список пайплайнов + Run кнопка + agent selector.

---

## Запуск MASys

```bash
cd E:\MASys
pnpm install
pnpm dev          # запускает server (:3000) + web (:5173) параллельно
```

Или только сервер:
```bash
cd E:\MASys/apps/server
pnpm dev          # Fastify на :3000
```

Первый запуск — инициализировать БД:
```bash
cd E:\MASys/apps/server
npx prisma migrate deploy
```

---

## MASys API (tRPC)

MASys использует tRPC — вызовы через HTTP как:

```
GET  http://localhost:3000/trpc/pipelines.list
GET  http://localhost:3000/trpc/pipelines.get?input={"id":"<id>"}
POST http://localhost:3000/trpc/runs.start  body: {"json":{"pipelineId":"<id>"}}
GET  http://localhost:3000/trpc/runs.get?input={"id":"<runId>"}
WS   ws://localhost:3000/ws?runId=<runId>   events stream
```

Secrets (AI ключи для LLM Call модуля):
```
POST http://localhost:3000/trpc/secrets.set  body: {"json":{"key":"ANTHROPIC_API_KEY","value":"sk-..."}}
```

---

## Добавление нового MASys-модуля для Gmind

Чеклист:
```
□ E:\MASys\modules\<name>\manifest.json  — контракт (inputs/outputs/config)
□ E:\MASys\modules\<name>\index.ts       — defineModule<I,C,O>({ manifest, execute })
□ E:\MASys\modules\<name>\package.json   — { name: "@masys/module-<name>", type: "module" }
□ E:\MASys\apps\server\src\runtime\moduleLoader.ts — import + moduleRegistry.register()
```

Шаблон: `E:\MASys\modules\_template\`

---

## Полезные пайплайны (идеи)

| Пайплайн | Описание |
|----------|----------|
| `research-to-mindmap` | `pipeline-input(query) → web-search → html-extract → llm-call(summarize+structure) → gmind-mindmap(create+add-topics)` |
| `pdf-to-mindmap` | `pipeline-input(url) → file-downloader → pdf-reader → text-splitter → llm-call → gmind-mindmap` |
| `agent-researcher` | `pipeline-input(task) → agent-loop(tools=[web-search, gmind-mindmap]) → logger` |
| `chat-with-map` | `webhook-input → gmind-mindmap(get-workbook) → merge(map+question) → llm-call → gmind-mindmap(chat)` |
| `wiki-to-mindmap` | `pipeline-input(wiki_query) → http-request(Gmind wiki) → llm-call → gmind-mindmap(create)` |
