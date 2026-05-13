# Skill: AI Agents — Gmind

## 1. Inbox Agent
**Назначение**: Авто-классификация входящих мыслей в Inbox.

**Логика**:
- При добавлении нового топика в Inbox workbook → EventBus событие `inbox:new`
- Agent анализирует текст:
  - Задача (содержит глагол, дедлайн) → Task
  - Заметка (пассивная формулировка) → Note  
  - Идея (вопрос, гипотеза) → Idea
- Предлагает: `{ type, suggested_workbook, suggested_parent, confidence }`
- Если confidence > 0.8 → авто-маршрутизация
- Если нет → помечает ноду маркером `needs-review`

**Backend**:
- `backend/internal/agents/inbox_agent.go` — подписка на `inbox:new`
- Новый endpoint: `POST /api/v1/agents/inbox/classify`

**Frontend**:
- Жёлтый маркер ⚡ на непроцессированных нодах Inbox
- Кнопка "Process" в тулбаре Inbox

## 2. Daily Review Agent
**Назначение**: Ежедневный обзор изменений.

**Логика**:
- При первом открытии за день (проверка `lastReviewDate` в offlineSettings)
- Показывает диалог:
  - Новые/изменённые топики с момента последнего визита
  - Предложения: архивировать старые, удалить пустые, связать похожие
- Кнопки: "Apply All", "Review Each", "Dismiss"

**Frontend**:
- `frontend/src/components/ReviewDialog/ReviewDialog.tsx`
- Хранит `lastReviewDate` в `offlineSettings`

## 3. Connector Agent
**Назначение**: Поиск связей между floating topics и деревом.

**Логика**:
- Периодически (или по кнопке "Find Connections"):
  - Берёт все floating topics в текущем sheet
  - Для каждого — ищет семантические совпадения среди root tree
  - Предлагает: `{ floating_id, suggested_parent_id, reason }`
- Показывает список предложений в боковой панели
- Кнопка "Connect" — перемещает floating в дерево

**Backend**:
- `backend/internal/agents/connector_agent.go`
- Новый endpoint: `POST /api/v1/workbooks/{id}/ai/find-connections`

## Общая архитектура агентов

```
EventBus (core)
  ├── inbox:new → InboxAgent.classify()
  ├── app:open  → DailyReviewAgent.check()
  └── user:request-connections → ConnectorAgent.find()

Agent Manager:
  - lifecycle (start/stop)
  - worker pool (goroutine per agent)
  - результат → WebSocket broadcast
```

## Файлы
- `backend/internal/agents/inbox_agent.go`
- `backend/internal/agents/daily_review_agent.go`  
- `backend/internal/agents/connector_agent.go`
- `frontend/src/components/ReviewDialog/ReviewDialog.tsx`
