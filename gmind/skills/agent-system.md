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

## Frontend Store

Агентское состояние на фронтенде управляется через `store/agent.ts`:

```ts
import { useAgentStore } from '../../store/agent'

// State
const agents = useAgentStore(s => s.agents)      // AgentInfo[]
const tasks = useAgentStore(s => s.tasks)         // AgentTask[]
const loading = useAgentStore(s => s.loading)

// Actions
const { fetchAgents, createAgent, deleteAgent, submitTask, approveTask, rejectTask } = useAgentStore()

// WebSocket live updates — подписка в useEffect
useEffect(() => {
  fetchAgents()
  const unsub = subscribeToEvents()  // agent:task_started / completed / failed
  return unsub
}, [])
```

Store заменяет ручной `fetch` + `setInterval` polling. Пер-агент провайдер/модель передаются через `AgentCreateRequest: { role, provider?, model? }`.
