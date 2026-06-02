use tauri::State;
use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::AppState;
use crate::error::AppError;
use crate::import as importer;
use crate::db::{self, Dataset};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportOptions {
    pub file_path: String,
    pub dataset_name: String,
    pub searchable_columns: Vec<String>,
    pub include_original_in_bundle: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportSummary {
    pub dataset_id: String,
    pub dataset_name: String,
    pub record_count: u64,
    pub column_names: Vec<String>,
    pub searchable_columns: Vec<String>,
    pub imported_at: String,
    pub size_bytes: u64,
}

/// Validates a file and returns its type. Does not import.
#[tauri::command]
pub async fn validate_file(file_path: String) -> Result<String, AppError> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(AppError::NotFound(file_path));
    }
    importer::validate_file(path)
}

/// Returns preview rows and detected columns — no data is stored.
#[tauri::command]
pub async fn preview_file(file_path: String) -> Result<importer::ImportPreview, AppError> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(AppError::NotFound(file_path));
    }
    importer::preview_file(path)
}

/// Full import: reads file, stores in DB, returns summary.
#[tauri::command]
pub async fn import_spreadsheet(
    options: ImportOptions,
    state: State<'_, AppState>,
) -> Result<ImportSummary, AppError> {
    let path = Path::new(&options.file_path);

    if !path.exists() {
        return Err(AppError::NotFound(options.file_path));
    }

    // Validate selected columns are non-empty
    if options.searchable_columns.is_empty() {
        return Err(AppError::Import("Please select at least one searchable column.".to_string()));
    }

    // Import file
    let import_result = importer::import_file(path)?;

    // Validate selected columns exist in the file
    for col in &options.searchable_columns {
        if !import_result.columns.contains(col) {
            return Err(AppError::Import(format!("Column '{}' not found in file", col)));
        }
    }

    let dataset_id = db::new_dataset_id();
    let now = db::now_iso();
    let size_bytes = serde_json::to_vec(&import_result.rows)
        .map(|v| v.len() as u64)
        .unwrap_or(0);

    let dataset = Dataset {
        id: dataset_id.clone(),
        name: options.dataset_name.clone(),
        source_filename: path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string(),
        record_count: import_result.row_count,
        column_names: import_result.columns.clone(),
        searchable_columns: options.searchable_columns.clone(),
        imported_at: now.clone(),
        size_bytes,
    };

    let mut db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    db.create_dataset(&dataset)?;
    db.bulk_insert_rows(&dataset_id, &import_result.rows, &options.searchable_columns)?;

    Ok(ImportSummary {
        dataset_id,
        dataset_name: options.dataset_name,
        record_count: import_result.row_count,
        column_names: import_result.columns,
        searchable_columns: options.searchable_columns,
        imported_at: now,
        size_bytes,
    })
}
