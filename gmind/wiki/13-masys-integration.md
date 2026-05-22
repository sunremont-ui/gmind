# 13 · MASys Integration — Gmind ↔ MASys

> MASys: `E:\MASys` (pnpm monorepo) · Gmind backend: `:8080` · MASys server: `:3000`

## Что такое MASys

**MASys (Modular Agent System)** — визуальная платформа для построения AI-пайплайнов через граф-редактор. Пользователь собирает граф из узлов-модулей, соединяет их типизированными рёбрами (портами). Runtime выполняет граф как DAG, транслируя события в реальном времени через WebSocket.

```
Стек MASys:
  Frontend: React 19 + React Flow + Zustand + TanStack Query (Vite)
  Backend:  Node.js 22 + Fastify + tRPC + Prisma + SQLite
  Monorepo: pnpm workspaces
  Запуск:   pnpm dev (порт 3000 = server, порт 5173 = web)
```

**70+ встроенных модулей** — полный список в `E:\MASys\wiki\10-modules.md`:

| Категория | Модули |
|-----------|--------|
| `ai` | llm-call, agent-loop (ReAct), llama-server, whisper-stt, vision-call, tts-call |
| `io` | http-request, db-query, html-extract, web-fetch, web-search, web-screenshot, email-send, telegram-send |
| `transform` | json-parser, text-template, object-get, merge, string-ops, array-ops, code (vm) |
| `logic` | if-condition, switch-case |
| `trigger` | pipeline-input, webhook-input, schedule-trigger |
| `flow` | pipeline-call (sub-pipelines) |
| `control` | delay, human-review |
| `monitor` | logger |
| `browser` | browser-navigate, browser-click, browser-type, browser-extract, browser-screenshot |
| `files` | pdf-reader, docx-reader, xlsx-reader, text-file-reader/writer, image-file-reader |
| **`gmind`** | **gmind-mindmap v2.0.0** |

---

## Архитектура интеграции

```
┌──────────────────────────────────────────────────────────┐
│              GMIND DESKTOP (Tauri v2)                     │
│                                                          │
│  Go Backend :8080                                        │
│  ├── REST API /api/v1/*  ◄───── gmind-mindmap module     │
│  ├── MCP Server (JSON-RPC)                               │
│  └── Agent System                                        │
│        └── ToolRegistry                                  │
│              └── run_masys_pipeline ──────────────────┐  │
│                                                       │  │
└───────────────────────────────────────────────────────┼──┘
                                                        │ HTTP
                                                        ▼
┌──────────────────────────────────────────────────────────┐
│              MASYS PLATFORM :3000                         │
│                                                          │
│  tRPC Router                                            │
│  ├── pipelines.list / .get / .create / .update / .delete │
│  ├── runs.start / .get / .list / .events                 │
│  └── secrets.set / .delete / .list                       │
│                                                          │
│  DAG Executor + Event Bus                               │
│  └── WebSocket ws://localhost:3000/ws?runId=<id>         │
│                                                          │
│  Module Registry (70+ modules)                          │
│  └── gmind-mindmap v2.0.0 ──────────── HTTP → :8080     │
│  └── agent-loop v1.0.0 (ReAct)                          │
└──────────────────────────────────────────────────────────┘
```

**Потоки данных:**
- **MASys → Gmind:** `gmind-mindmap` модуль вызывает REST API Gmind (`:8080/api/v1/*`)
- **Gmind → MASys:** tool `run_masys_pipeline` в Gmind вызывает tRPC `/trpc/runs.start` (Фаза 2)

---

## gmind-mindmap v2.0.0

Файл: `E:\MASys\modules\gmind-mindmap\`

Полное управление Gmind из MASys пайплайна. Один модуль — 11 операций через поле `operation`.

### Конфигурация

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `baseUrl` | `http://localhost:1010` | URL Gmind backend |
| `defaultTitle` | `MASys Pipeline Map` | Заголовок для новых workbook |
| `maxDepth` | `5` | Макс. глубина рекурсивного создания топиков |

### Все операции

| `operation` | Обязательные inputs | Ключевые outputs |
|-------------|---------------------|-----------------|
| `create` | `title` | `workbookId`, `sheetId`, `url` |
| `add-topics` | `workbookId`, `topics` | `topicIds` |
| `batch-create` | `workbookId`, `topics` (flat) | `topicIds` |
| `update-topic` | `workbookId`, `topicId`, `updateFields` | — |
| `delete-topic` | `workbookId`, `topicId` | — |
| `get-workbook` | `workbookId` | `tree`, `url` |
| `list-workbooks` | — | `workbooks` [{id,title}] |
| `delete-workbook` | `workbookId` | — |
| `generate` | `workbookId`, `prompt` | `reply` |
| `chat` | `workbookId`, `prompt` | `reply` |
| `export-markdown` | `workbookId` | `markdown` |

**Формат `topics` для `add-topics` (дерево):**
```json
[
  {
    "title": "Root Branch",
    "children": [
      {"title": "Sub 1", "font_color": "#3b82f6"},
      {"title": "Sub 2", "children": [{"title": "Deep"}]}
    ]
  }
]
```

**Формат `topics` для `batch-create` (плоский список):**
```json
[
  {"parent_id": "root-topic-id", "title": "First Topic"},
  {"parent_id": "<id-of-first>", "title": "Child of First"}
]
```

---

## agent-loop v1.0.0

ReAct-агент: итеративно рассуждает и вызывает инструменты (MASys пайплайны) до финального ответа.

**Конфигурация:**
```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "maxIterations": 10,
  "temperature": 0.3,
  "toolsJson": "[...]"
}
```

**toolsJson** — каждый инструмент это MASys пайплайн:
```json
[{
  "name": "create_mindmap",
  "description": "Creates a mindmap in Gmind with given title and topics",
  "pipelineId": "cm_abc123",
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

## Пайплайны (примеры)

### 1. Веб-исследование → Mindmap

```
pipeline-input(query: "AI trends 2026")
  → web-search(numResults=5)
  → array-ops(map: "item.url")
  → html-extract(maxLength=3000)     ← для каждого URL
  → llm-call(
      prompt="Create a mindmap JSON from this research: {{text}}
      Format: {title: string, children: [{title, children:[...]}]}"
    )
  → json-parser
  → gmind-mindmap(operation="create")   ← создаём workbook
  → gmind-mindmap(operation="add-topics")  ← добавляем структуру
  → logger(workbookId + url)
```

### 2. Agent-loop с gmind-mindmap как tool

```
pipeline-input(task: "Research quantum computing and create a mindmap")
  → agent-loop(
      provider="anthropic",
      model="claude-sonnet-4-6",
      toolsJson=[
        {name:"search_web", pipelineId:"<web-search-pipeline>"},
        {name:"create_mindmap", pipelineId:"<gmind-create-pipeline>"},
        {name:"add_topics", pipelineId:"<gmind-add-topics-pipeline>"}
      ]
    )
  → logger(result + iterations)
```

### 3. PDF → Mindmap

```
pipeline-input(url: "https://arxiv.org/paper.pdf")
  → file-downloader
  → pdf-reader
  → text-splitter(chunkSize=2000)
  → array-ops(map: chunk)
  → llm-call(prompt="Extract key concepts from: {{text}}")
  → merge(mode="deep")
  → llm-call(prompt="Organize into mindmap JSON: {title, children:[...]}")
  → json-parser
  → gmind-mindmap(operation="create")
  → gmind-mindmap(operation="add-topics")
```

### 4. Submit Gmind Agent Task из MASys (Фаза 3)

После добавления операции `submit-agent-task` в gmind-mindmap:
```
pipeline-input(agentId: "<researcher-agent-id>", task: "Research {{topic}}")
  → gmind-mindmap(operation="submit-agent-task")
  → delay(5000)   ← ждём выполнения
  → http-request(GET /api/v1/agents/tasks/{taskId})
  → object-get(path="result")
  → logger
```

---

## Gmind → MASys (Фаза 2)

### Tool: run_masys_pipeline

После реализации в `backend/internal/agent/tools.go`, Gmind-агент может использовать:

```
Агент "Researcher" в Gmind:
  Task: "Research quantum computing"
  → ReAct loop:
    → tool: run_masys_pipeline(
        pipeline_id: "cm_web-research",
        inputs: {text: "quantum computing latest papers"}
      )
    → получает результат (workbookId из gmind-mindmap)
    → tool: create_topic("Summary: ...", parent_id="root")
    → DONE
```

**Переменная окружения:** `MASYS_BASE_URL=http://localhost:3000`

---

## Запуск

### MASys

```bat
cd E:\MASys
pnpm install
pnpm dev
```

Первый запуск (инициализация БД):
```bat
cd E:\MASys\apps\server
npx prisma migrate deploy
```

MASys доступен:
- Граф-редактор: http://localhost:5173
- API (tRPC): http://localhost:3000/trpc

### AI Секреты для MASys (LLM Call module)

Через UI: Settings → Secrets → Add, или через API:
```bash
curl -X POST http://localhost:3000/trpc/secrets.set \
  -H "Content-Type: application/json" \
  -d '{"json":{"key":"ANTHROPIC_API_KEY","value":"sk-ant-..."}}'
```

---

## Схема данных MASys (Prisma / SQLite)

```prisma
model Pipeline {
  id          String   @id @default(cuid())
  name        String
  description String?
  graph       String   // JSON: { nodes, edges }
  runs        Run[]
}

model Run {
  id          String    @id
  pipelineId  String
  status      String    // running | completed | failed
  startedAt   DateTime
  completedAt DateTime?
  durationMs  Int?
  events      RunEvent[]
}

model RunEvent {
  id        String   @id @default(cuid())
  runId     String
  type      String   // node.started | node.completed | node.failed | pipeline.completed
  payload   String   // JSON
  timestamp DateTime
}
```

---

## Статус интеграции

| Направление | Статус | Примечание |
|-------------|--------|------------|
| MASys → Gmind (`gmind-mindmap`) | ✅ v2.0.0 | 11 операций верифицированы против текущего API |
| `submit-agent-task` операция | ✅ реализована | `POST /api/v1/agents/{agentId}/tasks` из MASys |
| MASys `gmind-agent` модуль | ✅ v1.0.0 | Dedicated модуль для отправки задачи + polling. `agentId` в config |
| MASys `/agents` страница | ✅ реализована | `http://localhost:5173/agents` — полный agent management UI |
| MASys `gmindAgents` tRPC роутер | ✅ реализован | `apps/server/src/router/gmindAgents.ts` — прокси всего Gmind agent API |
| MASys agent-loop + gmind tools | ✅ готово | Создать эталонный пайплайн вручную в GUI |
| Gmind → MASys (`run_masys_pipeline`) | ✅ реализован | tool в tools.go + tRPC start/poll в executor.go |
| UI: MASys pipelines в Gmind AgentPanel | ✅ реализован | Вкладка "MASys" в AgentPanel, Run кнопка |
| Gmind Desktop (.exe) | ✅ работает | `cargo tauri dev` запускается, sidecar, Stronghold JS |
| Новые agent tools | ✅ реализованы | `delete_topic`, `move_topic`, `list_topics`, `delegate_to_agent` |

---

## gmind-agent v1.0.0

Файл: `E:\MASys\modules\gmind-agent\`

Dedicated модуль для запуска конкретного Gmind-агента с polling до завершения.

### Конфигурация

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `agentId` | (обязательно) | ID Gmind-агента |
| `baseUrl` | `http://localhost:1010` | URL Gmind backend |
| `timeoutMs` | `120000` | Таймаут ожидания (2 мин) |
| `pollIntervalMs` | `1000` | Интервал polling |

### Inputs / Outputs

**Inputs:** `action` (string, required), `params` (object), `workbookId` (string), `sheetId` (string)

**Outputs:** `result` (string — финальный ответ агента), `taskId` (string)

### Использование в пайплайне

```
pipeline-input(action="Research quantum computing", workbookId="wb_123")
  → gmind-agent(config: { agentId: "<researcher-id>", timeoutMs: 120000 })
  → logger(result)
```

---

## MASys /agents страница

URL: `http://localhost:5173/agents`

Полноценный интерфейс управления Gmind-агентами из браузера MASys:
- Создание агентов (role, name, provider, model, custom system prompt)
- AgentCard: quick-prompt input, Stop, Delete, system prompt editor
- TaskLogDrawer: SSE-стриминг логов напрямую к Gmind (`EventSource → GET /api/v1/agents/tasks/{id}/stream`)
- Connection status indicator (Connected / Offline), auto-refresh 5s
- Настройка Gmind URL: MASys Settings → Secrets → ключ `gmind-base-url`

**Навигация:** кнопка «Агенты» в DashboardPage (`/` → Bot icon → `/agents`)

---

### Оставшееся (ручные задачи)

- [ ] Создать эталонный пайплайн в MASys GUI: `pipeline-input → agent-loop(tools=[gmind-mindmap]) → logger`
- [ ] Проверить `E:\MASys\start-masys.bat` на Windows (Node 22, pnpm, prisma migrate)
- [ ] Первый релиз: `git tag v1.0.0 && git push --tags` → GitHub Actions → `.msi`

Подробный план: [PLANS.md](../PLANS.md) → "ROADMAP: Production Windows Desktop + MASys Integration"
