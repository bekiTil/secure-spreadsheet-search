use tauri::State;
use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::AppState;
use crate::error::AppError;
use crate::backup;

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupResult {
    pub output_path: String,
    pub dataset_count: usize,
}

#[tauri::command]
pub async fn export_backup(
    output_path: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<BackupResult, AppError> {
    if password.len() < 8 {
        return Err(AppError::Bundle("Backup password must be at least 8 characters".to_string()));
    }

    let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    let dataset_count = db.list_datasets()?.len();
    backup::export_backup(Path::new(&output_path), &db, &password)?;

    Ok(BackupResult { output_path, dataset_count })
}

#[tauri::command]
pub async fn import_backup(
    backup_path: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    let mut db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    backup::import_backup(Path::new(&backup_path), &mut db, &password)
}
