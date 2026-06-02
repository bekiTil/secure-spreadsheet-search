use tauri::State;
use crate::AppState;
use crate::error::AppError;
use crate::db::Dataset;

#[tauri::command]
pub async fn list_datasets(state: State<'_, AppState>) -> Result<Vec<Dataset>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    db.list_datasets()
}

#[tauri::command]
pub async fn get_dataset(
    dataset_id: String,
    state: State<'_, AppState>,
) -> Result<Option<Dataset>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    db.get_dataset(&dataset_id)
}

#[tauri::command]
pub async fn rename_dataset(
    dataset_id: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if new_name.trim().is_empty() {
        return Err(AppError::General("Dataset name cannot be empty".to_string()));
    }
    let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    db.rename_dataset(&dataset_id, new_name.trim())
}

#[tauri::command]
pub async fn delete_dataset(
    dataset_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    db.delete_dataset(&dataset_id)
}
