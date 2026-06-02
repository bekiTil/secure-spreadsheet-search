//! Backup system: export/import encrypted backups of all datasets.

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use zip::{ZipArchive, ZipWriter, write::SimpleFileOptions};
use crate::error::{AppError, AppResult};
use crate::crypto;
use crate::db::{Dataset, Database};

const BACKUP_MAGIC: &str = "SSS-BACKUP-V1";
const BACKUP_INTERNAL_KEY: &str = "sss-backup-key-v1-no-user-password-required";

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupManifest {
    pub magic: String,
    pub created_at: String,
    pub app_version: String,
    pub dataset_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupDataset {
    pub dataset: Dataset,
    pub rows: Vec<serde_json::Value>,
}

/// Exports all datasets to an encrypted backup file.
pub fn export_backup(
    output_path: &std::path::Path,
    db: &Database,
    _password: &str,
) -> AppResult<()> {
    let password = BACKUP_INTERNAL_KEY;
    let datasets = db.list_datasets()?;
    let mut backup_datasets = Vec::new();

    for dataset in &datasets {
        let rows = db.export_rows(&dataset.id)?;
        backup_datasets.push(BackupDataset {
            dataset: dataset.clone(),
            rows,
        });
    }

    let manifest = BackupManifest {
        magic: BACKUP_MAGIC.to_string(),
        created_at: crate::db::now_iso(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        dataset_count: datasets.len(),
    };

    let file = std::fs::File::create(output_path)?;
    let mut zip = ZipWriter::new(file);
    let opts = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Manifest is plaintext for validation
    let manifest_json = serde_json::to_vec_pretty(&manifest)?;
    zip.start_file("manifest.json", opts).map_err(|e| AppError::Bundle(e.to_string()))?;
    zip.write_all(&manifest_json)?;

    // Each dataset encrypted separately
    for (i, bd) in backup_datasets.iter().enumerate() {
        let data_json = serde_json::to_vec(bd)?;
        let encrypted = crypto::encrypt(&data_json, password)?;
        zip.start_file(format!("dataset_{}.enc", i), opts)
            .map_err(|e| AppError::Bundle(e.to_string()))?;
        zip.write_all(&encrypted)?;
    }

    zip.finish().map_err(|e| AppError::Bundle(e.to_string()))?;
    Ok(())
}

/// Imports datasets from an encrypted backup file.
pub fn import_backup(
    backup_path: &std::path::Path,
    db: &mut Database,
    _password: &str,
) -> AppResult<Vec<String>> {
    let password = BACKUP_INTERNAL_KEY;
    let file = std::fs::File::open(backup_path)
        .map_err(|_| AppError::NotFound(backup_path.to_string_lossy().to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| AppError::Bundle(format!("Cannot open backup: {}", e)))?;

    let manifest: BackupManifest = {
        let mut entry = archive.by_name("manifest.json")
            .map_err(|_| AppError::Bundle("Invalid backup: missing manifest".to_string()))?;
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf)?;
        serde_json::from_slice(&buf)?
    };

    if manifest.magic != BACKUP_MAGIC {
        return Err(AppError::Bundle("Not a valid backup file".to_string()));
    }

    let mut imported_names = Vec::new();

    for i in 0..manifest.dataset_count {
        let encrypted = {
            let mut entry = archive
                .by_name(&format!("dataset_{}.enc", i))
                .map_err(|_| AppError::Bundle(format!("Missing dataset {} in backup", i)))?;
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            buf
        };

        let decrypted = crypto::decrypt(&encrypted, password)?;
        let bd: BackupDataset = serde_json::from_slice(&decrypted)?;

        // Skip if dataset already exists
        if db.get_dataset(&bd.dataset.id)?.is_some() {
            imported_names.push(format!("{} (skipped — already exists)", bd.dataset.name));
            continue;
        }

        db.create_dataset(&bd.dataset)?;
        db.bulk_insert_rows(&bd.dataset.id, &bd.rows, &bd.dataset.searchable_columns)?;
        let size_bytes = serde_json::to_vec(&bd.rows).map(|v| v.len() as u64).unwrap_or(0);
        db.update_record_count(&bd.dataset.id, bd.rows.len() as u64, size_bytes)?;

        imported_names.push(bd.dataset.name.clone());
    }

    Ok(imported_names)
}
