# Работа с памятью MASys: двусторонний мост

До этого шага мост был односторонним: Gmind читал все слои памяти MASys и умел
удалять записи, но ручная доработка на холсте в память не возвращалась, и из
узла нельзя было поставить задачу. Здесь появляется запись.

Схемы входа взяты из `E:\MASys\apps\server\src\router\{memory,runs}.ts`.

## Эндпоинты

| Метод | Path | tRPC MASys | Назначение |
|---|---|---|---|
| POST | `/api/v1/masys/memory/episodes` | `memory.episode.log` | Записать эпизод: «что произошло» |
| POST | `/api/v1/masys/memory/remember` | `memory.controller.remember` | Запомнить текст — слой выберет контроллер |
| POST | `/api/v1/masys/memory/entities/upsert` | `memory.entity.upsert` | Сущность графа знаний |
| POST | `/api/v1/masys/memory/relations` | `memory.kg.addRelation` | Связь в графе знаний |
| POST | `/api/v1/masys/push` | оба выше | Узлы и связи холста → граф MASys |
| POST | `/api/v1/masys/runs/start` | `runs.start` / `runs.invoke` | Поставить задачу |
| POST | `/api/v1/masys/runs/{runID}/stop` | `runs.stop` | Остановить прогон |

## Гочи, которые стоили бы времени

**`runs.start` не принимает `inputs`.** Его схема — `z.object({ pipelineId })` и
всё. Данные передаются только через `runs.invoke` (`{ pipelineId, inputs,
timeoutMs }`), который инжектит их в узел `pipeline-input` через
`config.jsonData`. Поэтому прокси сам выбирает метод: есть `inputs` или
`wait: true` → `invoke`, иначе → `start`.

**`entityTypeEnum` в MASys узкий:** `person | place | org | concept | custom`.
Виды памяти Gmind богаче (`semantic`, `skill`, `episodic`, `decision`…), и
передача их напрямую отклоняется zod целиком. `normalizeEntityType()` сводит вид
к допустимому набору, а исходный вид сохраняется в
`attributes.gmind_memory_kind` — точность не теряется при обратном чтении.

**Пустой input.** Как и на чтении: процедуры объявлены через `z.object({...})`,
объект обязателен даже при необязательных полях.

## Push: обратная сторона KG-sync

`POST /api/v1/masys/push` — `masys_push.go`.

```
узел с memory_kind        → memory.entity.upsert
связь V5.0 между узлами   → memory.kg.addRelation
```

Правила, заложенные намеренно:

- **Уходят только типизированные узлы.** Узел без `memory_kind` — обычный
  элемент карты, в графе знаний ему не место (считается в `skipped`).
- **Идентичность по `MasysRef.Key`, а не по заголовку.** После успешной записи
  ref проставляется на узел, поэтому повторный push идемпотентен, а
  переименование узла в Gmind не создаёт в MASys дубль. Покрыто тестом
  `TestPushStampsRefsForIdempotency`.
- **Связь уходит только если оба конца ушли** — иначе она бессмысленна.
- **Предикат** — заголовок связи, иначе её тип (обратное отображение к
  `mapPredicateToType` из `masys_kg_sync.go`).
- **Частичная неудача не роняет запрос:** ответ 200 с отчётом
  (`entities_pushed`, `relations_pushed`, `skipped`, `errors[]`, `refs`).
  Потерять уже записанное из-за одной ошибки хуже, чем вернуть отчёт.
- `topic_ids` ограничивает отправку выделением на холсте.

## Задача на узле

`Topic.MasysRunID` — карта помнит, где была поставлена работа. `stampRunOnTopic`
записывает `runId` на узел после успешного старта; ошибка записи в карту **не**
роняет ответ — задача уже запущена, и терять её нельзя.

## UI

Memory Workbench → таб «🔗 Узел» (`NodeMemoryActions.tsx`):

- «🧠 Запомнить» — текст узла (заголовок + тело + заметка) в `remember`;
- «🕸 В граф знаний» — `entity.upsert` по виду памяти узла;
- «⏱ Записать эпизод» — факт ручной правки в эпизодическую память;
- «⇪ Отправить узлы и связи» — push выделения (или всей карты);
- «▶ Запустить» — постановка задачи по выбранному пайплайну; текст узла уходит
  на вход, `runId` сохраняется на узле.

Все кнопки заблокированы, пока MASys недоступен — статус берётся из фонового
монитора (`skills/masys-integration.md`).
