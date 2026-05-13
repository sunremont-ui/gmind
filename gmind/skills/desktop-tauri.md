# Skill: Desktop (Tauri) — Gmind

## Цель
Нативное desktop-приложение: системный трей, горячие клавиши, нативные диалоги.

## План

1. **Инициализация Tauri**
   - `npm create tauri-app` в `frontend/` → создаст `src-tauri/`
   - Настроить window: title="Gmind", minWidth=800, minHeight=600

2. **System Tray**
   - Иконка в трее
   - Клик → show/hide окно
   - Контекстное меню: "Quick Capture", "Show", "Quit"

3. **Global Hotkey**
   - Ctrl+Shift+Space (или Win+Shift+G) — открывает Quick Capture из любого места
   - Даже когда приложение свёрнуто

4. **Native File Dialogs**
   - Экспорт/импорт через нативные диалоги (вместо `<input type="file">`)
   - Tauri API: `dialog.open()` / `dialog.save()`

5. **Auto-start**
   - Настройка "Launch at startup"
   - Tauri plugin: `tauri-plugin-autostart`

6. **Auto-updater**
   - Tauri updater с GitHub Releases

## Файлы
- `frontend/src-tauri/` — вся Tauri конфигурация
- `frontend/src-tauri/Cargo.toml`
- `frontend/src-tauri/tauri.conf.json`
- `frontend/src-tauri/src/main.rs`
