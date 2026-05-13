# Skill: Export/Import Features — Gmind

## Export PNG
**Способ**: Client-side, Canvas 2D
**Поток**:
1. `XMLSerializer` сериализует `<svg>` в строку
2. `new Blob([svg], {type:'image/svg+xml'})` → blob URL
3. `new Image()` грузит SVG через blob URL
4. `canvas.getContext('2d').drawImage(img)` на canvas 2x resolution
5. `canvas.toBlob()` → download `.png`
**Файлы**: `MindMap.tsx` — кнопка Export → PNG
**Плюсы**: без зависимостей, retina-quality, offline
**Минусы**: SVG → Canvas глючит с external ресурсами и шрифтами

## Export SVG
**Способ**: Client-side, прямой download
**Поток**:
1. `new XMLSerializer().serializeToString(svgRef.current)`
2. `new Blob([svgString], {type:'image/svg+xml'})`
3. `<a download="map.svg">` click
**Файлы**: `MindMap.tsx` — кнопка Export → SVG
**Плюсы**: тривиально, vector quality, малый размер
**Минусы**: SVG должен быть самодостаточным (inline стили, base64 images)

## Export PDF
**Вариант A (print-to-PDF)**: `window.print()`
- Встроенный диалог браузера → "Save as PDF"
- Нулевой код, но UX — диалог появляется
**Вариант B (jsPDF)**: `npm install jspdf`
- `const pdf = new jsPDF(); pdf.addImage(canvasData, 'PNG', 0, 0); pdf.save('map.pdf')`
- Полный контроль, без диалога
- Зависимость ~50KB gzip
**Выбор**: Вариант B — лучше UX, контроль качества

## Import Markdown
**Способ**: Frontend парсинг + Backend API
**Поток**:
```
# Header 1     → root topic
## Header 2    → child of root
### Header 3   → child of parent
- Item         → child of nearest heading
* Item         → same as -
```
1. File picker `.md` → читаем строки
2. `parseMarkdownToTopics(text)` → `Topic[]`
3. `api.createTopic()` для каждого рекурсивно
4. reload workbook
**Файлы**: `MindMap.tsx` + новый модуль `frontend/src/utils/markdown.ts`
**Плюсы**: естественный формат, много контента
**Минусы**: нет точного depth, flat lists требуют эвристик

## Import FreeMind (.mm)
**Способ**: Backend XML parser
**Формат**:
```xml
<map version="1.0.1">
  <node TEXT="Central Topic" FOLDED="true">
    <node TEXT="Child" LINK="https://..." />
  </node>
</map>
```
**Поток**:
1. Upload `.mm` file → backend
2. `encoding/xml` парсит `<node>` → рекурсивно `Topic{}`
3. Создаёт новый Workbook с корневым топиком
**Файлы**: `backend/internal/api/import.go` + `backend/internal/freemind/parser.go`
**Плюсы**: legacy support, хорошо документирован
**Минусы**: много optional атрибутов, RichText CONTENT

## Общие паттерны

### Все экспорты
- Добавить в MindMap.tsx: `handleExportPNG()`, `handleExportSVG()`, `handleExportPDF()`
- Кнопка Export → выпадающее меню (SVG/PNG/PDF)
- Сохранять в `workbook.title`

### Все импорты  
- Добавить кнопку Import → выпадающее меню (Markdown / FreeMind / JSON уже есть)
- File picker → parse → create topics → reload
- Markdown: frontend-only
- FreeMind: backend upload
