# Gmind → Lumen Style Audit

> Сопоставление компонентов Gmind с Lumen Design System.
> Каждый компонент проверен на соответствие Lumen-стилю.

---

## Примитивы (UI kit)

| Компонент | Lumen-референс | Статус | Изменения |
|---|---|---|---|
| `Box.tsx` Button | `preview/buttons-secondary.html` | ✅ Done | Lumen nbtn: все variants с neumorph shadow, hover flattens, press recesses |
| `Box.tsx` Input | `preview/inputs.html` | ✅ Done | bgTertiary + neuInsetSm, border: none |
| `Box.tsx` Card | `preview/cards.html` | ✅ Done | neuMd + border: none |
| `Box.tsx` Badge | `preview/badges.html` | ✅ Done | neuInsetSm |
| `Box.tsx` Toggle | `preview/selection.html` .nswt | ✅ Done | Lumen nswt: 46x26 track (neuInsetSm), 20x20 thumb (gradient when on) |
| `Box.tsx` MenuItem | `preview/menu.html` | — | White bg style, non-neu |
| `Box.tsx` ToolbarButton | — | — | Простой flat button |
| `Forms.tsx` Select | `preview/inputs.html` .ninput | ✅ Done | neuInsetSm |
| `Forms.tsx` NumberInput | `preview/inputs.html` .ninput | ✅ Done | neuInsetSm |
| `Forms.tsx` Slider | `preview/selection.html` .ntrack/.nthumb | ✅ Done | neumorphic track + thumb via lumen.css, fill gradient |
| `Forms.tsx` ColorPicker | — | ✅ Done | neuInsetSm |

## Панели

| Компонент | Lumen-референс | Статус | Изменения |
|---|---|---|---|
| `ToolPanel.tsx` | `preview/mindmap.html` .toolbar | ✅ Done | neuInset container, neuSm/neuInsetSm кнопки, hover |
| `PropertiesPanel.tsx` | — (side panel) | ✅ Done | bgTertiary + neuInset, без border |
| `StylePanel.tsx` | `preview/cards.html` .ncard | ✅ Done | neuLg + border: none |
| `AIPanel.tsx` | `preview/tabs.html` .seg | ✅ Done | bgTertiary + neuInset, Lumen segmented tabs |
| `Sidebar.tsx` | `preview/tree.html` | ✅ Done | bgTertiary + neuInset, Lumen tree-view items с neuSm |
| `PresencePanel.tsx` | `preview/cards.html` | ✅ Done | neuMd |

## Модальные/всплывающие

| Компонент | Lumen-референс | Статус | Изменения |
|---|---|---|---|
| `CommandPalette.tsx` | `preview/command-palette.html` | ✅ Done | Lumen palette: bgTertiary + neuLg, поиск neuInsetSm, active item neuSm |
| `QuickCapture.tsx` | — | ✅ Done | neuLg |
| `AIServerPanel.tsx` | `preview/dialog.html` | ✅ Done | neuLg, bgTertiary, border-radius 18 |
| `AgentPanel.tsx` | `preview/dialog.html` | ✅ Done | neuLg диалог, neuMd карточки |
| `TaskList.tsx` | — | ✅ Done | neuInset container, neuSm items, neuInsetSm details |

## Мелкие UI

| Компонент | Lumen-референс | Статус | Изменения |
|---|---|---|---|
| `SaveStatusBar.tsx` | `preview/badges.html` .npill | ✅ Done | neuSm |
| `OfflineBanner.tsx` | — | ✅ Done | neuMd |
| `PWAInstallPrompt.tsx` | `preview/cards.html` | ✅ Done | neuLg |

## SVG (MindMap)

| Компонент | Lumen-референс | Статус | Изменения |
|---|---|---|---|
| `TopicNode.tsx` | `preview/mindmap.html` .node | Частично | токены заменены, AI Expand Lumen-стиль |
| `RelationshipLine.tsx` | `preview/mindmap.html` connector | Частично | использует theme gradient |
| `ErrorBoundary.tsx` | — | ✅ Done | fontSize токен |
