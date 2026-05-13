# Skill: Responsive Layout

Адаптивный дизайн с переключаемой боковой панелью и скроллом.

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
- Width: `sizes.sidebar` (260px)
- Normal content with buttons + workbook list

**Animation:**
```tsx
style={{
  width: collapsed ? sizes.sidebarCollapsed : sizes.sidebar,
  transition: `width ${transitions.fast}`,
  overflowY: 'auto',
}}
```

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
