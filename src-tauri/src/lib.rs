pub mod commands;
pub mod crypto;
pub mod db;
pub mod bundle;
pub mod bundle_install_page;
pub mod import;
pub mod search;
pub mod backup;
pub mod error;

use tauri::Manager;
use std::sync::Mutex;

pub use error::{AppError, AppResult};

pub struct AppState {
    pub db: Mutex<db::Database>,
}

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .setup(|app| {
            // ── Initialize database ───────────────────────────────────────
            let app_dir = app
                .path_resolver()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            std::fs::create_dir_all(&app_dir)
                .expect("Failed to create app data directory");

            let db_path = app_dir.join("secure_data.db");
            let database = db::Database::open(&db_path)
                .expect("Failed to initialize database");

            app.manage(AppState {
                db: Mutex::new(database),
            });

            let window = app.get_window("main").unwrap();

            // ── Handle .companybundle passed as CLI argument ───────────────
            // Case 1: App is already installed, user double-clicks bundle → OS
            //         launches app with the bundle path as argv[1].
            if let Some(bundle_path) = std::env::args().nth(1) {
                if bundle_path.ends_with(".companybundle")
                    && std::path::Path::new(&bundle_path).exists()
                {
                    let w = window.clone();
                    let path = bundle_path.clone();
                    tauri::async_runtime::spawn(async move {
                        // Small delay so the window is ready
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                        w.emit("open-bundle", path).ok();
                    });
                }
            }

            // ── Windows: pending bundle stored before/during install ───────
            // Case 2 (Windows only): User double-clicked bundle, app wasn't
            // installed, NSIS wrote the path to registry, now app starts
            // fresh after install and should auto-open that bundle.
            #[cfg(target_os = "windows")]
            {
                if let Ok(hkcu) = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER)
                    .open_subkey("Software\\SecureSpreadsheetSearch")
                {
                    if let Ok(pending) =
                        hkcu.get_value::<String, _>("PendingBundleAfterInstall")
                    {
                        if !pending.is_empty() && std::path::Path::new(&pending).exists() {
                            // Clear the registry value immediately
                            if let Ok(key) = winreg::RegKey::predef(
                                winreg::enums::HKEY_CURRENT_USER,
                            )
                            .open_subkey_with_flags(
                                "Software\\SecureSpreadsheetSearch",
                                winreg::enums::KEY_WRITE,
                            ) {
                                key.delete_value("PendingBundleAfterInstall").ok();
                            }
                            let w = window.clone();
                            let path = pending.clone();
                            tauri::async_runtime::spawn(async move {
                                tokio::time::sleep(std::time::Duration::from_millis(800)).await;
                                w.emit("open-bundle", path).ok();
                            });
                        }
                    }
                }
            }

            // ── macOS: handle file open events ────────────────────────────
            // Case 3 (macOS): OS sends apple events for file open.
            // Tauri handles this via the file_drop_handler and system events.
            // Handled below via file-drop in the window config.

            Ok(())
        })
        .on_window_event(|event| {
            // Handle file drop into the window (drag-and-drop .companybundle)
            if let tauri::WindowEvent::FileDrop(tauri::FileDropEvent::Dropped(paths)) =
                event.event()
            {
                if let Some(path) = paths.first() {
                    if path.extension().and_then(|e| e.to_str()) == Some("companybundle") {
                        if let Ok(path_str) = path.to_str().map(|s| s.to_string()) {
                            event.window().emit("open-bundle", path_str).ok();
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::import::import_spreadsheet,
            commands::import::validate_file,
            commands::import::preview_file,
            commands::search::search_dataset,
            commands::datasets::list_datasets,
            commands::datasets::get_dataset,
            commands::datasets::rename_dataset,
            commands::datasets::delete_dataset,
            commands::bundle::create_bundle,
            commands::bundle::open_bundle,
            commands::bundle::validate_bundle,
            commands::backup::export_backup,
            commands::backup::import_backup,
            commands::settings::get_settings,
            commands::settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running application");
}
