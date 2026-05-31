# Skill: Graph Relationships v2 — Gmind V5.0

> Архитектура расширенных связей между топиками: типизированные, направленные, multi-edge, cross-sheet/workbook. Фундамент для памяти агентов и GraphRAG.

## Контекст

**V4.x** имел простые связи `{id, title, end1_id, end2_id}` внутри `Sheet.Relationships[]` JSON. Это ограничивало:
- Только parent-child / sibling-sibling в одном sheet
- Нет семантики (depends_on, supports, contradicts, ...)
- Нет агентских tools для манипуляции графом
- O(n) перезапись workbook при изменении связи

**V5.0** превращает связи в полноценный knowledge graph — фундамент агентской памяти и будущего GraphRAG (V5.1).

## Решения по дизайну (2026-05-22)

| Аспект | Решение | Обоснование |
|--------|---------|-------------|
| **Multi-edge** | ✅ Разрешено | A→B `depends_on` + A→B `references` — разные семантики, не мешают |
| **Направления** | 3 типа: forward / bidirectional / undirected | Максимальная выразительность |
| **Self-loop** | ✅ Разрешено | Для итеративных концепций / самомодификации |
| **Циклы** | ✅ Разрешено, опциональная детекция | `?strict=true` отклоняет создание циклов в depends_on |
| **Cross-sheet** | ✅ Поддержано через nullable `from/to_sheet_id` | Большие workbook |
| **Cross-workbook** | ✅ Поддержано через nullable `from/to_workbook_id` | Память агентов между картами |
| **UI создание** | drag-from-edge (4 anchors при hover) | Как Miro/draw.io, интуитивно |
| **Хранение** | Отдельная таблица `relationships` | O(1) индексированные запросы |

## Схема данных

```sql
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,          -- родительский workbook (для cleanup)
  -- Endpoints (nullable для cross-scope):
  from_workbook_id TEXT,              -- NULL = тот же workbook
  from_sheet_id TEXT,                  -- NULL = primary sheet
  from_topic_id TEXT NOT NULL,
  to_workbook_id TEXT,
  to_sheet_id TEXT,
  to_topic_id TEXT NOT NULL,
  -- Семантика:
  type TEXT DEFAULT 'relates_to',     -- relates_to|depends_on|supports|contradicts|references|blocks|custom
  direction TEXT DEFAULT 'forward',   -- forward|bidirectional|undirected
  title TEXT,
  weight REAL DEFAULT 1.0,             -- 0.0–1.0, для визуализации thickness
  notes TEXT,                          -- обоснование связи
  -- Вид:
  color TEXT,                          -- override (по умолчанию из type mapping)
  style TEXT DEFAULT 'solid',         -- solid|dashed|dotted
  -- Мета:
  created_by TEXT DEFAULT 'user',     -- user | agent_<id>
  created_at TEXT,
  updated_at TEXT,
  metadata TEXT DEFAULT '{}'           -- JSON для расширений
);

CREATE INDEX idx_rels_workbook ON relationships(workbook_id);
CREATE INDEX idx_rels_from_topic ON relationships(from_topic_id);
CREATE INDEX idx_rels_to_topic ON relationships(to_topic_id);
CREATE INDEX idx_rels_type ON relationships(type);
```

## Типы связей (default registry)

| Type | Default Color | Default Style | Смысл |
|------|--------------|---------------|-------|
| `relates_to` | `#94a3b8` (slate) | solid thin | Дефолтная связь |
| `depends_on` | `#ef4444` (red) | solid bold | A не работает без B |
| `supports` | `#22c55e` (green) | solid | A подтверждает B |
| `contradicts` | `#f59e0b` (amber) | dashed | A противоречит B |
| `references` | `#3b82f6` (blue) | dotted | A ссылается на B |
| `blocks` | `#ec4899` (pink) | solid bold | A блокирует B |
| `custom` | user-defined | user-defined | Пользовательский |

## Roadmap фаз

```
Phase 1 ── Backend Foundation ───────────────────  (~1 день)
   ├── Migration 010_relationships.up/down.sql
   ├── store/relationships.go: RelationshipStore CRUD
   ├── Traverse(start_id, depth, types) → BFS
   ├── DetectCycles(workbook_id) → DFS finding cycles
   ├── Data migration: sheet.relationships JSON → table
   └── model/types.go: Relationship struct extension

Phase 2 ── REST API ─────────────────────────────  (~1 день)
   ├── POST /workbooks/{id}/relationships
   ├── GET /workbooks/{id}/relationships?topic_id=X&type=Y
   ├── PUT /relationships/{relID}
   ├── DELETE /relationships/{relID}
   ├── GET /workbooks/{id}/topics/{tid}/related?depth=N&types=...
   └── GET /workbooks/{id}/cycles
   └── Backward compat: GET /workbook continues embedding rels in Sheet

Phase 3 ── Agent Tools ──────────────────────────  (~0.5 дня)
   ├── create_relationship(from, to, type, direction?, title?, notes?, weight?)
   ├── list_relationships(topic_id, direction?, type?)
   ├── get_related_topics(topic_id, depth, types?)  ─ BFS обход
   ├── detect_cycles(start_topic_id?)
   ├── update_relationship(rel_id, ...patch)
   ├── delete_relationship(rel_id)
   └── Category: "graph", доступ для всех ролей (HITAL на delete)

Phase 4 ── Frontend UI ──────────────────────────  (~2 дня)
   ├── TopicNode: hover показывает 4 edge anchors (top/right/bottom/left)
   ├── Drag handler: mousedown anchor → fantom line → mouseup target → popover
   ├── Popover: type select + direction toggle + title + Save
   ├── RelationshipLine rewrite: direction arrows, type styles, weight thickness
   ├── Multi-edge offset: parallel lines с 8px смещением
   ├── Self-loop: SVG arc petal справа от ноды
   ├── Cross-sheet badge: вместо линии — мини-индикатор "→ Sheet X" на ноде
   └── RelationshipPanel: sidebar редактор (type/direction/notes/weight/style)

Phase 5 ── Visual Polish + Graph Navigation ──── (~1 день)
   ├── Filter toolbar: чекбоксы по type, direction
   ├── Hover-highlight subgraph: dim non-related до 0.2 opacity
   ├── Cycle warning indicator на нодах в цикле (⚠ + tooltip)
   ├── PropertiesPanel: "Relations" tab — incoming/outgoing списки
   └── Subgraph view: "Show only X and its related (depth=2)"
```

## Алгоритмы

### Traverse (BFS) — для агентов и UI subgraph

```go
func (s *RelationshipStore) Traverse(startTopicID string, depth int, types []string) ([]TopicID, []Relationship) {
    visited := map[string]bool{startTopicID: true}
    current := []string{startTopicID}
    allRels := []Relationship{}
    for d := 0; d < depth; d++ {
        next := []string{}
        for _, tid := range current {
            rels, _ := s.ListByTopic(tid)
            for _, rel := range rels {
                if len(types) > 0 && !contains(types, rel.Type) { continue }
                allRels = append(allRels, rel)
                // bidirectional/undirected → обходим в обе стороны
                neighbor := rel.ToTopicID
                if rel.FromTopicID != tid { neighbor = rel.FromTopicID }
                if !visited[neighbor] {
                    visited[neighbor] = true
                    next = append(next, neighbor)
                }
            }
        }
        current = next
        if len(current) == 0 { break }
    }
    return keys(visited), allRels
}
```

### DetectCycles (DFS) — для validation и warning

```go
func (s *RelationshipStore) DetectCycles(workbookID string, typeFilter string) [][]string {
    // Only directional types (forward) form cycles meaningfully
    allRels, _ := s.ListByWorkbook(workbookID)
    adj := buildAdjacency(allRels, typeFilter) // map[from] → [to,...]
    cycles := [][]string{}
    color := map[string]int{} // 0=white, 1=gray, 2=black
    var dfs func(node string, path []string)
    dfs = func(node string, path []string) {
        color[node] = 1
        path = append(path, node)
        for _, next := range adj[node] {
            if color[next] == 1 {
                // found cycle: extract from path
                for i, p := range path {
                    if p == next {
                        cycles = append(cycles, append([]string{}, path[i:]...))
                        break
                    }
                }
            } else if color[next] == 0 {
                dfs(next, path)
            }
        }
        color[node] = 2
    }
    for node := range adj {
        if color[node] == 0 { dfs(node, []string{}) }
    }
    return cycles
}
```

## Backward Compat

- API `GET /workbooks/{id}` продолжает возвращать `sheet.relationships[]` — handler читает из новой таблицы и embed'ит в response.
- Старый `POST /workbooks/{id}/relationships` (legacy с end1_id/end2_id) → автоматически конвертируем в `from_topic_id/to_topic_id` с `type='relates_to', direction='forward'`.
- Старый `DELETE /workbooks/{id}/relationships/{relID}` — работает как раньше.
- Старое поле `sheet.relationships` в JSON sheet — оставляем пустым после миграции, не пишем туда (single source of truth = таблица).

## Agent Tool Examples

### Researcher агент находит связанные топики

```
{
  "tool": "get_related_topics",
  "args": {"topic_id": "tp_123", "depth": 2, "types": ["references", "supports"]}
}
→ {"topics": [...], "relationships": [...]}
```

### Analyst агент находит противоречия

```
{
  "tool": "list_relationships",
  "args": {"topic_id": "tp_123", "type": "contradicts"}
}
```

### Organizer агент строит граф зависимостей

```
{
  "tool": "detect_cycles",
  "args": {"start_topic_id": "tp_root"}
}
→ {"cycles": [["tp_a", "tp_b", "tp_c"]]}
```

### Supervisor агент координирует через знание графа

```
1. list_agents → выбирает 3 researcher
2. parallel_delegate({tasks: [
     {agent_id: r1, action: "find docs related to AI safety", ...},
     {agent_id: r2, action: "find contradicting positions", ...},
     {agent_id: r3, action: "find supporting evidence", ...}
   ]})
3. После завершения → create_relationship для каждой найденной связи
4. detect_cycles → отчёт о противоречиях
```

## Файлы (V5.0 Phase 1-3)

| Файл | Назначение |
|------|-----------|
| `backend/migrations/010_relationships.up.sql` | Таблица + индексы + миграция данных |
| `backend/migrations/010_relationships.down.sql` | Rollback |
| `backend/internal/store/relationships.go` | RelationshipStore CRUD + Traverse + DetectCycles |
| `backend/internal/model/types.go` | Relationship struct extension (новые поля) |
| `backend/internal/api/relationships.go` | HTTP handlers (POST/GET/PUT/DELETE/related/cycles) |
| `backend/internal/api/router.go` | Routes registration |
| `backend/internal/api/topic.go` | Backward compat для CreateRelationship/DeleteRelationship |
| `backend/internal/api/workbook.go` | Embed rels в GET workbook response |
| `backend/internal/agent/tools.go` | 6 новых ToolDef в category "graph" |
| `backend/internal/agent/executor.go` | 6 новых callbacks |

## Связи с другими модулями

- **RAG (V4.2)**: `Traverse` будет использован в `semantic_search` для подмешивания graph-context (V5.1 GraphRAG)
- **Multi-agent (V4.3)**: `parallel_delegate` агентов часто оставляет relationships как побочный продукт
- **Knowledge Graph (V5.x)**: Эта схема — ядро будущего полноценного KG
- **MCP Server**: graph tools будут доступны через MCP для внешних клиентов

## Frontend архитектура (Phase 4)

```
MindMap.tsx
  ├── TopicNode (extended)
  │   ├── onMouseEnter → showEdgeAnchors
  │   └── 4 anchors: top/right/bottom/left
  │       └── onMouseDown → startDrag(fromTopicId, anchorSide)
  ├── DragState (Zustand store extension)
  │   ├── isDragging, fromTopicId, currentMouseX/Y
  │   └── targetTopicId (snap при hover)
  ├── FantomLine — SVG line from anchor to current cursor
  ├── ConnectionPopover (при mouseup)
  │   ├── type select, direction toggle, title input
  │   └── Save → POST /relationships
  └── RelationshipLine (rewrite)
      ├── Direction arrows (1 forward, 2 bidirectional, 0 undirected)
      ├── Type → color/style mapping
      ├── Multi-edge offset (parallel paths)
      ├── Self-loop arc rendering
      └── Cross-sheet badge fallback

RelationshipPanel (новый компонент)
  ├── Selected relationship details
  ├── Type select (relates_to/depends_on/supports/contradicts/references/blocks/custom)
  ├── Direction radio (forward/bidirectional/undirected)
  ├── Weight slider 0–1
  ├── Title input
  ├── Notes textarea
  ├── Style select (solid/dashed/dotted) + color picker
  └── Delete button (с confirm)
```

## Тестирование

- Unit: `store/relationships_test.go` — CRUD, Traverse depths, DetectCycles edge cases (self-loop, multi-edge, bidirectional)
- Unit: `api/relationships_test.go` — endpoint contracts, validation, backward compat
- Unit: `agent/tools_test.go` (extend) — 6 новых tool callbacks
- Manual: drag-from-edge UX, popover, multi-edge visualization

## Migration Strategy (production)

Существующие workbook'и могут иметь `sheet.relationships[]` JSON. Миграция 010:

1. `CREATE TABLE relationships` + индексы
2. SQLite миграция-helper (Go runtime): для каждого workbook читаем `sheet.relationships` JSON → `INSERT INTO relationships` с дефолтами `type='relates_to', direction='forward', created_by='legacy'`
3. После успешной миграции — оставляем `sheet.relationships` в JSON как есть, но при API write всё пишется в таблицу

Down-миграция: переносит данные обратно в `sheet.relationships` (только id/title/end1_id/end2_id — теряется тип/direction/notes).

## Roadmap статус

- **Phase 1** (Backend Foundation) ✅ DONE 2026-05-22
- **Phase 2** (API) ✅ DONE 2026-05-22
- **Phase 3** (Agent Tools) ✅ DONE 2026-05-22
- **Phase 4** (Frontend UI) ✅ DONE 2026-06-01
- **Phase 5** (Visual Polish) ✅ DONE 2026-06-01 (partial: filter + highlight; cycle warning indicator — V5.1)

## Frontend implementation (Phase 4-5)

Реализовано через **decorator pattern** — TopicNode не правится, всё наслоено сверху.

### Файлы

| Файл | Назначение |
|------|-----------|
| `frontend/src/types/api.ts` | RelationshipType / Direction / Style unions; extended Relationship + CreateRelationshipRequest + UpdateRelationshipRequest |
| `frontend/src/api/relationships.ts` | REST client + visual mappings (colors/labels/styles per type) |
| `frontend/src/store/relationships.ts` | Zustand: relationships array, drag state, filters (visibleTypes), pending popover, highlight subgraph |
| `frontend/src/components/MindMap/EdgeAnchorsLayer.tsx` | 4 SVG-кружков по сторонам selected node — кликабельные, стартуют drag |
| `frontend/src/components/MindMap/FantomLine.tsx` | Bezier from anchor to cursor; зелёная при snap к target |
| `frontend/src/components/MindMap/ConnectionPopover.tsx` | После drop — type/direction/title input → POST |
| `frontend/src/components/MindMap/RelationshipLine.tsx` | Rewrite: arrows (forward/bidirectional/undirected), type colors/styles, multi-edge parallel offset (8px fan), self-loop dome arc, hit-area для click, selected state, hover dimming |
| `frontend/src/components/MindMap/RelationshipFilter.tsx` | Floating widget toggle по типу + count |
| `frontend/src/components/RelationshipPanel/RelationshipPanel.tsx` | Sidebar editor (type/direction/title/weight slider/style/notes/delete) |
| `frontend/src/components/MindMap/useGraphDragTracking.ts` | Global pointermove/pointerup hook + Escape cancel + drop target resolve через `elementFromPoint` → `closest('[data-topic-id]')` |
| `frontend/src/components/MindMap/MindMap.tsx` | fetch при workbookId change + highlight через setHighlight(selectedTopicId) + overlays внутри/снаружи SVG |
| `frontend/src/renderer/renderer.tsx` | multi-edge bundle group per (from,to) + read from store (single source of truth) |

### UX

1. Выбрать топик → 4 anchors появляются по сторонам
2. Drag с anchor → fantom-линия следует за курсором; зелёная если над valid target
3. Drop на target → popover (type/direction/title) → Save → POST → линия рисуется
4. Esc → cancel drag
5. Multi-edge: разные типы между одной парой → параллельные линии (8px offset, fan-out)
6. Self-loop: A→A → SVG arc справа от ноды
7. Click на ребро → RelationshipPanel sidebar для редактирования
8. Selected node → subgraph highlight (другие связи dimming 18%)
9. Filter widget справа внизу — toggle visibility по type

### Не реализовано (V5.1)

- Cycle warning indicator на нодах (требует периодический detect_cycles + node decoration)
- PropertiesPanel "Relations" tab (список incoming/outgoing для топика)
- Cross-sheet badge (когда target в другом sheet)

После V5.0 — фундамент для V5.1 GraphRAG и **V6.0 Memory Workbench** (KG Canvas использует V5.0 graph).
