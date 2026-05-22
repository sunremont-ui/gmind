# Skill: Multi-Agent Production Patterns — Gmind

> Сравнение существующих реализаций и best practices для встраивания в модульную архитектуру Gmind.

## Сравнение популярных фреймворков (2025–2026)

| Фреймворк | Архитектура | Плюсы | Минусы | Когда использовать |
|---|---|---|---|---|
| **LangGraph** | Stateful граф (DAG) | Гибкие conditional edges, human-in-the-loop, встроенный ReAct | Тяжелый (LangChain dependency), оверхед для простых задач | Сложные multi-step воркфлоу с ветвлением |
| **CrewAI** | Ролевые агенты + handoff | Простая YAML-конфигурация, built-in роли | Нет durable execution, плохая observability | Прототипы, простые agent teams |
| **AutoGen (Microsoft)** | Multi-agent conversation | Гибкие паттерны общения, strong typing | Сложный дебаг, нет production tooling | Исследования, conversational multi-agent |
| **OpenAI Agents SDK** | Agent + handoffs + guardrails | Нативный function calling, streaming, простота | Только OpenAI model, нет durable execution | Production с OpenAI, простые агенты |
| **Conductor (Netflix OSS)** | Durable workflow engine | Checkpointing, retry, MCP, human-in-the-loop, 14+ LLM | Тяжелая инфраструктура (нужен сервер) | High-stakes production: платежи, оркестрация |
| **AgentField** | Production infra | Webhooks, Prometheus метрики, async execution | Платная, молодой проект | Enterprise, когда нужен "из коробки" |
| **AQM Framework** | YAML-пайплайны | Zero-code, SQLite-based, handoff gates | Только пайплайны (нет циклов), молодой | CI/CD-like agent pipelines |

## Лучшие практики (из research)

### 1. Архитектура: Hub-and-Spoke (Foreman Pattern)
Один оркестратор управляет специализированными агентами. Агенты не общаются напрямую — только через оркестратор.
```
User → Foreman → Specialist A → Foreman → Specialist B → Foreman → Result
```
- Проще дебажить
- Одна точка мониторинга
- Легко добавлять/удалять специалистов

### 2. Durable Execution (Checkpointing)
Каждый шаг агента персистится. При краше восстанавливаемся с последнего шага, а не с начала.
- **Conductor**: `DO_WHILE` с checkpoint на каждой итерации
- **AgentExec**: Redis-backed task queue + SQLAlchemy activity tracking
- **Нам**: достаточно SQLite очереди + event log

### 3. Tool Registry
Один источник правды для всех инструментов агента:
```go
type ToolDef struct {
    Name        string          // create_topic
    Description string          // "Creates a new topic as a child of parent_id"
    Schema      json.RawMessage // JSON Schema для валидации аргументов
    Category    string          // "mindmap", "search", "web"
    Cost        float64         // estimated cost per call
    Timeout     time.Duration
    Idempotent  bool
}
```

### 4. Native Function Calling (LLM tool_use)
Best practice: использовать нативный function calling провайдера (OpenAI tools / Anthropic tool_use).
- Автоматическая валидация схемы на стороне провайдера
- Parallel tool calls (несколько tool_use в одном ответе)
- Structured output гарантирует формат

### 5. Worker Pool Pattern
```go
type Worker struct {
    ID      string
    Agent   *AgentInfo
    LLM     *ai.Client
    Queue   chan Task
    Running bool
}

type Task struct {
    ID        string
    AgentID   string
    Action    string        // "research", "expand", "summarize"
    Params    map[string]any
    Context   *MindmapContext // текущее состояние mindmap
    CreatedAt time.Time
    Status    TaskStatus    // queued, running, done, failed
}
```

### 6. ReAct Loop с защитами
```
1. User request → create Task
2. FORMAT: system prompt (role) + context (mindmap) + tool defs
3. LLM → tool_use (structured action)
4. VALIDATE: schema, timeout, idempotency
5. EXECUTE: tool → result
6. FEED BACK: tool result → LLM
7. REPEAT until max_calls (10) or LLM produces final answer
8. RETURN result → Activity Log
```

### 7. Ошибки — structured, не throw
```go
type ToolResult struct {
    Success bool
    Data    any
    Error   string // human-readable for LLM
    IsFinal bool   // if true, stop the loop
}
```
- LLM получает structured error → может скорректировать поведение
- Exponental backoff + jitter для retry
- Circuit breaker per external dependency

### 8. Observability
- **Trace ID** на каждую задачу агента
- **Event log**: `agent:task_started`, `agent:tool_call`, `agent:task_complete`
- **Per-agent метрики**: количество вызовов, токены, latency, ошибки
- **Cost attribution**: сколько $ потратил каждый агент

### 9. Human-in-the-Loop Gates
Для операций, которые должны быть подтверждены:
- Создание/удаление большого количества топиков
- Изменение структуры workbook
- AI-генерация с expensive model

## Что берем для Gmind

| Компонент | Наш подход | Аналог в индустрии |
|---|---|---|
| **Task Queue** | SQLite-based (offline-first) | AgentExec (Redis), Conductor (durable queue) |
| **Registry** | Go interface + in-memory map | LangGraph registry, MCP tool registry |
| **Worker** | Горутина на агента + LLM call | OpenAI Agents SDK worker |
| **Lifecycle** | core.Module (Init/Start/Stop) | Conductor module system |
| **Tool defs** | JSON Schema + Go structs | OpenAI function calling schema |
| **Event Bus** | In-memory pub/sub | LangGraph event system |
| **Error handling** | Structured ToolResult | Anthropic tool_result pattern |
| **Observability** | Event log + polling | AgentExec activity tracking |
| **Persistence** | IndexedDB (offline) + SQLite | Conductor durable storage |

## Порядок имплементации (production-ready)

```
1. ✅ Module System (ядро)
2. ✅ Agent Registry + CRUD
3. ✅ Tool Definitions (JSON Schema) — tools.go
4. ✅ Worker Pool (горутины + LLM) — worker.go
5. ✅ Task Queue (SQLite-based) — store/agent_task.go
6. ✅ ReAct Loop (tool_use cycle) — react.go
7. ✅ Role Prompts (Researcher, Expander, etc.) — prompts.json
8. ✅ Activity Log — agent:task_log WebSocket events
9. ⬜ Human-in-the-Loop gates
10. ⬜ Observability (метрики, trace)
11. ⬜ Parallel fan-out (delegate to multiple agents)
12. ⬜ MASys delegation tool (run_masys_pipeline)
```

---

## MASys — Внешний Multi-Agent Orchestrator

**MASys** (`E:\MASys`) — визуальная pipeline платформа, естественный оркестратор для Gmind-агентов.

### Как MASys реализует паттерны

| Паттерн | Реализация в MASys |
|---------|-------------------|
| **Sequential pipeline** | Линейный граф: A → B → C |
| **Parallel fan-out** | Один исток → несколько узлов (DAG с параллельными ветвями) |
| **Conditional routing** | `if-condition` / `switch-case` модули |
| **ReAct loop** | `agent-loop` модуль — встроенный ReAct с toolsJson |
| **Sub-pipeline call** | `pipeline-call` модуль — вложенные пайплайны |
| **Human-in-the-loop** | `human-review` модуль — пауза и ожидание подтверждения |
| **Durable execution** | Prisma RunEvent — каждый шаг персистится в SQLite |
| **Observability** | WebSocket live feed, LiveFeed панель, метрики per-node |

### Интеграция Gmind ↔ MASys

```
Gmind агент                    MASys
──────────────────────────     ─────────────────────────────
ToolExecutor                   DAG Executor
  └── run_masys_pipeline ─────→ POST /trpc/runs.start
        ↑                           ↓ WebSocket events
  TaskStore (result)  ←───── runs.get (completed)
```

Gmind использует MASys для задач, которые требуют:
- Сложной многошаговой логики (ветвления, циклы)
- Визуального редактирования workflow
- Множества специализированных инструментов (PDF, browser, STT, vision)
- Наблюдаемости на уровне шагов пайплайна

Подробно: [skills/masys-integration.md](masys-integration.md)
