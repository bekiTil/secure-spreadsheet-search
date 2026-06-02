use tauri::State;
use serde::{Deserialize, Serialize};
use crate::AppState;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,         // "system" | "light" | "dark"
    pub font_size: String,     // "normal" | "large" | "larger"
    pub auto_lock: bool,
    pub auto_lock_minutes: u32,
    pub default_search_limit: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            theme: "system".to_string(),
            font_size: "normal".to_string(),
            auto_lock: false,
            auto_lock_minutes: 15,
            default_search_limit: 100,
        }
    }
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;

    let settings = match db.get_setting("app_settings")? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => AppSettings::default(),
    };

    Ok(settings)
}

#[tauri::command]
pub async fn save_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let json = serde_json::to_string(&settings)?;
    let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    db.set_setting("app_settings", &json)
}
