# Skill: Tests — Gmind

## Быстрый старт

```bash
cd frontend && npx vitest run          # однократный прогон
cd frontend && npx vitest              # watch mode
cd backend && go test ./internal/...   # Go тесты
```

## Frontend (Vitest + Testing Library)

**Конфиг:** `frontend/vitest.config.ts` — jsdom, globals, setup `test-setup.ts`
**Setup:** `frontend/src/test-setup.ts` — импортирует `@testing-library/jest-dom`

### Существующие тесты (62 tests, 8 files)

| Файл | Tests | Статус |
|---|---|---|
| `layout.test.ts` | 11 | ✅ buildLayout, computeTreeLayout, directions, fishbone, collapse |
| `store/mindmap.test.ts` | 15 | ✅ addTopic, removeTopic, updateTopicInTree, getTopic |
| `api/ws.test.ts` | 7 | ✅ connect, disconnect, reconnect, sendOperation |
| `ToolPanel.test.tsx` | 14 | ✅ (1 фикс: active tool color вместо background) |
| `AgentPanel.test.tsx` | 5 | ✅ |
| `TaskList.test.tsx` | 8 | ✅ |
| `SaveStatusBar.test.tsx` | 3 | ✅ |
| `OfflineBanner.test.tsx` | 2 | ✅ |

### Важные детали типов в тестах

```typescript
// Topic: floating_topics — нет, только на Sheet!
const makeTopic = (id: string, children: Topic[] = []): Topic => ({
  id, title: id, folded: false, children, labels: [], markers: [],
})

// Workbook: все поля обязательны
const makeWorkbook = (): Workbook => ({
  id: 'wb1', title: 'Test',
  private: false, owner_id: '', created_at: '', updated_at: '',
  sheets: [{ id: 's1', title: 'S1', root_topic: makeTopic('root') }],
})

// children — possibly undefined, используй !
const children = store.workbook!.sheets[0].root_topic.children!
```

**tsconfig:** `"target": "ES2022", "lib": ["ES2022", "DOM", "DOM.Iterable"]` — нужно для `Array.prototype.at()`.

### Что добавить

- `store/layout.test.ts` — тесты LayoutGaps store
- `components/MindMap/TopicNode.test.tsx` — рендер, выбор, редактирование, collapse animation
- `components/ShareDialog/ShareDialog.test.tsx` — invite, private toggle, collaborator list
- `utils/export.test.ts` — export функции
- `api/client.test.ts` — collaborator API методы

### Написание тестов

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

it('renders with expected text', () => {
  render(<MyComponent />)
  expect(screen.getByText('Hello')).toBeInTheDocument()
})
```

## Layout engine тесты (`layout.test.ts`)

Компонент чистой функции — не требует DOM. Тестировать напрямую:

```typescript
import { describe, it, expect } from 'vitest'
import { buildLayout, computeTreeLayout, subtreeHeight, subtreeWidth } from './layout'
import type { Topic } from '../types'

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return { id: '1', title: 'test', folded: false, ...overrides }
}
```

### Кейсы для layout

1. **buildLayout** — лист, один ребёнок, вложенные дети (folded больше не фильтруется)
2. **computeTreeLayout** — mindmap, tree-right, tree-left, tree-down, tree-up, radial, fishbone
3. **collapse animation** — children folded parent коллапсируются к parent position
4. **subtreeHeight/subtreeWidth** — лист, один уровень, вложенные
5. **shiftSubtree** — сдвиг потомков при перепозиционировании родителя
6. **Direction** — right/left/down/up дают разные X/Y
7. **postProcessFolded** — рекурсивный коллапс folded subtrees

## Backend тесты (Go)

```bash
cd backend && go test ./... -v -count=1
```

### Store tests
- `backend/internal/store/*_test.go` — in-memory SQLite, CRUD операций

### API handler tests
- `backend/internal/api/*_test.go` — httptest.Server, тестирование эндпоинтов

## Debug

```bash
npx vitest run --reporter=verbose     # подробный вывод
npx vitest run --reporter=json        # JSON для CI
```
