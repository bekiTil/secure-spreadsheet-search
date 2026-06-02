//! Import engine: reads XLSX, XLS, CSV, TSV files and produces normalized rows.

use calamine::{open_workbook_auto, Reader, Data};
use csv::ReaderBuilder;
use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub filename: String,
    pub columns: Vec<String>,
    pub preview_rows: Vec<serde_json::Value>,
    pub estimated_total_rows: u64,
    pub file_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub rows: Vec<serde_json::Value>,
    pub columns: Vec<String>,
    pub row_count: u64,
}

const PREVIEW_ROW_COUNT: usize = 10;
const MAX_ROWS: usize = 2_000_000;

/// Validates a file path as a supported spreadsheet type.
pub fn validate_file(path: &Path) -> AppResult<String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "xlsx" | "xls" | "xlsm" | "xlsb" => Ok(ext),
        "csv" => Ok("csv".to_string()),
        "tsv" => Ok("tsv".to_string()),
        "ods" => Ok("ods".to_string()),
        _ => Err(AppError::InvalidFormat(format!(
            "Unsupported file type: .{}. Supported types: XLSX, XLS, CSV, TSV",
            ext
        ))),
    }
}

/// Returns a preview of the file with first N rows and detected columns.
pub fn preview_file(path: &Path) -> AppResult<ImportPreview> {
    let ext = validate_file(path)?;
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    match ext.as_str() {
        "xlsx" | "xls" | "xlsm" | "xlsb" | "ods" => preview_excel(path, &filename, &ext),
        "csv" => preview_csv(path, &filename, b','),
        "tsv" => preview_csv(path, &filename, b'\t'),
        _ => Err(AppError::InvalidFormat("Unsupported format".to_string())),
    }
}

/// Imports the full file into rows.
pub fn import_file(path: &Path) -> AppResult<ImportResult> {
    let ext = validate_file(path)?;

    match ext.as_str() {
        "xlsx" | "xls" | "xlsm" | "xlsb" | "ods" => import_excel(path),
        "csv" => import_csv(path, b','),
        "tsv" => import_csv(path, b'\t'),
        _ => Err(AppError::InvalidFormat("Unsupported format".to_string())),
    }
}

// ─── Excel (XLSX / XLS) ──────────────────────────────────────────────────────

fn preview_excel(path: &Path, filename: &str, ext: &str) -> AppResult<ImportPreview> {
    let mut workbook = open_workbook_auto(path)
        .map_err(|e| AppError::Import(format!("Cannot open file: {}", e)))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let sheet_name = sheet_names.first()
        .ok_or_else(|| AppError::Import("No sheets found in file".to_string()))?
        .clone();

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| AppError::Import(format!("Cannot read sheet: {}", e)))?;

    let mut rows = range.rows();

    // First row = headers
    let headers: Vec<String> = match rows.next() {
        Some(row) => row
            .iter()
            .map(|cell| data_to_string(cell))
            .collect(),
        None => return Err(AppError::Import("File is empty".to_string())),
    };

    let columns = normalize_headers(&headers);
    let estimated_total = range.get_size().0.saturating_sub(1) as u64;

    let preview_rows: Vec<serde_json::Value> = rows
        .take(PREVIEW_ROW_COUNT)
        .map(|row| row_to_json(row, &columns))
        .collect();

    Ok(ImportPreview {
        filename: filename.to_string(),
        columns,
        preview_rows,
        estimated_total_rows: estimated_total,
        file_type: ext.to_uppercase(),
    })
}

fn import_excel(path: &Path) -> AppResult<ImportResult> {
    let mut workbook = open_workbook_auto(path)
        .map_err(|e| AppError::Import(format!("Cannot open file: {}", e)))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let sheet_name = sheet_names.first()
        .ok_or_else(|| AppError::Import("No sheets found in file".to_string()))?
        .clone();

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| AppError::Import(format!("Cannot read sheet: {}", e)))?;

    let mut rows = range.rows();

    let headers: Vec<String> = match rows.next() {
        Some(row) => row.iter().map(|cell| data_to_string(cell)).collect(),
        None => return Err(AppError::Import("File is empty".to_string())),
    };

    let columns = normalize_headers(&headers);

    let result_rows: Vec<serde_json::Value> = rows
        .take(MAX_ROWS)
        .filter(|row| !is_empty_row(row))
        .map(|row| row_to_json(row, &columns))
        .collect();

    let row_count = result_rows.len() as u64;

    Ok(ImportResult {
        rows: result_rows,
        columns,
        row_count,
    })
}

// ─── CSV / TSV ───────────────────────────────────────────────────────────────

fn preview_csv(path: &Path, filename: &str, delimiter: u8) -> AppResult<ImportPreview> {
    let file = std::fs::File::open(path)?;
    let mut reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(file);

    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| AppError::Import(format!("Cannot read headers: {}", e)))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let columns = normalize_headers(&headers);

    let preview_rows: Vec<serde_json::Value> = reader
        .records()
        .take(PREVIEW_ROW_COUNT)
        .filter_map(|r| r.ok())
        .map(|record| csv_record_to_json(&record, &columns))
        .collect();

    // Estimate total rows by counting lines
    let estimated_total = estimate_csv_rows(path).unwrap_or(0);

    Ok(ImportPreview {
        filename: filename.to_string(),
        columns,
        preview_rows,
        estimated_total_rows: estimated_total,
        file_type: if delimiter == b'\t' { "TSV" } else { "CSV" }.to_string(),
    })
}

fn import_csv(path: &Path, delimiter: u8) -> AppResult<ImportResult> {
    let file = std::fs::File::open(path)?;
    let mut reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(file);

    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| AppError::Import(format!("Cannot read headers: {}", e)))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let columns = normalize_headers(&headers);

    let result_rows: Vec<serde_json::Value> = reader
        .records()
        .take(MAX_ROWS)
        .filter_map(|r| r.ok())
        .map(|record| csv_record_to_json(&record, &columns))
        .collect();

    let row_count = result_rows.len() as u64;

    Ok(ImportResult { rows: result_rows, columns, row_count })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn data_to_string(cell: &Data) -> String {
    match cell {
        Data::String(s) => s.clone(),
        Data::Float(f) => {
            if f.fract() == 0.0 { format!("{}", *f as i64) } else { f.to_string() }
        }
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => b.to_string(),
        Data::DateTime(dt) => dt.to_string(),
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
        Data::Error(e) => format!("#ERR:{:?}", e),
        Data::Empty => String::new(),
    }
}

fn row_to_json(row: &[Data], columns: &[String]) -> serde_json::Value {
    let mut obj = serde_json::Map::new();
    for (i, col) in columns.iter().enumerate() {
        let value = row.get(i).map(data_to_string).unwrap_or_default();
        obj.insert(col.clone(), serde_json::Value::String(value));
    }
    serde_json::Value::Object(obj)
}

fn csv_record_to_json(record: &csv::StringRecord, columns: &[String]) -> serde_json::Value {
    let mut obj = serde_json::Map::new();
    for (i, col) in columns.iter().enumerate() {
        let value = record.get(i).unwrap_or("").to_string();
        obj.insert(col.clone(), serde_json::Value::String(value));
    }
    serde_json::Value::Object(obj)
}

fn is_empty_row(row: &[Data]) -> bool {
    row.iter().all(|cell| matches!(cell, Data::Empty))
}

/// Normalizes column header names: strips whitespace, deduplicates.
fn normalize_headers(headers: &[String]) -> Vec<String> {
    let mut seen = std::collections::HashMap::new();
    headers
        .iter()
        .enumerate()
        .map(|(i, h)| {
            let base = if h.trim().is_empty() {
                format!("Column_{}", i + 1)
            } else {
                h.trim().to_string()
            };
            let count = seen.entry(base.clone()).or_insert(0u32);
            let name = if *count == 0 {
                base.clone()
            } else {
                format!("{}_{}", base, count)
            };
            *count += 1;
            name
        })
        .collect()
}

fn estimate_csv_rows(path: &Path) -> AppResult<u64> {
    use std::io::{BufRead, BufReader};
    let file = std::fs::File::open(path)?;
    let reader = BufReader::new(file);
    let count = reader.lines().count().saturating_sub(1) as u64;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::Builder;

    fn write_tmp(content: &str, ext: &str) -> tempfile::NamedTempFile {
        let mut file = Builder::new().suffix(ext).tempfile().unwrap();
        file.write_all(content.as_bytes()).unwrap();
        file
    }

    #[test]
    fn test_csv_import() {
        let file = write_tmp("Name,Age,Email\nAlice,30,alice@example.com\nBob,25,bob@example.com\n", ".csv");
        let result = import_csv(file.path(), b',').unwrap();
        assert_eq!(result.row_count, 2);
        assert_eq!(result.columns, vec!["Name", "Age", "Email"]);
    }

    #[test]
    fn test_tsv_import() {
        let file = write_tmp("Name\tAge\nAlice\t30\nBob\t25\n", ".tsv");
        let result = import_csv(file.path(), b'\t').unwrap();
        assert_eq!(result.row_count, 2);
        assert_eq!(result.columns, vec!["Name", "Age"]);
    }

    #[test]
    fn test_duplicate_column_normalization() {
        let headers = vec!["Name".to_string(), "Name".to_string(), "Age".to_string()];
        let normalized = normalize_headers(&headers);
        assert_eq!(normalized[0], "Name");
        assert_eq!(normalized[1], "Name_1");
        assert_eq!(normalized[2], "Age");
    }

    #[test]
    fn test_empty_column_header() {
        let headers = vec!["".to_string(), "Name".to_string()];
        let normalized = normalize_headers(&headers);
        assert_eq!(normalized[0], "Column_1");
    }

    #[test]
    fn test_validate_file_invalid() {
        let path = Path::new("file.pdf");
        assert!(validate_file(path).is_err());
    }

    #[test]
    fn test_validate_file_valid() {
        assert!(validate_file(Path::new("data.xlsx")).is_ok());
        assert!(validate_file(Path::new("data.csv")).is_ok());
        assert!(validate_file(Path::new("data.tsv")).is_ok());
    }
}
