# Responsive Layout

## Sidebar: сворачивание и изменение ширины

Левая панель поддерживает два независимых действия: сворачивание до компактной
полосы и изменение ширины развёрнутого состояния.

### Implementation

- **State:** `sidebarOpen` in `App.tsx` (default `true`)
- **Props:** `collapsed={!sidebarOpen}` + `onToggle` passed to `Sidebar`
- **Sizes:**
  - Expanded: 220–560px, стартовое/сброшенное значение `sizes.sidebar` (260px)
  - Collapsed: `sizes.sidebarCollapsed` (48px) — видна только кнопка открытия
- **Animation:** CSS `transition: width ${transitions.fast}` on the sidebar container
- **Toggle icon:** Hamburger (≡) when collapsed, arrow (←) when expanded — inline SVG
- **Persistence:** `localStorage['gmind_sidebar_width']`
- **Viewport guard:** ширина не превышает 55% текущего окна

### Resize handle

Правый край `Sidebar` — интерактивный `role="separator"` с
`aria-orientation="vertical"` и текущим значением в `aria-valuenow`.

- drag мышью: непрерывно меняет ширину, на время drag отключает выделение текста;
- `ArrowLeft` / `ArrowRight`: шаг 16px;
- двойной щелчок или `Home`: сброс к 260px;
- во время drag transition отключён, после отпускания значение сохраняется;
- в collapsed-состоянии handle скрыт, а запомненная ширина не теряется.

### File Locations

- `frontend/src/App.tsx` — state сворачивания + toggle trigger
- `frontend/src/components/Sidebar/Sidebar.tsx` — collapsed UI, resize state,
  clamp/persist, accessible separator и вертикальный scroll

### Toggle Button

```tsx
<button onClick={onToggle} title={collapsed ? 'Open sidebar' : 'Close sidebar'}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" ...>
    {collapsed ? (
      // 3 lines (hamburger)
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    ) : (
      // Arrow left + middle line
      <line x1="9" y1="4" x2="3" y2="12" />
      <line x1="9" y1="20" x2="3" y2="12" />
      <line x1="3" y1="12" x2="21" y2="12" />
    )}
  </svg>
</button>
```

## Scrollable Panels

All side panels now scroll when content overflows vertically:

| Panel | Attribute | File |
|---|---|---|
| Sidebar | `overflowY: auto` | `components/Sidebar/Sidebar.tsx` |
| AIPanel | `overflowY: auto` + `height: 100%` | `components/AIPanel/AIPanel.tsx` |
| AgentPanel | `overflowY: auto` + `height: 100%` | `components/AgentPanel/AgentPanel.tsx` |
| PropertiesPanel | `overflow: auto` + `height: 100%` | `components/PropertiesPanel/PropertiesPanel.tsx` |

Panels are rendered inside `AnimatedMount` with `position: absolute; inset: 0`. Without `height: 100%`, scroll doesn't work because the panel has no constrained height.

### AnimatedMount

`components/UI/AnimatedMount.tsx` — wraps panels for enter/exit animations:

- `type="panel-right"` — slide in from right + fade
- `type="panel-left"` — slide in from left + fade
- `type="modal"` — scale + fade
- Delays unmount until exit transition completes (`anim.dur.normal` = 200ms)

## Дерево документов

При открытом корне проекта Sidebar содержит `ProjectTree` над списком обычных
workbook. Дерево выводит только `.md`, `.markdown`, `.xmind` и их папки-предки.
Все папки изначально свёрнуты; кнопки секции сворачивают и разворачивают всё
дерево. Полное описание корневого контекста, CRUD файлов и навигации —
в [18 — Корневая навигация и дерево документов](18-project-root-navigation.md).
