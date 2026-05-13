# WebSocket Protocol

**Endpoint:** `ws://localhost:8080/ws` (через Vite proxy: `ws://localhost:5173/ws`)

WebSocket используется для real-time коллаборации: уведомления об изменениях, курсоры.

## Подключение

```js
import { wsClient } from './api/ws'

wsClient.connect(workbookId, userId)

// Подписка на события
const unsub = wsClient.on('update', (msg) => {
  // msg.payload содержит данные
  fetchWorkbook()  // перезагрузить через REST
})

// Отписка
unsub()
```

## Формат сообщений

```json
{
  "type": "string",
  "payload": {},
  "user_id": "string"
}
```

## Сообщения от клиента

| type | payload | Описание |
|---|---|---|
| `join` | `{ workbook_id, user_id }` | Подключиться к workbook |
| `update` | `{}` | Уведомить об изменении |
| `cursor` | `{ x, y }` | Позиция курсора |

## Сообщения от сервера

| type | payload | Описание |
|---|---|---|
| `user_joined` | `{ user_id, client_id }` | Пользователь подключился |
| `user_left` | `{ user_id, client_id }` | Пользователь отключился |

## Механизм синхронизации

Gmind использует **REST + WebSocket** (не full OT/CRDT):

1. Пользователь A делает изменение через REST API
2. После успешного ответа A отправляет `{ type: "update" }` через WebSocket
3. Сервер рассылает `update` всем остальным пользователям в workbook
4. Получатели перезагружают workbook через REST API

Этот подход простой, но не optimal для частых изменений. Для production рекомендуется OT/CRDT.

## Reconnect

Клиент автоматически переподключается через 3 секунды при разрыве.

```typescript
private scheduleReconnect() {
  setTimeout(() => {
    if (this.workbookId && this.userId) {
      this.doConnect()
    }
  }, 3000)
}
```

## React Strict Mode

В dev-режиме React Strict Mode выполняет mount → unmount → mount. Клиент защищён от двойного подключения:
- `connect()` проверяет `readyState` перед созданием нового соединения
- `disconnect()` проверяет `readyState` перед close()

## Файлы

- `backend/internal/ws/hub.go` — WebSocket hub (Go, gorilla/websocket)
- `frontend/src/api/ws.ts` — WSClient (TypeScript)
