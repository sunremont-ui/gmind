# Wiki 16 — Graph Relationships v2 (V5.0)

> Расширенная архитектура связей между топиками. Фундамент для памяти агентов и GraphRAG.

## Обзор

V4.x имел простые связи `{id, title, end1_id, end2_id}` хранящиеся в JSON sheet'а. V5.0 превращает их в полноценный knowledge graph:

- **Типизированные связи** (relates_to, depends_on, supports, contradicts, references, blocks, custom)
- **3 направления**: forward / bidirectional / undirected
- **Multi-edge**: несколько связей разных типов между одной парой
- **Cross-scope**: cross-sheet, cross-workbook endpoints
- **Self-loop** и **циклы** разрешены
- **Отдельная таблица** SQLite с 4 индексами вместо JSON

## Модель данных

```sql
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  -- Endpoints (nullable для cross-scope)
  from_workbook_id TEXT, from_sheet_id TEXT, from_topic_id TEXT NOT NULL,
  to_workbook_id TEXT,   to_sheet_id TEXT,   to_topic_id TEXT NOT NULL,
  -- Семантика
  type TEXT DEFAULT 'relates_to',
  direction TEXT DEFAULT 'forward',
  title TEXT, weight REAL DEFAULT 1.0, notes TEXT,
  -- Вид
  color TEXT, style TEXT DEFAULT 'solid',
  -- Мета
  created_by TEXT DEFAULT 'user',
  created_at TEXT, updated_at TEXT,
  metadata TEXT DEFAULT '{}'
);
```

## API

### Создать связь

```http
POST /api/v1/workbooks/{workbookID}/relationships
Content-Type: application/json

{
  "from_topic_id": "tp_a",
  "to_topic_id": "tp_b",
  "type": "depends_on",
  "direction": "forward",
  "title": "A нуждается в B",
  "weight": 0.8,
  "notes": "Критическая зависимость"
}
```

Опционально: `?strict=true` отклоняет создание если оно создаёт цикл в `depends_on`/`blocks`.

### Получить связи

```http
GET /api/v1/workbooks/{workbookID}/relationships?topic_id=tp_a&type=depends_on
```

### Обновить

```http
PUT /api/v1/relationships/{relID}
{ "title": "...", "weight": 0.5, "notes": "..." }
```

### Удалить

```http
DELETE /api/v1/relationships/{relID}
```

### BFS обход

```http
GET /api/v1/workbooks/{workbookID}/topics/{topicID}/related?depth=2&types=relates_to,supports
```

Возвращает:
```json
{
  "topic_id": "tp_a",
  "depth": 2,
  "topics": ["tp_a", "tp_b", "tp_c", ...],
  "relationships": [...]
}
```

### Детекция циклов

```http
GET /api/v1/workbooks/{workbookID}/cycles?type=depends_on
```

```json
{ "workbook_id": "...", "type": "depends_on", "cycles": [["A", "B", "C"]] }
```

## Agent Tools

Категория `"graph"`, доступна всем 8 ролям:

| Tool | Описание |
|------|----------|
| `create_relationship(from, to, type, direction?, title?, weight?, notes?)` | Создать связь |
| `list_relationships(topic_id, type?, direction?)` | Связи узла (in + out) |
| `get_related_topics(topic_id, depth=1..5, types?)` | BFS обход — для контекста агента |
| `detect_cycles(workbook_id, type?)` | Найти циклы |
| `update_relationship(relationship_id, ...)` | Обновить |
| `delete_relationship(relationship_id)` | Удалить |

Поле `created_by` автоматически = `agent_<task.AgentID>` для агентских вызовов.

## Сценарии использования

### 1. Researcher агент находит связанные топики

```json
{"tool": "get_related_topics", "args": {"topic_id": "tp_123", "depth": 2, "types": ["references", "supports"]}}
```

### 2. Analyst находит противоречия

```json
{"tool": "list_relationships", "args": {"topic_id": "tp_123", "type": "contradicts"}}
```

### 3. Organizer ищет циклы зависимостей

```json
{"tool": "detect_cycles", "args": {"workbook_id": "wb_1", "type": "depends_on"}}
```

### 4. Supervisor строит subgraph для делегирования

```
1. list_agents → выбирает 3 researcher
2. parallel_delegate({tasks: [
     {agent_id: r1, action: "research AI safety", ...},
     {agent_id: r2, action: "find contradicting positions", ...},
     {agent_id: r3, action: "find supporting evidence", ...}
   ]})
3. После завершения → create_relationship для каждой связи
4. detect_cycles → отчёт о противоречиях
```

## Backward Compatibility

- `GET /api/v1/workbooks/{id}` — handler читает связи из новой таблицы и embed'ит их в `sheet.relationships[]` JSON (старые клиенты работают)
- Legacy `End1ID`/`End2ID` поля сохранены в `Relationship` struct
- Legacy POST `/workbooks/{id}/relationships` принимает оба формата (legacy `end1_id`/`end2_id` или V5.0 `from_topic_id`/`to_topic_id`)
- Cascade delete: при удалении топика — `RelationshipStore.DeleteByTopic` чистит все его связи

## Алгоритмы

### Traverse (BFS)

```
visited = {start}
current = [start]
для каждого уровня глубины:
  next = []
  для каждого tid в current:
    для каждой связи rel в ListByTopic(tid):
      если type фильтр и rel.Type не подходит → skip
      neighbor = rel.ToTopicID если from = tid, иначе rel.FromTopicID
      если direction = forward и tid - это to_id → skip
      если neighbor не visited → добавить в next
  current = next
```

Для bidirectional/undirected — обход идёт в обе стороны.

### DetectCycles (DFS с three-color marking)

```
white (0): не посещён
gray (1): в стеке текущего DFS
black (2): полностью обработан

DFS(node, path):
  color[node] = gray
  path.push(node)
  для каждого next в adj[node]:
    если color[next] = gray → найден цикл: path[index(next)..конец]
    если color[next] = white → DFS(next, path)
  color[node] = black
```

Только связи с `direction='forward'` участвуют в детекции (циклы из undirected/bidirectional не имеют смысла).

## Что НЕ сделано (Phase 4-5)

- Frontend UI для drag-from-edge
- RelationshipLine rewrite (стрелки, типы, multi-edge offset)
- RelationshipPanel sidebar
- Filter toolbar по типу
- Hover-highlight subgraph
- Cycle warning indicator

Эти задачи — V5.0 Phase 4-5. См. [skills/graph-relationships.md](../skills/graph-relationships.md).

## Связь с другими модулями

- **V4.2 RAG**: `Traverse` будет интегрирован в `semantic_search` для GraphRAG (V5.1)
- **V4.3 Multi-Agent**: supervisor может использовать `get_related_topics` для построения subgraph задач
- **MCP Server**: graph tools будут exposed через MCP для внешних клиентов
