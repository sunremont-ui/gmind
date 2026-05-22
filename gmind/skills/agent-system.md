# Skill: Agent System — Gmind Multi-Agent

## Архитектура

```
┌──────────────────────────────────────────────┐
│              Core (module.go)                 │
│  Registry │ EventBus │ Lifecycle             │
└────────────────┬─────────────────────────────┘
                 │ implements core.Module
┌────────────────▼─────────────────────────────┐
│           Agent Module (agent/)               │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Registry │  │ Manager  │  │ Task Queue │  │
│  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │              │              │         │
│  ┌────▼──────────────▼──────────────▼──────┐  │
│  │            Worker Pool                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐  │  │
│  │  │Researcher│ │Organizer │ │Critic  │  │  │
│  │  │ (GPT-4o) │ │ (llama)  │ │(GPT-4o)│  │  │
│  │  └──────────┘ └──────────┘ └────────┘  │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

## Agent Interface

```go
type Agent interface {
    ID() string
    Role() string
    Status() AgentStatus           // idle, working, error
    Provider() string              // "openai", "local"
    Model() string                 // "gpt-4o", "llama-3.1"
    Execute(ctx context.Context, task Task) error
    Cancel() error
}
```

## Role Definitions

```go
type Role struct {
    Name         string
    Description  string
    SystemPrompt string
    Capabilities []Capability       // create_topic, update_topic, search_web, etc.
    Tools        []ToolDef          // function definitions for LLM tool calling
    Provider     string             // default provider
    Model        string             // default model
}
```

## LLM Tool Calling Protocol

Agent общается с LLM через function calling. LLM возвращает structured actions:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "create_topic",
        "parameters": {
          "parent_id": "abc123",
          "title": "New Topic Title",
          "children": ["Sub 1", "Sub 2"]
        }
      }
    }
  ]
}
```

## WebSocket Protocol Extension

```json
// Register agent
{"type": "agent:register", "payload": {"role": "researcher", "provider": "openai"}}

// Assign task
{"type": "agent:task", "payload": {"agent_id": "res-1", "action": "research", "params": {...}}}

// Agent progress
{"type": "agent:status", "payload": {"agent_id": "res-1", "status": "working", "message": "..."}}

// Agent complete
{"type": "agent:complete", "payload": {"agent_id": "res-1", "result": {...}}}
```

## Task Queue

- FIFO очередь для каждого агента
- `POST /api/v1/agents/{id}/tasks` — добавить задачу
- `GET /api/v1/agents/{id}/tasks` — статус задач
- `DELETE /api/v1/agents/{id}/tasks/{taskId}` — отменить задачу
- Worker забирает следующую задачу по готовности LLM

## Как добавить нового агента

1. Зарегистрировать `Role` в `agent/roles.go`
2. Если нужен новый tool — добавить в `Tools []ToolDef` и обработчик в `worker.go`
3. Создать агента через `POST /api/v1/agents` с указанием роли
4. Готово — агент сразу начинает принимать задачи

## Как удалить агента

1. `DELETE /api/v1/agents/{id}` → `Stop()` → отмена текущей задачи → удаление из registry
2. Все подписки на события отписываются автоматически

## V3.9 Features — New Agent Tools (2026-05-15)

### Новые инструменты

| Tool | Роли | Ключевые особенности |
|------|------|---------------------|
| `delete_topic` | все mindmap роли | `sheet.RemoveTopic(id)` — root нельзя удалить; publishes `topic:deleted` |
| `move_topic` | все mindmap роли | `FindTopic` + `RemoveTopic` + `AddChild(newParent)` |
| `list_topics` | все mindmap роли | `flattenTopicTree` — depth-first, возвращает id/title/depth/parent_id |
| `delegate_to_agent` | researcher, organizer, analyst | sync poll: SubmitTask → 500ms × 240 iterations → result или timeout |

### delegate_to_agent — реализация

```go
// executor.go
func (e *ToolExecutor) delegateToAgent(raw json.RawMessage, callerTask *Task) (any, error) {
    // 1. Self-delegation guard
    if args.AgentID == callerTask.AgentID {
        return nil, fmt.Errorf("cannot delegate to self")
    }
    // 2. Submit task
    taskID, err := e.manager.SubmitTask(args.AgentID, args.Action, args.Params,
        callerTask.WorkbookID, callerTask.SheetID, ...)
    // 3. Poll 500ms × 240 (2 min timeout)
    for i := 0; i < 240; i++ {
        time.Sleep(500 * time.Millisecond)
        task, _ := e.manager.GetTask(taskID)
        if task.Status == TaskDone { return task.Result, nil }
        if task.Status == TaskFailed { return nil, errors.New(task.Error) }
    }
    return nil, fmt.Errorf("delegate timeout after 2 minutes")
}
```

### getCallbacks(task *Task) — паттерн

Сигнатура изменена с `getCallbacks()` → `getCallbacks(task *Task)`.
Task передаётся чтобы `delegateToAgent` знал: caller's AgentID (guard) + WorkbookID (контекст делегата).

```go
// react.go
callbacks := executor.getCallbacks(task)  // task из RunTask

// worker.go (init)
exec := NewToolExecutor(s, eventBus, logger, wikiStore)
exec.SetManager(manager)  // нужно для delegate_to_agent polling
```

## V3.7 Features (реализовано)

### Submit Task UI
- Кнопка `Submit Task →` во всю ширину карточки агента в AgentPanel
- Открывает диалог с полем ввода задачи
- `POST /api/v1/agents/{id}/tasks` — создаёт задачу

### Agent Streaming
- WebSocket событие `agent:task_log` — стриминг мыслей/действий агента
- `store/agent.ts`: `agentLogs` — реактивное состояние
- `AgentCard`: зелёная строка с `Working...` / `Thinking...` / `Using <tool>...` в реальном времени
- `GET /api/v1/agents/tasks/{taskID}/stream` — SSE streaming endpoint
- `GET /api/v1/agents/tasks/{taskID}/logs` — логи задачи

### Agent Chaining
- `003_agent_chaining.up.sql` — миграция: колонки `chain_to_agent_id`, `chain_from_task_id`
- `store/agent_task.go` + `task.go` — chain поля персистентны
- `AgentTask` тип на фронтенде: `chainToAgentId`, `chainFromTaskId`
- `TaskList.tsx` — ⛓️ иконка + развёрнутая цепочка (expanded view с chain details)
- Поддержка sequential chaining: результат одного агента → вход для другого

## Frontend Store

Агентское состояние на фронтенде управляется через `store/agent.ts`:

```ts
import { useAgentStore } from '../../store/agent'

// State
const agents = useAgentStore(s => s.agents)      // AgentInfo[]
const tasks = useAgentStore(s => s.tasks)         // AgentTask[]
const agentLogs = useAgentStore(s => s.agentLogs) // taskId → log[]
const loading = useAgentStore(s => s.loading)

// Actions
const { fetchAgents, createAgent, deleteAgent, submitTask, approveTask, rejectTask } = useAgentStore()

// WebSocket live updates — подписка в useEffect
useEffect(() => {
  fetchAgents()
  const unsub = subscribeToEvents()  // agent:task_started / completed / failed / task_log
  return unsub
}, [])
```

Store заменяет ручной `fetch` + `setInterval` polling. Пер-агент провайдер/модель передаются через `AgentCreateRequest: { role, provider?, model? }`.

---

## V3.8 — Agent UI Enhancement Roadmap

### Ключевые паттерны реализации

#### Two-level model selector (Фаза 1.1)

```tsx
// AgentCreateDialog
const [selectedProvider, setSelectedProvider] = useState('')
const [selectedModel, setSelectedModel] = useState('')
const [manualModel, setManualModel] = useState(false)

const filteredModels = selectedProvider
  ? modelPresets.find(p => p.id === selectedProvider)?.models ?? []
  : modelPresets.flatMap(p => p.models)

// Render: providerSelect → filteredModelSelect | <input>
<select onChange={e => { setSelectedProvider(e.target.value); setSelectedModel('') }}>
  <option value="">— Any provider —</option>
  {modelPresets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
</select>

{manualModel
  ? <input value={selectedModel} onChange={e => setSelectedModel(e.target.value)} placeholder="e.g. llama3.2:8b" />
  : <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
      {filteredModels.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
    </select>
}
<button onClick={() => setManualModel(v => !v)}>✎ Manual</button>
```

#### Stop button + endpoint (Фаза 2.1)

```tsx
// AgentCard — кнопка Stop
{agent.status === 'working' && (
  <button onClick={() => stopAgent(agent.id)} style={{ color: colors.red }}>
    ■ Stop
  </button>
)}
```

```go
// backend/internal/api/module.go
r.Post("/agents/{id}/stop", h.StopAgent)

func (h *Handler) StopAgent(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")
    ag := h.agentModule.Registry().Get(id)
    if ag == nil { http.NotFound(w, r); return }
    ag.Status = agent.StatusIdle
    // TODO: cancel worker context
    w.WriteHeader(http.StatusNoContent)
}
```

#### Role-filtered actions (Фаза 3.1)

```ts
// types/agent.ts
export const ROLE_ACTIONS: Record<string, string[]> = {
  researcher: ['search_web', 'wiki_search', 'get_workbook', 'custom'],
  organizer:  ['create_multiple_topics', 'update_topic', 'summarize_topics', 'custom'],
  critic:     ['add_note', 'summarize_topics', 'get_workbook', 'custom'],
  expander:   ['create_multiple_topics', 'create_topic', 'get_workbook', 'custom'],
  summarizer: ['summarize_topics', 'add_note', 'get_workbook', 'custom'],
  editor:     ['update_topic', 'add_note', 'search_web', 'custom'],
  analyst:    ['get_workbook', 'search_web', 'wiki_search', 'custom'],
}
```

```tsx
// TaskSubmitDialog — фильтрация
const roleId = AGENT_ROLES.find(r => r.label === agentRole)?.id ?? ''
const primaryActions = TASK_ACTIONS.filter(a =>
  (ROLE_ACTIONS[roleId] ?? []).includes(a.value)
)
const otherActions = TASK_ACTIONS.filter(a =>
  !(ROLE_ACTIONS[roleId] ?? []).includes(a.value)
)
```

#### Natural language prompt (Фаза 3.2)

```tsx
// TaskSubmitDialog
const [simpleMode, setSimpleMode] = useState(true)
const [naturalPrompt, setNaturalPrompt] = useState('')

// В handleSubmit:
const parsedParams = simpleMode
  ? (naturalPrompt.trim() ? { query: naturalPrompt.trim() } : undefined)
  : parseJsonParams(params)
```

#### Action schema hints (Фаза 3.3)

```ts
// TaskSubmitDialog.tsx
const ACTION_SCHEMAS: Record<string, string> = {
  create_topic:           '{"parent_id": "abc123", "title": "New Topic"}',
  create_multiple_topics: '{"parent_id": "abc123", "titles": ["A", "B", "C"]}',
  update_topic:           '{"topic_id": "abc123", "title": "Updated", "notes": "..."}',
  add_note:               '{"topic_id": "abc123", "note": "Note text"}',
  summarize_topics:       '{"topic_id": "abc123"}',
  search_web:             '{"query": "search terms"}',
  wiki_search:            '{"query": "search terms"}',
  get_workbook:           '{}',
}
```

### Изменяемые файлы по фазам

| Фаза | Файлы |
|------|-------|
| 1.1 | `AgentPanel.tsx` (AgentCreateDialog) |
| 1.2 | `AgentPanel.tsx`, `types/agent.ts`, `backend/internal/agent/module.go`, `worker.go` |
| 2.1 | `AgentPanel.tsx` (AgentCard), `api/agent.ts`, `store/agent.ts`, `backend/internal/api/module.go` |
| 2.2 | `AgentPanel.tsx` (AgentCard) |
| 2.3 | `AgentPanel.tsx`, `types/agent.ts` |
| 3.1 | `TaskSubmitDialog.tsx`, `types/agent.ts` |
| 3.2 | `TaskSubmitDialog.tsx` |
| 3.3 | `TaskSubmitDialog.tsx` |
| 4.1 | `AgentPanel.tsx` (AgentCard) |
| 4.2 | `api/secrets.ts`, `AgentPanel.tsx` |
| 5.x | `AgentPanel.tsx`, `store/agent.ts` |

---

## V4.1 — Agent Persistence (DONE, 2026-05-17)

Агенты теперь не теряются при рестарте. SQLite-backed registry.

```go
// Ключевые файлы
// backend/internal/store/agents.go — AgentStore CRUD
// backend/internal/agent/module.go — PersistAgent/RemoveAgent/SyncAgent

// InitAgentStore — вызывается при старте сервера
func (m *Module) InitAgentStore(as *store.AgentStore) {
    m.agentStore = as
    agents, _ := as.List()
    for _, a := range agents {
        m.Registry.Register(a)
        m.WorkerPool.StartWorker(a)  // worker сразу стартует
    }
}
```

---

## V4.2 — RAG Search (DONE, 2026-05-17)

semantic_search tool для агентов — cosine similarity по embeddings топиков.

```go
// backend/internal/store/embeddings.go
type EmbeddingStore struct { db *sql.DB }
func (s *EmbeddingStore) Upsert(topicID string, embedding []float32) error
func (s *EmbeddingStore) Search(query []float32, limit int) ([]SearchResult, error)
// cosine similarity, pure Go, без CGO

// Tool definition (tools.go)
{Name: "semantic_search", Parameters: {...query, limit...}}

// API
// GET /api/v1/search?q=...&type=semantic
```

**Embedding:** OpenAI `text-embedding-3-small` (1536 dims). При добавлении/обновлении топика — фоновая индексация.

---

## V4.3 — Multi-Agent Orchestration (следующий)

```go
// Планируемый tool
{Name: "parallel_delegate", Parameters: {
    "tasks": [{"agent_id": "...", "action": "...", "params": {}}]
}}

// Task struct
type Task struct {
    // ...
    ParallelGroupID string  // группировка fan-out задач
}

// Роль Supervisor
GetToolsForRole("supervisor") = ["delegate_subtask", "parallel_delegate", "list_agents", ...]
```
