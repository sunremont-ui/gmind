# Skill: Responsive Layout

Адаптивный дизайн со сворачиваемой и изменяемой по ширине боковой панелью,
корневым деревом документов и скроллом.

## Sidebar Toggle

### State

```tsx
// App.tsx
const [sidebarOpen, setSidebarOpen] = useState(true)
```

### Props

```tsx
<Sidebar
  collapsed={!sidebarOpen}
  onToggle={() => setSidebarOpen(s => !s)}
/>
```

### Sidebar component

```tsx
// components/Sidebar/Sidebar.tsx
interface SidebarProps {
  activeWorkbookId: string | null
  onSelectWorkbook: (id: string) => void
  collapsed?: boolean
  onToggle?: () => void
}
```

**Collapsed mode:**
- Width: `sizes.sidebarCollapsed` (48px)
- Shows only the toggle button (hamburger icon)
- Content hidden

**Expanded mode:**
- Width: 220–560px; default/reset = `sizes.sidebar` (260px)
- Не шире 55% viewport
- Normal content with buttons + `ProjectTree` + workbook list

**Animation:**
```tsx
style={{
  width: collapsed ? sizes.sidebarCollapsed : sidebarWidth,
  transition: isResizing ? 'none' : `width ${transitions.fast}`,
  overflow: 'hidden',
}}
```

### Drag resize

Правый край Sidebar — доступный separator, а не декоративная линия:

```tsx
<div
  role="separator"
  aria-label="Изменить ширину боковой панели"
  aria-orientation="vertical"
  aria-valuemin={220}
  aria-valuemax={560}
  aria-valuenow={sidebarWidth}
  tabIndex={0}
/>
```

Инварианты:

- `pointermove` считает ширину от стартовых `clientX` и width;
- на время drag ставятся `cursor: col-resize` и `userSelect: none`, затем
  исходные значения обязательно восстанавливаются;
- `ArrowLeft`/`ArrowRight` меняют ширину на 16px;
- двойной клик и `Home` сбрасывают к `sizes.sidebar`;
- ширина сохраняется в `localStorage['gmind_sidebar_width']` только после
  завершения drag или клавиатурного изменения;
- collapsed-режим остаётся 48px и не затирает сохранённую expanded-ширину.

Реализация: `components/Sidebar/Sidebar.tsx`.

### Toggle Icon

Inline SVG: hamburger (≡) when collapsed, arrow (←) when expanded.

## Scrollable Panels

To make a panel scrollable inside `AnimatedMount` (which uses `position: absolute`):

```tsx
<div style={{
  height: '100%',            // must fill absolute parent
  overflowY: 'auto',          // scroll when content overflows
  // ...
}}>
```

| Panel | Required props |
|---|---|
| AIPanel | `height: '100%'`, `overflowY: 'auto'` |
| AgentPanel | `height: '100%'`, `overflowY: 'auto'` |
| PropertiesPanel | `height: '100%'`, `overflow: 'auto'` |
| Sidebar | `overflowY: 'auto'` |

## Корневое дерево документов

Если активна карта проекта или документ внутри неё, Sidebar показывает
`ProjectTree`. Не смешивай историю документа с Undo/Redo карты.

- Все папки при первом показе свёрнуты (`new Set()`).
- Массовое раскрытие кладёт в set все folder ids; массовое сворачивание —
  пустой set.
- Показываются только `.md`, `.markdown`, `.xmind` и папки-предки.
- Активный файл получает `aria-current="page"` и `scrollIntoView`.
- Кнопка **Карта корня** всегда возвращает корневой workbook.

Подробности: `wiki/18-project-root-navigation.md`.

## Token Sizes

```ts
// styles/tokens.ts
sizes: {
  sidebar: 260,
  sidebarCollapsed: 48,
  propertiesPanel: 280,
  aiPanel: 320,
  // ...
}
```
