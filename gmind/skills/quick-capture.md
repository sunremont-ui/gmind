# Skill: Quick Capture — Gmind

## Цель
Быстрый захват мыслей, текста и идей с возможностью тегирования и сохранения в выбранный workbook. Работает офлайн через IndexedDB.

## Архитектура

```
Hotkey (Ctrl+Shift+I) / Share Target
        │
        ▼
  QuickCapture.tsx
        │
        ├── auto-paste выделенного текста (getSelection)
        ├── теги (chips + пресеты)
        ├── выбор target workbook (Inbox / другой)
        │
        ▼
  captureToInbox() / api.createTopic()
        │
        ▼
  Inbox workbook / выбранный workbook
```

## UI

- **Мини-окно** — маленькая панель в правом верхнем углу (position: fixed, top: 60, right: 16)
- **Нет overlay** — не блокирует фон (в отличие от старой версии с backdrop blur)
- **Авто-вставка** — при открытии подхватывает `window.getSelection().toString()`
- **Теги** — input + кнопка `+`, теги как chips (удаление ×), пресеты: idea/todo/fix/note/question/reference
- **Формат заголовка** — `[tag1][tag2] текст` — теги префиксом в квадратных скобках
- **Target selector** — выпадающий список: Inbox (по умолч.) или любой другой workbook (подгружается из API/IndexedDB)

## Хоткеи

| Комбинация | Действие |
|---|---|
| Ctrl+Shift+I | Открыть/закрыть Quick Capture |
| ⌘+Enter | Сохранить |
| Esc | Закрыть |

## Web Share Target

При установке PWA можно шарить текст из любого приложения:
- Выделить текст → Поделиться → Gmind
- PWA открывается с текстом в Quick Capture
- Конфиг: `share_target` в `vite.config.ts`

## Офлайн

- При офлайн-режиме заметка сохраняется через `mutatingRequest` → `offlineQueue`
- Target selector использует `offlineStorage.listWorkbooks()` как fallback
- Статус `📴 Offline · will sync later` в UI

## Файлы

- `frontend/src/components/QuickCapture/QuickCapture.tsx` — компонент
- `frontend/src/utils/inbox.ts` — `captureToInbox()`, `ensureInboxWorkbook()`
- `frontend/src/App.tsx` — хоткей, share target handler, lazy import
- `frontend/vite.config.ts` — `share_target` в PWA manifest
