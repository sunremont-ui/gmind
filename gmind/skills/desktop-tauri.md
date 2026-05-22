# Skill: Desktop (Tauri v2) — Gmind Windows

## Статус: ✅ Production-ready (все gaps закрыты, 2026-05-14)

**Порты:** devUrl=`http://localhost:1011`, backend API=`:1010`. Диапазон 1010–1200 зарезервирован для Gmind.

**Для первого релиза:** `git tag v1.0.0 && git push --tags` → GitHub Actions собирает `.msi` → GitHub Release Draft.

---

## Всё реализовано ✅

### Sidecar Backend ✅
Go бэкенд запускается как sidecar-процесс Tauri v2.

- `src-tauri/src/lib.rs` — `app.shell().sidecar("gmind-server")?.spawn()` в `setup()`; `child.kill()` в `RunEvent::Exit`
- `tauri.conf.json` — `externalBin: ["binaries/gmind-server"]`
- `capabilities/default.json` — `shell:allow-execute`
- `Makefile` — цели: `tauri-dev`, `tauri-build`, `tauri-sidecar`
- `build-sidecar.bat` — сборка Go бинарника в `src-tauri/binaries/gmind-server-x86_64-pc-windows-msvc.exe`

### Data Paths ✅
- `config.go` — `GMIND_DATA_DIR` env, fallback `os.UserConfigDir()/Gmind`
- `lib.rs` — `cmd.env("GMIND_DATA_DIR", app.path().app_data_dir()?)` перед spawn
- DB, wiki, notes — все пути строятся от `dataDir`

### System Tray ✅
- Иконка в трее при запуске
- Левый клик → toggle show/hide (не только show)
- Контекстное меню (правый клик): **Show/Hide** / **Quick Capture...** / **Quit**
- Закрытие окна (×) → hide в трей, приложение не завершается
- `on_tray_icon_event` фильтрует `MouseButton::Left`; правый клик → нативное `.menu()` автоматически

### Health Polling + Splash Screen ✅
- Main window `visible: true` сразу при запуске (нет белого flash)
- `SplashScreen.tsx` — брендированный экран до `backendReady`
- `App.tsx` poll `/health` каждые 150ms; secrets inject параллельно через `Promise.all`
- `main.go` — ранний TCP-listener (`atomicRouter`): 503 до ready, затем полный router (~400ms vs ~750ms)

### Stronghold → AI Keys ✅
- Все AI ключи (OpenAI, Yandex) хранятся в Stronghold (OS keychain)
- `AIServerPanel.tsx` — load secrets при открытии, save при apply
- `App.tsx` startup injection: `POST /api/v1/config` после backendReady
- `api/secrets.ts` — полная JS API (`@tauri-apps/plugin-stronghold`)
- Vault: `secrets.hold` в app_data_dir (хардкожен в lib.rs)
- Stronghold операции — только через JS (Rust API приватен в плагине 2.3.1)

### Global Shortcut ✅
- `Ctrl+Shift+Space` — Quick Capture из любого приложения
- `Ctrl+Shift+G` (default, настраиваемый) — показать/скрыть главное окно
- `CurrentMainShortcut(Mutex<String>)` managed state — корректный unregister при смене

### Settings Modal ✅ (V3.9)
- Автостарт (tauri-plugin-autostart), `startMinimized`, startup agents, configurable shortcut
- `tauri-plugin-store` → `settings.json` в app_data_dir
- `SettingsModal.tsx` — 3 секции: Запуск / Агенты при старте / Горячие клавиши

### NSIS Installer ✅
- `bundle.targets: ["nsis"]`, Desktop+StartMenu shortcuts
- `installMode: perMachine`

### Auto-Updater ✅
- `tauri-plugin-updater` endpoint: `github.com/greengo0/gmind/releases`
- Активируется через `git tag v1.0.0 && git push --tags`

---

## Критичные API-изменения (tauri-plugin-stronghold 2.3.1)

- `Stronghold`/`Client` — **приватные** типы, все операции только через JS API
- `Builder::with_argon2(&Path)` — путь к salt-файлу, не строка
- `.build()` возвращает `TauriPlugin` напрямую (без `.expect()`)
- Регистрация через `app.handle().plugin(...)` в `setup()`

## Критичные API-изменения (Tauri v2 tray)

- `on_tray_event` → `on_tray_icon_event`
- Callback arg: `tray: &TrayIcon<R>` → используй `tray.app_handle()`
- Правый клик показывает `.menu()` **автоматически** — не обрабатывать в event handler

---

## Файлы

| Файл | Назначение |
|------|-----------|
| `frontend/src-tauri/src/lib.rs` | Rust: setup, sidecar, tray, shortcuts, Stronghold, quick_capture |
| `frontend/src-tauri/tauri.conf.json` | Конфигурация: окна, bundle, CSP, externalBin |
| `frontend/src-tauri/Cargo.toml` | Зависимости: plugins (shell, stronghold, shortcut, dialog) |
| `frontend/src-tauri/capabilities/default.json` | shell:allow-execute permissions |
| `frontend/src-tauri/icons/` | Иконки приложения (PNG, ICO) |
| `Makefile` | Цели: `tauri-dev`, `tauri-build`, `tauri-sidecar` |
| `build-sidecar.bat` | Сборка Go бинарника → `src-tauri/binaries/` |

## Команды

```bash
# Сборка sidecar
make tauri-sidecar
# или
build-sidecar.bat

# Dev запуск (Tauri + React + Go)
make tauri-dev

# Production build (генерирует .msi)
make tauri-build
```
