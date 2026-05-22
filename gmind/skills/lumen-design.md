# Skill: Lumen Design System — Gmind

Этот скилл описывает как применять **Lumen Design System** при работе с фронтендом Gmind.
Для общей документации системы — см. `lumen/README.md` и `wiki/08-design-system.md`.

---

## Быстрый старт

```typescript
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, gradients } from '../../styles/tokens'
import { Stack, Text, Button, Card } from '../UI/Box'
import { Select, Field, Slider } from '../UI/Forms'
import { LumenSearch, LumenPlus, LumenZap, lumenIcons } from '../UI/LumenIcon'
```

Всё. Никаких CSS-файлов, никаких Tailwind-классов — только inline `style={}` с токенами.
CSS custom properties (`lumen.css`) доступны глобально через `var(--color-primary)` в CSS-контексте.

---

## Иконки — LumenIcon (заменяет lucide-react)

```typescript
import { LumenSearch, LumenZap, LumenUsers, LumenTrash2, lumenIcons } from '../UI/LumenIcon'
import { createElement } from 'react'

// Прямое использование
<LumenSearch size={16} strokeWidth={1.8} color={colors.textTertiary} />

// Динамически по имени из реестра
const Icon = lumenIcons['Sparkles']
createElement(Icon, { size: 15, strokeWidth: 1.8 })
```

Доступные имена (для `lumenIcons[name]`):
`Plus` `X` `Search` `ChevronRight` `ChevronDown` `ChevronLeft` `FileText` `StickyNote` `Palette` `MoveHorizontal` `Download` `Upload` `Users` `Bot` `Sparkles` `ImageIcon` `MousePointer` `Trash2` `Map` `Inbox` `Zap` `Play` `Square` `Star` `Heart` `Flag` `Lightbulb` `Target` `Crown` `Brain` `Rocket` `Code` `Bookmark` `Clock` `CheckCircle` `Cloud` `Sun` `Globe` `Lock` `Key` `Music` `Camera` `Image` `User` `Home` `Flame` `Command` `Edit2` `Undo` `Redo`

---

## Ключевые токены

### Цвета

```typescript
// Фоны
colors.bg            // #F7F7F8 — фон приложения
colors.bgSecondary   // #FFFFFF — панели, карточки
colors.bgTertiary    // #EEEEF1 — hover-фон, канвас

// Текст
colors.text          // #15151B — основной
colors.textSecondary // #57575F — вторичный
colors.textTertiary  // #76767F — тихий (placeholder)
colors.textQuaternary// #9C9CA6 — disabled

// Акцент (Lumen Indigo)
colors.accent        // #5B6CFF
colors.accentHover   // #4A56DB
colors.accentLight   // rgba(91,108,255,0.12) — мягкий фон

// Семантика
colors.green  // #10B981
colors.red    // #EF4444
colors.orange // #F59E0B
colors.purple // #8B5CF6

// Разделители
colors.separator      // rgba(0,0,0,0.08)
colors.separatorThick // rgba(0,0,0,0.16)

// Focus ring (primary glow)
colors.focusInset  // '0 0 0 4px rgba(91,108,255,0.15)'
```

### Размеры

```typescript
// Radii (Lumen scale — крупнее, чем было)
radii.sm   // 8px   — инпуты, кнопки
radii.md   // 12px  — карточки, меню
radii.lg   // 16px  — панели
radii.xl   // 20px  — модалки
radii.xxl  // 28px  — листы
radii.full // 9999  — пиллы, аватары

// Spacing (4px grid)
spacing.xs  // 4    spacing.md  // 8    spacing.lg  // 12
spacing.xl  // 16   spacing.xxxl // 24  spacing.section // 32

// Тени (двухслойные)
shadows.sm    // карточки    shadows.md    // панели
shadows.lg    // плавающие   shadows.modal // модалки
```

### Градиенты

```typescript
gradients.aurora     // #5B6CFF → #8B5CF6 → #EC4899 (hero, root-нода)
gradients.auroraSoft // мягкая версия для фонов
gradients.tide       // #06B6D4 → #0EA5E9 (медиа, data)
gradients.ember      // #F59E0B → #EC4899 (warning, hot)
gradients.forest     // #10B981 → #06B6D4 (success, growth)
```

---

## Паттерны

### Панель (sidebar-style)

```typescript
<div style={{
  width: sizes.propertiesPanel,
  background: colors.bgSecondary,
  borderLeft: `1px solid ${colors.separator}`,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: fonts.ui,
}}>
  <Stack gap={spacing.md} style={{ padding: spacing.xl }}>
    <Text size={fontSizes.title} weight={fontWeights.semibold}>Заголовок</Text>
    ...
  </Stack>
</div>
```

### Кнопка с Aurora-градиентом

```typescript
<button style={{
  background: gradients.aurora,
  color: '#fff',
  border: 'none',
  borderRadius: radii.sm,
  padding: `${spacing.sm}px ${spacing.lg}px`,
  fontFamily: fonts.ui,
  fontWeight: fontWeights.semibold,
  fontSize: fontSizes.body,
  cursor: 'pointer',
  transition: `all ${transitions.fast}`,
}}>
  Действие
</button>
```

### Floating card / modal

```typescript
<div style={{
  background: colors.bgSecondary,
  borderRadius: radii.xl,
  boxShadow: shadows.modal,
  border: `1px solid ${colors.separator}`,
  padding: spacing.xl,
}}>
  ...
</div>
```

### Frosted glass header

```typescript
<header style={{
  background: `${colors.white}e0`,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderBottom: `1px solid ${colors.separator}`,
  height: sizes.headerHeight,
}}>
  ...
</header>
```

### Mono-числа (цены, размеры файлов, таймстемпы)

```typescript
<Text mono size={fontSizes.label} color={colors.textSecondary}>
  2h 14m
</Text>
// или напрямую:
<span style={{ fontFamily: fonts.mono, fontSize: fontSizes.label }}>
  48 ms
</span>
```

### Focus state на input

```typescript
onFocus={e => {
  e.currentTarget.style.borderColor = colors.accent
  e.currentTarget.style.boxShadow = colors.focusInset
}}
onBlur={e => {
  e.currentTarget.style.borderColor = colors.separatorThick
  e.currentTarget.style.boxShadow = 'none'
}}
```

### Hover overlay (без смены цвета)

```typescript
onMouseEnter={e => e.currentTarget.style.background = colors.fillHover}
onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
```

---

## Mindmap-темы

Тема `lumen` — дефолт. Переключение через `useThemeStore`:

```typescript
import { useThemeStore } from '../../store/theme'

const { theme, setTheme } = useThemeStore()

// Применить тему:
setTheme('lumen')    // дефолт
setTheme('midnight') // тёмная
setTheme('ocean')    // синяя
```

В SVG-рендерере темы определяют:
- `theme.topic.fill/stroke/textColor` — стиль нод
- `theme.rootTopic.*` — стиль корневой ноды
- `theme.connection.stroke` — цвет связей
- `theme.gradients[]` — SVG linearGradient definitions

---

## Типичные ошибки

| Ошибка | Правильно |
|---|---|
| `color: '#5B6CFF'` | `color: colors.accent` |
| `borderRadius: 4` | `borderRadius: radii.sm` (8px) или оставь 4 только для compact menu |
| `boxShadow: '0 2px 8px rgba(0,0,0,0.1)'` | `boxShadow: shadows.sm` |
| `transition: '0.2s ease'` | `transition: \`all ${transitions.normal}\`` |
| `fontFamily: 'system-ui'` | `fontFamily: fonts.ui` |
| Градиент на иконке 20px | Только `currentColor`, градиент — на больших поверхностях |

---

## Что смотреть для референса

- `lumen/preview/` — HTML-specimen карточки всех компонентов
- `lumen/ui_kits/lumen-app/` — референсный дашборд (Sidebar, TopBar, HeroBanner, StatTile)
- `lumen/colors_and_type.css` — CSS-переменные (источник истины)
- `wiki/08-design-system.md` — полная документация в контексте Gmind
