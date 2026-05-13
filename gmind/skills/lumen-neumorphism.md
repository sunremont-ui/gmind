# Skill: Lumen Neumorphism — Component Style Guide

Паттерны не́йморфного дизайна Lumen для React-компонентов.

## Принципы

1. **Двойные тени**: тёмная offset (bottom-right) + светлая offset (top-left)
2. **Фон элемента = фон поверхности**: не́йморфизм работает за счёт теней, не цвета
3. **Raised** (приподнят): торчит из поверхности (кнопки, карточки)
4. **Recessed** (утоплен): вдавлен в поверхность (панели, инпуты, треки)

## Токены (`tokens.ts`)

```typescript
// Raised
neuSm: '3px 3px 7px rgba(120,140,180,0.26), -3px -3px 7px #FFFFFF'
neuMd: '5px 5px 12px rgba(120,140,180,0.30), -5px -5px 12px #FFFFFF'
neuLg: '10px 10px 26px rgba(120,140,180,0.22), -10px -10px 26px #FFFFFF'

// Recessed
neuInset: 'inset 2px 2px 6px rgba(120,140,180,0.26), inset -2px -2px 6px #FFFFFF'
neuInsetSm: 'inset 1px 1px 2px rgba(120,140,180,0.30), inset -1px -1px 2px #FFFFFF'
```

## Компонентные паттерны

### 1. Панель / Toolbar (recessed)
```tsx
<div style={{
  background: colors.bgTertiary,
  boxShadow: shadows.neuInset,
}}>
  {/* raised children here */}
</div>
```

### 2. Кнопка (raised → pressed)
```tsx
<button style={{
  background: 'transparent',
  boxShadow: active ? shadows.neuInsetSm : shadows.neuSm,
  transition: `all ${transitions.fast}`,
}}
  onMouseEnter={e => e.currentTarget.style.boxShadow = shadows.neuInsetSm}
  onMouseLeave={e => e.currentTarget.style.boxShadow = shadows.neuSm}
/>
```

### 3. Input / Select (recessed)
```tsx
<input style={{
  background: colors.bgTertiary,
  border: 'none',
  boxShadow: shadows.neuInsetSm,
}}/>
```

### 4. Card (raised)
```tsx
<div style={{
  background: colors.surface,
  border: 'none',
  boxShadow: shadows.neuMd,
}}/>
```

### 5. Switch (Lumen-style)
```tsx
<div style={{ // track
  width: 46, height: 26,
  borderRadius: radii.full,
  background: colors.bgTertiary,
  boxShadow: shadows.neuInsetSm,
}}>
  <div style={{ // thumb
    width: 20, height: 20,
    borderRadius: '50%',
    background: checked
      ? `linear-gradient(135deg, ${colors.accent}, ${colors.purple})`
      : colors.bgTertiary,
    boxShadow: checked ? shadows.neuSm : '2px 2px 5px rgba(...), -2px -2px 5px #FFF',
  }}/>
</div>
```

### 6. Segmented Tabs
```tsx
<div style={{ // track
  background: colors.bgTertiary,
  boxShadow: shadows.neuInset,
  borderRadius: 12,
}}>
  <button style={{ // active tab
    boxShadow: isActive ? shadows.neuSm : 'none',
    background: 'transparent',
  }}/>
</div>
```

### 7. Command Palette Item
```tsx
<div style={{
  borderRadius: 10,
  background: isActive ? colors.bgTertiary : 'transparent',
  boxShadow: isActive ? shadows.neuSm : 'none',
}}>
  <span style={{ // icon
    borderRadius: radii.sm,
    background: isActive ? colors.accent : colors.bgTertiary,
    color: isActive ? colors.textInverse : colors.textTertiary,
    boxShadow: isActive ? shadows.neuSm : shadows.neuInsetSm,
  }}/>
</div>
```

## Hover/Active состояния

| Состояние | Эффект |
|---|---|
| Hover (inactive button) | `boxShadow: neuInsetSm` (кажется, что кнопка вдавливается) |
| Hover (card) | `boxShadow: neuLg` (поднимается выше) |
| Active/Pressed | `boxShadow: neuInsetSm` + `transform: scale(0.97)` |
| Focus (input) | `boxShadow: neuInsetSm, 0 0 0 3px accentLight` |

## Проверка контрастности

Не́йморфизм работает только когда фон элемента совпадает с фоном родителя:
- Recessed панели: `bgTertiary` (canvas) + `neuInset`
- Raised кнопки на панели: `transparent` (наследует bgTertiary) + `neuSm`
- Карточки на светлом фоне: `surface` (#FFF) + `neuMd`
