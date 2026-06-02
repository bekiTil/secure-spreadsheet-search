//! Cryptographic operations: AES-256-GCM encryption, Argon2id key derivation,
//! HMAC-SHA256 integrity verification.

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng as ArgonOsRng, SaltString, PasswordHash};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use rand::RngCore;
use crate::error::{AppError, AppResult};

pub const KEY_SIZE: usize = 32;  // 256-bit key
pub const NONCE_SIZE: usize = 12; // 96-bit nonce for AES-GCM
pub const SALT_SIZE: usize = 32;

/// Derives a 256-bit key from a password using Argon2id.
pub fn derive_key(password: &str, salt: &[u8]) -> AppResult<[u8; KEY_SIZE]> {
    let params = argon2::Params::new(
        65536, // 64 MiB memory
        3,     // 3 iterations
        4,     // 4 parallel lanes
        Some(KEY_SIZE),
    ).map_err(|e| AppError::Encryption(e.to_string()))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
    let mut key = [0u8; KEY_SIZE];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| AppError::Encryption(e.to_string()))?;
    Ok(key)
}

/// Generates a cryptographically secure random salt.
pub fn generate_salt() -> [u8; SALT_SIZE] {
    let mut salt = [0u8; SALT_SIZE];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

/// Generates a cryptographically secure nonce for AES-GCM.
pub fn generate_nonce() -> [u8; NONCE_SIZE] {
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    nonce.into()
}

/// Encrypts plaintext with AES-256-GCM. Returns salt + nonce + ciphertext.
pub fn encrypt(plaintext: &[u8], password: &str) -> AppResult<Vec<u8>> {
    let salt = generate_salt();
    let key_bytes = derive_key(password, &salt)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let nonce_bytes = generate_nonce();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| AppError::Encryption(e.to_string()))?;

    // Output format: [salt (32)] + [nonce (12)] + [ciphertext]
    let mut output = Vec::with_capacity(SALT_SIZE + NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

/// Decrypts data produced by `encrypt`. Fails if password is wrong or data is tampered.
pub fn decrypt(data: &[u8], password: &str) -> AppResult<Vec<u8>> {
    if data.len() < SALT_SIZE + NONCE_SIZE + 16 {
        return Err(AppError::DecryptionFailed);
    }

    let salt = &data[..SALT_SIZE];
    let nonce_bytes = &data[SALT_SIZE..SALT_SIZE + NONCE_SIZE];
    let ciphertext = &data[SALT_SIZE + NONCE_SIZE..];

    let key_bytes = derive_key(password, salt)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| AppError::DecryptionFailed)
}

/// Encrypts data with a raw 256-bit key (used for internal DB encryption).
pub fn encrypt_with_key(plaintext: &[u8], key_bytes: &[u8; KEY_SIZE]) -> AppResult<Vec<u8>> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);

    let nonce_bytes = generate_nonce();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| AppError::Encryption(e.to_string()))?;

    let mut output = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

/// Decrypts data produced by `encrypt_with_key`.
pub fn decrypt_with_key(data: &[u8], key_bytes: &[u8; KEY_SIZE]) -> AppResult<Vec<u8>> {
    if data.len() < NONCE_SIZE + 16 {
        return Err(AppError::DecryptionFailed);
    }

    let nonce_bytes = &data[..NONCE_SIZE];
    let ciphertext = &data[NONCE_SIZE..];

    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| AppError::DecryptionFailed)
}

/// Computes an HMAC-SHA256 signature for tamper detection.
pub fn hmac_sign(data: &[u8], key: &[u8]) -> Vec<u8> {
    let mut mac = <Hmac::<Sha256> as hmac::Mac>::new_from_slice(key)
        .expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// Verifies an HMAC-SHA256 signature.
pub fn hmac_verify(data: &[u8], key: &[u8], signature: &[u8]) -> bool {
    let mut mac = <Hmac::<Sha256> as hmac::Mac>::new_from_slice(key)
        .expect("HMAC accepts any key length");
    mac.update(data);
    mac.verify_slice(signature).is_ok()
}

/// Hashes a password for storage using Argon2id (for settings PIN etc.).
pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut ArgonOsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Encryption(e.to_string()))?;
    Ok(hash.to_string())
}

/// Verifies a password against a stored Argon2id hash.
pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::Encryption(e.to_string()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let plaintext = b"Hello, world! This is sensitive data.";
        let password = "correct-horse-battery-staple";
        let encrypted = encrypt(plaintext, password).unwrap();
        let decrypted = decrypt(&encrypted, password).unwrap();
        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_wrong_password_fails() {
        let plaintext = b"Secret data";
        let encrypted = encrypt(plaintext, "correct-password").unwrap();
        let result = decrypt(&encrypted, "wrong-password");
        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_data_fails() {
        let plaintext = b"Secret data";
        let mut encrypted = encrypt(plaintext, "password").unwrap();
        // Flip a byte in the ciphertext
        let last = encrypted.len() - 1;
        encrypted[last] ^= 0xFF;
        let result = decrypt(&encrypted, "password");
        assert!(result.is_err());
    }

    #[test]
    fn test_hmac_roundtrip() {
        let data = b"data to sign";
        let key = b"signing key";
        let sig = hmac_sign(data, key);
        assert!(hmac_verify(data, key, &sig));
    }

    #[test]
    fn test_hmac_tampered_fails() {
        let data = b"data to sign";
        let key = b"signing key";
        let sig = hmac_sign(data, key);
        assert!(!hmac_verify(b"tampered data", key, &sig));
    }

    #[test]
    fn test_password_hash_verify() {
        let hash = hash_password("my-password").unwrap();
        assert!(verify_password("my-password", &hash).unwrap());
        assert!(!verify_password("wrong-password", &hash).unwrap());
    }
}
