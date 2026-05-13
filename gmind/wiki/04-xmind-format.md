# XMind File Format

Формат `.xmind` — это ZIP-архив с JSON-данными внутри. Gmind поддерживает экспорт и импорт в этом формате для совместимости с XMind 2020+.

## Структура архива

```
my-map.xmind
├── content.json         # Данные mindmap
├── manifest.json        # Манифест файлов
└── META-INF/
    └── manifest.xml     # XML манифест (legacy)
```

## Экспорт

**Endpoint:** `GET /api/v1/workbooks/{id}/export`

Gmind создаёт ZIP-архив с content.json в формате XMind 2.0:

```json
{
  "version": "2.0",
  "sheets": [
    {
      "id": "uuid",
      "title": "Sheet Title",
      "topic": {
        "id": "uuid",
        "title": "Central Topic",
        "children": {
          "attached": [
            {
              "id": "uuid",
              "title": "Sub-topic",
              "children": { "attached": [...] }
            }
          ]
        }
      },
      "relationships": [...]
    }
  ]
}
```

**Файл:** `backend/internal/xmind/export.go`

## Импорт

**Endpoint:** `POST /api/v1/workbooks/import` (multipart/form-data, поле `file`)

Gmind поддерживает два формата content.json:

### JSON Array (некоторые версии XMind)
```json
[
  {
    "title": "Central Topic",
    "children": { "attached": [...] }
  }
]
```

### JSON Object (XMind 2020+)
```json
{
  "sheets": [
    {
      "title": "Sheet Title",
      "topic": { ... }
    }
  ]
}
```

**Файл:** `backend/internal/xmind/import.go`

## Совместимость

- ✅ Экспорт Gmind → открывается в XMind 2020+
- ✅ Импорт из XMind 2020+ (.xmind файлы)
- ⚠️ Импорт из XMind 8/Classic может не работать (другой формат)
- ⚠️ Некоторые фичи XMind (латекс, аудио, стикеры) не поддерживаются

## Файлы

- `backend/internal/xmind/export.go` — создание .xmind архива
- `backend/internal/xmind/import.go` — парсинг .xmind архива
