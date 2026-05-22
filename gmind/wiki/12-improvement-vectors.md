# Анализ векторов развития

> Дата: Май 2026
> Статус: Ollama Auto-Detect ✅ DONE, остальные приоритеты актуальны

## 1. RAG over Mindmaps — Векторный поиск по mindmap + wiki

**Суть:** Добавить векторные эмбеддинги всех mindmap-топиков и wiki-страниц в SQLite через `sqlite-vec`. При AI-запросе находить семантически близкие топики и подмешивать их в контекст.

**Технологии:**
- `github.com/viant/sqlite-vec` (v0.3) — CGO-free, работает с `modernc.org/sqlite`
- `github.com/viant/embedius` (v0.5) — сервис индексации поверх sqlite-vec
- Embedding: OpenAI `text-embedding-3-small`, Ollama (локально), ONNX (офлайн)

**Плюсы:**
- Без внешних зависимостей — всё в SQLite
- Совместим с текущим стеком (modernc.org/sqlite уже используется)
- Семантический поиск (не только keyword match)
- Улучшает AI-генерацию контекстом из всех карт

**Минусы:**
- Нужен embedding-сервис → добавляет latency
- sqlite-vec пока v0.3
- Индексация при каждом изменении (фоновая синхронизация)
- Размер БД растёт (embeddings ~1536 float32 на топик)

**Оценка: ⭐⭐⭐⭐⭐ — Стоит делать. Фундаментальное улучшение AI.**

**Внедрение:**
1. Добавить `sqlite-vec` модуль в Go backend
2. Фоновая переиндексация mindmap + wiki при изменениях
3. UI: кнопка «AI Search по всем картам»
4. Новый tool для агентов: `semantic_search(query string)`

---

## 2. Multi-Agent Orchestration — Supervisor/Worker, Parallel, Pipeline

**Суть:** Расширить sequential chaining до supervisor/worker, parallel fan-out, pipeline.

**Плюсы:**
- Покрывает сценарии pipeline (напиши → проверь → исправь)
- Параллельный запуск ускоряет работу
- Supervisor динамически выбирает агента
- Можно итеративно: parallel → supervisor → pipeline

**Минусы:**
- Supervisor добавляет latency (LLM-вызов на планирование)
- Отладка DAG нетривиальна
- Готовые библиотеки (zenflow, orloj) могут конфликтовать с архитектурой
- Sequential chaining покрывает 80% сценариев

**Оценка: ⭐⭐⭐⭐ — Делать поэтапно, начать с parallel fan-out.**

**Внедрение:**
1. **Phase 1:** Parallel fan-out — `parallel_to: ["agent1", "agent2"]`
2. **Phase 2:** Supervisor — новый tool `delegate_subtask(task, agent_id)`
3. **Phase 3:** Pipeline — визуальный редактор DAG в UI

---

## 3. Tauri Production Hardening — Stronghold, Tray, Auto-Update, CSP

**Суть:** Безопасное хранение ключей (Stronghold), system tray, автообновление, правильный CSP.

**Плюсы:**
- API-ключи шифрованы в OS keychain (AES-256-GCM)
- Приложение в трее не занимает панель задач
- Пользователи авто-получают обновления
- CSP защищает от XSS

**Минусы:**
- Stronghold требует Rust-кода
- Vault password management нетривиален
- Auto-update требует сервер/GitHub Releases
- CSP может сломать WS без `connect-src`

**Оценка: ⭐⭐⭐⭐ — Важно перед production-релизом, но не сейчас.**

**Внедрение:**
1. **P1:** Stronghold — перенести API-ключи AI провайдеров
2. **P2:** System tray — сворачивание/возврат по клику
3. **P2:** Global shortcut — Alt+Space для показа из любого приложения
4. **P3:** Auto-update через GitHub Releases

---

## 4. Local AI Auto-Detect — Ollama Discovery ✅ DONE

**Суть:** Авто-определение Ollama на localhost:11434, показ как доступного провайдера.

**Статус: РЕАЛИЗОВАНО**
- `backend/internal/ai/ollama.go` — OllamaDetector: health check `GET /api/tags`, периодический polling
- `backend/internal/api/ollama.go` — OllamaHandler: `GET /api/v1/ollama/status`
- `frontend/src/components/AIServerPanel/AIServerPanel.tsx` — Ollama секция (detected/not detected, модели, Use Ollama)
- UI: индикатор «Ollama detected ✓» + выбор модели
- Используется официальный Go SDK (`ollama/ollama/api`)

**Плюсы:**
- Zero-config для пользователей с Ollama
- Динамический список моделей (pull → сразу видна)
- Health check с кэшированием (периодический polling)

**Минусы:**
- Ollama может быть на нестандартном порту
- На Windows требует отдельной установки

---

## 5. Mobile PWA / Tauri Mobile

**Суть:** iOS и Android через Tauri Mobile.

**Плюсы:**
- Единая кодовая база
- Нативное распространение (App Store / Google Play)

**Минусы:**
- iOS требует Mac + $99/год
- Go backend не работает на mobile (sidecar)
- Нужен отдельный backend-сервер
- UI не адаптирован под touch
- Нужна архитектурная переработка

**Оценка: ⭐⭐ — Рано. Требует серьёзной переработки. Отложить до V5.0.**

---

## 6. MCP Bridge — Интеграция с n8n и внешними Workflow

**Суть:** Агенты вызывают внешние workflow (n8n) через MCP протокол.

**Плюсы:**
- 400+ интеграций n8n (Slack, Gmail, GitHub, Telegram, Notion, ...)
- MCP сервер уже есть — 3 новых tool
- Сценарии: Notion → mindmap → Slack

**Минусы:**
- n8n добавляет ~500MB к дистрибутиву
- Управление установкой/запуском n8n
- Риск безопасности
- Глубокая интеграция — сложная инженерия

**Оценка: ⭐⭐⭐ — Перспективно, но не сейчас. После стабилизации агентов.**

---

## 7. Knowledge Graph Fusion — Mindmap → Knowledge Graph → GraphRAG

**Суть:** Mindmap-структура → Knowledge Graph → GraphRAG для AI.

**Плюсы:**
- Mindmap — уже knowledge graph (узлы → связи)
- CogGRAG (2025) подтверждает эффективность
- GraphRAG отвечает на глобальные вопросы
- Отличает от конкурентов

**Минусы:**
- Очень сложная реализация
- Neo4j — тяжёлая зависимость (Java, Docker)
- GraphRAG Microsoft — Python
- Research-риск: может не дать улучшения над простым RAG

**Оценка: ⭐⭐⭐ — Технически красиво, сложно. P4, после базового RAG.**

---

---

## 8. Agent Persistence — Сохранение агентов в SQLite

**Суть:** Агенты хранятся только in-memory в `Registry`. При перезапуске сервера — исчезают.

**Плюсы:**
- Агенты переживают рестарт (критично для production)
- Workers авто-стартуют для recovered задач
- Открывает путь к agent versioning / rollback

**Минусы:**
- Дополнительная миграция + store
- Registry нужно синхронизировать с DB при каждом CRUD

**Оценка: ⭐⭐⭐⭐⭐ — Критично. Без этого система не production-ready.**

**Внедрение:**
1. Миграция `007_agents.up.sql` — таблица `agents`
2. `store/agents.go` — AgentStore CRUD
3. `agent/module.go` — `InitAgentStore` + load при старте + startup worker start
4. `cmd/server/main.go` — wiring

---

## 9. Reliability — Startup Worker Auto-Start + Stuck Task Recovery

**Суть:** При recover задач из SQLite (`recover()`) worker-горутины для агентов не запускаются → recovered задачи зависают навсегда.

**Текущий баг:** `recover()` загружает `queued` задачи в `q.tasks`, но никто не вызывает `WorkerPool.StartWorker` для них.

**Фикс:**
- После `InitTaskStore` + `InitAgentStore` проходить по списку агентов и вызывать `wp.StartWorker(agentInfo)` для каждого

**Оценка: ⭐⭐⭐⭐⭐ — Критично. Связан с V4.1.**

---

## 10. Export/Import — Markdown, FreeMind, Drag-and-Drop

**Суть:** Обратный экспорт в .md и .mm (FreeMind), плюс drag-and-drop import прямо на холст.

**Плюсы:**
- Стандартные форматы — совместимость с Obsidian, XMind, Notion
- Drag-and-drop — UX-паттерн, ожидаемый пользователями

**Оценка: ⭐⭐⭐ — Средний приоритет. Быстрая реализация.**

---

## Итоговая матрица приоритетов (обновлено 2026-05-17)

| ID | Вектор | Приоритет | Сложность | Ценность | Статус |
|----|--------|-----------|-----------|----------|--------|
| — | Ollama Auto-Detect | ✅ DONE | S | ⭐⭐⭐⭐ | DONE |
| — | Tauri Hardening | ✅ DONE | M | ⭐⭐⭐⭐ | DONE |
| — | Bugfix: SSE/TaskQueue/Startup | ✅ DONE | S | ⭐⭐⭐⭐⭐ | DONE |
| V4.1 | Agent Persistence + Reliability | ✅ DONE | M | ⭐⭐⭐⭐⭐ | DONE 2026-05-17 |
| V4.2 | RAG over Mindmaps | ✅ DONE | L | ⭐⭐⭐⭐⭐ | DONE 2026-05-17 |
| V4.3 | Multi-Agent Orchestration | 🟠 P1 | L | ⭐⭐⭐⭐ | После V4.1 |
| V4.4 | Export/Import (MD, MM, DnD) | 🟡 P2 | S | ⭐⭐⭐ | Любое время |
| V4.5 | Performance (Worker, Minimap) | 🟡 P2 | M | ⭐⭐⭐⭐ | После V4.3 |
| V4.6 | MCP Bridge (n8n) | 🟢 P3 | M | ⭐⭐⭐ | После стабильных агентов |
| V5.0 | Knowledge Graph + GraphRAG | 🟢 P4 | XL | ⭐⭐⭐⭐⭐ | V5.0 |
| V5.x | Mobile PWA / Tauri Mobile | 🟢 P4 | XL | ⭐⭐ | Отложено до V5.0 |

**Рекомендация:** V4.1 DONE. Следующий приоритет — V4.2 (RAG over Mindmaps) как фундамент AI-улучшений, затем V4.3 (Multi-Agent Orchestration).
