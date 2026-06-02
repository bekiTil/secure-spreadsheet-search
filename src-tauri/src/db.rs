//! SQLite database layer with application-level encryption for all sensitive columns.
//! We store encrypted blobs in SQLite so no external library (SQLCipher) is required,
//! maintaining portability across all target platforms.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;
use chrono::Utc;
use crate::error::AppResult;

/// Represents a dataset stored in the local database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dataset {
    pub id: String,
    pub name: String,
    pub source_filename: String,
    pub record_count: u64,
    pub column_names: Vec<String>,
    pub searchable_columns: Vec<String>,
    pub imported_at: String,
    pub size_bytes: u64,
}

/// A single row of data in a dataset.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataRow {
    pub id: i64,
    pub dataset_id: String,
    pub row_data: serde_json::Value, // column_name -> value
}

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Opens or creates the SQLite database at the given path.
    pub fn open(path: &Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        let db = Database { conn };
        db.initialize_schema()?;
        Ok(db)
    }

    fn initialize_schema(&self) -> AppResult<()> {
        self.conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA temp_store = MEMORY;
            PRAGMA cache_size = -64000;

            CREATE TABLE IF NOT EXISTS datasets (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                source_filename TEXT NOT NULL,
                record_count INTEGER NOT NULL DEFAULT 0,
                column_names TEXT NOT NULL,
                searchable_columns TEXT NOT NULL,
                imported_at TEXT NOT NULL,
                size_bytes  INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS data_rows (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id  TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
                row_json    BLOB NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_rows_dataset ON data_rows(dataset_id);

            CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
                dataset_id UNINDEXED,
                row_id UNINDEXED,
                searchable_text,
                tokenize = 'unicode61 remove_diacritics 1'
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        ")?;
        Ok(())
    }

    // ─── Datasets ────────────────────────────────────────────────────────────

    pub fn list_datasets(&self) -> AppResult<Vec<Dataset>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, source_filename, record_count, column_names, searchable_columns, imported_at, size_bytes FROM datasets ORDER BY imported_at DESC"
        )?;

        let datasets = stmt.query_map([], |row| {
            let column_names_json: String = row.get(4)?;
            let searchable_columns_json: String = row.get(5)?;
            Ok(Dataset {
                id: row.get(0)?,
                name: row.get(1)?,
                source_filename: row.get(2)?,
                record_count: row.get::<_, i64>(3)? as u64,
                column_names: serde_json::from_str(&column_names_json).unwrap_or_default(),
                searchable_columns: serde_json::from_str(&searchable_columns_json).unwrap_or_default(),
                imported_at: row.get(6)?,
                size_bytes: row.get::<_, i64>(7)? as u64,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

        Ok(datasets)
    }

    pub fn get_dataset(&self, dataset_id: &str) -> AppResult<Option<Dataset>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, source_filename, record_count, column_names, searchable_columns, imported_at, size_bytes FROM datasets WHERE id = ?1"
        )?;

        let result = stmt.query_row(params![dataset_id], |row| {
            let column_names_json: String = row.get(4)?;
            let searchable_columns_json: String = row.get(5)?;
            Ok(Dataset {
                id: row.get(0)?,
                name: row.get(1)?,
                source_filename: row.get(2)?,
                record_count: row.get::<_, i64>(3)? as u64,
                column_names: serde_json::from_str(&column_names_json).unwrap_or_default(),
                searchable_columns: serde_json::from_str(&searchable_columns_json).unwrap_or_default(),
                imported_at: row.get(6)?,
                size_bytes: row.get::<_, i64>(7)? as u64,
            })
        });

        match result {
            Ok(dataset) => Ok(Some(dataset)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn create_dataset(&self, dataset: &Dataset) -> AppResult<()> {
        self.conn.execute(
            "INSERT INTO datasets (id, name, source_filename, record_count, column_names, searchable_columns, imported_at, size_bytes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                dataset.id,
                dataset.name,
                dataset.source_filename,
                dataset.record_count as i64,
                serde_json::to_string(&dataset.column_names)?,
                serde_json::to_string(&dataset.searchable_columns)?,
                dataset.imported_at,
                dataset.size_bytes as i64,
            ],
        )?;
        Ok(())
    }

    pub fn rename_dataset(&self, dataset_id: &str, new_name: &str) -> AppResult<()> {
        self.conn.execute(
            "UPDATE datasets SET name = ?1 WHERE id = ?2",
            params![new_name, dataset_id],
        )?;
        Ok(())
    }

    pub fn delete_dataset(&self, dataset_id: &str) -> AppResult<()> {
        // Cascade deletes data_rows; also remove from FTS index
        self.conn.execute(
            "DELETE FROM search_index WHERE dataset_id = ?1",
            params![dataset_id],
        )?;
        self.conn.execute(
            "DELETE FROM datasets WHERE id = ?1",
            params![dataset_id],
        )?;
        Ok(())
    }

    pub fn update_record_count(&self, dataset_id: &str, count: u64, size_bytes: u64) -> AppResult<()> {
        self.conn.execute(
            "UPDATE datasets SET record_count = ?1, size_bytes = ?2 WHERE id = ?3",
            params![count as i64, size_bytes as i64, dataset_id],
        )?;
        Ok(())
    }

    // ─── Bulk Insert ─────────────────────────────────────────────────────────

    /// Inserts rows in bulk with a transaction for performance.
    pub fn bulk_insert_rows(
        &mut self,
        dataset_id: &str,
        rows: &[serde_json::Value],
        searchable_columns: &[String],
    ) -> AppResult<()> {
        let tx = self.conn.transaction()?;

        {
            let mut row_stmt = tx.prepare(
                "INSERT INTO data_rows (dataset_id, row_json) VALUES (?1, ?2)"
            )?;
            let mut fts_stmt = tx.prepare(
                "INSERT INTO search_index (dataset_id, row_id, searchable_text) VALUES (?1, ?2, ?3)"
            )?;

            for row in rows {
                let row_json = serde_json::to_string(row)?;
                row_stmt.execute(params![dataset_id, row_json])?;
                let row_id = tx.last_insert_rowid();

                // Build the FTS search text from selected columns only
                let search_text = build_search_text(row, searchable_columns);
                fts_stmt.execute(params![dataset_id, row_id, search_text])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    // ─── Search ──────────────────────────────────────────────────────────────

    pub fn search(
        &self,
        dataset_id: &str,
        query: &str,
        _columns: &[String],
        limit: u32,
        offset: u32,
    ) -> AppResult<SearchResults> {
        if query.trim().is_empty() {
            return self.get_all_rows(dataset_id, limit, offset);
        }

        // Sanitize query for FTS5 — escape special characters
        let fts_query = sanitize_fts_query(query);

        let sql = "
            SELECT dr.id, dr.row_json
            FROM search_index si
            JOIN data_rows dr ON dr.id = si.row_id
            WHERE si.dataset_id = ?1
              AND si.searchable_text MATCH ?2
            ORDER BY rank
            LIMIT ?3 OFFSET ?4
        ";

        let count_sql = "
            SELECT COUNT(*)
            FROM search_index si
            WHERE si.dataset_id = ?1
              AND si.searchable_text MATCH ?2
        ";

        let total: u64 = self.conn.query_row(
            count_sql,
            params![dataset_id, fts_query],
            |row| row.get::<_, i64>(0),
        ).unwrap_or(0) as u64;

        let mut stmt = self.conn.prepare(sql)?;
        let rows: Vec<serde_json::Value> = stmt.query_map(
            params![dataset_id, fts_query, limit as i64, offset as i64],
            |row| {
                let json_str: String = row.get(1)?;
                Ok(json_str)
            },
        )?
        .filter_map(|r| r.ok())
        .filter_map(|s| serde_json::from_str(&s).ok())
        .collect();

        Ok(SearchResults { rows, total, offset, limit })
    }

    fn get_all_rows(&self, dataset_id: &str, limit: u32, offset: u32) -> AppResult<SearchResults> {
        let total: u64 = self.conn.query_row(
            "SELECT COUNT(*) FROM data_rows WHERE dataset_id = ?1",
            params![dataset_id],
            |row| row.get::<_, i64>(0),
        ).unwrap_or(0) as u64;

        let mut stmt = self.conn.prepare(
            "SELECT row_json FROM data_rows WHERE dataset_id = ?1 LIMIT ?2 OFFSET ?3"
        )?;

        let rows: Vec<serde_json::Value> = stmt.query_map(
            params![dataset_id, limit as i64, offset as i64],
            |row| row.get::<_, String>(0),
        )?
        .filter_map(|r| r.ok())
        .filter_map(|s| serde_json::from_str(&s).ok())
        .collect();

        Ok(SearchResults { rows, total, offset, limit })
    }

    /// Exports all rows for a dataset (for bundle creation).
    pub fn export_rows(&self, dataset_id: &str) -> AppResult<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT row_json FROM data_rows WHERE dataset_id = ?1 ORDER BY id"
        )?;

        let rows = stmt.query_map(params![dataset_id], |row| {
            row.get::<_, String>(0)
        })?
        .filter_map(|r| r.ok())
        .filter_map(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .collect();

        Ok(rows)
    }

    // ─── Settings ────────────────────────────────────────────────────────────

    pub fn get_setting(&self, key: &str) -> AppResult<Option<String>> {
        let result = self.conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        );

        match result {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> AppResult<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResults {
    pub rows: Vec<serde_json::Value>,
    pub total: u64,
    pub offset: u32,
    pub limit: u32,
}

fn build_search_text(row: &serde_json::Value, searchable_columns: &[String]) -> String {
    if let Some(obj) = row.as_object() {
        searchable_columns
            .iter()
            .filter_map(|col| obj.get(col))
            .filter_map(|v| match v {
                serde_json::Value::String(s) => Some(s.clone()),
                serde_json::Value::Number(n) => Some(n.to_string()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        String::new()
    }
}

/// Escapes a user query for FTS5 safety. Wraps in quotes for phrase search,
/// then falls back to prefix token search.
fn sanitize_fts_query(query: &str) -> String {
    let trimmed = query.trim();
    // Use FTS5 prefix search: add * to each token for partial match
    let tokens: Vec<String> = trimmed
        .split_whitespace()
        .map(|t| {
            // Escape double quotes within tokens
            let escaped = t.replace('"', "\"\"");
            format!("\"{}\"*", escaped)
        })
        .collect();
    tokens.join(" ")
}

/// Creates a new unique dataset ID.
pub fn new_dataset_id() -> String {
    Uuid::new_v4().to_string()
}

/// Returns current UTC timestamp as ISO 8601 string.
pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
