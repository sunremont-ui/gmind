# Gmind — Планы и Память Сессии

> Этот файл обновляется в каждой сессии: хранит активный план, контекст и прогресс.

---

## Сессия: 2026-06-01 — V6.0 Phase 2 (Memory Layer Map)

### Контекст
- Phase 1 готов; Phase 2 — визуализация 6-слойной karp модели поверх 8 MASys layers
- karp 6 слоёв: Working / Episodic / Semantic / Procedural / Artifact / Meta
- Каждый слой получает health metrics с heuristics

### Выполнено

**Mapping (8 MASys → 6 karp):**
- Working ← Conversations (active sessions + summaries + message count)
- Episodic ← Episodes (total + errors + recent 24h)
- Semantic ← Entities + Wiki pages (low-mention warning, stale >60d)
- Procedural ← Skills (active count + avg successRate + unused detection)
- Artifact ← Results (expiring soon + expired warnings)
- Meta ← Decisions + Pending writes (queue size + old pending detection)

**Файлы:**
- [x] `layerMapping.ts` — pure-function aggregation (6 functions + healthColor/healthLabel + AggregatedLayer type)
- [x] `LayerMap.tsx` — 2×3 grid of LayerCard with icon + label + description + parts + health badge + health notes
- [x] `LayerDrillDown.tsx` — modal showing recent items per layer (5 list variants)
- [x] `MemoryWorkbenchPanel.tsx` — Tabs view (Layer Map / Raw layers); TabBtn helper

**Health levels (3 уровня):**
- `ok` (green) — данных достаточно, нет аномалий
- `warn` (amber) — есть гниющие данные, low-quality items
- `crit` (red) — много ошибок / низкая success rate

### Health heuristics

| Layer | Метрика | Threshold |
|-------|---------|-----------|
| Working | compressed_count vs total_msgs | 0 compressed at >100 msgs → warn |
| Episodic | error_rate | >30% warn, >50% crit |
| Episodic | stale_count | >70% старше 30 дней → warn |
| Semantic | low_mention_ratio | >40% entities с <2 mentions → warn |
| Semantic | stale_entities | >0 entities старше 60 дней → warn |
| Procedural | low_success_skills | >30% с success<50% → crit |
| Procedural | unused_skills | >50% не запускались → warn |
| Artifact | expired_count | >0 → warn |
| Artifact | expiring_soon | в течение 7 дней → notes |
| Meta | pending_queue | >50 → warn, >100 → crit |
| Meta | old_pending | старше 7 дней → warn |

### Drill-down UX

Click на любую карточку → modal с recent items (top 30-50 per layer):
- Working: sessions + compressed summary preview
- Episodic: action + status + tags + timestamp + agent
- Semantic: entities (name/type/mentions/lastSeen) + wiki pages
- Procedural: name + successRate badge (color-coded) + usage count
- Artifact: name + type + namespace + expiresAt
- Meta: decisions log + pending queue

Esc или click на overlay → close.

### Тесты
- `tsc --noEmit` чист
- Vitest: 62/62 OK

### Следующее (Phase 3)
- Knowledge Graph Canvas: sync MASys entities + relations → V5.0 graph через POST `/api/v1/workbooks/{id}/relationships`
- Использует существующий drag-from-edge UI

---

## Сессия: 2026-06-01 — V6.0 Phase 1 (MASys Memory Bridge)

### Контекст
- V5.0 graph UI готов; начат V6.0 Memory & Pipeline Workbench
- Phase 1: bridge backend (REST proxy + SSE) + frontend types + store + stub panel

### Выполнено

**Backend (Go):**
- [x] `backend/internal/api/masys_memory.go` — REST proxy к MASys tRPC
  - Helpers: `callTRPCQuery` (GET с url-encoded input), `callTRPCMutation` (POST body), `writeMASysJSON` (unwrap result.data)
  - Endpoints: 10 шт.
- [x] `backend/internal/api/masys_sse.go` — SSE bridge для run events
  - Connects Gmind backend → MASys WS, re-emits как `event: <type>\ndata: <json>\n\n`
  - 20s keepalive, Escape via context cancel
  - Использует `gorilla/websocket` (уже в deps)
- [x] `router.go` — регистрация `/api/v1/masys/*` (memory/runs/health)
- [x] `go build ./...` чист; `go test ./internal/api/...` OK

**Frontend (TypeScript/React):**
- [x] `types/masys.ts` — 12 интерфейсов (Episode/Entity/Skill/Conversation/Wiki/Result/Decision/Pending/Run/RunEvent/RecallResult/Health)
- [x] `api/masys.ts` — fetch wrapper + 14 методов (health, listX × 8, recall, listRuns, getRun, getRunEvents, streamRun→EventSource)
- [x] `store/masysMemory.ts` — Zustand: health + namespaces + 8 layers + loading flags + `fetchX` × 8 + `refreshAll`
- [x] `components/MemoryWorkbench/MemoryWorkbenchPanel.tsx` — skeleton:
  - Reachability indicator (✓/✗ + error)
  - Namespace switcher
  - 8 layer cards с counters
  - Refresh button
- [x] `modules/memory-workbench/module.ts` — AppModule, order=5, icon LumenBrain, 2 commands (open, refresh)
- [x] `modules/registry.ts` — добавлен MemoryWorkbenchModule
- [x] `tsc --noEmit` чист; Vitest 62/62 OK

### API endpoints (V6.0 Phase 1)

```
GET  /api/v1/masys/health
GET  /api/v1/masys/memory/namespaces
GET  /api/v1/masys/memory/episodes?namespace=...&limit=...
GET  /api/v1/masys/memory/entities?namespace=...
GET  /api/v1/masys/memory/skills?namespace=...
GET  /api/v1/masys/memory/conversations?namespace=...
GET  /api/v1/masys/memory/wiki?namespace=...
GET  /api/v1/masys/memory/results?namespace=...
GET  /api/v1/masys/memory/decisions?namespace=...
GET  /api/v1/masys/memory/pending?namespace=...
POST /api/v1/masys/memory/recall  { namespace, query, limit }
GET  /api/v1/masys/runs?limit=...
GET  /api/v1/masys/runs/{runID}
GET  /api/v1/masys/runs/{runID}/events
GET  /api/v1/masys/runs/{runID}/stream    ← SSE bridge
```

tRPC mappings: `memory.episode.recent`, `memory.entity.list`, `memory.skill.list` (с fallback на `workspaces.skills`), `memory.conversation.list`, `memory.wiki.list`, `memory.result.list`, `memory.controller.decisions`, `memory.controller.pending`, `memory.retriever.search`, `memory.entity.namespaces`, `runs.list/get/events`.

### Следующее (Phase 2-7)

- Phase 2: Layer Map — 6 карточек слоёв с health metrics
- Phase 3: Knowledge Graph Canvas (sync MASys entities → V5.0 graph)
- Phase 4: Episode Timeline
- Phase 5: Context Budget (Sankey)
- Phase 6: Skill Evolution Tree
- Phase 7: Pipeline Trace Map + SSE live

---

## Сессия: 2026-06-01 — V5.0 Phase 4-5 (Frontend graph UI)

### Контекст
- Backend V5.0 (Phase 1-3) уже готов (миграция 010, RelationshipStore, 6 agent tools)
- Phase 4-5 — frontend UI: drag-from-edge, popover, sidebar, filter, hover highlight
- Это prerequisite для V6.0 KG Canvas

### Выполнено

**Types & API (frontend):**
- [x] `types/api.ts` — расширил Relationship/CreateRelationshipRequest + новый UpdateRelationshipRequest + 3 union types (Type/Direction/Style)
- [x] `types/index.ts` — re-export всех новых типов
- [x] `api/relationships.ts` — REST клиент (list/create/update/remove/related/cycles) + visual mappings (RELATIONSHIP_TYPE_COLORS/LABELS/STYLES)

**State:**
- [x] `store/relationships.ts` — Zustand: data + drag state + filters + popover + 9 actions

**Components (decorator pattern — без правки TopicNode):**
- [x] `EdgeAnchorsLayer.tsx` — 4 SVG-кружка на сторонах selected node, стартуют drag
- [x] `FantomLine.tsx` — Bezier-линия от anchor до cursor; зелёная при snap
- [x] `ConnectionPopover.tsx` — type select + direction toggle + title input после drop
- [x] `RelationshipLine.tsx` (rewrite) — direction arrows (forward/bidirectional/undirected), type colors/styles, multi-edge parallel offset, self-loop SVG arc, hit-area для click, selection state, hover dimming
- [x] `RelationshipMarkers` — SVG `<marker>` для всех типов (с reversed для bidirectional)
- [x] `RelationshipPanel/RelationshipPanel.tsx` — sidebar editor (type/direction/title/weight slider/style/notes/delete)
- [x] `RelationshipFilter.tsx` — floating toggle widget по типу с count

**Integration:**
- [x] `useGraphDragTracking.ts` — global pointermove/pointerup tracker + Escape cancel
- [x] `MindMap.tsx` — fetch при смене workbookId, подключение всех overlays (внутри SVG anchors+fantom+markers; снаружи popover+panel+filter), highlight через setHighlight(selectedTopicId)
- [x] `renderer.tsx` — multi-edge bundle group + prefer store relationships, передача offsetIndex/offsetCount

### Тесты
- `tsc --noEmit` чистый
- Vitest: 62/62 passed (8 файлов)

### Архитектура (decorator overlay)

```
SVG (existing TopicNode untouched)
├── <MindMapRenderer> ← reads from store + bundle multi-edges
├── <EdgeAnchorsLayer node={selected} /> ← 4 anchors
├── <FantomLine /> ← drag follow cursor
└── <RelationshipMarkers /> ← arrows defs

Outside SVG (overlays):
├── <ConnectionPopover /> ← после drop
├── <RelationshipPanel /> ← edit selected
└── <RelationshipFilter /> ← visibility per type
```

### UX

- Выбрать топик → видны 4 anchors на нём
- Drag с любого anchor → fantom-линия за курсором
- Drop на target ноду → popover с type/direction/title
- Esc → cancel drag
- Multi-edge: разные типы между одной парой → параллельные линии (8px offset, fan-out)
- Self-loop: A→A → дуга справа от ноды
- Click на ребро → RelationshipPanel sidebar для редактирования
- Select топик → выделение subgraph (другие связи dimming до 18%)
- Filter widget справа внизу — toggle по типу

### Осталось (опциональное)

- [ ] Cycle warning indicator на нодах в цикле (требует периодический detect_cycles call)
- [ ] PropertiesPanel "Relations" tab — список incoming/outgoing для топика
- [ ] Cross-sheet badge (когда target в другом sheet)

---

## Сессия: 2026-06-01 — V6.0 Memory & Pipeline Workbench (research + architecture)

### Контекст
- Пользователь работает над D:\karp (исследование памяти агентов) и E:\MASys (агентная платформа)
- Требование: Gmind становится visual workbench для памяти + пайплайнов MASys
- Решение: V6.0 — 7-фазный план, использует V5.0 Graph как фундамент

### Исследование (parallel Explore agents)

**D:\karp** — теория памяти:
- 6-слойная модель (working/episodic/semantic/procedural/artifact/meta)
- Dual-lane (fast/slow): captured→proposed→draft / reviewed→canonical→archived
- Memory Controller с 3 режимами (self-managed/external/hybrid)
- Спроектированные UI: Layer Map, Episode Timeline, Context Budget, Salience Queue, Record Inspector, Trace, KG, Artifact Lineage

**E:\MASys** — practical engine:
- Prisma таблицы: ConversationSession, Episode, MemoryEntity, VectorEntry, Skill, MemoryDecision, MemoryPendingWrite
- 13+ memory модулей: memory-controller, memory-retriever, knowledge-graph, entity-memory, episode-memory, wiki-memory, conversation-memory, result-store, vector-store, skill-library, context-assembly, memory-decay, memory-export, embedder, llama-embedder
- MemoryPage с 8 tabs (UI минималистичный — таблицы и JSON)
- tRPC: memory.*, runs.*, agents.*, workspaces.*, gmindAgents.*
- WS live updates: `ws://localhost:3001/ws?runId=<id>`
- Гэп: visual canvas для KG, timeline, skill tree, run trace

### V6.0 Roadmap (7 фаз, ~10 дней)

**Prerequisite**: V5.0 Phase 4-5 (Frontend graph UI) — без drag-from-edge KG canvas не получится.

| Phase | Что | Срок |
|-------|-----|------|
| 1. MASys Bridge & Types | REST proxy + types + WS bridge | 1д |
| 2. Memory Layer Map | 6 карточек слоёв с health | 1д |
| 3. Knowledge Graph Canvas | KG sync → V5.0 graph + canvas | 2д |
| 4. Episode Timeline | Hronologica + filter + reflection actions | 1.5д |
| 5. Context Budget | Sankey + sandwich + evicted preview | 1д |
| 6. Skill Evolution Tree | Skill graph через V5.0 | 1.5д |
| 7. Pipeline Trace Map | Run timeline + memory recalls links | 2д |

### Выполнено
- [x] Параллельное исследование karp + MASys (2 Explore agents)
- [x] Skill `memory-visualization.md` — полная архитектура V6.0 (~500 строк)
- [x] Memory: `project_karp_memory.md` (D:\karp концепции)
- [x] Memory: `project_masys_memory_engine.md` (MASys как memory engine)
- [x] MEMORY.md index обновлён
- [x] Roadmap (project_v4x_roadmap.md) — V6.0 запланирован

### Архитектура (краткая)

```
Gmind UI Layer
├── NavRail + новые 2 модуля:
│   ├── 📊 Memory Workbench (7 sub-views)
│   └── 🔄 Pipeline Workbench (3 sub-views)
└── Gmind backend (Go) — proxy к MASys tRPC
        ↓ HTTP/WS
MASys (:3000/3001) — 13+ memory modules + Prisma + tRPC
```

### Не делаем сейчас (V6.1+)
- Запись (mutate) в MASys через Gmind UI
- Memory editor inside Gmind (создание ADR/skills)
- Multi-namespace switching
- Embeddings comparison Gmind vs MASys
- Tauri Mobile

### Открытые решения (для discussion)
1. **Порядок**: сначала V5.0 Phase 4-5 (frontend graph) или сразу V6.0 Phase 1 (bridge)?
2. **Скоуп MVP**: какие 3 фазы из 7 — приоритетные? (рекомендую: 1+2+4 = bridge + layer map + episode timeline)
3. **KG sync mode**: одноразовая команда, polling 30s или WS push (рекомендую: explicit + WS для новых)
4. **Namespace handling**: добавить namespace column в `relationships` таблицу? (рекомендую: да, мигр. 011)

---

## Сессия: 2026-05-22 — V5.0 Graph Relationships (Phase 1-3 backend)

### Контекст
- V4.4 закрыт, ядро программы расширяется для памяти агентов
- Требование: связи во все стороны (sibling, cross-branch, cross-sheet, cross-workbook, self-loop, циклы, multi-edge)
- Решено через AskUserQuestion-голосование:
  - Multi-edge: ✅ разрешён (несколько типов между одной парой)
  - Направления: 3 (forward, bidirectional, undirected)
  - UI: drag-from-edge (4 anchors при hover)
  - Scope: ВСЁ (self-loop, cross-sheet, cross-workbook, циклы)

### Выполнено (Backend Phase 1-3)

**Phase 1: Foundation**
- [x] Skill `graph-relationships.md` — архитектура, типы, алгоритмы, roadmap
- [x] Миграция `010_relationships.up/down.sql` — таблица + 4 индекса
- [x] `model.Relationship` extension — legacy `End1ID/End2ID` сохранены + 17 новых полей (FromTopicID/ToTopicID/Type/Direction/Weight/Notes/Color/Style/CreatedBy/Metadata + cross-scope endpoints)
- [x] `model.UpdateRelationshipRequest` — pointer-based partial update
- [x] `store/relationships.go` — `RelationshipStore`: Insert/Get/Update/Delete + ListByWorkbook/ListByTopic/FindBetween + DeleteByTopic/DeleteByWorkbook cascade + **Traverse (BFS)** + **DetectCycles (DFS с color marking)**
- [x] `store/relationships_test.go` — 4 теста: CRUD, multi-edge, Traverse depth 1/2, cycles, self-loop

**Phase 2: REST API**
- [x] `api/relationships.go` — handlers + validators (type/direction/style) + cycle prevention (`?strict=true`)
- [x] Endpoints:
  - `POST /api/v1/workbooks/{id}/relationships` (CreateRelationshipV2 — accept legacy + V5.0 fields)
  - `GET /api/v1/workbooks/{id}/relationships?topic_id=...&type=...`
  - `PUT /api/v1/relationships/{relID}`
  - `DELETE /api/v1/relationships/{relID}` (scope-agnostic)
  - `DELETE /api/v1/workbooks/{id}/relationships/{relID}` (legacy, тоже работает)
  - `GET /api/v1/workbooks/{id}/cycles?type=depends_on`
  - `GET /api/v1/workbooks/{id}/topics/{topicID}/related?depth=N&types=...`
- [x] Backward compat: `EmbedRelationshipsIntoSheet` в GetWorkbook
- [x] Cascade delete: при DeleteTopic — `relationships.DeleteByTopic`
- [x] Handler.relationships wired в `New()`

**Phase 3: Agent Tools**
- [x] 6 новых tools в category `"graph"`:
  - `create_relationship(from, to, type, direction?, title?, weight?, notes?, workbook_id?)`
  - `list_relationships(topic_id, type?, direction?)`
  - `get_related_topics(topic_id, depth=1..5, types?)`
  - `detect_cycles(workbook_id, type?)`
  - `update_relationship(relationship_id, type?, direction?, title?, weight?, notes?, color?, style?)`
  - `delete_relationship(relationship_id)`
- [x] `GetToolsForRole` обновлён — все 8 ролей получили graph category
- [x] `ToolExecutor.relStore` + `SetRelationshipStore`; `WorkerPool.SetRelationshipStore`
- [x] `main.go` — wired `relStore` в worker pool
- [x] `created_by` авто-генерация: `agent_<callerTask.AgentID>` для агентских вызовов

### Тесты

- Go: `relationships_test.go` 4/4 OK (CRUD, Traverse, Cycles, SelfLoop)
- Go: `agent` + `api` + `wiki` + `ws` + `mcp` — все OK
- FTS test failures — pre-existing (modernc.org/sqlite без sqlite_fts5 build tag), не V5.0 регрессия
- TypeScript: `tsc --noEmit` чистый

### Осталось (V5.0 Phase 4-5)

- [ ] Phase 4: Frontend UI
  - TopicNode hover → 4 edge anchors
  - Drag handler с fantom line
  - ConnectionPopover (type/direction)
  - RelationshipLine rewrite (arrows, type styles, multi-edge offset, self-loop arc)
  - RelationshipPanel sidebar
  - Cross-sheet badge
- [ ] Phase 5: Visual Polish
  - Filter toolbar по type/direction
  - Hover-highlight subgraph
  - Cycle warning indicator
  - PropertiesPanel "Relations" tab

---

## Сессия: 2026-05-22 — V4.4 Parallel UI + Export endpoints + README

### Контекст
- V4.3 backend закрыт (parallel_delegate, list_agents, supervisor role)
- V4.4: визуализация parallel-задач + backend endpoint для FreeMind export
- Создан root README.md (на github.com sunremont-ui/gmind)

### Выполнено
- [x] **README.md** (root) — стек, установка, dev-режимы, структура, команды, roadmap, использование
- [x] **TaskList grouped UI** — группировка по `parallel_group_id`, агрегированный counter "X/N done · M running"
- [x] **Backend `/export/freemind`** — XML с `<node TEXT=".."/>` + `<richcontent>` для notes; XML escape helpers
- [x] Express Markdown (`/export/markdown`) — уже был реализован, проверено
- [x] `go build` + `go test` + `tsc --noEmit` — все чистые

### Архитектура grouped row

```ts
type Row = { kind: 'single'; task: AgentTask } | { kind: 'group'; groupId: string; tasks: AgentTask[] }

// Pre-process: tasks → singles + groups (by parallel_group_id)
// Render: sorted by created_at, max 20
// Group card: counter (done/failed/running/queued), expandable list
```

### Осталось (V4.5)
- [ ] Web Worker layout для 1000+ нод
- [ ] Виртуальный скроллинг минимапы
- [ ] Drag-and-drop файлов на холст (.md/.mm/.xmind)

---

## Сессия: 2026-05-22 — V4.3 Multi-Agent Orchestration

### Контекст
- V4.2 RAG завершён, production-релиз v1.0.0 в CI (assembly ok)
- V4.3 — следующий milestone roadmap'а: parallel fan-out + supervisor

### Выполнено
- [x] Миграция `009_parallel_groups.up.sql/down.sql` — `parallel_group_id` колонка + индекс
- [x] `Task.ParallelGroupID` + `AgentTaskRecord.ParallelGroupID` + scanTask/Insert обновлены
- [x] `Manager.SubmitTaskInGroup(...)` — submit с групповым ID, уважает HITAL
- [x] `parallel_delegate` tool — max 16 задач, 5 мин timeout, self-delegation guard
- [x] `list_agents` tool — discovery агентов до делегирования
- [x] Роль `supervisor` в `GetToolsForRole` — categories agent/notes/wiki/search/analysis (без mindmap)
- [x] Frontend: `AGENT_ROLES` + `ROLE_ACTIONS` + `ACTION_SCHEMAS` + `AgentTask.parallel_group_id`
- [x] Wiki: 07-improvements.md (V4.3 DONE), index.md (статус, чек-лист)
- [x] Skills: agent-system.md (V4.3 DONE secn), multi-agent-patterns.md (Hub-and-Spoke pattern)
- [x] `go build` + `go test ./...` (агент + store + mcp + wiki + ws — все OK)
- [x] `tsc --noEmit` чистый

### Архитектура parallel_delegate

```
Supervisor → parallel_delegate({tasks: [...]})
  → SubmitTaskInGroup × N (общий group_id)
  → worker pool обрабатывает параллельно
  → polling 500ms × 600 итераций (5 мин timeout)
  → return {group_id, results: [{agent_id, task_id, status, result|error}]}
```

### Осталось (V4.4)
- [ ] TaskList grouped card по `parallel_group_id` — визуализация fan-out
- [ ] Progress indicator: "2/3 done · 1 running"
- [ ] Pipeline DAG визуальный редактор (V5.0)

---

## Сессия: 2026-05-22 — Production Launch Prep + Skills Update

### Контекст
- Проект готов к production-релизу (все 4 фазы roadmap закрыты)
- Осталось: git tag v1.0.0 → CI builds .msi → GitHub Release Draft
- Обновлены устаревшие skills: desktop-tauri.md, masys-integration.md

### Выполнено
- [x] desktop-tauri.md — убраны "Production Gaps" (всё уже DONE), добавлен актуальный статус (SplashScreen, Stronghold JS API, SettingsModal, auto-updater)
- [x] masys-integration.md — порт 8080→1010, Фаза 2 помечена как DONE, добавлена операция submit-agent-task

### Для первого релиза (ручные шаги)
1. [ ] `git add -A && git commit -m "feat: V4.2 production ready"`
2. [ ] `git tag v1.0.0 && git push origin master --tags` → триггер GitHub Actions → `.msi` artifact
3. [ ] Создать эталонный пайплайн в MASys: `pipeline-input → agent-loop(tools=[gmind-mindmap]) → logger`
4. [ ] Проверить `E:\MASys\start-masys.bat` на Windows

---

## Сессия: 2026-05-22 — Documentation Sync

### Контекст
- Синхронизация документации с фактическим состоянием кода (V4.1 + V4.2 DONE)
- Обновлены: AGENTS.md, PLANS.md, wiki/07-improvements.md, wiki/index.md, memory

### Выполнено
- [x] AGENTS.md — V3.9 "в разработке" → ✅ DONE; добавлены секции V4.1 и V4.2
- [x] PLANS.md — V4.1/V4.2 checkboxes `[ ]` → `[x]`; добавлена сессия
- [x] wiki/07-improvements.md — V3.8 матрица + V4.1/V4.2 разделы; V4.3 upcoming
- [x] wiki/index.md — нижний список: добавлены страницы 14 и 15
- [x] memory/project_gmind_stack.md — исправлен Arch Gotcha об агентах (V4.1 fixes it)
- [x] memory/project_v4x_roadmap.md — обновлена матрица

### Текущий статус
- **V4.0 Modular Platform** ✅ DONE (2026-05-16)
- **V4.1 Agent Persistence** ✅ DONE (2026-05-17)
- **V4.2 RAG Search** ✅ DONE (2026-05-17)
- **V4.3 Multi-Agent Orchestration** 🟠 Следующий

---

## Сессия: 2026-05-17 — Тестирование + Bugfix + Roadmap V4.x

### Контекст
- Запущено полное тестирование: Go `go test ./...`, TypeScript `tsc --noEmit`, Vitest
- Найдено и исправлено 7 багов (4 в тестах/go, 3 в production-коде)
- Составлен roadmap V4.1–V5.0 по векторам улучшений
- Оптимизирован запуск desktop-версии (Tauri startup)

### Найденные и исправленные баги

| # | Баг | Серьёзность | Файл |
|---|-----|-------------|------|
| 1 | `api.New` — 4 аргумента вместо 5 в тестах | 🔴 build fail | `workbook_test.go` |
| 2 | nil store panic в health handler + webhook init | 🔴 panic | `router.go` |
| 3 | In-memory SQLite — несколько соединений пула → "no such table" | 🔴 test fail | `store/db.go` |
| 4 | SSE `taskBrokers` — `removeBrokerIfEmpty` нигде не вызывалась | 🔴 memory leak | `api/sse.go` |
| 5 | `TaskQueue.done` map — unbounded рост в памяти | 🔴 memory leak | `agent/task.go` |
| 6 | Tauri main window `visible: true` → белый flash до React | 🟡 UX | `tauri.conf.json` + `lib.rs` |
| 7 | `update_main_shortcut` — хардкоженные кандидаты → не снимает кастомный шорткат | 🟡 logic bug | `lib.rs` |

### Выполнено
- [x] Исправлены все 7 багов
- [x] Go: 6/6 пакетов OK (56+ тестов)
- [x] Frontend Vitest: 62/62 тестов OK
- [x] TypeScript: 0 ошибок
- [x] SSE: TTL cleanup goroutine (30 мин) + `removeBrokerIfEmpty` при disconnect
- [x] TaskQueue: `maxDone=500`, FIFO eviction через `doneOrder []string`, helper `addDone()`
- [x] Tauri: `visible: false` + `w.show()` из Rust после spawn sidecar; poll 150ms→300ms
- [x] Rust: `CurrentMainShortcut(Mutex<String>)` managed state для корректного unregister
- [x] Обновлены: PLANS.md, AGENTS.md, wiki/01, wiki/12, wiki/index, memory

---

## ROADMAP V4.x — Векторы улучшений (2026-05-17)

> Основан на результатах тестирования, аудита архитектуры и анализа wiki/12-improvement-vectors.md.
> Каждый milestone — независимо deployable.

---

### V4.1 — Agent Persistence + Reliability
**Приоритет: 🔴 КРИТИЧНО**
**Цель:** агенты не теряются при перезапуске сервера; зависшие задачи авто-восстанавливаются

#### 4.1.1 — SQLite persistence для агентов ✅ DONE (2026-05-17)
- [x] Миграция `007_agents.up.sql` — таблица `agents(id, name, role, provider, model, system_prompt, created_at)`
- [x] `backend/internal/store/agents.go` — `AgentStore`: `Insert`, `Get`, `List`, `Update`, `Delete`
- [x] `backend/internal/agent/module.go` — `InitAgentStore`, `PersistAgent`, `RemoveAgent`, `SyncAgent`
- [x] `backend/cmd/server/main.go` — wired `agentStore` + auto-start workers после `InitAgentStore`

#### 4.1.2 — Startup agent worker auto-start ✅ DONE (2026-05-17)
- [x] `backend/internal/agent/module.go` — `StartWorker` вызывается для каждого агента из InitAgentStore

#### 4.1.3 — Startup agents robustness (App.tsx) ✅ DONE (2026-05-17)
- [x] `frontend/src/App.tsx` — убран `submitTask __startup__` no-op, только `fetchAgents()` при старте

---

### V4.2 — RAG поиск по картам и вики
**Приоритет: 🟠 ВЫСОКИЙ**
**Цель:** семантический поиск по всем mindmap и wiki-страницам; AI видит релевантный контекст

#### 4.2.1 — Vector store ✅ DONE (2026-05-17)
- [x] Миграция `008_embeddings.up.sql` — таблица `topic_embeddings(topic_id, embedding BLOB, updated_at)`
- [x] `backend/internal/store/embeddings.go` — `EmbeddingStore`: `Upsert`, `Search` (cosine similarity, pure Go)

#### 4.2.2 — Embedding service ✅ DONE (2026-05-17)
- [x] OpenAI `text-embedding-3-small` интеграция; CGO-free (нет sqlite-vec)

#### 4.2.3 — Agent tool + API ✅ DONE (2026-05-17)
- [x] `backend/internal/agent/tools.go` + `search.go` — tool `semantic_search(query, limit)` → JSON топиков
- [x] `backend/internal/api/router.go` — `GET /api/v1/search?q=...&type=semantic`

---

### V4.3 — Multi-Agent Orchestration
**Приоритет: 🟠 ВЫСОКИЙ**
**Цель:** параллельный fan-out, supervisor-агент, pipeline DAG

#### 4.3.1 — Parallel fan-out
**Уже есть:** sequential chaining через `chain_to_agent_id`
- [ ] `backend/internal/agent/executor.go` — tool `parallel_delegate(tasks: [{agent_id, action, params}])` → запускает задачи параллельно, ждёт все, возвращает merged result
- [ ] `backend/internal/agent/task.go` — `Task.ParallelGroupID string` для группировки fan-out задач
- [ ] Frontend: визуализация parallel tasks в TaskList (grouped card)

#### 4.3.2 — Supervisor agent
- [ ] Новая роль `supervisor` в `GetToolsForRole` — имеет доступ к `delegate_subtask`, `parallel_delegate`, `list_agents`
- [ ] `backend/internal/agent/executor.go` — `delegate_subtask(agent_id, action, params)` — submit + poll до завершения
- [ ] Frontend: `AgentCreateDialog` — роль Supervisor в dropdown

#### 4.3.3 — Pipeline UI (V5.0+)
- [ ] Визуальный редактор DAG в MaSysPanel или отдельный модуль `pipeline`

---

### V4.4 — Export/Import расширения
**Приоритет: 🟡 СРЕДНИЙ**
**Цель:** обратный экспорт в популярные форматы; batch import

#### 4.4.1 — Export Markdown
- [ ] `backend/internal/xmind/export_md.go` — рекурсивный обход дерева → Markdown headers + списки
- [ ] API: `GET /api/v1/workbooks/{id}/export?format=md`
- [ ] Frontend: кнопка «Export MD» в тулбаре рядом с SVG/PNG/PDF

#### 4.4.2 — Export FreeMind (.mm)
- [ ] `backend/internal/xmind/export_mm.go` — XML с `<map>/<node TEXT="...">` структурой
- [ ] API: `GET /api/v1/workbooks/{id}/export?format=mm`

#### 4.4.3 — Drag-and-drop file import
- [ ] `frontend/src/components/MindMap/MindMap.tsx` — `onDragOver`/`onDrop` на SVG canvas
- [ ] Определение формата по MIME/extension → вызов существующих импортёров

---

### V4.5 — Performance: Large Graphs
**Приоритет: 🟡 СРЕДНИЙ**
**Цель:** плавная работа с 500+ нодами

#### 4.5.1 — Web Worker layout
- [ ] `frontend/src/workers/layout.worker.ts` — `buildLayout` + `computeTreeLayout` в Worker
- [ ] `frontend/src/components/MindMap/MindMap.tsx` — `useWorker` hook, отображать skeleton пока считается

#### 4.5.2 — Incremental viewport culling
**Уже есть:** `isInViewport` скрывает через `visibility:hidden`
- [ ] Улучшить: полностью убирать из DOM ноды вне viewport + 20% margin (React `key`-based removal)

#### 4.5.3 — Minimap для навигации
- [ ] `frontend/src/components/MindMap/MiniMap.tsx` — SVG в SVG, масштаб 1/10, viewport rect
- [ ] Клик на minimap → pan canvas к нужной зоне

---

### V4.6 — MCP Bridge + n8n
**Приоритет: 🟢 НИЗКИЙ**
**Цель:** агенты вызывают внешние workflow (n8n, Zapier) через MCP

- [ ] `backend/internal/mcp/bridge.go` — MCP client (JSON-RPC 2.0) → внешний MCP-совместимый сервер
- [ ] `backend/internal/agent/tools.go` — tool `call_workflow(server_url, workflow_id, inputs)`
- [ ] UI: в AIServerPanel — секция «MCP Bridges» (URL + enabled toggle)

---

### V5.0 — Knowledge Graph + GraphRAG
**Приоритет: 🟢 НИЗКИЙ (V5.0)**
**Цель:** mindmap → knowledge graph → GraphRAG для глобальных AI-запросов

- [ ] `backend/internal/store/graph.go` — таблица `topic_relations(src_id, dst_id, type, weight)`
- [ ] Авто-извлечение связей из rich_text + relationships
- [ ] GraphRAG: при AI-запросе обходить граф (BFS/DFS) → собирать контекст из N-hop окружения
- [ ] Отображение в MindMap: «связи из других карт» пунктиром

---

### Приоритетная матрица

| ID | Название | Приоритет | Сложность | Ценность | Статус |
|----|----------|-----------|-----------|----------|--------|
| V4.1 | Agent Persistence + Reliability | ✅ DONE | M | ⭐⭐⭐⭐⭐ | 2026-05-17 |
| V4.2 | RAG Search | ✅ DONE | L | ⭐⭐⭐⭐⭐ | 2026-05-17 |
| V4.3 | Multi-Agent Orchestration | 🟠 P1 | L | ⭐⭐⭐⭐ | Следующий |
| V4.4 | Export/Import расширения | 🟡 P2 | S | ⭐⭐⭐ | Любое время |
| V4.5 | Performance (Worker layout) | 🟡 P2 | M | ⭐⭐⭐⭐ | После V4.3 |
| V4.6 | MCP Bridge (n8n, Zapier) | 🟢 P3 | M | ⭐⭐⭐ | После V4.3 |
| V5.0 | Knowledge Graph + GraphRAG | 🟢 P4 | XL | ⭐⭐⭐⭐⭐ | V5.0 |

---

## Сессия: 2026-05-12 — Rich text editing (V3.2)

### Контекст
- Первая задача V3.2 Editor roadmap: rich text support (bold, italic, lists) in mindmap topic nodes
- Реализовано: HTML-поле `rich_text` в Go/TS моделях, `RichTextEditor` (contentEditable + toolbar), рендеринг через foreignObject
- TS strict mode: исправлен `radii.xs` → `radii.sm` (в tokens нет `xs`)

### Выполнено
- [x] `RichText` field added to Go `Topic` and `UpdateTopicRequest` (`types.go`)
- [x] `rich_text?` field added to TS `Topic` and `UpdateTopicRequest` (`types/api.ts`)
- [x] `RichTextEditor.tsx` — contentEditable div + Bold/Italic/Bullet/Numbered toolbar + Ctrl+B/I shortcuts
- [x] `TopicNode.tsx` — edit mode uses RichTextEditor; display renders `dangerouslySetInnerHTML` via foreignObject
- [x] `MindMap.tsx` — `handleTopicEditSave` accepts optional `richText` in updates (both regular + floating topics)
- [x] `radii.xs` → `radii.sm` TS bugfix in RichTextEditor.tsx
- [x] `tsc --noEmit` — clean (0 errors)
- [x] **Image nodes** — вставка изображений в ноды
- [x] **Hyperlink preview** — 🔗 иконка на ноде + клик открывает URL + тултип + контекстное меню
- [x] **Callout / Notes popup** — 📄 иконка кликабельна → модалка с textarea + Save/Cancel
- [x] **Node templates** — сохранение/загрузка стилей через StylePanel (localStorage)
  - TopicNode.tsx: рендеринг `topic.image` через foreignObject + `<img>`, совместно с rich_text/title
  - PropertiesPanel.tsx: URL input + file upload (base64) + preview
  - RichTextEditor.tsx: кнопка вставки `<img>` через prompt
  - MindMap.tsx: `image` + `rich_text` включены в deepCloneForCopy/pasteTopicRecursive

## Сессия: 2026-05-11 — Полная Lumen миграция UI

### Контекст
- Все компоненты проверены и обновлены под Lumen Design System
- Не́йморфизм: двойные тени (тёмная offset + светлая offset) вместо обычных drop shadow
- Единый фон `bgTertiary` для панелей (recessed), `neuSm/neuMd/neuLg` для raised элементов
- Создан `COMPONENTS.md` — полный аудит каждого компонента с Lumen-референсом

### Прогресс

#### Токены и примитивы
- [x] `tokens.ts` — добавлены neuSm, neuMd, neuLg, neuInset, neuInsetSm + dark variants
- [x] `Box.tsx` Button — Lumen nbtn: все variants (primary/secondary/ghost/danger) с neumorph shadow, hover flattens, press recesses
- [x] `Box.tsx` Input — Lumen ninput: bgTertiary + neuInsetSm, border: none
- [x] `Box.tsx` Card — Lumen ncard: neuMd, border: none, hover → neuLg
- [x] `Box.tsx` Badge — Lumen npill: neuInsetSm
- [x] `Box.tsx` Toggle/Switch — Lumen nswt: 46x26 track (neuInsetSm), 20x20 thumb (gradient when on)
- [x] `Forms.tsx` Select, NumberInput — Lumen ninput: neuInsetSm
- [x] `Forms.tsx` ColorPicker — neuInsetSm

#### Панели (recessed — neuInset)
- [x] `ToolPanel.tsx` — Lumen toolbar: bgTertiary + neuInset, кнопки neuSm/neuInsetSm, hover
- [x] `PropertiesPanel.tsx` — bgTertiary + neuInset, без border
- [x] `AIPanel.tsx` — bgTertiary + neuInset, Lumen segmented tabs
- [x] `Sidebar.tsx` — bgTertiary + neuInset, Lumen tree-view items с neuSm, кнопки neumorph

#### Плавающие карточки (raised — neuLg/neuMd)
- [x] `StylePanel.tsx` — neuLg
- [x] `PresencePanel.tsx` — neuMd
- [x] `SaveStatusBar.tsx` — neuSm
- [x] `OfflineBanner.tsx` — neuMd
- [x] `PWAInstallPrompt.tsx` — neuLg
- [x] `QuickCapture.tsx` — neuLg

#### Модальные окна (neuLg диалоги)
- [x] `CommandPalette.tsx` — Lumen palette: bgTertiary + neuLg, поиск neuInsetSm, активный item neuSm
- [x] `AIServerPanel.tsx` — neuLg, bgTertiary, border-radius 18
- [x] `AgentPanel.tsx` — neuLg диалог, neuMd карточки агентов

#### SVG
- [x] `TopicNode.tsx` — AI Expand Lumen-иконка (Zap, rect+gradient), токены
- [x] `RelationshipLine.tsx` — theme gradient
- [x] `MindMap.tsx` — context/canvas menu: neuMd, help: neuLg

### Осталось
- [x] `TaskList.tsx` — проверить/обновить
- [x] `Forms.tsx` Slider — Lumen neumorphic thumb (native range limitation)
- [x] Мелкие border-стили в MindMap.tsx (search input, textareas) при возможности

## Сессия: 2026-05-13 — Agent Store + Новая архитектура

### Контекст
- Создан `store/agent.ts` — Zustand store для управления агентами (fetch/create/delete/submit) с WebSocket-подпиской
- `AgentPanel`, `TaskList` переведены на store — убран локальный state + polling
- В `AgentCreateDialog` добавлены поля Provider/Model для per-agent конфигурации
- Пофикшены предупреждения: `enctype` в `share_target`, `key` prop в `ToolPanel`

### Выполнено
- [x] `store/agent.ts` — Zustand store: agents, tasks, fetchAgents, fetchTasks, createAgent, deleteAgent, submitTask, approveTask, rejectTask, subscribeToEvents
- [x] `AgentPanel.tsx` — переписан на useAgentStore, убран polling (3000ms interval → WS events)
- [x] `TaskList.tsx` — переписан на useAgentStore, убран локальный `load` callback
- [x] `AgentCreateDialog` — добавлены поля Provider/Model (опционально, per-agent)
- [x] `TaskList.test.tsx` — обновлён под store-архитектуру
- [x] `vite.config.ts` — добавлен `enctype: 'application/x-www-form-urlencoded'` в share_target
- [x] `ToolPanel.tsx` — добавлен `key` prop в `toolBtn()` (fix React warning)
- [x] `AGENTS.md` — обновлён: store/agent.ts, useAgentStore

### Векторы улучшения

#### V3.7 — Agent Ecosystem (P2)
- [ ] **Per-agent model UI** — выбор модели при создании агента (preset dropdown вместо ручного ввода)
- [ ] **Agent task submission** — UI кнопка "Submit Task" на AgentCard + диалог с параметрами
- [ ] **Agent streaming** — WebSocket стриминг мыслей/действий агента в реальном времени
- [ ] **Agent chaining** — передача результата одного агента другому
- [ ] **Agent schedule** — отложенные/периодические задачи (cron)

#### V3.8 — Export/Import (P2)
- [ ] **Export Markdown** — обратный экспорт mindmap в .md
- [ ] **Export FreeMind** — обратный экспорт в .mm
- [ ] **Import XMind v2** — поддержка новой версии .xmind формата
- [ ] **Export OPML** — для совместимости с другими mindmap-инструментами
- [ ] **Batch import** — массовый импорт нескольких файлов

#### V3.9 — AI и UX (P2)
- [ ] **AI Agent авто-действия** — агенты сами предлагают/выполняют действия без команды пользователя
- [ ] **Drag-and-drop file import** — перетаскивание .md/.mm/.xmind прямо на холст
- [ ] **Sticky notes / Canvas** — наклейки на холсте (независимо от дерева)
- [ ] **Mindmap presentation mode** — режим презентации: шаг за шагом по узлам
- [ ] **Infinite canvas minimap** — мини-карта для навигации по большому холсту

#### V4.0 — Performance & Native (P3)
- [ ] **Worker-based layout** — вынести расчёт layout в Web Worker (1000+ nodes)
- [ ] **Canvas/SVG hybrid** — Canvas для рендера (performance) + SVG overlay (интерактивность)
- [ ] **Virtual scrolling** — виртуализация для Presence, Agents, Sidebar
- [ ] **Lazy topic loading** — lazy loading глубоких поддеревьев
- [ ] **Tauri desktop** — нативное приложение с Tauri v2

---

## Сессия: 2026-05-14 — Документация V3.7 + Ollama

### Контекст
- Обновление roadmap, wiki, skills под V3.7 (Agent Chaining, Streaming, Task Submission)
- Ollama Auto-Detect реализован (P0 → DONE)
- Comments on Nodes реализованы
- Tauri desktop sidecar реализован

### Выполнено
- [x] AGENTS.md — обновлён: V3.7 фичи, Ollama, Tauri, векторный анализ
- [x] wiki/index.md — +Tauri, +Agent streaming, +Agent chaining, +Comments, +12 страница
- [x] wiki/07-improvements.md — roadmap updates, V3.7 done, V3.8 partial done
- [x] wiki/02-api-reference.md — добавлены Comments API endpoints
- [x] wiki/12-improvement-vectors.md — создан новый файл анализа
- [x] Skills: agent-system.md, collaboration.md, desktop-tauri.md — обновлены
- [x] PLANS.md — текущая сессия

### Заметки
- Skills: 20 → 26 файлов (добавлены lumen-neumorphism.md и др.)
- Wiki: 11 → 12 страниц
- Ollama Auto-Detect (P0) — выполнен, moved из priority matrix
- Per-agent model presets — реализован (GroupedSelect + GET /api/v1/ai/models)

---

## Сессия: 2026-05-14 — Production Windows Desktop + MASys Integration Roadmap

### Контекст
- Изучены все слои проекта: Gmind (Go + Tauri v2 + React), MASys (Node.js + 70+ модулей, React Flow)
- MASys — полноценная visual pipeline платформа, не skeleton. Фаза 0 (wiki) завершена, код активно разрабатывается
- В MASys уже есть `gmind-mindmap` v2.0.0 (11 операций), `agent-loop` (ReAct), `mcp-server` package, 70+ модулей
- Tauri: system tray ✅, Stronghold ✅, global shortcut ✅, sidecar ✅ — всё реализовано
- Основные production gaps: (1) пути данных SQLite/wiki используют relative paths, (2) sidecar binary name, (3) Stronghold не подключён к UI для хранения AI ключей

### Цели
1. Сохранить полный roadmap до production Windows release
2. Обновить все skills, wiki, docs с учётом MASys

### Выполнено
- [x] Глубокое изучение Gmind (130+ фич, Tauri v2, agent system)
- [x] Глубокое изучение MASys (wiki, 70+ модулей, gmind-mindmap, agent-loop, mcp-server)
- [x] Составлен production roadmap (4 фазы)
- [x] Обновлены PLANS.md, AGENTS.md, skills/, wiki/

---

## ROADMAP: Production Windows Desktop + MASys Integration

> Порядок реализации. Каждая фаза — независимый deployable milestone.

### Фаза 1: Gmind — Production Windows Desktop
**Цель:** собрать рабочий `.msi` инсталлятор для Windows

#### 1.1 — Fix Data Paths (КРИТИЧНО)
Go backend использует `./gmind.db`, `./wiki/` — ломается в packaged .exe.

- [x] `backend/internal/config/config.go` — `GMIND_DATA_DIR` env, fallback `os.UserConfigDir()/Gmind`; DB_PATH и WIKI_PATH строятся от dataDir
- [x] `frontend/src-tauri/src/lib.rs` — передать `GMIND_DATA_DIR = app.path().app_data_dir()?` перед `.spawn()` sidecar

#### 1.2 — Fix Sidecar Binary Name ✅ (было уже готово)
- [x] `build-sidecar.bat` — `gmind-server-x86_64-pc-windows-msvc.exe`
- [x] `tauri.conf.json` — `externalBin: ["binaries/gmind-server"]`

#### 1.3 — Stronghold → AI Keys
- [x] `AIServerPanel.tsx` — load secrets из Stronghold при открытии, save при apply (Yandex + OpenAI)
- [x] `App.tsx` — startup injection: читать секреты и вызывать `POST /api/v1/config`
- [x] `api/client.ts` — `applyConfig()` endpoint
- [x] `api/secrets.ts` — уже был полностью готов
- [x] `backend/internal/api/ai_handlers.go` — `POST /api/v1/config` (ApplyConfig handler)
- [x] `backend/internal/api/router.go` — зарегистрирован `/api/v1/config`

#### 1.4 — Backend Robustness
- [x] `backend/cmd/server/main.go` — graceful shutdown (`signal.Notify SIGTERM`) + port fallback (8080→8081+)
- [x] `backend/internal/api/router.go` — `GET /health` → `{status, db_ok, agents_count}`
- [x] `frontend/src-tauri/src/lib.rs` — poll `GET /health` (40x/500ms), показывать окно только когда backend ready

#### 1.5 — Installer Config
- [x] `tauri.conf.json` — `bundle.targets: ["nsis"]`, NSIS shortcuts (Desktop + StartMenu), `visible: false` на main window

---

### Фаза 2: Gmind → MASys ✅

#### 2.1 — Tool: run_masys_pipeline
- [x] `backend/internal/agent/tools.go` — tool `run_masys_pipeline(pipeline_id, inputs)` в ToolRegistry
- [x] `backend/internal/agent/executor.go` — `POST /trpc/runs.start` + poll `/trpc/runs.get`
- [x] `backend/internal/config/config.go` — `MASYS_BASE_URL` env (default: `http://localhost:3000`)
- [x] `backend/internal/agent/worker.go` — `SetMaSysBaseURL()` propagates to executor
- [x] `backend/cmd/server/main.go` — `wp.SetMaSysBaseURL(cfg.MASysBaseURL)`

#### 2.2 — MASys Pipelines в UI Gmind
- [x] `backend/internal/api/ai_handlers.go` — `GET /api/v1/masys/pipelines` (proxy to MASys tRPC)
- [x] `frontend/src/api/client.ts` — `listMasysPipelines()`
- [x] `frontend/src/store/agent.ts` — `masysPipelines` state + `fetchMasysPipelines()`
- [x] `frontend/src/components/AgentPanel/AgentPanel.tsx` — вкладка "MASys" с пайплайнами и Run

---

### Фаза 3: MASys → Gmind ✅

#### 3.1 — Верификация gmind-mindmap v2.0.0
- [x] Все 11 операций совпадают с текущим API Gmind (нет расхождений)

#### 3.2 — Новая операция: submit-agent-task
- [x] `E:\MASys\modules\gmind-mindmap\manifest.json` — операция `submit-agent-task` + inputs: agentId, action, taskParams; outputs: taskId
- [x] `E:\MASys\modules\gmind-mindmap\index.ts` — `POST /api/v1/agents/{agentId}/tasks`

#### 3.3 — Эталонный пайплайн
- [ ] Создать в MASys пайплайн: `pipeline-input → agent-loop(tools=[gmind-mindmap]) → logger`
- [ ] Документировать в `wiki/13-masys-integration.md`

---

### Фаза 4: Build & Release Pipeline ✅

- [x] `.github/workflows/build.yml` — job `build-windows`: Go sidecar + backend tests + tauri-action → `.msi` artifact + GitHub Release draft
- [x] `Makefile` — target `release`: `tauri-sidecar` → `cargo tauri build --target x86_64-pc-windows-msvc`
- [x] `tauri.conf.json` — `plugins.updater` endpoint (GitHub Releases)
- [ ] `E:\MASys\start-masys.bat` — проверить работу на Windows

---

### Заметки
- MASys использует Prisma + SQLite (не PostgreSQL как в wiki) — `apps/server/prisma/schema.prisma`
- MASys запускается через `pnpm dev` в `E:\MASys`, порт 3000 (Fastify) + Vite frontend
- Stronghold vault path в lib.rs хардкожен как `"secrets.hold"` — при релизе переместить в `app_data_dir`
- Port conflict: MASys по умолчанию :3000 для сервера, но llama-server тоже может быть на :8080

---

## Сессия: 2026-05-14 — Production Roadmap Full Implementation

### Цели
1. Реализовать все 4 фазы roadmap

### Выполнено
- [x] **1.1 Fix Data Paths** — `config.go` GMIND_DATA_DIR + UserConfigDir fallback; lib.rs передаёт app_data_dir sidecar'у
- [x] **1.2 Sidecar binary** — уже был готов (build-sidecar.bat + tauri.conf.json)
- [x] **1.3 Stronghold → AI Keys** — `AIServerPanel.tsx` load/save secrets; `App.tsx` startup injection; `POST /api/v1/config` endpoint
- [x] **1.4 Backend Robustness** — graceful shutdown (SIGTERM), port fallback (8080→8083), health polling в lib.rs (main window hidden до ready)
- [x] **1.5 Installer** — NSIS targets, shortcuts Desktop+StartMenu, tokio dep в Cargo.toml
- [x] **2.1 run_masys_pipeline tool** — tools.go + executor.go (tRPC start+poll) + config MASYS_BASE_URL + worker SetMaSysBaseURL
- [x] **2.2 MASys UI** — GET /api/v1/masys/pipelines proxy; listMasysPipelines в api/client; masysPipelines в store; MASys tab в AgentPanel
- [x] **3.1 gmind-mindmap verification** — все 11 операций корректны, расхождений нет
- [x] **3.2 submit-agent-task** — manifest.json + index.ts (agentId, action, taskParams → POST /api/v1/agents/{id}/tasks)
- [x] **4. CI/CD** — .github/workflows/build.yml (Go sidecar + tests + tauri-action + artifact); Makefile release target; auto-updater config

### Осталось (Фаза 3.3 + MASys start.bat)
- [ ] Эталонный пайплайн в MASys + wiki/13-masys-integration.md
- [ ] Проверить E:\MASys\start-masys.bat на Windows

---

## Сессия: 2026-05-15 — Agent Prompt UX + Desktop Tray Fix

### Цели
1. Per-agent system prompt: задавать/редактировать прямо в UI без перезапуска
2. Inline quick-prompt на AgentCard (без модала для простых задач)
3. Исправить tray: right-click → меню, left-click → toggle show/hide

### Выполнено
- [x] **Backend `AgentInfo.SystemPrompt`** — новое поле в `module.go`; ReAct loop (`react.go`) использует его вместо role prompt если задан
- [x] **API `system_prompt`** — `CreateAgent` + `UpdateAgent` в `api/module.go`; PATCH теперь не требует provider/model (можно патчить только prompt)
- [x] **Frontend types/api/store** — `system_prompt?` в `AgentInfo`, `AgentCreateRequest`; `updateAgent(id, provider?, model?, systemPrompt?)`
- [x] **AgentCard inline quick-prompt** — textarea + `→` кнопка; Enter to send; отправляет action=текст без модала
- [x] **AgentCard system prompt editor** — ⚙ toggle; inline textarea с Save/Reset; тег "custom prompt"
- [x] **AgentCreateDialog** — коллапсируемая секция `▶ Custom System Prompt`
- [x] **Tray right-click fix** — `on_tray_icon_event` фильтрует `MouseButton::Left`; правый клик → нативное меню через `.menu()`
- [x] **Tray toggle** — left-click = show/hide; menu "Show/Hide" = toggle
- [x] **Tray menu order** — Show/Hide → Quick Capture → separator → ✕ Quit
- [x] `go build ./...` — чистый
- [x] `tsc --noEmit` — чистый

---

## Сессия: 2026-05-15 — Port Range Migration + External Model Servers

### Цели
1. Перевести все Gmind-сервисы на диапазон портов 1010–1200 (разрешение конфликтов с другими приложениями)
2. Добавить JSON-конфиг и UI для внешних model-серверов (LM Studio, Jan, llama.cpp и др.)
3. Сохранить таблицу портов в памяти Claude

### Таблица портов (зафиксирована)

| Сервис | Порт |
|--------|------|
| Gmind backend API | 1010 |
| Vite dev server | 1011 |
| Docker frontend nginx | 1012 |
| llama.cpp (default) | 1100 |
| Ollama | 11434 (стандарт) |
| MASys | 3000 (внешний) |

### Выполнено
- [x] **Port migration** — vite.config.ts: 5173→1011; docker-compose: 5173:80→1012:80; tauri.conf.json devUrl→1011
- [x] **llama.cpp default port** — `llama/server.go` + `ai_handlers.go`: 8081→1100
- [x] **CORS defaults** — config.go + docker-compose: localhost:1011, localhost:1012
- [x] **model_servers package** — `backend/internal/model_servers/model_servers.go`: Load/Save/Default (defaults: llama.cpp:1100, LM Studio:1234, Jan:1337)
- [x] **API endpoints** — GET/PUT `/api/v1/model-servers` (router.go + api/model_servers.go)
- [x] **Config** — `config.go`: `ModelServersConfigPath`, env `MODEL_SERVERS_CONFIG`
- [x] **Frontend API** — `frontend/src/api/modelServers.ts`
- [x] **AIServerPanel UI** — новая секция «External Model Servers»: таблица серверов, Add/Edit/Delete/Use кнопки
- [x] **Memory** — `project_ports.md` с таблицей + MEMORY.md

---

## Сессия: 2026-05-14 — Desktop Dev Mode: Rust + Stronghold Fix

### Цели
1. Запустить `cargo tauri dev` — устранить все ошибки компиляции и runtime

### Выполнено
- [x] **tauri.conf.json** — исправлена структура NSIS: `bundle.windows.nsis` (а не `bundle.nsis`), удалены невалидные поля `displayLanguageSelector`, `shortcutsDefaultInstall`
- [x] **lib.rs — Stronghold API 2.3.1** — `Client`/`Stronghold` приватны → убраны Rust-команды `store_secret`/`get_secret`/`remove_secret`; stronghold плагин инициализируется в `setup()` через `app.handle().plugin(Builder::with_argon2(&salt_path).build())`
- [x] **lib.rs — Tray API** — `on_tray_event` → `on_tray_icon_event`; `TrayEvent::Click` → `tray::TrayIconEvent::Click`; callback arg `tray.app_handle()` вместо `app`
- [x] **lib.rs — borrow fix** — `main_win.clone().on_window_event(...)`
- [x] **lib.rs — hotkey re-registration** — `unregister` перед `on_shortcut` (не паникует при повторном запуске)
- [x] **secrets.ts** — полная миграция на JS API `@tauri-apps/plugin-stronghold`: `Stronghold.load()`, `client.getStore()`, `store.insert/get/remove`
- [x] **cargo-tauri установлен** — `cargo install tauri-cli --version "^2"`
- [x] **Desktop запускается** ✅

### Заметки
- `with_argon2` принимает `&Path` к salt-файлу (`app_local_data_dir/gmind.salt`), не строку
- `.build()` возвращает `TauriPlugin` напрямую (без `Result`)
- При повторных `cargo tauri dev` убивать старые процессы: `taskkill /F /IM gmind.exe`

---

## Сессия: 2026-05-14 — Agent Bugfix: рабочие агенты

### Цели
1. Найти и исправить баги, из-за которых агентная система не работала end-to-end

### Найденные баги
- **Критично**: `frontend/src/api/agent.ts` — все task-эндпоинты вызывали `/api/v1/tasks/*` вместо `/api/v1/agents/tasks/*` → все задачи возвращали 404
- **Критично**: `TaskLogPanel.tsx` — SSE stream и logs fetch использовали `/api/v1/tasks/{id}/...` вместо `/api/v1/agents/tasks/{id}/...`
- **Важно**: `worker.go:tryProcessTask` — всегда использовался глобальный `wp.model`, per-agent модель игнорировалась при выполнении
- **Важно**: `react.go:RunTask` — после завершения/падения задачи `agentInfo.Status` не сбрасывался в `idle` → агент навсегда застревал в `working`
- **Минор**: `sse.go:GetTaskLogs` — race condition: читал `b.messages` без `b.mu.RLock()`, использовал глобальный `brokerMu` вместо broker-level lock

### Выполнено
- [x] `frontend/src/api/agent.ts` — `listTasks`, `getTask`, `approveTask`, `rejectTask` → `/api/v1/agents/tasks/*`
- [x] `frontend/src/components/TaskList/TaskLogPanel.tsx` — SSE paths исправлены на `/api/v1/agents/tasks/${taskId}/...`
- [x] `backend/internal/agent/worker.go` — `tryProcessTask` и `SubmitScheduled`: используют `agentInfo.Model` если установлен
- [x] `backend/internal/agent/react.go` — `RunTask`: `agentInfo.Status = StatusIdle` после complete/fail
- [x] `backend/internal/api/sse.go` — `GetTaskLogs`: читает `b.messages` через `b.mu.RLock()` (корректный lock)
- [x] `go build ./...` — чистый, ошибок нет
- [x] `tsc --noEmit` — чистый, ошибок нет

---

## Сессия: 2026-05-14 — Lumen UI Desktop: узлы, скролл, агентные окна

### Цели
1. Lumen-стиль узлов mindmap (градиент по умолчанию, Lumen-бейджи, SVG glow)
2. Прокрутка левого (Sidebar) и правого (AgentPanel) баров
3. Lumen-стилизация всех агентных окон

### Выполнено
- [x] `TopicNode.tsx` — дефолтный стиль узлов `gradient` вместо `solid`; selected использует `selectedGradient`; indicator badges (comments/notes/hyperlink) получили accent/purple подсветку вместо plain bgTertiary; child count badge — accent circle с white текстом
- [x] `Sidebar.tsx` — `overflow: hidden` на контейнере (вместо overflowY:auto), `flexShrink:0` на header-actions и toggle div → внутренний список с `flex:1,overflow:auto` теперь скроллит корректно
- [x] `AgentPanel.tsx` — контейнер `bgTertiary + boxShadow` (panel right shadow, no border), `overflow: hidden`, header `flexShrink:0`; AgentCreateDialog: `colors.scrim` + `backdropFilter blur(8)`, `bgTertiary + neuLg`, role buttons нейморфные (neuSm→neuInsetSm), select инсет
- [x] `TaskSubmitDialog.tsx` — `colors.scrim + blur`, `bgTertiary + radii.xl + neuLg`, action buttons нейморф; textarea/select/input через `inputStyle` (neuInsetSm, bgTertiary, no border)
- [x] `TaskLogPanel.tsx` — `colors.scrim + blur`, `bgTertiary + radii.xl`, header с border-bottom; close button нейморфный; log area neuInset вместо neuInsetSm
- [x] `MindMap.tsx` — SVG фильтры: `topic-shadow` двойное accent-свечение (glow + lift); `shadow-soft` теперь с лёгким accent tint

---

## Сессия: 2026-05-14 — V3.8 Agent UI Enhancement Roadmap

### Контекст
- Проведён аудит AgentPanel, AgentCreateDialog, AgentCard, TaskSubmitDialog
- Выявлены ключевые pain points: нет ручного ввода модели, нет Stop, actions не фильтруются по роли
- Составлен пошаговый roadmap V3.8 (5 фаз), обновлены wiki/skills/memory

### Векторы (выявлены)
1. Нет ручного ввода model ID → если нет пресета, падает в `gpt-4o`
2. AgentCard не имеет Stop-кнопки при `status === 'working'`
3. `TASK_ACTIONS` захардкожены, не зависят от роли агента
4. Провайдер выбирается косвенно (через модель), нет явного select
5. Нет Duplicate Agent, Stop All, drag-to-reorder

### Выполнено
- [x] Аудит AgentPanel/AgentCard/TaskSubmitDialog/TaskSubmitDialog
- [x] Roadmap V3.8 (5 фаз, 14 шагов) записан в PLANS.md
- [x] AGENTS.md обновлён: секция V3.8
- [x] wiki/07-improvements.md обновлён: V3.8 раздел
- [x] skills/agent-system.md обновлён: roadmap + паттерны
- [x] memory/project_gmind_stack.md обновлён

---

## ROADMAP V3.8 — Agent UI Enhancement

> Пошаговая реализация. Каждый шаг — независимый, deployable PR.

### Фаза 1: Agent Creation — полный контроль над моделью и провайдером

#### 1.1 — Two-level model selector ✅
- [x] `AgentCreateDialog`: `providerSelect` → filtered `modelSelect` + "✎ Enter manually" toggle на `<input>`
- [x] Опциональное поле `name` → передаётся в `AgentCreateRequest`
- [x] Backend: `Name string` в `AgentInfo` и `CreateAgent` handler
- [x] Вариант "Custom endpoint…" в providerSelect → поле `customBaseURL`

---

### Фаза 2: AgentCard — расширенные inline контролы

#### 2.1 — Stop button ✅
- [x] `AgentCard`: кнопка "■ Stop" вместо delete-кнопки при `status === 'working'`
- [x] `POST /api/v1/agents/{id}/stop` → `StopAgent` handler: `ag.Status = StatusIdle` + `StartWorker` restart
- [x] `api/agent.ts`: `stopAgent(id)`
- [x] `store/agent.ts`: `stopAgent` action + optimistic status update

#### 2.2 — Manual model input toggle ✅
- [x] Кнопка "✎" рядом с model select → `manualModel` state переключает `<select>` → `<input>`
- [x] `onBlur` / Enter → `onUpdateModel(agent.id, value)`

#### 2.3 — Agent name display + last task snippet ✅
- [x] `AgentInfo.name?: string` в `types/agent.ts`
- [x] `AgentCard` header: `agent.name || role.label + ' #' + id.slice(-4)`
- [x] Под "Submit Task": строка последней задачи `✓ done` / `✗ failed` + truncated action

---

### Фаза 3: TaskSubmitDialog — контекстные actions

#### 3.1 — Фильтрация actions по роли ✅
- [x] `ROLE_ACTIONS: Record<string, string[]>` в `types/agent.ts`
- [x] `TaskSubmitDialog`: получает `roleId` вместо label; показывает primary actions по роли
- [x] Кнопка "+ Show all" разворачивает полный список

#### 3.2 — Natural language prompt ✅
- [x] Toggle Simple / JSON над params
- [x] Simple: textarea "Describe what the agent should do…" → `{ query: text }`
- [x] Default: Simple mode

#### 3.3 — Params schema hint ✅
- [x] `ACTION_SCHEMAS: Record<string, string>` в `types/agent.ts`
- [x] В JSON mode: `hint` под textarea + кнопка "Use example"

---

### Фаза 4: Provider-aware controls

#### 4.1 — Явный provider select в AgentCard
**Цель:** разделить "provider" и "model" на два отдельных контрола в AgentCard.

Файлы:
- `AgentCard` в `AgentPanel.tsx`

Изменения:
- [ ] Добавить `providerSelect` (compact, над `modelSelect`)
- [ ] При смене провайдера → обновлять список моделей + вызывать `updateAgent(id, newProvider, models[0])`
- [ ] Если `provider === 'custom'` — показать кнопку "⚙ Configure" → inline form (baseURL + key)

#### 4.2 — Per-agent custom endpoint через Stronghold
**Цель:** custom API key/URL хранятся в Stronghold, не передаются в plaintext.

Файлы:
- `frontend/src/api/secrets.ts`
- `AgentCard` / `AgentCreateDialog`

Изменения:
- [ ] Ключ `agent-{id}-key` в Stronghold при сохранении custom key
- [ ] При `updateAgent` — передавать только `custom_base_url`, ключ читается backend'ом из secrets напрямую

---

### Фаза 5: Bulk & UX polishing

#### 5.1 — Duplicate Agent
- [ ] Кнопка "⧉" на AgentCard → `createAgent({ role: agent.role, provider: agent.provider, model: agent.model })`

#### 5.2 — Stop All
- [ ] Кнопка "Stop All" в хедере AgentPanel при наличии working агентов
- [ ] `POST /api/v1/agents/stop-all` → iterate registry, interrupt all

#### 5.3 — Drag-to-reorder agents
- [ ] `DragEvent` на AgentCard containers, обновление order в store
- [ ] Порядок persist в localStorage (не нужен API)

#### 5.4 — Agent presets / templates
- [ ] "Save as template" в AgentCard (localStorage: `agentTemplates[]`)
- [ ] "Load template" в AgentCreateDialog

---

### Приоритеты реализации

| Фаза | Шаг | Приоритет | Сложность | Ценность |
|------|-----|-----------|-----------|----------|
| 1 | 1.1 Two-level model selector | P0 | Низкая | Очень высокая |
| 2 | 2.1 Stop button | P0 | Низкая | Очень высокая |
| 2 | 2.2 Manual model input | P0 | Низкая | Высокая |
| 3 | 3.1 Role-filtered actions | P1 | Низкая | Высокая |
| 3 | 3.2 Natural language prompt | P1 | Низкая | Высокая |
| 1 | 1.2 Custom provider | P1 | Средняя | Высокая |
| 2 | 2.3 Name + last task | P1 | Низкая | Средняя |
| 3 | 3.3 Params hint | P2 | Низкая | Средняя |
| 4 | 4.1 Explicit provider select | P2 | Средняя | Средняя |
| 4 | 4.2 Stronghold per-agent key | P2 | Высокая | Средняя |
| 5 | 5.1 Duplicate | P3 | Низкая | Низкая |
| 5 | 5.2 Stop All | P3 | Низкая | Низкая |
| 5 | 5.3 Drag-to-reorder | P3 | Средняя | Низкая |
| 5 | 5.4 Agent templates | P3 | Средняя | Низкая |

**Следующий спринт:** Фазы 1.1 + 2.1 + 2.2 + 3.1 + 3.2 — всё frontend-only, без бэкенда (кроме 1.1 Name + 2.1 Stop endpoint).

---

---

## Сессия: 2026-05-14 — Desktop Startup Speed + Scroll + SettingsModal (V3.9)

### Цели
1. Ускорить запуск десктопа: убрать 500ms sleep, ранний TCP-listener, splash screen
2. Добавить скролл во все переполняющиеся панели
3. Реализовать SettingsModal: autostart, startup agents, настраиваемый шорткат

### Выполнено (startup optimization)
- [x] `main.go` — ранний TCP-listener до полной init: `atomicRouter` + `earlyHandler` возвращает 503 до ready, затем подменяем на полный router
- [x] `lib.rs` — убран health-poll (500ms sleep + 40 итераций); окно `visible:true` сразу
- [x] `tauri.conf.json` — `"visible": true` для main window
- [x] `App.tsx` — `SplashScreen` компонент; `isTauri` detection; поллинг `/health` каждые 150ms; secrets inject после `backendReady`; `Promise.all` для параллельной загрузки secrets

### Выполнено (V3.9)
- [x] `lumen.css` — глобальный скроллбар (4px, индиго), `.lumen-scroll` утилита
- [x] `AgentPanel.tsx`, `AIPanel.tsx`, `StylePanel.tsx` — `minHeight: 0` на scroll-контейнерах
- [x] `Cargo.toml` — `tauri-plugin-autostart = "2"`, `tauri-plugin-store = "2"` (убран tokio)
- [x] `lib.rs` — регистрация autostart+store плагинов, `--minimized` флаг, `parse_shortcut()`, команды: `enable_autostart`, `disable_autostart`, `is_autostart_enabled`, `update_main_shortcut`; дефолтный шорткат Ctrl+Shift+G для главного окна
- [x] `capabilities/default.json` — `autostart:default`, `store:default`
- [x] `frontend/src/api/settings.ts` — `StartupSettings` интерфейс, `settingsApi` (load/save/patch + Tauri-команды)
- [x] `package.json` — `@tauri-apps/plugin-autostart`, `@tauri-apps/plugin-store`
- [x] `SettingsModal.tsx` — 3 секции: Запуск / Агенты при старте / Горячие клавиши; ShortcutInput (record mode); scroll-ready
- [x] `App.tsx` — кнопка ⚙ в header, `SettingsModal` монтирование, startup agents useEffect
- [x] `go build`, `tsc --noEmit` — оба чистые

---

## ROADMAP V3.9 — Desktop Settings & Startup

### Шаг 1: Скролл во всех панелях

Паттерн (flex-контейнер):
```css
/* Родитель */
overflow: hidden

/* Скроллируемый ребёнок */
flex: 1; min-height: 0; overflow-y: auto
```

Целевые компоненты:
- `Sidebar.tsx` — список воркбуков
- `AgentPanel.tsx` — список агентов
- `TaskList.tsx` — список задач
- `StylePanel.tsx` — секции стилей
- `AIPanel.tsx` — история чата
- `SettingsModal.tsx` — сама модалка (при создании)

Глобальный скроллбар в `index.css`:
```css
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(91,108,255,.25); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgba(91,108,255,.45); }
```

### Шаг 2: Rust-инфраструктура

```toml
tauri-plugin-autostart = "2"
tauri-plugin-store = "2"
```

lib.rs изменения:
- Регистрация обоих плагинов в `setup()`
- Проверка `--minimized` arg → если есть, не вызывать `w.show()` в startup
- Tauri-команды: `enable_autostart()`, `disable_autostart()`, `is_autostart_enabled()`
- Tauri-команда: `update_main_shortcut(shortcut: String)` — unregister + register

### Шаг 3: Settings API (Frontend)

```ts
// frontend/src/api/settings.ts
interface StartupSettings {
  autostart: boolean
  startMinimized: boolean
  startupAgentIds: string[]
  mainWindowShortcut: string  // default: "ctrl+shift+g"
}
```

### Шаг 4: SettingsModal UI

Три секции:
1. **Запуск** — toggle Автозапуск + toggle Свёрнутым (disabled если autostart off)
2. **Агенты при запуске** — чеклист из `GET /api/v1/agents`
3. **Горячие клавиши** — capture-input для главного окна; read-only строка Ctrl+Shift+Space

### Шаг 5: Startup agents + global shortcut

App.tsx после `backendReady`:
```ts
const { startupAgentIds } = await loadSettings()
for (const id of startupAgentIds) {
  await agentApi.submitTask(id, { action: 'analyze', input: '__startup__', ... })
}
```

lib.rs — второй глобальный шорткат (Ctrl+Shift+G или из settings):
```rust
// register shortcut → toggle main window show/hide
```

---

## Сессия: 2026-05-15 — Agent Tools + MASys /agents Page

### Цели
1. Добавить недостающие agent tools: delete_topic, move_topic, list_topics, delegate_to_agent
2. Добавить модуль `gmind-agent` в MASys (polling-based)
3. Создать tRPC роутер `gmindAgents` в MASys
4. Создать страницу `/agents` в MASys web app

### Блок 1 — Gmind backend (DONE)

- [x] `model/sheet.go` — `FindTopicParent(topicID) *Topic`, `RemoveTopic(topicID) bool` + helpers
- [x] `agent/tools.go` — 4 новых tool в ToolRegistry:
  - `delete_topic` (mindmap, non-idempotent)
  - `move_topic` (mindmap, non-idempotent)
  - `list_topics` (mindmap, idempotent) — плоский список с id/title/depth/parent_id
  - `delegate_to_agent` (agent, non-idempotent) — sync delegation: submit + 500ms poll × 240 (2 min)
- [x] `agent/tools.go` — `GetToolsForRole`: researcher/organizer/analyst добавлена категория `"agent"`
- [x] `agent/module.go` — `Manager.GetTask(id string) (*Task, error)` — публичный геттер для poll
- [x] `agent/executor.go` — поле `manager *Manager` + `SetManager(m *Manager)`
- [x] `agent/executor.go` — `getCallbacks()` → `getCallbacks(task *Task)` (task нужен для delegate_to_agent)
- [x] `agent/executor.go` — 4 новых функции: `deleteTopic`, `moveTopic`, `listTopics`, `delegateToAgent`
- [x] `agent/executor.go` — `topicFlatItem` struct + `flattenTopicTree` helper
- [x] `agent/react.go` — вызов `executor.getCallbacks(task)` (была `getCallbacks()`)
- [x] `agent/worker.go` — `exec.SetManager(manager)` после `NewToolExecutor(…)`
- [x] `agent/agent_test.go` — фикс теста: `getCallbacks()` → `getCallbacks(dummyTask)`
- [x] `go build ./...` — чистый
- [x] `go test ./internal/agent/... ./internal/model/...` — OK

### Блок 2 — MASys gmind-agent module (DONE)

- [x] `E:\MASys\modules\gmind-agent\manifest.json` — inputs: action, params, workbookId, sheetId; config: agentId, baseUrl, timeoutMs, pollIntervalMs
- [x] `E:\MASys\modules\gmind-agent\index.ts` — `POST .../tasks` → poll 1s intervals → success/fail/timeout + AbortController
- [x] `E:\MASys\modules\gmind-agent\package.json` — `@masys/module-gmind-agent`
- [x] `E:\MASys\apps\server\src\runtime\moduleLoader.ts` — import + `moduleRegistry.register(gmindAgentModule)`

### Блок 3 — MASys /agents страница (DONE)

- [x] `E:\MASys\apps\server\src\router\gmindAgents.ts` — tRPC роутер:
  - `list`, `create`, `update`, `delete`, `stop`
  - `listTasks(agentId?)`, `submitTask`, `getTask`, `getTaskLogs`
  - `getBaseUrl()` — возвращает secret `gmind-base-url` (default `http://localhost:1010`)
- [x] `E:\MASys\apps\server\src\router\index.ts` — добавлен `gmindAgents: gmindAgentsRouter`
- [x] `E:\MASys\apps\web\src\pages\AgentsPage.tsx` — полная страница:
  - `AgentCard` с quick-prompt input, stop, delete, system prompt editor
  - `CreateAgentModal` — role selector, name, provider, model, custom prompt
  - `TaskLogDrawer` — SSE direct connection к Gmind, structured log lines
  - Polling: `refetchInterval: 5000`, connection status
- [x] `E:\MASys\apps\web\src\App.tsx` — маршрут `/agents`
- [x] `E:\MASys\apps\web\src\pages\DashboardPage.tsx` — кнопка «Агенты» в навигации
- [x] TypeScript: обе стороны (server + web) компилируются без ошибок

### Заметки
- Gmind baseUrl в MASys берётся из secret `gmind-base-url` (через `prisma.secret.findUnique`)
- `delegate_to_agent`: guard `args.AgentID == callerTask.AgentID` → error "cannot delegate to self"
- SSE logs в TaskLogDrawer: прямой `EventSource` к Gmind (не через MASys tRPC) — нет задержки WS прокси
- `getCallbacks(task)` — task нужен именно делегирующей функции для передачи caller context

---

---

## Сессия: 2026-05-16 — Модульная платформа V4.0

### Цели
1. Рефакторинг монолитного App.tsx → модульная архитектура с Nav Rail
2. Notes Module — быстрое сохранение мыслей (SQLite + REST + UI)
3. MaSys выделен из AgentPanel в отдельный модуль
4. Extensible Tool Registry — RegisterTool + RegisterCallback для плагинов
5. Обновить всю документацию (AGENTS.md, PLANS.md, wiki, memory)

### Выполнено

#### Фаза 0 — Типы и структура
- [x] `frontend/src/modules/types.ts` — AppModule, ModulePanelProps, ModuleContext, ModuleCommand, ModuleAgentTool interfaces
- [x] `frontend/src/store/shell.ts` — useShellStore: activeModuleId, toggleModule, closeModule, setActiveModule
- [x] `frontend/src/modules/registry.ts` — MODULE_REGISTRY (5 модулей) + getModule(id)

#### Фаза 1 — App Shell + Nav Rail
- [x] `frontend/src/components/NavRail/NavRail.tsx` — 48px Activity Bar: иконки, tooltip, активный accent, Settings внизу
- [x] `frontend/src/modules/mindmap/module.ts` — home module (canvas, order:0, не открывает панель)
- [x] `frontend/src/modules/notes/module.ts` — NotesPanel, order:1, Ctrl+Shift+N shortcut, save_note/search_notes tools
- [x] `frontend/src/modules/agent-sandbox/module.ts` — AgentPanel, order:2
- [x] `frontend/src/modules/masys/module.ts` — MaSysPanel, order:3
- [x] `frontend/src/modules/ai/module.ts` — AIPanel, order:4
- [x] `frontend/src/App.tsx` — убраны showAIPanel/showAgentPanel, добавлен NavRail + useShellStore; CommandPalette агрегирует команды всех модулей через `MODULE_REGISTRY.flatMap`

#### Фаза 2 — Notes Module
- [x] `backend/migrations/006_notes.up.sql` + `006_notes.down.sql` — таблица notes (id, content, tags JSON, source, workbook_id, topic_id, pinned, timestamps)
- [x] `backend/internal/store/notes.go` — NoteStore: Create, List(query), Get, Update, Delete
- [x] `backend/internal/api/notes.go` — ListNotes, CreateNote, UpdateNote, DeleteNote handlers
- [x] `backend/internal/api/router.go` — добавлен /api/v1/notes маршрут
- [x] `frontend/src/api/notes.ts` — notesApi (list, create, update, delete) с типом Note
- [x] `frontend/src/store/notes.ts` — useNotesStore: notes[], loading, fetchNotes, createNote, updateNote, deleteNote, setSearchQuery
- [x] `frontend/src/components/NotesPanel/NotesPanel.tsx` — header + quick textarea + поиск + note cards (tags chips, pin, delete)

#### Фаза 3 — MaSys выделение
- [x] `frontend/src/components/MaSysPanel/MaSysPanel.tsx` — содержимое из AgentPanel MaSysPipelinesTab
- [x] `frontend/src/components/AgentPanel/AgentPanel.tsx` — удалён masys tab, workbookId: string | null
- [x] `frontend/src/components/AIPanel/AIPanel.tsx` — workbookId: string | null

#### Фаза 5 — Extensible Tool Registry
- [x] `backend/internal/agent/tools.go` — RegisterTool() + GetRegistry() + sync.RWMutex; init() инициализирует toolRegistry; добавлены save_note + search_notes tools; GetToolsForRole обновлён для "notes" категории
- [x] `backend/internal/agent/executor.go` — RegisterCallback(name, fn) + extraCallbacks map; saveNote + searchNotes методы

### TypeScript ошибки и фиксы
- `LazyExoticComponent` не assignable к `ComponentType<ModulePanelProps>` — фикс: `workbookId: string | null` в AgentPanel/AIPanel + `?? ''` фолбэки
- `React.ComponentType` undefined — фикс: `import type { ReactNode, ComponentType } from 'react'`

### Заметки
- Layout: `[NavRail 48px][Sidebar 260px][Canvas flex:1][Module Panel 360px slide-in]`
- MindMap module (order:0) не открывает панель — NavRail клик на него закрывает активный модуль (`closeModule()`)
- Все панели принимают `ModulePanelProps` — единый интерфейс для slide-in панелей справа
- Notes используют SQLite (атомарные, timestamped, tagged) — в отличие от Wiki (файловые .md)
- Pre-existing api test failure в `internal/api/workbook_test.go` — не наши изменения (New() args count mismatch из ScheduledTaskStore)

---

## Формат записи сессии

```markdown
## Сессия: YYYY-MM-DD — Описание

### Цели
1. ...

### Выполнено
- [x] ...

### Заметки
- ...
```
