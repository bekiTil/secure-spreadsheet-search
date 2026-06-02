use tauri::State;
use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::AppState;
use crate::error::AppError;
use crate::bundle::{self, BundleManifest};
use crate::db::{self, Dataset};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBundleOptions {
    pub dataset_id: String,
    pub output_path: String,
    pub password: String,
    pub include_original: bool,
    pub original_file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenBundleResult {
    pub dataset_id: String,
    pub dataset_name: String,
    pub record_count: u64,
    pub column_names: Vec<String>,
    pub searchable_columns: Vec<String>,
}

/// Creates a .companybundle at the given output path.
#[tauri::command]
pub async fn create_bundle(
    options: CreateBundleOptions,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    if options.password.len() < 8 {
        return Err(AppError::Bundle("Password must be at least 8 characters".to_string()));
    }

    let (dataset, rows) = {
        let db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
        let dataset = db.get_dataset(&options.dataset_id)?
            .ok_or_else(|| AppError::NotFound(options.dataset_id.clone()))?;
        let rows = db.export_rows(&options.dataset_id)?;
        (dataset, rows)
    };

    let original_bytes: Option<Vec<u8>> = if options.include_original {
        if let Some(ref orig_path) = options.original_file_path {
            Some(std::fs::read(orig_path)?)
        } else {
            None
        }
    } else {
        None
    };

    let output_path = Path::new(&options.output_path);
    bundle::create_bundle(output_path, &dataset, &rows, &options.password, original_bytes.as_deref())?;

    Ok(options.output_path)
}

/// Reads the manifest without decrypting — for UI pre-validation.
#[tauri::command]
pub async fn validate_bundle(bundle_path: String) -> Result<BundleManifest, AppError> {
    let path = Path::new(&bundle_path);
    bundle::read_manifest(path)
}

/// Decrypts and imports a bundle into the local database.
#[tauri::command]
pub async fn open_bundle(
    bundle_path: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<OpenBundleResult, AppError> {
    let path = Path::new(&bundle_path);
    let import_result = bundle::open_bundle(path, &password)?;

    let manifest = &import_result.manifest;
    let dataset_id = db::new_dataset_id();
    let now = db::now_iso();
    let size_bytes = serde_json::to_vec(&import_result.rows)
        .map(|v| v.len() as u64)
        .unwrap_or(0);

    let dataset = Dataset {
        id: dataset_id.clone(),
        name: manifest.dataset_name.clone(),
        source_filename: manifest.source_filename.clone(),
        record_count: import_result.rows.len() as u64,
        column_names: manifest.column_names.clone(),
        searchable_columns: manifest.searchable_columns.clone(),
        imported_at: now,
        size_bytes,
    };

    let mut db = state.db.lock().map_err(|_| AppError::General("DB lock poisoned".to_string()))?;
    db.create_dataset(&dataset)?;
    db.bulk_insert_rows(&dataset_id, &import_result.rows, &manifest.searchable_columns)?;

    Ok(OpenBundleResult {
        dataset_id,
        dataset_name: manifest.dataset_name.clone(),
        record_count: import_result.rows.len() as u64,
        column_names: manifest.column_names.clone(),
        searchable_columns: manifest.searchable_columns.clone(),
    })
}
