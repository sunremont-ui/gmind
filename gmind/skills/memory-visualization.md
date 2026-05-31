# Skill: Memory & Pipeline Visualization — Gmind V6.0

> Gmind как visual workbench для агентской памяти и пайплайнов. Базируется на исследованиях D:\karp (теория) и реализации E:\MASys (engine).

## Контекст исходных систем

### D:\karp — теория памяти (исследование)

**6-слойная модель памяти** (расширение классической 4-слойной):
1. **Working memory** — контекстное окно LLM (4k–2M токенов)
2. **Episodic memory** — хронология действий, ошибок, уроков
3. **Semantic memory** — факты, концепции, отношения (RAG/KG)
4. **Procedural memory** — навыки, SOP, action graphs
5. **Artifact memory** — артефакты, diff, тесты, реализация
6. **Meta-memory** — политики, ADR, метрики, routing decisions

**Dual-lane маппинг** (fast/slow):
- Fast: `captured → proposed → draft` (сырые эпизоды, кандидаты)
- Slow: `reviewed → canonical → archived` (проверенные факты, ADR)

**Memory Controller** — паттерн управления:
- Recall routing (intent → layer selection → k_retrieve ≫ k_context → dedup → rerank)
- Write routing (salience-gate → extraction → type classification → layer dispatch)
- Consolidation (фоновый flush, compression, reflection, lint/decay)
- 3 режима: self-managed / external controller / **hybrid** (рекомендуется)

**Спроектированные UI screens (есть в wiki, нет в коде)**:
- Layer Map — 6 слоёв как карточки с health
- Episode Timeline — хронология действий
- Context Budget — token allocation, evicted, sandwich preview
- Salience Queue — pending writes review
- Record Inspector — provenance, versions, conflicts
- Trace Drawer — spans LLM/tool calls
- Knowledge Graph — entity-relations canvas
- Artifact Lineage — code → ADR → memory chain

### E:\MASys — реализация (engine)

**Prisma таблицы памяти:**
- `ConversationSession` / `ConversationMessage` — диалог × 6 алгоритмов сжатия
- `Episode` — действия агента (input/output JSON, tags, status)
- `WikiPage` — иерархическая KB в markdown
- `ResultArtifact` — артефакты с TTL
- `MemoryEntity` — NER-сущности (person/place/org/concept) с attributes
- `VectorEntry` — embeddings + cosine search
- `Skill` — процедурная память (trigger/body/successRate)
- `MemoryDecision` — лог решений controller
- `MemoryPendingWrite` — salience queue

**Memory модули (13+):**
- `memory-controller` — единый мозг (recall/remember/consolidate)
- `memory-retriever` — unify search по 6 источникам
- `knowledge-graph` — entity-relations граф
- `entity-memory` — NER tracking
- `episode-memory` — chronological log
- `wiki-memory` — markdown KB
- `conversation-memory` — 6 алгоритмов сжатия
- `result-store` — artifact registry
- `vector-store` — embeddings
- `skill-library` — procedural search
- `context-assembly` — token budget packing
- `memory-decay` — TTL cleanup
- `memory-export` — JSON/MD dump

**Web pages MASys (15):**
- EditorPage (React Flow pipeline)
- DashboardPage
- **MemoryPage с 8 tabs** (Controller, Context, Skills, Metrics, Conversations, Episodes, Wiki, Results) — UI минималистичный
- AgentsPage, WorkspaceMap, BridgesPage, ServersPage

**API hooks для UI:**
- tRPC: `memory.recall/remember/consolidate/search`
- tRPC: `runs.get/list/cancel/abort`
- WS: `ws://localhost:3001/ws?runId=<id>` — live pipeline events
- REST: `POST /webhooks/:webhookId`
- gmindAgents router — bridge к Gmind

### Гэпы (что нужно от Gmind)

| Что есть в MASys | Что отсутствует / минимально |
|------------------|------------------------------|
| Knowledge graph (entity-relations) в БД | Visual canvas для KG |
| Episode log в БД | Timeline/Flow view |
| Skill library (таблица) | Tree/dependency graph |
| Run trace через RunSpan | Связь spans ↔ memory recalls |
| WS live events | Memory live updates |
| Memory-export → JSON | Memory → Gmind mindmap |

## Архитектура Gmind как visual workbench

```
┌────────────────────────────────────────────────────────────────┐
│                    Gmind V6.0 UI Layer                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  NavRail (existing 5 modules) +                           │  │
│  │  ├── 📊 Memory Workbench (NEW)                           │  │
│  │  │   ├── Layer Map                                       │  │
│  │  │   ├── Knowledge Graph (uses V5.0 RelationshipStore)   │  │
│  │  │   ├── Episode Timeline                                │  │
│  │  │   ├── Context Budget                                  │  │
│  │  │   ├── Salience Queue                                  │  │
│  │  │   ├── Skill Evolution Tree                            │  │
│  │  │   └── Record Inspector                                │  │
│  │  ├── 🔄 Pipeline Workbench (NEW)                         │  │
│  │  │   ├── Pipeline Trace Map (timeline + nodes)           │  │
│  │  │   ├── Run Compare (A/B diffs)                         │  │
│  │  │   └── Workspace Map (agent composition)               │  │
│  │  └── 📈 Analytics (NEW, V6.1)                            │  │
│  │      └── Attention Heatmap, Health Dashboard             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↑↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Gmind Backend (Go) — proxy + cache + transform      │  │
│  │  /api/v1/masys/memory/*  → tRPC memory.*                 │  │
│  │  /api/v1/masys/runs/*    → tRPC runs.*                   │  │
│  │  /api/v1/masys/skills/*  → tRPC workspaces.skills        │  │
│  │  /api/v1/masys/kg/*      → tRPC knowledge-graph          │  │
│  │  SSE bridge: /api/v1/masys/runs/{id}/stream              │  │
│  │  WS bridge: /api/v1/masys/memory/stream                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              ↑↓ HTTP/WS
┌────────────────────────────────────────────────────────────────┐
│                    MASys Backend (:3000/3001)                   │
│  tRPC routers · WebSocket · Memory Controller · 13+ modules    │
│  Prisma: Pipeline, Run, Episode, MemoryEntity, Skill, ...      │
└────────────────────────────────────────────────────────────────┘
```

## V6.0 Roadmap — 7 фаз

### Phase 1 — MASys Bridge & Types (~1 день)

**Backend:**
- `backend/internal/api/masys_memory.go` — REST proxy к MASys tRPC
- Endpoints:
  ```
  GET  /api/v1/masys/memory/episodes?namespace=...&limit=...
  GET  /api/v1/masys/memory/entities?namespace=...
  GET  /api/v1/masys/memory/skills?namespace=...
  GET  /api/v1/masys/memory/conversations?namespace=...
  GET  /api/v1/masys/memory/wiki?namespace=...
  GET  /api/v1/masys/memory/results?namespace=...
  GET  /api/v1/masys/memory/decisions?namespace=...
  GET  /api/v1/masys/memory/pending?namespace=...
  POST /api/v1/masys/memory/recall?namespace=...
  GET  /api/v1/masys/runs/{runId}/stream  ← SSE bridge
  ```
- TypeScript types: `frontend/src/types/masys.ts`

**Frontend:**
- API client `frontend/src/api/masys.ts` — все proxy эндпоинты
- Zustand store `frontend/src/store/masysMemory.ts`

### Phase 2 — Memory Layer Map (~1 день)

**Компонент:** `frontend/src/components/MemoryWorkbench/LayerMap.tsx`

6 карточек, по одной на слой:
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Working Memory   │ │ Episodic         │ │ Semantic         │
│ ▓▓▓▓░░░░ 50%     │ │ 142 episodes     │ │ 38 entities      │
│ 4128/8192 tokens │ │ ⚠ 3 conflicts    │ │ ⚠ 5 stale        │
│ [drill-down]     │ │ [drill-down]     │ │ [drill-down]     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Procedural       │ │ Artifact         │ │ Meta             │
│ 12 skills        │ │ 47 artifacts     │ │ 8 ADRs           │
│ ✓ healthy        │ │ ⏰ 3 expiring    │ │ ✓ healthy        │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

Каждая карточка — клик → drill-down view.

### Phase 3 — Knowledge Graph Canvas (~2 дня)

**Использовать V5.0 RelationshipStore!** Импортируем MASys entities как topics + edges как relationships.

**Компонент:** `frontend/src/components/MemoryWorkbench/KnowledgeGraphCanvas.tsx`

- При открытии: `POST /api/v1/masys/memory/sync-kg?namespace=...` → создаёт workbook + topics + relationships в Gmind
- Live updates: WS → новая entity/relation → инкрементальный апдейт
- Использует существующий MindMap SVG renderer
- Filter toolbar: type (person/place/concept/...), confidence threshold

### Phase 4 — Episode Timeline (~1.5 дня)

**Компонент:** `frontend/src/components/MemoryWorkbench/EpisodeTimeline.tsx`

```
2026-06-01 ▼ Filter: All / Errors / Successes
─────────────────────────────────────────────────────
10:23  ━━━━━━━ pipeline_id=p1, agent=researcher
            └── tool: web_search("AI safety")
10:24       └── tool: wiki_write("AI Safety Overview")
10:25  ━━━━ ✓ result: "wiki page created"
─────────────────────────────────────────────────────
11:02  ━━━━━━━━━━━━━━━━━━━━━━ agent=analyst
            └── recall(namespace=research) → 12 results
            └── llm_call(gpt-4o) — 3.2s, 2400 tokens
            └── ✗ error: "context too long"
            └── 💡 skill candidate: "summarize before recall"
─────────────────────────────────────────────────────
```

**Фичи:**
- Filter: by date, by agent, by status (error/success)
- Reflection actions: `episode → semantic fact`, `episodes → skill`
- Context usage: какие episodes в текущем prompt
- Click на эпизод → Record Inspector

### Phase 5 — Context Budget Visualizer (~1 день)

**Компонент:** `frontend/src/components/MemoryWorkbench/ContextBudget.tsx`

Sankey-style диаграмма:
```
System prompt    ████████░░░░░░░░ 1024 tokens
History          ██████████░░░░░░ 2048 tokens
Retrieved facts  ███████░░░░░░░░░ 1536 tokens (3 evicted)
Scratchpad       █░░░░░░░░░░░░░░░ 256 tokens
─────────────────────────────────────────────────
Total in window  ██████████████░░ 4864 / 8192 (59%)

Evicted (3):
  - episode_42 "tool failure" (last_used 2h ago)
  - fact_117 "user preference" (confidence 0.3)
  - artifact_5 "old draft" (superseded)
```

Lost-in-the-middle подсветка (центр контекста — приглушённый цвет).

### Phase 6 — Skill Evolution Tree (~1.5 дня)

**Использовать V5.0 graph relationships!**

**Компонент:** `frontend/src/components/MemoryWorkbench/SkillEvolutionTree.tsx`

```
Skill: "web_research_workflow" (used 47×, success 89%)
  └── trigger: "research task with no docs"
  └── derivedFrom: [episode_12, episode_18, episode_24]  ← linked
  └── body (action graph):
        1. web_search(query)
        2. for each result: read_page()
        3. summarize_findings()
        4. wiki_write(summary)
  └── preconditions: [no existing wiki page on topic]
  └── successRate trend: 78% → 85% → 89% (3 versions)
```

Relationships (V5.0):
- `episode → skill_candidate` (type=derived_from)
- `skill → action` (type=contains)
- `skill_v1 → skill_v2` (type=supersedes)

### Phase 7 — Pipeline Trace Map (~2 дня)

**Компонент:** `frontend/src/components/PipelineWorkbench/PipelineTraceMap.tsx`

Pipeline run как mindmap-style canvas с timeline:
```
Pipeline: research-and-summarize  Run #142  ✓ completed (12.4s)

[start] ──→ [web-search] ──→ [llm-extract] ──→ [knowledge-graph] ──→ [wiki-write] ──→ [end]
              │ 1.2s              │ 4.8s              │ 0.6s                │ 0.3s
              │                   │ tokens: 2400      │
              │                   │ memory recalls: 3  ←── side panel: какие recalls
              └── side panel: result preview
```

- Кликабельные ноды → Record Inspector с трассой spans
- Связь nodes ↔ memory recalls (MASys RunSpan ↔ MemoryDecision)
- Real-time updates через SSE bridge

---

## Технические детали

### MASys → Gmind data flow

**Pull modes:**
- Episodes/entities/skills: REST poll каждые 30s + WS push
- KG sync: explicit "Sync" button + background watcher

**Bridge proxy в Gmind backend:**
```go
// backend/internal/api/masys_memory.go
func (h *Handler) MASysMemoryEpisodes(w http.ResponseWriter, r *http.Request) {
    namespace := r.URL.Query().Get("namespace")
    url := fmt.Sprintf("%s/trpc/memory.listEpisodes?input=%s", h.maSysBaseURL, urlEncode(...))
    resp, err := http.Get(url)
    // transform tRPC response → simplified JSON for Gmind frontend
}
```

### KG sync — Memory → V5.0 Graph

```
1. GET /trpc/memory.entities?namespace=... → list of entities
2. For each entity:
   - Find/create Gmind topic (UUID match or fuzzy by name)
3. GET /trpc/memory.relations?namespace=... → list of relations
4. For each relation:
   - relationships.Insert({
       from_topic_id: ..., to_topic_id: ...,
       type: relation.predicate, weight: relation.confidence,
       created_by: 'masys', notes: relation.source
     })
```

### TypeScript types (V6.0)

```ts
export interface MASysEpisode {
  id: string
  agentId?: string
  pipelineId?: string
  namespace: string
  action: string
  input: any
  output: any
  status: 'success' | 'error'
  tags: string[]
  timestamp: string
}

export interface MASysMemoryEntity {
  id: string
  name: string
  type: 'person' | 'place' | 'org' | 'concept'
  namespace: string
  attributes: Record<string, any>
  mentions: number
  firstSeen: string
  lastSeen: string
}

export interface MASysSkill {
  id: string
  name: string
  trigger: string
  body: any // action graph JSON
  preconditions?: any[]
  successRate: number
  usageCount: number
  successCount: number
  active: boolean
  derivedFrom: string[]
  createdAt: string
}

export interface MASysRunEvent {
  type: 'node.started' | 'node.completed' | 'node.failed' | 'pipeline.cancelled'
  runId: string
  nodeId?: string
  payload: any
  timestamp: string
}
```

### Расширение V5.0 graph для namespace

Добавить в `relationships` таблицу:
```sql
ALTER TABLE relationships ADD COLUMN namespace TEXT DEFAULT '';
CREATE INDEX idx_rels_namespace ON relationships(namespace);
```

При KG sync — записываем `namespace=masys:<ns>`.

## Связь с другими системами

| Система | Что используем |
|---------|----------------|
| **V5.0 Graph Relationships** | Хранение KG (entities + relations) в `relationships` таблице |
| **V4.3 Multi-Agent** | Supervisor может вызывать MASys через `run_masys_pipeline` |
| **V4.2 RAG** | Future: comparing Gmind embeddings vs MASys vector-store |
| **karp wikiMemory** | Архитектурные ADR (что показывать, как агрегировать) |
| **MASys gmindAgents router** | Bidirectional bridge (MASys уже знает про Gmind agents) |

## Файлы V6.0 (планируемые)

```
backend/internal/api/masys_memory.go          — REST proxy
backend/internal/api/masys_runs.go            — Run trace endpoints
backend/internal/api/masys_kg_sync.go         — KG → V5.0 graph sync
backend/migrations/011_memory_namespace.up.sql — namespace column
frontend/src/api/masys.ts                     — API client
frontend/src/types/masys.ts                   — types
frontend/src/store/masysMemory.ts             — Zustand store
frontend/src/modules/memory-workbench/        — module + panel
  ├── module.ts
  ├── LayerMap.tsx
  ├── KnowledgeGraphCanvas.tsx
  ├── EpisodeTimeline.tsx
  ├── ContextBudget.tsx
  ├── SkillEvolutionTree.tsx
  ├── SalienceQueue.tsx
  ├── RecordInspector.tsx
  └── MemoryWorkbenchPanel.tsx
frontend/src/modules/pipeline-workbench/      — module + panel
  ├── module.ts
  ├── PipelineTraceMap.tsx
  ├── RunCompare.tsx
  └── WorkspaceMap.tsx
frontend/src/components/Charts/               — reusable
  ├── SankeyChart.tsx
  ├── TimelineChart.tsx
  ├── HealthGauge.tsx
  └── TokenAllocationBar.tsx
```

## Не делаем сейчас

- **Запись в MASys** (mutate операции) — V6.1
- **Memory editor inside Gmind** (создание ADR/skills) — V6.1
- **Multi-namespace switching** — V6.1
- **Embeddings comparison** Gmind vs MASys — V7.0
- **Tauri Mobile** — V7.0

## Roadmap status

- **Phase 1** (MASys Bridge) ✅ DONE 2026-06-01
- **Phase 2** (Layer Map) ✅ DONE 2026-06-01
- **Phase 3** (KG Canvas) — следующий
- **Phase 4** (Episode Timeline) — параллельно с Phase 3
- **Phase 5** (Context Budget) — после 4
- **Phase 6** (Skill Tree) — после 5
- **Phase 7** (Pipeline Trace) — финальный

## Phase 1 deliverables (2026-06-01)

### Backend
- `backend/internal/api/masys_memory.go` — REST proxy:
  - `callTRPCQuery(method, input)` → GET `/trpc/<method>?input=<urlencoded>`, unwraps `result.data`
  - `callTRPCMutation(method, input)` → POST body, unwraps
  - 10 endpoints: `/api/v1/masys/{health, memory/{namespaces,episodes,entities,skills,conversations,wiki,results,decisions,pending,recall}, runs, runs/{id}, runs/{id}/events}`
- `backend/internal/api/masys_sse.go` — SSE bridge for `runs/{id}/stream`:
  - dial MASys WS → re-emit как `event: <type>\ndata: <json>\n\n`
  - 20s keepalive comments, Escape via context cancel
  - eventTypeOf() reads `.type` from message; sanitizeEventName() replaces whitespace with dots
- gorilla/websocket уже в зависимостях

### Frontend
- `frontend/src/types/masys.ts` — 12 интерфейсов (MASys{Health,Episode,MemoryEntity,Skill,Conversation,WikiPage,Result,Decision,PendingWrite,Run,RunEvent,RecallResult})
- `frontend/src/api/masys.ts` — fetch helper + 14 методов; `streamRun(runID)` возвращает EventSource
- `frontend/src/store/masysMemory.ts` — Zustand: health + namespaces + 8 layers data + per-layer loading flags + `refreshAll`
- `frontend/src/components/MemoryWorkbench/MemoryWorkbenchPanel.tsx`:
  - Reachability indicator (✓/✗)
  - Namespace switcher (select)
  - 8 layer cards в grid (Episodes/Entities/Skills/Conversations/Wiki/Results/Decisions/Pending) с counter
  - Refresh button
- `frontend/src/modules/memory-workbench/module.ts` — AppModule (order=5, icon Brain, 2 commands)
- Registered в `modules/registry.ts`

### Запуск

```bash
# 1. Запустить MASys на :3000
cd E:\MASys && pnpm dev

# 2. Запустить Gmind на :1010/:1011
cd D:\Gmind\gmind && powershell -ExecutionPolicy Bypass -File scripts/start.ps1

# 3. Открыть Gmind → NavRail → нажать на 🧠 Brain (5-я иконка)
# Panel покажет reachability + 8 layer cards с counters из MASys
```

### Тесты

- Go: `go build ./...` чист, `go test ./internal/api/...` OK
- TS: `tsc --noEmit` чист, Vitest 62/62 OK

Итого Phase 1: ~3 часа работы. Осталось Phase 2-7 ~ 8 дней.
