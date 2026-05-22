# 08 — Дизайн-система (Lumen)

Gmind использует **Lumen Design System** — Apple/Google-вдохновлённую дизайн-систему с выразительными градиентами, Inter-типографикой и семантическими токенами.

Исходник системы: `lumen/` (токены, превью, UI-кит).
Имплементация: `frontend/src/styles/tokens.ts`, `frontend/src/components/UI/`.

---

## Цветовая палитра

### Акцент — Lumen Indigo

| Токен | Значение | Назначение |
|---|---|---|
| `colors.accent` | `#5B6CFF` | Кнопки primary, ссылки, активные иконки |
| `colors.accentHover` | `#4A56DB` | Hover на accent-элементах |
| `colors.accentLight` | `rgba(91,108,255,0.12)` | Мягкий фон выделения (active bg) |
| `colors.accentDark` | `#3B45B0` | Press/selected состояние |

### Нейтральные (светлая тема)

| Токен | Значение | Назначение |
|---|---|---|
| `colors.bg` | `#F7F7F8` | Фон приложения |
| `colors.bgSecondary` | `#FFFFFF` | Панели, карточки |
| `colors.bgTertiary` | `#EEEEF1` | Hover-фон, канвас mindmap |
| `colors.canvas` | `#EEEEF1` | SVG-холст mindmap |
| `colors.text` | `#15151B` | Основной текст |
| `colors.textSecondary` | `#57575F` | Вторичный текст, лейблы |
| `colors.textTertiary` | `#76767F` | Третичный, плейсхолдеры |
| `colors.textQuaternary` | `#9C9CA6` | Отключённые, hint-текст |
| `colors.textInverse` | `#FFFFFF` | Текст на тёмном фоне |

### Семантические

| Токен | Значение | Назначение |
|---|---|---|
| `colors.green` | `#10B981` | Успех, онлайн-статус |
| `colors.red` | `#EF4444` | Ошибка, удаление |
| `colors.orange` | `#F59E0B` | Предупреждение, offline |
| `colors.purple` | `#8B5CF6` | Violet-акцент |

### Разделители / границы

```typescript
colors.separator       // rgba(0,0,0,0.08)  — тонкие линии
colors.separatorThick  // rgba(0,0,0,0.16)  — заметные границы
colors.separatorHeavy  // rgba(0,0,0,0.24)  — сильный акцент
```

### Градиенты

```typescript
import { gradients } from '../styles/tokens'

gradients.aurora     // linear-gradient(135deg, #5B6CFF, #8B5CF6, #EC4899) — hero/бренд
gradients.auroraSoft // мягкая версия aurora (с opacity) — фоны
gradients.tide       // linear-gradient(135deg, #06B6D4, #0EA5E9) — медиа/чарты
gradients.ember      // linear-gradient(135deg, #F59E0B, #EC4899) — предупреждения
gradients.forest     // linear-gradient(135deg, #10B981, #06B6D4) — успех
```

**Правило:** градиенты только на крупных поверхностях (hero-блок, root-нода, иллюстрации). На элементах ≤32px — цвет становится грязным.

---

## Типографика

**Шрифты загружаются в `frontend/index.html` из Google Fonts:**
- **Inter Variable** — основной UI-шрифт (веса 300–800)
- **JetBrains Mono** — код, временны́е метки, числа с выравниванием

```typescript
fonts.ui    // 'Inter', ui-sans-serif, system-ui, -apple-system, ...
fonts.mono  // 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, ...
```

**Размеры шрифта:**

| Токен | px | Использование |
|---|---|---|
| `fontSizes.caption` | 11 | Eyebrow-лейблы, метки в UPPERCASE |
| `fontSizes.label` | 12 | Подписи, бейджи, caption |
| `fontSizes.body` | 13 | Основной текст UI |
| `fontSizes.bodyLarge` | 15 | Увеличенный контентный текст |
| `fontSizes.subhead` | 15 | Подзаголовок секции |
| `fontSizes.title` | 17 | Заголовок панели/секции |
| `fontSizes.headline` | 20 | Большой заголовок |
| `fontSizes.display` | 28 | Display-текст (hero) |

**Веса:**
```typescript
fontWeights.regular  // 400
fontWeights.medium   // 500
fontWeights.semibold // 600
fontWeights.bold     // 700
```

---

## Spacing (4px сетка)

```typescript
spacing.xxs     // 2px
spacing.xs      // 4px
spacing.sm      // 6px
spacing.md      // 8px   ← базовый блок
spacing.lg      // 12px
spacing.xl      // 16px
spacing.xxl     // 20px
spacing.xxxl    // 24px
spacing.section // 32px
spacing.block   // 48px
```

---

## Border Radius (Lumen scale)

| Токен | px | Назначение |
|---|---|---|
| `radii.sm` | 8 | Инпуты, кнопки, чипы, теги |
| `radii.md` | 12 | Карточки, дропдауны, меню |
| `radii.lg` | 16 | Большие карточки, боковые панели |
| `radii.xl` | 20 | Модальные окна |
| `radii.xxl` | 28 | Полноэкранные листы |
| `radii.full` | 9999 | Пилл-кнопки, аватары, круглые элементы |

---

## Тени (двухслойные, Lumen)

Всегда используй тени из токенов — ambient + soft слой:

```typescript
shadows.hairline  // 0 0 0 1px rgba(15,15,25,0.08)           — граница-волос
shadows.sm        // ambient + soft (мелкие карточки, инпуты)
shadows.md        // панели, выпадающие списки
shadows.lg        // плавающие элементы, тултипы
shadows.xl        // модальные окна, оверлеи
shadows.modal     // алиас xl для модалок
```

Для focus-состояний: `boxShadow: colors.focusInset` — `0 0 0 4px rgba(91,108,255,0.15)`.

---

## Анимации (Lumen easing)

```typescript
transitions.fast   // 120ms cubic-bezier(0.32, 0.72, 0, 1)   — нажатия, press-in
transitions.normal // 200ms cubic-bezier(0.32, 0.72, 0, 1)   — hover, state change
transitions.slow   // 320ms cubic-bezier(0.16, 1, 0.3, 1)    — layout-сдвиги, reveal
transitions.spring // 320ms cubic-bezier(0.16, 1, 0.3, 1)    — spring-like transitions
```

**Паттерн нажатия:** `scale(0.98)` + 10% overlay, 120ms in / 240ms out. Никаких bounce-эффектов.

Использование:
```typescript
transition: `all ${transitions.fast}`      // для кнопок
transition: `color ${transitions.normal}`  // для текстовых изменений
transition: `background ${transitions.fast}, transform ${transitions.fast}`
```

---

## Темы mindmap

Список тем в `frontend/src/types/theme.ts`. **Тема по умолчанию — Lumen** (первая в массиве `themes[]`).

| ID | Название | Характер |
|---|---|---|
| `lumen` | **Lumen** | Indigo + Violet + Coral, нейтральный фон — **дефолт** |
| `vivid` | Vivid | Purple + Pink + Blue |
| `sunset` | Sunset | Orange + Red + Coral |
| `ocean` | Ocean | Cyan + Blue + Teal |
| `forest` | Forest | Green + Emerald + Yellow |
| `midnight` | Midnight | Тёмный Indigo (для тёмной темы) |
| `silicon` | Silicon | Нейтральные серые |
| `lavender` | Lavender | Purple + Indigo |
| `peach` | Peach | Orange + Warm |
| `aurora` | Aurora | Multi-color rainbow |

**Добавление новой темы:**

```typescript
// frontend/src/types/theme.ts
{
  id: 'my-theme',
  name: 'My Theme',
  background: '#...',
  canvasBackground: '#...',
  gradients: [ /* SVG linearGradient definitions */ ],
  topic: { fill, stroke, textColor, fontSize: 14, borderRadius: 12, fontFamily: "'Inter', system-ui, sans-serif", ... },
  rootTopic: { fill, stroke, textColor, fontSize: 16, borderRadius: 12, ... },
  connection: { stroke, strokeWidth: 2, opacity: 0.7, style: 'solid' },
}
```

---

## UI-примитивы

Все UI-компоненты в `frontend/src/components/UI/`:

### Box.tsx

| Компонент | Props ключевые | Назначение |
|---|---|---|
| `Stack` | `direction`, `gap`, `align`, `justify` | Flex-контейнер |
| `Text` | `size`, `weight`, `color`, `secondary`, `mono`, `truncate` | Стилизованный текст |
| `Button` | `variant` (primary/secondary/ghost/danger), `size` (sm/md/lg), `icon` | Кнопка Lumen-style |
| `Input` | `value`, `onChange`, `placeholder`, `rows` | Текстовый ввод / textarea |
| `Divider` | — | Разделитель |
| `Badge` | `color`, `dot` | Бейдж / чип |
| `Section` | `title`, `right` | Секция с заголовком |
| `Card` | `padding`, `hoverable`, `onClick` | Карточка с тенью |
| `SectionHeader` | `title`, `open`, `onToggle`, `count` | Collapsible-заголовок |
| `MenuItem` | `onClick`, `danger`, `disabled` | Пункт меню |
| `ToolbarButton` | `disabled`, `title`, `active` | Кнопка тулбара |
| `Toggle` | `checked`, `onChange`, `label` | iOS-style переключатель |

### Forms.tsx

| Компонент | Назначение |
|---|---|
| `Select` | Выпадающий список |
| `NumberInput` | Числовой ввод с суффиксом |
| `Slider` | Ползунок диапазона |
| `ColorPicker` | Цветовой пикер |
| `Field` | Обёртка поля с лейблом |
| `Grid` | 2+ колоночная сетка |

---

## Шаблон компонента

```typescript
// components/MyFeature/MyFeature.tsx
import { useState } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, gradients } from '../../styles/tokens'
import { Stack, Text, Button, Card } from '../UI/Box'
import { Select, Field } from '../UI/Forms'

interface MyFeatureProps {
  workbookId: string
  onClose: () => void
}

export function MyFeature({ workbookId, onClose }: MyFeatureProps) {
  const [value, setValue] = useState('')

  return (
    <Card style={{ borderRadius: radii.lg, boxShadow: shadows.md }}>
      <Stack gap={spacing.lg} style={{ padding: spacing.xl, fontFamily: fonts.ui }}>
        <Text size={fontSizes.title} weight={fontWeights.semibold} color={colors.text}>
          Заголовок
        </Text>
        <Text size={fontSizes.body} color={colors.textSecondary}>
          Описание компонента
        </Text>
        <Field label="Параметр">
          <Select
            value={value}
            onChange={setValue}
            options={[{ value: 'a', label: 'Опция A' }]}
          />
        </Field>
        <Button variant="primary" onClick={onClose}>Применить</Button>
      </Stack>
    </Card>
  )
}
```

---

## Иконки — LumenIcon

Проект использует **кастомную библиотеку `LumenIcon`** (`frontend/src/components/UI/LumenIcon.tsx`) вместо lucide-react.

```typescript
import { LumenPlus, LumenSearch, LumenZap, LumenUsers, LumenTrash2, lumenIcons } from '../UI/LumenIcon'

// Прямое использование
<LumenSearch size={16} strokeWidth={1.8} color={colors.textTertiary} />

// Через реестр (для динамических иконок)
import { createElement } from 'react'
const Icon = lumenIcons['Sparkles']  // lookup по имени
createElement(Icon, { size: 15, strokeWidth: 1.8 })
```

**Доступные иконки:** Plus, X, Search, ChevronRight, ChevronDown, ChevronLeft, FileText, StickyNote, Palette, MoveHorizontal, Download, Upload, Users, Bot, Sparkles, ImageIcon, MousePointer, Trash2, Map, Inbox, Zap, Play, Square, Star, Heart, Flag, Lightbulb, Target, Crown, Brain, Rocket, Code, Bookmark, Clock, CheckCircle, Cloud, Sun, Globe, Lock, Key, Music, Camera, Image, User, Home, Flame, Command, Edit2, Undo, Redo.

**Размеры по контексту:**
- 14px — dense (sidebar, badges)
- 16px — body (content, tooltips)
- 20px — toolbar default
- 24px — prominent actions

**strokeWidth:** всегда 1.5–2.0px. Никогда fill у stroke-иконок.

---

## CSS Custom Properties

С версии Phase 2 дизайн-система также предоставляет CSS custom properties через `frontend/src/styles/lumen.css`:

```css
/* Подключено глобально через main.tsx → import './styles/lumen.css' */
/* body получает class="lds-body" в index.html */

var(--color-bg)           /* фон приложения */
var(--color-primary)      /* Lumen Indigo */
var(--gradient-aurora)    /* aurora-градиент */
var(--shadow-md)          /* тень уровня md */
var(--font-sans)          /* Inter */
```

CSS variables дублируют TypeScript-токены — используй их в CSS-файлах, а `tokens.ts` в inline styles.

**Dark mode:** переключается `[data-theme="dark"]` на `<html>` или `<body>`.

**Neumorphic shadows** (дополнительный набор для специальных компонентов):
```typescript
shadows.neuSm        // 3px raised — мягкий объём
shadows.neuLg        // 10px raised — выраженный
shadows.neuInsetSm   // recessed — поля ввода, активные элементы
```

---

## Правила дизайна

1. **Только токены** — не хардкоди цвета, размеры или тени. Только `colors.*`, `spacing.*`, `radii.*`, `shadows.*`
2. **Градиенты сдержанно** — только на крупных hero-элементах, не на кнопках меньше 32px
3. **Иконки** — `LumenIcon`, strokeWidth 1.5–2px, `color={colors.textTertiary}` / `currentColor`, размер по контексту
4. **Двухслойные тени** — только `shadows.*`, не создавай кастомные
5. **Focus ring** — `boxShadow: colors.focusInset` (primary glow), не outline
6. **Анимации** — только `transitions.*`, без bounce
7. **Шрифт** — `fonts.ui` везде, `fonts.mono` для чисел/кода/таймстемпов
8. **Sentence case** — кнопки и заголовки в нижнем регистре: `Сохранить`, не `СОХРАНИТЬ`
9. **Inline styles** — весь стиль через `style={}`, без CSS-файлов и классов в компонентах

---

## Расположение исходников

```
lumen/
├── colors_and_type.css      # CSS-переменные всех токенов (light + dark) — источник истины
├── README.md                # Voice/tone, правила, иконография
├── SKILL.md                 # Манифест скилла для Claude
├── assets/
│   ├── lumen-logo.svg
│   └── lumen-wordmark.svg
├── preview/                 # 60+ HTML-specimen карточек
└── ui_kits/lumen-app/       # Референсный дашборд (JSX компоненты)

frontend/src/
├── styles/
│   ├── tokens.ts            # TypeScript-токены (inline styles)
│   └── lumen.css            # CSS custom properties (глобально импортирован)
├── components/UI/
│   ├── Box.tsx              # Примитивы: Stack, Text, Button, Input, ...
│   ├── Forms.tsx            # Формы: Select, Slider, ColorPicker, ...
│   └── LumenIcon.tsx        # Кастомная иконная библиотека (35+ иконок)
└── types/theme.ts           # Темы mindmap (10 тем, Lumen — дефолт)
```
