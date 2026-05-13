# Skill: Error Handling — Gmind

## Цель
Единый формат ошибок на бэкенде: все API endpoints возвращают одинаковую структуру `ErrorResponse` с кодом, сообщением и HTTP статусом.

## ErrorResponse (Go → TS)

**Go:** `backend/internal/model/types.go`
```go
type ErrorResponse struct {
    Error  string    `json:"error"`
    Code   ErrorCode `json:"code"`
    Status int       `json:"status"`
}
```

**TypeScript (сгенерирован):**
```typescript
export type ErrorCode = string
export interface ErrorResponse {
  error: string
  code: ErrorCode
  status: number
}
```

## Коды ошибок

| HTTP Status | ErrorCode | Когда |
|---|---|---|
| 400 | INVALID_REQUEST | Неверное тело запроса / валидация |
| 404 | NOT_FOUND | Ресурс не найден |
| 409 | CONFLICT | Конфликт (например, сервер уже запущен) |
| 500 | INTERNAL_ERROR | Внутренняя ошибка сервера (без деталей) |
| 503 | SERVICE_UNAVAILABLE | AI сервис не настроен |

## Helpers

В `backend/internal/api/router.go`:

- `writeError(w, status, msg)` — автоматически выбирает ErrorCode по статусу
- `writeErrorWithCode(w, status, code, msg)` — явный код
- `internalError(w, err)` — **логирует реальную ошибку**, возвращает "internal server error"

## Защита от утечки деталей

Все `writeError(w, 500, err.Error())` заменены на `internalError(w, err)`:
- Реальная ошибка пишется в `log.Printf("ERROR 500: %v", err)`
- Клиент получает `{"error": "internal server error", "code": "INTERNAL_ERROR", "status": 500}`

## Фронтенд

`frontend/src/api/client.ts`:
```typescript
const body: ErrorResponse = await res.json()
throw new ApiError(body.error, body.code, body.status)
```

`frontend/src/api/errors.ts`:
```typescript
export class ApiError extends Error {
  code: string
  status: number
}
// Helpers:
isNotFound(err)    // err.code === 'NOT_FOUND'
isOffline(err)     // err.code === 'OFFLINE'
isConflict(err)    // err.code === 'CONFLICT'
```

## Файлы

- `backend/internal/model/types.go` — ErrorResponse, ErrorCode, NewErrorResponse
- `backend/internal/api/router.go` — writeError, internalError, codeForStatus
- `frontend/src/api/errors.ts` — ApiError class
- `frontend/src/api/client.ts` — ErrorResponse в request()
