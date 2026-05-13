# Skill: Modular Architecture — Gmind Core

## Принципы

1. **Interface-driven** — каждый модуль зависит только от интерфейсов, не от конкретных реализаций
2. **Registry pattern** — все модули регистрируются в центральном реестре, ядро не знает о конкретных модулях
3. **Event bus (pub-sub)** — модули общаются через события, не через прямые вызовы
4. **Lifecycle management** — `Init → Start → Stop` с гарантированным порядком (по графу зависимостей)
5. **Graceful degradation** — удаление модуля не ломает систему, only warnings в лог

## Core Module Interface (Go)

```go
// core/module.go
type Module interface {
    ID() string
    Name() string
    Version() string
    Dependencies() []string
    Init(ctx context.Context, deps *Dependencies) error
    Start(ctx context.Context) error
    Stop(ctx context.Context) error
    Health() HealthStatus
}

type Dependencies struct {
    EventBus EventBus
    Store    Store
    Logger   Logger
    Config   ConfigProvider
}
```

## Event Bus

```go
type EventBus interface {
    Publish(event Event)
    Subscribe(eventType string, handler EventHandler) func()
}

type Event struct {
    Type      string         // "module.*", "topic.*", "agent.*"
    Source    string         // module ID
    Timestamp time.Time
    Payload   map[string]any
}
```

## Registry

```go
type Registry struct {
    modules map[string]Module
    deps    *Dependencies
}

func (r *Registry) Register(m Module) error
func (r *Registry) Unregister(id string)
func (r *Registry) StartAll(ctx context.Context) error  // topo-sorted by deps
func (r *Registry) StopAll(ctx context.Context) error    // reverse order
func (r *Registry) Get(id string) Module
```

## Как добавить модуль

1. Создать `internal/<module>/` с реализацией `Module` interface
2. В `Init()` подписаться на нужные события через `deps.EventBus.Subscribe()`
3. Зарегистрировать в `api/router.go` свои HTTP endpoints (через `RegisterModuleRoutes`)
4. В `main.go`: `registry.Register(myModule)`

## Как удалить модуль

1. `registry.Unregister(id)` — вызывает `Stop()`, отписывается от всех событий
2. Все зависимые модули получают `Event{Type: "module:removed", Source: id}`
3. HTTP роуты модуля удаляются автоматически

## Event Types Convention

| Тип | Producer | Consumer | Payload |
|---|---|---|---|
| `module:registered` | Registry | Logger, API | `{id, name}` |
| `module:removed` | Registry | Logger, API | `{id}` |
| `topic:created` | API | Agent, WS | `{topic_id, parent_id, workbook_id}` |
| `topic:updated` | API | Agent, WS | `{topic_id, updates, workbook_id}` |
| `topic:moved` | API | Agent, WS | `{topic_id, new_parent_id, workbook_id}` |
| `agent:task` | AgentPanel | Agent | `{agent_id, action, params}` |
| `agent:status` | Agent | AgentPanel | `{agent_id, status, message}` |
| `agent:complete` | Agent | AgentPanel | `{agent_id, result}` |

## Frontend: UI Module Architecture

### Структура директорий компонента

```
components/MyFeature/
├── MyFeature.tsx        # Основной компонент (export function)
├── MyFeature.Sub.tsx    # Дочерний (если >1 файла)
└── index.ts             # re-export (опционально)
```

### Примитивы (`components/UI/`)

```
UI/
├── Box.tsx              # Stack, Text, Button, Input, Divider, Badge, Section, Card, SectionHeader, MenuItem, ToolbarButton, Toggle
└── Forms.tsx            # Select, NumberInput, Slider, ColorPicker, Field, Grid
```

### Токены (`styles/tokens.ts`)

```
colors      — bg, text, accent, fill, separator, semantic (green/red/orange), ...
fonts       — ui (SF Pro), mono
fontSizes   — caption(11) → display(28)
fontWeights — regular(400) → bold(700)
spacing     — xxs(2) → block(48)
radii       — sm(6) → full(9999)
shadows     — hairline → modal
transitions — fast(0.12s) → spring
sizes       — sidebar, propertiesPanel, header, ...
```

### Правила модульности на фронтенде

1. **Компонент ничего не знает о родителе** — получает всё через props
2. **Стор (Zustand) — только через хуки**, никогда через `getState()` внутри render
3. **API вызовы — только через `api/client.ts`**, никаких прямых fetch
4. **WS сообщения — только через `wsClient`**, никаких прямых WebSocket
5. **Состояние панелей** (showX) — всегда в ближайшем общем предке (MindMap.tsx)
6. **Переиспользуемые стили** — выносятся в tokens.ts, а не копируются между компонентами

### Паттерн: Auto-save с debounce

```typescript
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const autoSave = useCallback((updates: Partial<Topic>) => {
  if (!selectedTopicId) return
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(async () => {
    await api.updateTopic(workbookId, selectedTopicId, updates)
    updateTopicInTree(selectedTopicId, updates)
    wsClient.send({ type: 'update', payload: { topic_id: selectedTopicId } })
  }, 300)
}, [selectedTopicId, workbookId, ...])
```

### Паттерн: Floating panel

```typescript
// В MindMap.tsx:
const [showPanel, setShowPanel] = useState(false)

// Тулбар:
<ToolbarButton onClick={() => setShowPanel(s => !s)}>🎨</ToolbarButton>

// Рендер:
{showPanel && <PanelComponent onClose={() => setShowPanel(false)} />}

// Canvas click закрывает:
if (contextMenu) setContextMenu(null)
setShowPanel(false)
```

### Порядок импортов

```typescript
// 1. React
import { useState, useEffect, useCallback, useRef } from 'react'
// 2. Store
import { useMindMapStore } from '../../store/mindmap'
// 3. API
import { api } from '../../api/client'
// 4. Types
import type { Topic } from '../../types'
// 5. Styles + UI
import { colors, fonts, spacing, radii } from '../../styles/tokens'
import { Stack, Text, Button } from '../UI/Box'
import { Select, Slider } from '../UI/Forms'
```

## Backend: Go Module Architecture

### Структура директорий

```
backend/internal/
├── core/           # Module interface, Registry, EventBus
├── agent/          # Agent Module (implements core.Module)
├── api/            # HTTP handlers (chi)
│   └── module.go   # Module routes registration
├── ws/             # WebSocket hub
├── ai/             # AI clients
├── store/          # SQLite store
├── config/         # Config
├── model/          # Data types
└── xmind/          # XMind import/export
```

## Использование в main.go

```go
func main() {
    deps := core.NewDependencies(db, cfg)
    registry := core.NewRegistry(deps)

    registry.Register(agent.NewModule(deps))

    ctx := context.Background()
    registry.StartAll(ctx)
    defer registry.StopAll(ctx)

    // HTTP server
    r := chi.NewRouter()
    api.RegisterModuleRoutes(r, registry)
    // ... existing routes
}
```
