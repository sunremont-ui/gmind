# Gmind — Планы и Память Сессии

> Этот файл обновляется в каждой сессии: хранит активный план, контекст и прогресс.

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
