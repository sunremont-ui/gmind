# Skill: PWA Share Target — Gmind

## Цель
Позволить пользователям отправлять текст из любых приложений в Gmind через системный Share Sheet (мобильные) или контекстное меню (десктоп).

## Как это работает

1. PWA регистрирует `share_target` в манифесте
2. Система добавляет Gmind в список доступных приложений для Share
3. Пользователь выделяет текст → Share → Gmind
4. Браузер открывает PWA с текстом в URL параметре `?text=...`
5. `App.tsx` читает параметр и открывает Quick Capture с этим текстом

## Конфигурация

В `frontend/vite.config.ts`:
```typescript
manifest: {
  share_target: {
    action: '/',
    method: 'GET',
    params: {
      title: 'title',
      text: 'text',
      url: 'url',
    },
  },
}
```

## Обработка на фронтенде

В `frontend/src/App.tsx`:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const sharedText = params.get('text')
  if (sharedText) {
    setQuickCaptureText(sharedText)
    setShowQuickCapture(true)
    window.history.replaceState(null, '', '/')
  }
}, [])
```

## Требования

- PWA должен быть **установлен** (display: standalone)
- Поддерживается на Android (Chrome), iOS (Safari 16+), десктоп (Chrome)
- После обработки URL очищается через `replaceState` (не保留 shared text при перезагрузке)

## Файлы

- `frontend/vite.config.ts` — манифест с share_target
- `frontend/src/App.tsx` — хендлер shared text
- `frontend/src/components/QuickCapture/QuickCapture.tsx` — отображает переданный текст
