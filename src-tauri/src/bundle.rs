//! .companybundle file format: encrypted, signed, tamper-resistant ZIP archive.
//!
//! Bundle structure (ZIP contents):
//!   manifest.json       — metadata, column list, security info (plaintext)
//!   data.enc            — AES-256-GCM encrypted JSON array of rows
//!   hmac.sig            — HMAC-SHA256 over (data.enc bytes) using derived key
//!   [original.enc]      — original file (optional, encrypted separately)

use serde::{Deserialize, Serialize};
use std::io::{Read, Write, Seek};
use zip::{ZipArchive, ZipWriter, write::SimpleFileOptions};
use crate::error::{AppError, AppResult};
use crate::crypto;
use crate::db::Dataset;
use crate::bundle_install_page;

pub const BUNDLE_FORMAT_VERSION: u32 = 1;
pub const BUNDLE_MAGIC: &str = "SECURE-SPREADSHEET-SEARCH";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleManifest {
    pub magic: String,
    pub format_version: u32,
    pub bundle_id: String,
    pub dataset_name: String,
    pub source_filename: String,
    pub record_count: u64,
    pub column_names: Vec<String>,
    pub searchable_columns: Vec<String>,
    pub created_at: String,
    pub created_by_version: String,
    pub has_original_file: bool,
    pub kdf_algorithm: String,
    pub encryption_algorithm: String,
    pub hmac_algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleImportResult {
    pub manifest: BundleManifest,
    pub rows: Vec<serde_json::Value>,
    pub original_file_bytes: Option<Vec<u8>>,
}

#[derive(Serialize, Deserialize)]
struct BundleSigData {
    sign_salt_hex: String,
    hmac_hex: String,
}

/// Creates a .companybundle file at `output_path`.
pub fn create_bundle(
    output_path: &std::path::Path,
    dataset: &Dataset,
    rows: &[serde_json::Value],
    password: &str,
    include_original: Option<&[u8]>,
) -> AppResult<()> {
    // 1. Serialize rows to JSON
    let rows_json = serde_json::to_vec(rows)
        .map_err(|e| AppError::Bundle(format!("Failed to serialize rows: {}", e)))?;

    // 2. Encrypt rows
    let encrypted_data = crypto::encrypt(&rows_json, password)?;

    // 3. Derive signing key (separate password suffix + separate salt)
    let sign_password = format!("{}:SIGN", password);
    let sign_salt = crypto::generate_salt();
    let sign_key = crypto::derive_key(&sign_password, &sign_salt)?;

    // 4. HMAC over encrypted data
    let hmac_sig = crypto::hmac_sign(&encrypted_data, &sign_key);

    // 5. Build manifest
    let manifest = BundleManifest {
        magic: BUNDLE_MAGIC.to_string(),
        format_version: BUNDLE_FORMAT_VERSION,
        bundle_id: uuid::Uuid::new_v4().to_string(),
        dataset_name: dataset.name.clone(),
        source_filename: dataset.source_filename.clone(),
        record_count: dataset.record_count,
        column_names: dataset.column_names.clone(),
        searchable_columns: dataset.searchable_columns.clone(),
        created_at: crate::db::now_iso(),
        created_by_version: env!("CARGO_PKG_VERSION").to_string(),
        has_original_file: include_original.is_some(),
        kdf_algorithm: "Argon2id".to_string(),
        encryption_algorithm: "AES-256-GCM".to_string(),
        hmac_algorithm: "HMAC-SHA256".to_string(),
    };

    let manifest_json = serde_json::to_vec_pretty(&manifest)
        .map_err(|e| AppError::Bundle(format!("Failed to serialize manifest: {}", e)))?;

    let sig_data = BundleSigData {
        sign_salt_hex: hex::encode(&sign_salt),
        hmac_hex: hex::encode(&hmac_sig),
    };
    let sig_json = serde_json::to_vec(&sig_data)
        .map_err(|e| AppError::Bundle(format!("Failed to serialize sig data: {}", e)))?;

    // 6. Write ZIP
    let file = std::fs::File::create(output_path)?;
    let mut zip = ZipWriter::new(file);
    let opts = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("manifest.json", opts).map_err(|e| AppError::Bundle(e.to_string()))?;
    zip.write_all(&manifest_json)?;

    zip.start_file("data.enc", opts).map_err(|e| AppError::Bundle(e.to_string()))?;
    zip.write_all(&encrypted_data)?;

    zip.start_file("hmac.sig", opts).map_err(|e| AppError::Bundle(e.to_string()))?;
    zip.write_all(&sig_json)?;

    if let Some(original_bytes) = include_original {
        let enc_original = crypto::encrypt(original_bytes, password)?;
        zip.start_file("original.enc", opts).map_err(|e| AppError::Bundle(e.to_string()))?;
        zip.write_all(&enc_original)?;
    }

    // Always embed the install guide — opens in any browser, guides user through install
    let open_me = bundle_install_page::generate_open_me_html(&dataset.name, dataset.record_count);
    zip.start_file("_OPEN_ME.html", opts).map_err(|e| AppError::Bundle(e.to_string()))?;
    zip.write_all(&open_me)?;

    zip.finish().map_err(|e| AppError::Bundle(e.to_string()))?;
    Ok(())
}

/// Reads and validates a bundle manifest without decrypting data.
pub fn read_manifest(bundle_path: &std::path::Path) -> AppResult<BundleManifest> {
    let file = std::fs::File::open(bundle_path)
        .map_err(|_| AppError::NotFound(bundle_path.to_string_lossy().to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| AppError::Bundle(format!("Cannot open bundle: {}", e)))?;

    let manifest = read_zip_json::<BundleManifest, _>(&mut archive, "manifest.json")
        .map_err(|_| AppError::Bundle("Bundle is missing or has corrupt manifest".to_string()))?;

    if manifest.magic != BUNDLE_MAGIC {
        return Err(AppError::Bundle("Not a valid Secure Spreadsheet Search bundle".to_string()));
    }

    if manifest.format_version > BUNDLE_FORMAT_VERSION {
        return Err(AppError::Bundle(format!(
            "Bundle version {} is newer than this app supports ({}). Please update the app.",
            manifest.format_version, BUNDLE_FORMAT_VERSION
        )));
    }

    Ok(manifest)
}

/// Decrypts and imports a bundle given the correct password.
pub fn open_bundle(
    bundle_path: &std::path::Path,
    password: &str,
) -> AppResult<BundleImportResult> {
    let file = std::fs::File::open(bundle_path)
        .map_err(|_| AppError::NotFound(bundle_path.to_string_lossy().to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| AppError::Bundle(format!("Cannot open bundle: {}", e)))?;

    // Read manifest
    let manifest = read_zip_json::<BundleManifest, _>(&mut archive, "manifest.json")?;

    if manifest.magic != BUNDLE_MAGIC {
        return Err(AppError::TamperDetected);
    }

    // Read encrypted data
    let encrypted_data = read_zip_bytes(&mut archive, "data.enc")?;

    // Read HMAC signature data
    let sig_data = read_zip_json::<BundleSigData, _>(&mut archive, "hmac.sig")?;

    // Verify HMAC — tamper detection
    let sign_password = format!("{}:SIGN", password);
    let sign_salt = hex::decode(&sig_data.sign_salt_hex)
        .map_err(|_| AppError::TamperDetected)?;
    let sign_key = crypto::derive_key(&sign_password, &sign_salt)?;
    let expected_hmac = hex::decode(&sig_data.hmac_hex)
        .map_err(|_| AppError::TamperDetected)?;

    if !crypto::hmac_verify(&encrypted_data, &sign_key, &expected_hmac) {
        return Err(AppError::TamperDetected);
    }

    // Decrypt — wrong password fails here
    let rows_json = crypto::decrypt(&encrypted_data, password)
        .map_err(|_| AppError::DecryptionFailed)?;

    let rows: Vec<serde_json::Value> = serde_json::from_slice(&rows_json)
        .map_err(|_| AppError::Bundle("Bundle data is corrupted".to_string()))?;

    // Optionally decrypt original file
    let original_file_bytes = if manifest.has_original_file {
        match read_zip_bytes(&mut archive, "original.enc") {
            Ok(enc) => crypto::decrypt(&enc, password).ok(),
            Err(_) => None,
        }
    } else {
        None
    };

    Ok(BundleImportResult { manifest, rows, original_file_bytes })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn read_zip_bytes<R: Read + Seek>(archive: &mut ZipArchive<R>, name: &str) -> AppResult<Vec<u8>> {
    let mut entry = archive
        .by_name(name)
        .map_err(|_| AppError::Bundle(format!("Missing file in bundle: {}", name)))?;
    let mut buf = Vec::new();
    entry.read_to_end(&mut buf)?;
    Ok(buf)
}

fn read_zip_json<T: for<'de> Deserialize<'de>, R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
) -> AppResult<T> {
    let bytes = read_zip_bytes(archive, name)?;
    serde_json::from_slice(&bytes)
        .map_err(|e| AppError::Bundle(format!("Invalid JSON in {}: {}", name, e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    fn make_dataset() -> Dataset {
        Dataset {
            id: "test-id".to_string(),
            name: "Test Dataset".to_string(),
            source_filename: "test.csv".to_string(),
            record_count: 2,
            column_names: vec!["Name".to_string(), "Email".to_string()],
            searchable_columns: vec!["Name".to_string(), "Email".to_string()],
            imported_at: "2024-01-01T00:00:00Z".to_string(),
            size_bytes: 1024,
        }
    }

    fn make_rows() -> Vec<serde_json::Value> {
        vec![
            serde_json::json!({"Name": "Alice", "Email": "alice@example.com"}),
            serde_json::json!({"Name": "Bob", "Email": "bob@example.com"}),
        ]
    }

    #[test]
    fn test_create_and_open_bundle() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();
        let dataset = make_dataset();
        let rows = make_rows();
        let password = "correct-password-123";

        create_bundle(path, &dataset, &rows, password, None).unwrap();
        let result = open_bundle(path, password).unwrap();

        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.manifest.dataset_name, "Test Dataset");
        assert_eq!(result.manifest.record_count, 2);
    }

    #[test]
    fn test_wrong_password_fails() {
        let tmp = NamedTempFile::new().unwrap();
        let dataset = make_dataset();
        let rows = make_rows();

        create_bundle(tmp.path(), &dataset, &rows, "correct-pass-123", None).unwrap();
        let result = open_bundle(tmp.path(), "wrong-password-456");
        assert!(result.is_err());
    }

    #[test]
    fn test_tamper_detected() {
        let tmp = NamedTempFile::new().unwrap();
        let dataset = make_dataset();
        let rows = make_rows();

        create_bundle(tmp.path(), &dataset, &rows, "password-secure-1", None).unwrap();

        // Corrupt the ZIP by flipping bytes at the end
        let mut bytes = std::fs::read(tmp.path()).unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 0xFF;
        bytes[last - 1] ^= 0xFF;
        std::fs::write(tmp.path(), bytes).unwrap();

        let result = open_bundle(tmp.path(), "password-secure-1");
        assert!(result.is_err());
    }

    #[test]
    fn test_manifest_readable_without_password() {
        let tmp = NamedTempFile::new().unwrap();
        let dataset = make_dataset();
        let rows = make_rows();

        create_bundle(tmp.path(), &dataset, &rows, "any-password-123", None).unwrap();
        let manifest = read_manifest(tmp.path()).unwrap();

        assert_eq!(manifest.magic, BUNDLE_MAGIC);
        assert_eq!(manifest.dataset_name, "Test Dataset");
    }

    #[test]
    fn test_bundle_with_original_file() {
        let tmp = NamedTempFile::new().unwrap();
        let dataset = make_dataset();
        let rows = make_rows();
        let original = b"original spreadsheet bytes here";

        create_bundle(tmp.path(), &dataset, &rows, "password-abc-123", Some(original)).unwrap();
        let result = open_bundle(tmp.path(), "password-abc-123").unwrap();

        assert!(result.original_file_bytes.is_some());
        assert_eq!(result.original_file_bytes.unwrap(), original.to_vec());
    }
}
