# Skill: Lumen Migration — Design Token Audit & Fix

Систематический процесс приведения существующих компонентов к Lumen Design System.

## Шаги

### 1. Аудит компонента

Проверь файл на hardcoded значения:

```typescript
// ❌ Hardcoded
color: '#5B6CFF'
background: 'rgba(255,255,255,0.55)'
borderRadius: 8
fontSize: 16
zIndex: 2000
marginTop: 20
color: 'white'
fill="white"

// ✅ Lumen token
color: colors.accent
background: colors.white + '8c'
borderRadius: radii.sm
fontSize: fontSizes.title
zIndex: z.modal
marginTop: spacing.xxl
color: colors.textInverse
fill={colors.white}
```

### 2. Что заменять

| Hardcoded | Lumen Token |
|---|---|
| `'#5B6CFF'` | `colors.accent` |
| `'#15151B'` | `colors.text` |
| `'#F7F7F8'` | `colors.bg` |
| `'#FFFFFF'` / `'white'` | `colors.white` (fill) / `colors.textInverse` (text on accent) |
| `'#57575F'` | `colors.textSecondary` |
| `'#76767F'` | `colors.textTertiary` |
| `'#9C9CA6'` | `colors.textQuaternary` |
| `'#EF4444'` | `colors.red` |
| `'#10B981'` | `colors.green` |
| `'#F59E0B'` | `colors.orange` |
| `'#8B5CF6'` | `colors.purple` |
| `'transparent'` | keep (no token needed) |
| `rgba(0,0,0,0.08)` | `colors.separator` |
| `rgba(0,0,0,0.16)` | `colors.separatorThick` |
| `rgba(15,15,25,0.4)` (scrim) | `colors.scrim || 'rgba(15,15,25,0.4)'` |
| `zIndex: 999/1000` | `z.overlay` / `z.modalBackdrop` |
| `zIndex: 2000` | `z.modal` (1100) или `z.modal + 900` (2000) |
| `zIndex: 3000` | `z.commandPalette` |
| `borderRadius: 4/6/8` | `radii.sm` (8) |
| `borderRadius: 10/12` | `radii.md` (12) |
| `borderRadius: 14/16` | `radii.lg` (16) |
| `borderRadius: 20` | `radii.xl` (20) |
| `borderRadius: 28` | `radii.xxl` (28) |
| `borderRadius: 9999` | `radii.full` |
| `fontSize: 11` | `fontSizes.caption` |
| `fontSize: 12` | `fontSizes.label` |
| `fontSize: 13` | `fontSizes.body` |
| `fontSize: 15` | `fontSizes.bodyLarge` / `fontSizes.subhead` |
| `fontSize: 17` | `fontSizes.title` |
| `fontSize: 20` | `fontSizes.headline` |
| `fontSize: 28` | `fontSizes.display` |
| `fontWeight: 400` | `fontWeights.regular` |
| `fontWeight: 500` | `fontWeights.medium` |
| `fontWeight: 600` | `fontWeights.semibold` |
| `fontWeight: 700` | `fontWeights.bold` |
| `margin/padding: 4` | `spacing.xs` |
| `margin/padding: 8` | `spacing.md` |
| `margin/padding: 12` | `spacing.lg` |
| `margin/padding: 16` | `spacing.xl` |
| `margin/padding: 20` | `spacing.xxl` |
| `margin/padding: 24` | `spacing.xxxl` |
| `margin/padding: 2` | `spacing.xxs` |
| `fontFamily: 'Inter'...` | `fonts.ui` |
| `fontFamily: 'JetBrains'...` | `fonts.mono` |

### 3. RGBA → Hex + Alpha

```typescript
// rgba → hex + alpha suffix
'rgba(255,255,255,0.55)' → colors.white + '8c'   // 55%
'rgba(255,255,255,0.92)' → colors.white + 'eb'   // 92%
'rgba(255,255,255,0.15)' → colors.white + '26'   // 15%
'rgba(0,0,0,0.05)'       → colors.fill
'rgba(0,0,0,0.08)'       → colors.separator
```

### 4. Shadows

```typescript
// ❌ Hardcoded
boxShadow: '0 2px 8px rgba(0,0,0,0.1)'

// ✅ Lumen token — standard
boxShadow: shadows.sm     // карточки
boxShadow: shadows.md     // панели, меню
boxShadow: shadows.lg     // floating panels
boxShadow: shadows.modal  // модалки

// ✅ Lumen token — neumorphic
boxShadow: shadows.neuSm      // raised buttons, small pills (3px offset)
boxShadow: shadows.neuMd      // raised cards, nodes (5px offset)
boxShadow: shadows.neuLg      // floating panels, dialogs (10px offset)
boxShadow: shadows.neuInset   // recessed panels, toolbar trays
boxShadow: shadows.neuInsetSm // pressed buttons, inputs, badges
```

### 5. Neumorphic patterns

| Элемент | Стиль | Пример |
|---|---|---|
| Toolbar/панель | Recessed (neuInset) | `bgTertiary + neuInset` |
| Кнопка inactive | Raised (neuSm) | `bg: transparent, boxShadow: neuSm` |
| Кнопка active/pressed | Inset (neuInsetSm) | `boxShadow: neuInsetSm` |
| Input/Select | Inset (neuInsetSm) | `bgTertiary + neuInsetSm, border: none` |
| Карточка/Card | Raised (neuMd/neuLg) | `bg: surface, boxShadow: neuMd, border: none` |
| Команда palette | Strong raised (neuLg) | `bgTertiary + neuLg` |
| Switch track | Inset (neuInsetSm) | `46x26, neuInsetSm` |
| Switch thumb on | Gradient + raised | `linear-gradient(accent, purple) + neuSm` |
| Badge/Pill | Inset (neuInsetSm) | `neuInsetSm` |
| Modal dialog | Strong raised (neuLg) | `neuLg, border-radius 18` |
| Hover flatten | remove shadow | `boxShadow: none` / `boxShadow: neuInsetSm` |
| Tab (segmented) | Track inset, active raised | Track: `neuInset`, active tab: `neuSm` |

### 6. Transitions

```typescript
// ❌ Hardcoded
transition: '0.2s ease'

// ✅ Lumen token
transition: `all ${transitions.fast}`    // 120ms (hover)
transition: `all ${transitions.normal}`  // 200ms (state)
transition: `all ${transitions.slow}`    // 320ms (layout)
```

### 7. Import checklist

```typescript
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, gradients, z, sizes } from '../../styles/tokens'
```
