use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Decryption failed — wrong password or corrupted data")]
    DecryptionFailed,

    #[error("Bundle tampered — integrity check failed")]
    TamperDetected,

    #[error("Invalid file format: {0}")]
    InvalidFormat(String),

    #[error("File not found: {0}")]
    NotFound(String),

    #[error("Import error: {0}")]
    Import(String),

    #[error("Bundle error: {0}")]
    Bundle(String),

    #[error("General error: {0}")]
    General(String),
}

pub type AppResult<T> = Result<T, AppError>;

// Tauri requires errors to be serializable
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
