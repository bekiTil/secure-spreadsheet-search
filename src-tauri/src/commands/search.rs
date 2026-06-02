use tauri::State;
use serde::{Deserialize, Serialize};
use crate::AppState;
use crate::error::AppError;
use crate::db::SearchResults;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    pub dataset_id: String,
    pub query: String,
    pub columns: Vec<String>, // empty = all searchable columns
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[tauri::command]
pub async fn search_dataset(
    options: SearchOptions,
    state: State<'_, AppState>,
) -> Result<SearchResults, AppError> {
    let limit = options.limit.unwrap_or(100).min(500);
    let offset = options.offset.unwrap_or(0);

    let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    db.search(&options.dataset_id, &options.query, &options.columns, limit, offset)
}
