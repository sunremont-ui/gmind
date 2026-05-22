# V4.0 — Модульная платформа

## Обзор

V4.0 трансформирует Gmind из монолитного SPA в визуальную платформу с подключаемыми модулями. Canvas (MindMap) всегда виден, модули открываются как slide-in панели справа.

**Layout:**
```
[NavRail 48px][Sidebar 260px][Canvas flex:1][Module Panel 360px slide-in]
```

## Nav Rail

48px Activity Bar (VS Code-стиль). Файл: `frontend/src/components/NavRail/NavRail.tsx`.

- Иконки без текста, `title=""` tooltip
- Активная иконка: `colors.accentLight` фон
- Повторный клик на активную иконку — закрывает панель
- MindMap (order:0) — не открывает панель, закрывает текущую
- Settings icon внизу (через flex spacer)

## AppModule Interface

```typescript
// frontend/src/modules/types.ts
export interface AppModule {
  id: string
  name: string
  icon: (props: { size?: number; color?: string; strokeWidth?: number }) => ReactNode
  order: number       // позиция в Nav Rail
  tooltip: string
  panel: ComponentType<ModulePanelProps>
  commands?: (ctx: ModuleContext) => ModuleCommand[]
  agentTools?: ModuleAgentTool[]
}

export interface ModulePanelProps {
  workbookId: string | null
  onClose: () => void
}
```

## MODULE_REGISTRY

```typescript
// frontend/src/modules/registry.ts
export const MODULE_REGISTRY: AppModule[] = [
  MindMapModule,      // order:0 — canvas, не открывает панель
  NotesModule,        // order:1 — NotesPanel
  AgentSandboxModule, // order:2 — AgentPanel
  MaSysModule,        // order:3 — MaSysPanel
  AIModule,           // order:4 — AIPanel
].sort((a, b) => a.order - b.order)

export function getModule(id: string): AppModule | undefined {
  return MODULE_REGISTRY.find(m => m.id === id)
}
```

## useShellStore

```typescript
// frontend/src/store/shell.ts
interface ShellState {
  activeModuleId: string | null
  setActiveModule: (id: string | null) => void
  toggleModule: (id: string) => void   // открыть или закрыть если уже открыт
  closeModule: () => void
}
```

## Notes Module

### SQLite schema (`backend/migrations/006_notes.up.sql`)

```sql
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',  -- JSON array
  source      TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'agent'
  workbook_id TEXT NOT NULL DEFAULT '',
  topic_id    TEXT NOT NULL DEFAULT '',
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### REST API

| Метод | Path | Описание |
|-------|------|----------|
| GET | /api/v1/notes | Список заметок (поддерживает `?q=` для поиска) |
| POST | /api/v1/notes | Создать заметку |
| PUT | /api/v1/notes/{noteID} | Обновить заметку |
| DELETE | /api/v1/notes/{noteID} | Удалить заметку (204 No Content) |

### Frontend

- `frontend/src/api/notes.ts` — `notesApi` (list/create/update/delete)
- `frontend/src/store/notes.ts` — `useNotesStore` (notes[], loading, fetchNotes, createNote, updateNote, deleteNote)
- `frontend/src/components/NotesPanel/NotesPanel.tsx` — textarea + search + note cards

### Agent Tools

- `save_note` — сохраняет заметку с контентом, тегами, workbook ассоциацией
- `search_notes` — поиск по контенту и тегам

Роли с доступом к notes: researcher, organizer, summarizer, analyst, writer.

## Extensible Tool Registry

### Регистрация tools (backend)

```go
// Любой модуль может добавить tool в runtime:
agent.RegisterTool(agent.ToolDef{
  Name:        "my_tool",
  Description: "...",
  Schema:      json.RawMessage(`{...}`),
  Category:    "my_category",
})
```

### Регистрация callback (executor)

```go
// ToolExecutor поддерживает плагинные обработчики:
executor.RegisterCallback("my_tool", func(ctx context.Context, args json.RawMessage) (agent.ToolResult, error) {
  // обработка
})
```

`RegisterTool` и `RegisterCallback` thread-safe (`sync.RWMutex`).

## MaSysPanel

MASys пайплайны выделены из AgentPanel в отдельный компонент:
- `frontend/src/components/MaSysPanel/MaSysPanel.tsx` — agent selector + pipeline cards с Run button
- Принимает `ModulePanelProps` (стандартный интерфейс)
- Использует `useAgentStore` для данных

AgentPanel (после v4.0) содержит только agents + tasks вкладки.

## Добавить новый модуль

### Frontend

1. Создать `frontend/src/modules/{id}/module.ts`:
```typescript
import type { AppModule } from '../types'
import { lazy } from 'react'

export const MyModule: AppModule = {
  id: 'my-module',
  name: 'My Module',
  icon: MyIcon,
  order: 5,
  tooltip: 'My Module (Ctrl+Shift+M)',
  panel: lazy(() => import('../../components/MyPanel/MyPanel')),
  commands: (ctx) => [
    { id: 'open-my-module', label: 'Open My Module', action: () => { /* ... */ } }
  ],
}
```

2. Добавить в `registry.ts`:
```typescript
import { MyModule } from './my-module/module'
export const MODULE_REGISTRY = [..., MyModule].sort(...)
```

### Backend (опционально)

```go
// В init() или при старте модуля:
agent.RegisterTool(agent.ToolDef{...})
executor.RegisterCallback("tool_name", handlerFn)
// Добавить роут в router.go
```
