use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

struct BackendProcess(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

/// Tracks the currently-registered main-window shortcut string so
/// update_main_shortcut can unregister the exact previous value.
struct CurrentMainShortcut(Mutex<String>);

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn quick_capture(text: String) -> Result<(), String> {
    let client = reqwest::Client::new();

    let inbox = client
        .get("http://localhost:1010/api/v1/workbooks")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch workbooks: {}", e))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse workbooks: {}", e))?;

    let inbox_id = inbox
        .as_array()
        .and_then(|arr| {
            arr.iter().find(|wb| {
                wb.get("title")
                    .and_then(|t| t.as_str())
                    .map(|t| t.contains("Inbox"))
                    .unwrap_or(false)
            })
        })
        .and_then(|wb| wb.get("id").and_then(|id| id.as_str().map(String::from)))
        .ok_or_else(|| "Inbox workbook not found".to_string())?;

    let wb = client
        .get(format!("http://localhost:1010/api/v1/workbooks/{}", inbox_id))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch inbox: {}", e))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse inbox: {}", e))?;

    let root_id = wb
        .get("sheets")
        .and_then(|s| s.as_array())
        .and_then(|arr| arr.first())
        .and_then(|s| s.get("root_topic"))
        .and_then(|t| t.get("id"))
        .and_then(|id| id.as_str().map(String::from))
        .ok_or_else(|| "No root topic found".to_string())?;

    let body = serde_json::json!({ "title": text, "parent_id": root_id });

    let res = client
        .post(format!("http://localhost:1010/api/v1/workbooks/{}/topics", inbox_id))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to create topic: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Save failed ({}): {}", status, body));
    }
    Ok(())
}

#[tauri::command]
async fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    app.autolaunch()
        .enable()
        .map_err(|e| format!("Failed to enable autostart: {}", e))
}

#[tauri::command]
async fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    app.autolaunch()
        .disable()
        .map_err(|e| format!("Failed to disable autostart: {}", e))
}

#[tauri::command]
async fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| format!("Failed to check autostart: {}", e))
}

/// Re-registers the main-window global shortcut.
/// `keys` is a string like "ctrl+shift+g". Pass empty string to unregister only.
#[tauri::command]
async fn update_main_shortcut(app: tauri::AppHandle, keys: String) -> Result<(), String> {
    let shortcuts = app.global_shortcut();

    // Unregister the previously-registered shortcut using stored state.
    if let Some(state) = app.try_state::<CurrentMainShortcut>() {
        let prev = state.0.lock().unwrap().clone();
        if !prev.is_empty() {
            if let Ok(s) = parse_shortcut(&prev) {
                let _ = shortcuts.unregister(s);
            }
        }
    }
    // Also try to unregister the new key in case it was registered by something else.
    if !keys.is_empty() {
        if let Ok(s) = parse_shortcut(&keys) {
            let _ = shortcuts.unregister(s);
        }
    }

    // Update stored state.
    if let Some(state) = app.try_state::<CurrentMainShortcut>() {
        *state.0.lock().unwrap() = keys.clone();
    }

    if keys.is_empty() {
        return Ok(());
    }

    let shortcut = parse_shortcut(&keys)
        .map_err(|e| format!("Invalid shortcut '{}': {}", keys, e))?;

    shortcuts.on_shortcut(shortcut, move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            if let Some(w) = app.get_webview_window("main") {
                if w.is_visible().unwrap_or(false) {
                    let _ = w.hide();
                } else {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        }
    })
    .map_err(|e| format!("Failed to register shortcut: {}", e))
}

// ── Shortcut parser ───────────────────────────────────────────────────────────

fn parse_shortcut(keys: &str) -> Result<Shortcut, String> {
    let lower = keys.to_lowercase();
    let parts: Vec<&str> = lower.split('+').map(str::trim).collect();

    let mut mods = Modifiers::empty();
    let mut code: Option<Code> = None;

    for part in &parts {
        match *part {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "shift" => mods |= Modifiers::SHIFT,
            "alt" => mods |= Modifiers::ALT,
            "meta" | "super" | "win" => mods |= Modifiers::META,
            key => {
                code = Some(match key {
                    "a" => Code::KeyA, "b" => Code::KeyB, "c" => Code::KeyC,
                    "d" => Code::KeyD, "e" => Code::KeyE, "f" => Code::KeyF,
                    "g" => Code::KeyG, "h" => Code::KeyH, "i" => Code::KeyI,
                    "j" => Code::KeyJ, "k" => Code::KeyK, "l" => Code::KeyL,
                    "m" => Code::KeyM, "n" => Code::KeyN, "o" => Code::KeyO,
                    "p" => Code::KeyP, "q" => Code::KeyQ, "r" => Code::KeyR,
                    "s" => Code::KeyS, "t" => Code::KeyT, "u" => Code::KeyU,
                    "v" => Code::KeyV, "w" => Code::KeyW, "x" => Code::KeyX,
                    "y" => Code::KeyY, "z" => Code::KeyZ,
                    "space" => Code::Space,
                    "f1" => Code::F1, "f2" => Code::F2, "f3" => Code::F3,
                    "f4" => Code::F4, "f5" => Code::F5, "f6" => Code::F6,
                    "f7" => Code::F7, "f8" => Code::F8, "f9" => Code::F9,
                    "f10" => Code::F10, "f11" => Code::F11, "f12" => Code::F12,
                    other => return Err(format!("Unknown key: {}", other)),
                });
            }
        }
    }

    let code = code.ok_or_else(|| "No key specified".to_string())?;
    Ok(Shortcut::new(if mods.is_empty() { None } else { Some(mods) }, code))
}

// ── App setup ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check for --minimized flag (passed by autostart)
    let start_minimized = std::env::args().any(|a| a == "--minimized");

    let app = tauri::Builder::default()
        .manage(CurrentMainShortcut(Mutex::new("ctrl+shift+g".to_string())))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            // Stronghold — salt file in app local data dir
            let salt_path = app
                .path()
                .app_local_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .join("gmind.salt");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
            )?;

            // If started via autostart with --minimized, hide window immediately
            if start_minimized {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }

            let handle = app.handle().clone();

            // ── Tray ──────────────────────────────────────────────────────────
            let quit    = MenuItemBuilder::with_id("quit",     "✕  Quit Gmind").build(app)?;
            let show    = MenuItemBuilder::with_id("show",     "◉  Show / Hide").build(app)?;
            let capture = MenuItemBuilder::with_id("capture",  "✦  Quick Capture...").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&capture)
                .separator()
                .item(&quit)
                .build()?;

            if let Some(win) = app.get_webview_window("capture") {
                let w = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }

            let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
                Image::from_bytes(include_bytes!("../icons/icon.png"))
                    .expect("Failed to load tray icon")
            });

            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.clone().on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_win.hide();
                    }
                });
            }

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                    "capture" => {
                        if let Some(w) = app.get_webview_window("capture") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.center();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Only handle left-click — right-click is handled by the .menu() automatically
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // ── Shortcuts ─────────────────────────────────────────────────────
            // Ctrl+Shift+Space → Quick Capture
            let capture_shortcut =
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
            let _ = app.global_shortcut().unregister(capture_shortcut.clone());
            if let Err(e) = app.global_shortcut().on_shortcut(
                capture_shortcut,
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(w) = handle.get_webview_window("capture") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.center();
                        }
                    }
                },
            ) {
                eprintln!("[tauri] Failed to register capture shortcut: {}", e);
            }

            // Ctrl+Shift+G → toggle main window (default; overridable via update_main_shortcut)
            let main_shortcut =
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyG);
            let _ = app.global_shortcut().unregister(main_shortcut.clone());
            if let Err(e) = app.global_shortcut().on_shortcut(
                main_shortcut,
                move |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                },
            ) {
                eprintln!("[tauri] Failed to register main shortcut: {}", e);
            }

            // ── Sidecar ───────────────────────────────────────────────────────
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            let data_dir_str = data_dir.to_string_lossy().to_string();

            // Kill any stale sidecar left from a previous crash so port 8080 is free.
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/IM", "gmind-server-x86_64-pc-windows-msvc.exe"])
                .output();

            match app.shell().sidecar("gmind-server") {
                Ok(cmd) => {
                    let cmd = cmd.env("GMIND_DATA_DIR", &data_dir_str);
                    match cmd.spawn() {
                        Ok((mut rx, child)) => {
                            app.manage(BackendProcess(Mutex::new(Some(child))));
                            tauri::async_runtime::spawn(async move {
                                while let Some(event) = rx.recv().await {
                                    match event {
                                        CommandEvent::Stdout(line) => {
                                            println!("[backend] {}", String::from_utf8_lossy(&line));
                                        }
                                        CommandEvent::Stderr(line) => {
                                            eprintln!("[backend] {}", String::from_utf8_lossy(&line));
                                        }
                                        _ => {}
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            eprintln!("[tauri] Failed to spawn backend sidecar: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[tauri] Failed to create backend sidecar: {}", e);
                }
            }

            // Show main window now that React (SplashScreen) is ready to render.
            // The window was hidden to avoid the white flash before WebView initialises.
            if !start_minimized {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            quick_capture,
            enable_autostart,
            disable_autostart,
            is_autostart_enabled,
            update_main_shortcut,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<BackendProcess>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}
