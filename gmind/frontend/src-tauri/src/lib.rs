use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

#[tauri::command]
async fn quick_capture(text: String) -> Result<(), String> {
    let client = reqwest::Client::new();

    // 1. Find inbox workbook ID
    let inbox = client
        .get("http://localhost:8080/api/v1/workbooks")
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

    // 2. Get workbook — sheets[0].root_topic.id contains the root topic
    let wb = client
        .get(format!(
            "http://localhost:8080/api/v1/workbooks/{}",
            inbox_id
        ))
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

    // 3. Create topic under root
    let body = serde_json::json!({
        "title": text,
        "parent_id": root_id,
    });

    let create_res = client
        .post(format!(
            "http://localhost:8080/api/v1/workbooks/{}/topics",
            inbox_id
        ))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to create topic: {}", e))?;

    if !create_res.status().is_success() {
        let status = create_res.status();
        let body = create_res.text().await.unwrap_or_default();
        return Err(format!("Save failed ({}): {}", status, body));
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let show = MenuItemBuilder::with_id("show", "Show Gmind").build(app)?;
            let capture = MenuItemBuilder::with_id("capture", "Quick Capture...").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&capture)
                .separator()
                .item(&show)
                .item(&quit)
                .build()?;

            // Intercept capture window close — hide instead of destroy
            if let Some(capture_win) = app.get_webview_window("capture") {
                let win = capture_win.clone();
                capture_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            let icon = app.default_window_icon().cloned()
                .unwrap_or_else(|| {
                    Image::from_bytes(include_bytes!("../icons/icon.png"))
                        .expect("Failed to load tray icon")
                });

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
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
                .build(app)?;

            let handle = app.handle().clone();
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(w) = handle.get_webview_window("capture") {
                        let _ = w.show();
                        let _ = w.set_focus();
                        let _ = w.center();
                    }
                }
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![quick_capture])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("Tauri error: {}", e));
}
