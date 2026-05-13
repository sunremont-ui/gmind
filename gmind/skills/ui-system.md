# Skill: UI System — Gmind Frontend

## Принципы

1. **Все стили inline** — через `style={}`, никаких CSS-файлов
2. **Все цвета/размеры из tokens** — `import { colors, fonts, spacing, radii, ... } from '../../styles/tokens'`
3. **Никаких хардкод-значений** — каждый цвет, отступ, размер должен быть токеном
4. **Примитивы из Box/Forms** — прежде чем писать inline-control, проверь `Box.tsx` и `Forms.tsx`

## Дизайн-система

Gmind использует **Lumen Design System** — `lumen/` содержит исходник, `frontend/src/styles/tokens.ts` — TypeScript-имплементацию.

Полная документация: `wiki/08-design-system.md` и `skills/lumen-design.md`.

## Токены (`styles/tokens.ts`)

```
colors:      bg(#F7F7F8), bgSecondary(#FFF), bgTertiary(#EEEEF1), canvas(#EEEEF1)
             text(#15151B), textSecondary(#57575F), textTertiary(#76767F), textQuaternary(#9C9CA6)
             accent(#5B6CFF), accentHover(#4A56DB), accentLight(rgba(91,108,255,0.12))
             green(#10B981), red(#EF4444), orange(#F59E0B), purple(#8B5CF6)
             separator(rgba(0,0,0,0.08)), separatorThick(rgba(0,0,0,0.16))
             focusInset('0 0 0 4px rgba(91,108,255,0.15)')

fonts:       ui ('Inter', ui-sans-serif, ...), mono ('JetBrains Mono', ui-monospace, ...)

fontSizes:   caption(11), label(12), body(13), bodyLarge(15), subhead(15),
             title(17), headline(20), display(28)

fontWeights: regular(400), medium(500), semibold(600), bold(700)

spacing:     xxs(2), xs(4), sm(6), md(8), lg(12), xl(16), xxl(20), xxxl(24),
             section(32), block(48)

radii:       sm(8), md(12), lg(16), xl(20), xxl(28), full(9999)

shadows:     hairline, sm, md, lg, xl, modal  — двухслойные (ambient + soft)

transitions: fast(120ms ease-standard), normal(200ms ease-standard),
             slow(320ms ease-emphasized), spring(320ms ease-emphasized)

gradients:   aurora, auroraSoft, tide, ember, forest

sizes:       sidebar(260), propertiesPanel(280), aiPanel(320), headerHeight(48)
```

## Примитивы (`components/UI/Box.tsx`)

| Компонент | Props | Назначение |
|---|---|---|
| `Stack` | direction, gap, align, justify, wrap | Flex-контейнер |
| `Text` | size, weight, color, secondary, mono, truncate | Текст |
| `Button` | variant(primary/secondary/ghost/danger), size(sm/md/lg), icon | Кнопка Lumen-style |
| `Input` | value, onChange, placeholder, rows | Текстовое поле / textarea |
| `Divider` | — | Горизонтальная линия |
| `Badge` | color, dot | Чип / бейдж |
| `Section` | title, right | Секция с заголовком |
| `Card` | padding, hoverable | Карточка с тенью |
| `SectionHeader` | title, open, onToggle, count | Collapsible заголовок секции |
| `MenuItem` | onClick, danger, disabled | Пункт контекстного меню |
| `ToolbarButton` | disabled, title, active | Кнопка тулбара |
| `Toggle` | checked, onChange, label | Переключатель iOS-style |

## Формы (`components/UI/Forms.tsx`)

| Компонент | Props | Назначение |
|---|---|---|
| `Select` | value, onChange, options, placeholder | Выпадающий список |
| `NumberInput` | value, onChange, min, max, step, suffix | Числовой ввод |
| `Slider` | value, onChange, min, max, step, showValue, suffix | Ползунок |
| `ColorPicker` | value, onChange, defaultColor, onClear | Выбор цвета |
| `Field` | label, children | Обёртка поля с меткой |
| `Grid` | columns, gap | Сетка для полей |

## Шаблон компонента

```typescript
// components/MyFeature/MyFeature.tsx
import { useState, useCallback } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'
import { Stack, Text, Button } from '../UI/Box'
import { Select, NumberInput } from '../UI/Forms'

interface MyFeatureProps {
  workbookId: string
  onClose: () => void
}

export function MyFeature({ workbookId, onClose }: MyFeatureProps) {
  const [value, setValue] = useState('')

  return (
    <Stack gap={spacing.lg} style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      <Text size={fontSizes.title} weight={fontWeights.semibold}>My Feature</Text>
      <Select
        value={value}
        onChange={setValue}
        options={[
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
        ]}
      />
      <Button variant="primary" onClick={onClose}>Применить</Button>
    </Stack>
  )
}
```

## Структура директории компонента

```
components/MyFeature/
├── MyFeature.tsx        # Основной компонент
├── MyFeature.Sub.tsx    # Дочерний (если >1 файла)
└── index.ts             # re-export (опционально)
```

## Правила

1. **Один компонент = один файл.** Не пиши несколько export-ов в одном файле (кроме UI-примитивов)
2. **Zustand селекторы** — всегда используй примитивные селекторы, никогда `store.getState()` в render
3. **Auto-save** — паттерн `useCallback` + `debounceRef` (300ms), смотри `PropertiesPanel.tsx` как пример
4. **Не дублируй логику** — выноси общую логику в `utils/` или `hooks/`
5. **Lumen Design** — Inter-типографика, 8px grid, frosted glass (backdrop-filter), большие radii, двухслойные тени
6. **TypeScript** — всегда интерфейсы для props, никаких `any` в пропсах
7. **Focus states** — `boxShadow: colors.focusInset`, не outline

## Импорты (порядок)

```typescript
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useMindMapStore } from '../../store/mindmap'
import { api } from '../../api/client'
import { wsClient } from '../../api/ws'
import type { Topic } from '../../types'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, gradients } from '../../styles/tokens'
import { Stack, Text, Button, Card, SectionHeader, Toggle } from '../UI/Box'
import { Select, NumberInput, Slider, ColorPicker, Field, Grid } from '../UI/Forms'
```
