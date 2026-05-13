# Улучшения

## Реализовано (MVP + v2–v3.5)

### Базовый MVP
- [x] REST API (CRUD workbooks/sheets/topics/relationships)
- [x] SVG рендеринг mindmap (layout engine: mindmap, org-chart, tree, radial, fishbone)
- [x] WebSocket real-time коллаборация (курсоры, presence, operation sync)
- [x] AI генерация и чат (OpenAI GPT-4o + Yandex GPT + локальный llama-server)
- [x] Экспорт/импорт .xmind
- [x] Context menu (add/rename/delete topic)
- [x] Zustand state management
- [x] Drag & drop — перетаскивание топиков (long-press)
- [x] 10 тем оформления — Lumen, Vivid, Sunset, Ocean, Forest, Midnight, Silicon, Lavender, Peach, Aurora
- [x] Разные layout — Mindmap, Org-Chart, Tree, Fishbone, Radial
- [x] Multiple sheets — вкладки с разными mindmap в одном workbook
- [x] Properties panel — редактор свойств топика
- [x] Starter nodes — новые mindmap создаются с 3 стартовыми темами
- [x] Keyboard shortcuts — Delete/Backspace для удаления выбранной ноды
- [x] Help overlay — всплывающая подсказка при загрузке
- [x] Canvas context menu — правый клик на пустом поле → Add Topic
- [x] ErrorBoundary — защита от краша рендера

### Производительность и оптимизации
- [x] **React.memo для TopicNode** — кастомная `areEqual`, предотвращает лишние ререндеры
- [x] **Viewport culling** — `isInViewport()` скрывает ноды вне видимой области через `visibility:hidden`
- [x] **useMemo для сборки данных** — `edgeData`, `nodeComponents`, `selSet`, `viewportRect` мемоизированы
- [x] **selSet мемоизация** — `new Set(selectedTopicIds)` в `useMemo`
- [x] **Layout мемоизация** — `buildLayout` + `computeTreeLayout` в `useMemo` от `activeSheet`

### Встроенный экспорт (frontend)
- [x] **Экспорт SVG** — `XMLSerializer` → Blob → download `.svg`
- [x] **Экспорт PNG** — SVG → canvas (2x retina) → `toBlob` → download `.png`
- [x] **Экспорт PDF** — SVG → canvas → `jsPDF.addImage()` → `pdf.save()`
- [x] **Импорт из Markdown (.md)** — парсинг заголовков и списков → рекурсивное создание
- [x] **Импорт из FreeMind (.mm)** — `DOMParser` парсит XML `<node TEXT="...">` → рекурсивное создание
- [x] **Import/Export dropdowns** — группировка форматов в тулбаре

### Коллаборация (Multiplayer)
- [x] **Multiplayer курсоры с именами** — цветные кружки + badge с именем
- [x] **Presence** — 👥 кнопка в тулбаре, список онлайн с цветными точками
- [x] **Operation sync** — broadcast CRUD операций через WebSocket без full reload

### AI фичи
- [x] **AI Inline Expand** — ✨ кнопка на каждой ноде, AI генерирует 3-5 детей
- [x] **AI Summarize** — 📋 кнопка в тулбаре, диалог с суммаризацией mindmap
- [x] **AI Image Generation** — 🎨 DALL-E 3, диалог с preview

### Инфраструктура (выполнено)
- [x] **Frontend тесты** — Vitest + Testing Library, 42 теста, 6 файлов
- [x] **Backend тесты** — Go store/agent/api/ws: 56+ тестов
- [x] **Docker** — docker-compose.yml + Dockerfiles (backend + frontend/nginx)
- [x] **CI/CD** — GitHub Actions (backend lint/test/build, frontend lint/tsc/test/build, docker build)
- [x] **TypeScript strict mode** — включено `strict: true` в tsconfig

### Дизайн-система
- [x] **Apple Design System** — SF Pro typography, 8px grid, frosted glass, macOS-style Header/Sidebar
- [x] **10 тем mindmap** — Lumen (дефолт), Vivid, Sunset, Ocean, Forest, Midnight, Silicon, Lavender, Peach, Aurora
- [x] **Lumen Design System** — токены, UI-примитивы (Box, Forms), компонентный шаблон
- [x] **Тёмная тема (системная)** — авто-переключение по `prefers-color-scheme`

### Модульная архитектура
- [x] **Module System** — core.Module interface, Registry, EventBus, lifecycle с графом зависимостей
- [x] **Agent System (MVP)** — CRUD агентов, 7 ролей, REST API, AgentPanel, per-agent model/provider
- [x] **Wiki Module** — файловое .md хранилище, CRUD, полнотекстовый поиск, тесты
- [x] **MCP Server** — JSON-RPC 2.0, методы initialize/tools/list/tools/call, wiki tools
- [x] **API Typing** — авто-генерация TypeScript типов из Go structs (`gen-ts-types`)
- [x] **Unified Error Handling** — `internalError()` helper, логирование 500 ошибок
- [x] **Code Splitting** — динамический `import()` для export функций, lazy панели

### UX улучшения
- [x] **Quick Capture v2** — мини-окно, авто-вставка `getSelection()`, теги (chips + пресеты), target selector, офлайн
- [x] **Web Share Target** — PWA принимает текст из системного Share → Quick Capture
- [x] **PWA / Offline-first** — Service Worker, IndexedDB кэш, offline queue, install prompt, offline banner
- [x] **Workbook delete button** — × кнопка в Sidebar, hover-показ, confirm перед удалением
- [x] **Command Palette (Ctrl+Alt+Space / ⌘K)** — поиск и запуск команд
- [x] **Session restore** — восстановление lastWorkbookId/lastSheetId при холодном старте офлайн
- [x] **Sync on reconnect** — авто-воспроизведение pending_ops при возврате онлайн
- [x] **Inbox Workbook** — авто-создание при старте, отдельная секция в Sidebar
- [x] **Удаление дублирующейся панели** — всё перенесено в тулбар
- [x] **Responsive sidebar** — toggle collapsible (≡/←), анимация ширины 260↔48px
- [x] **Scrollable panels** — AIPanel/AgentPanel/PropertiesPanel скроллятся при переполнении

### V3.2 — Редактор
- [x] **Rich text в нодах** — форматирование (bold, italic, list) внутри foreignObject
- [x] **Image nodes** — вставка изображений (URL/base64) в ноды
- [x] **Hyperlink preview** — 🔗 иконка, клик открывает URL, тултип, пункт "Open Link"
- [x] **Callout / Notes popup** — 📄 кликабельная иконка, модальное окно с редактированием
- [x] **Node templates** — сохранение/загрузка стилей ноды как шаблонов (localStorage)

### Многонаправленная раскладка
- [x] **Direction** — единый параметр `'right' | 'left' | 'down' | 'up'`
- [x] **Tree Right/Left/Down/Up** — 4 варианта направления дерева
- [x] **Fishbone (Ishikawa) diagram** — реализован алгоритм
- [x] **Контекстное меню** — 6 пунктов: Mindmap, Tree Right, Tree Left, Tree Down, Tree Up, Radial
- [x] **Collapse/expand animation** — плавная анимация (opacity + transform через `parentFolded`)
- [x] **Per-node spacing override** — `topic.level_gap` / `topic.sibling_gap`
- [x] **Auto-layout button** — ⊞ кнопка в тулбаре
- [x] **Node customization** — `node_height`, `border_color`, `connection_color`, `shadow_type`, `node_style`, `fold_icon`, `show_child_count`

### Yandex GPT
- [x] **Yandex GPT интеграция** — новый AI провайдер
- [x] **SwitchAIProvider folder_id** — `folder_id` в запросе
- [x] **Yandex GPT Config UI** — секция в AIServerPanel (API Key, Folder ID, Model)

---

## Известные проблемы

### Все ранее известные баги исправлены. Нет открытых критических проблем.

---

## История реализованных фич

### Инфраструктура (P0) ✅
- [x] **ESLint + Prettier** — линтеры настроены, все предупреждения исправлены
- [x] **Тесты** — frontend (Vitest + Testing Library, 42 теста) и backend (Go testing, 56+ тестов)
- [x] **Docker** — docker-compose с backend + frontend + nginx
- [x] **CI/CD** — GitHub Actions: lint → test → build → docker build
- [x] **TypeScript strict mode** — включён, все ошибки пройдены

### UX и фичи (P1/P2) ✅
- [x] **Fishbone layout** — Ishikawa diagram
- [x] **Direction UI** — выпадающий список в PropertiesPanel
- [x] **Collapse animation** — плавная анимация при сворачивании/разворачивании
- [x] **Per-node spacing** — настройка gap'ов для отдельных нод
- [x] **Rich text editor** — contentEditable с toolbar
- [x] **Image nodes** — вставка изображений
- [x] **Hyperlink preview** — предпросмотр ссылок
- [x] **Callout/Notes popup** — модальное окно заметок
- [x] **Node templates** — шаблоны стилей
- [x] **Export как отдельный dropdown** — SVG, PNG, PDF, XMind
- [x] **Import как отдельный dropdown** — Markdown, FreeMind, JSON
- [x] **Drag & drop .md/.mm/.xmind на холст**
- [x] **Sticky notes / Canvas** — наклейки на холсте
- [x] **Mindmap presentation mode** — шаг за шагом
- [x] **Infinite canvas minimap** — мини-карта
- [x] **Private mode** — Access Mode (public/collaborators/agents/private)
- [x] **Share/Invite dialog** — управление доступом
- [x] **Collaborator management** — API + UI
- [x] **Yandex GPT** — новый провайдер

### Технический долг ✅
- [x] **Линтер/форматтер** — ESLint + Prettier (фронтенд), golangci-lint (бэк)
- [x] **БД миграции** — SQL-файлы, embed.FS, up/down-миграции
- [x] **App.tsx missing imports** — исправлены (`gradients`, `setInitializing`)
- [x] **Нижняя панель** — удалена дублирующаяся панель

### Исправленные баги

1. **Layout: дети не двигались за родителем** → `shiftSubtree()` — `frontend/src/renderer/layout.ts`
2. **Drag: race condition event listeners** → `useRef` для `handlePointerMove`/`handlePointerUpGlobal`
3. **MoveTopic: удаление раньше поиска** → сначала найти target, потом удалить source
4. **WebSocket: Strict Mode double-mount** → guard `readyState`
5. **Nested SVG: двойной `<svg>`** → renderer возвращает `<g>`
6. **`collectBounds` не вызывался** → добавлен вызов перед shift
7. **App.tsx: missing `gradients` import** → ReferenceError исправлен
8. **App.tsx: `setInitializing` undefined** → мёртвый код удалён
9. **TopicNode.tsx: CSS `font` shorthand** → отдельные свойства
10. **PropertiesPanel/StylePanel: NaN при font size** → `isNaN` guard
11. **Fold Animation: children не анимировали скрытие** → `visibility` применяется после transition
12. **Chevron Hit Area: мелкая область** → увеличена в 2x

---

## Векторы развития (приоритеты)

### V3.7 — Agent Ecosystem (P2)
- [x] **Agent Zustand store** — `store/agent.ts`
- [x] **Per-agent model/provider** — выбор модели и провайдера
- [ ] **Agent task submission UI** — кнопка "Submit Task" на AgentCard
- [ ] **Agent streaming** — WebSocket стриминг мыслей/действий агента (`agent:thought`)
- [ ] **Agent chaining** — передача результата одного агента другому
- [ ] **Per-agent model presets** — выпадающий список моделей
- [ ] **Agent schedule** — отложенные/периодические задачи (cron)

### V3.8 — Социальные фичи (P2)
- [ ] **OT/CRDT** — операционные трансформации для совместной работы без конфликтов
- [ ] **Comments** — комментирование конкретных нод, треды
- [ ] **History timeline** — временная шкала изменений документа
- [ ] **Shareable links** — публичные ссылки на workbook с read-only доступом

### V3.9 — Экспорт/Импорт (P2)
- [ ] **Export Markdown** — обратный экспорт mindmap в .md
- [ ] **Export FreeMind** — обратный экспорт в .mm
- [ ] **Import XMind v2** — поддержка новой версии .xmind формата
- [ ] **Export OPML** — для совместимости с другими mindmap-инструментами
- [ ] **Batch import** — массовый импорт нескольких файлов

### V4.0 — Производительность (P3)
- [ ] **Worker-based layout** — Web Worker для тяжёлых деревьев (1000+ nodes)
- [ ] **Canvas/SVG hybrid** — Canvas (производительность) + SVG overlay (точность)
- [ ] **Virtual scrolling** — виртуализация для списков
- [ ] **Lazy topic loading** — lazy loading глубоких поддеревьев

### V4.1 — Нативное приложение (P3)
- [ ] **Tauri desktop** — нативное приложение с Tauri v2
- [ ] **Mobile PWA** — адаптация интерфейса для мобильных устройств

### V4.2 — Продвинутый AI (P2)
- [ ] **AI Agent авто-действия** — агенты сами предлагают/выполняют действия
- [ ] **Local model inference** — полностью локальный режим без внешних API
- [ ] **RAG over mindmaps** — AI получает контекст из всех пользовательских карт