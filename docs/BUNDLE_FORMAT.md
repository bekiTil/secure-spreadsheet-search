# .companybundle File Format Specification

**Version:** 1  
**Extension:** `.companybundle`  
**MIME type:** `application/x-companybundle`

---

## Overview

A `.companybundle` file is a ZIP archive containing:

| File | Contents | Encrypted? |
|---|---|---|
| `manifest.json` | Metadata, column list, security info | No (readable without password) |
| `data.enc` | AES-256-GCM encrypted JSON rows | Yes |
| `hmac.sig` | HMAC-SHA256 signature + signing salt | No (but useless without password) |
| `original.enc` | Original spreadsheet bytes (optional) | Yes |

---

## manifest.json Schema

```json
{
  "magic": "SECURE-SPREADSHEET-SEARCH",
  "format_version": 1,
  "bundle_id": "<uuid-v4>",
  "dataset_name": "Employee Directory",
  "source_filename": "employees.xlsx",
  "record_count": 5000,
  "column_names": ["Employee ID", "Name", "Email", "Department"],
  "searchable_columns": ["Name", "Email"],
  "created_at": "2024-01-15T10:30:00Z",
  "created_by_version": "1.0.0",
  "has_original_file": false,
  "kdf_algorithm": "Argon2id",
  "encryption_algorithm": "AES-256-GCM",
  "hmac_algorithm": "HMAC-SHA256"
}
```

---

## data.enc Format

```
[salt: 32 bytes] [nonce: 12 bytes] [AES-256-GCM ciphertext + 16-byte auth tag]
```

**Plaintext (before encryption):** JSON array of row objects  
```json
[
  {"Name": "Alice Smith", "Email": "alice@corp.com"},
  {"Name": "Bob Jones", "Email": "bob@corp.com"}
]
```

**Key derivation:**
- Algorithm: Argon2id
- Memory: 65,536 KiB (64 MiB)
- Iterations: 3
- Parallelism: 4
- Output: 32 bytes (256-bit AES key)

---

## hmac.sig Format

```json
{
  "sign_salt_hex": "<64-char hex>",
  "hmac_hex": "<64-char hex>"
}
```

**Signing key derivation:** Same Argon2id parameters, different password suffix:
```
sign_password = user_password + ":SIGN"
sign_key = Argon2id(sign_password, sign_salt)
hmac = HMAC-SHA256(data.enc bytes, sign_key)
```

---

## Integrity Guarantee

The HMAC is verified BEFORE decryption. If either:
1. The HMAC does not match (data.enc was modified), **or**
2. Decryption fails (wrong password or corrupted data)

…the bundle is rejected with a clear error and no data is imported.

---

## Backward Compatibility

- `format_version` in the manifest is checked on open
- Apps will reject bundles with format versions newer than they support
- Old apps will reject new-format bundles gracefully

---

## Security Properties

| Property | How |
|---|---|
| Confidentiality | AES-256-GCM encryption |
| Integrity | HMAC-SHA256 + AES-GCM auth tag |
| Tamper detection | HMAC verified before decryption |
| Password brute-force resistance | Argon2id (memory-hard) |
| Replay prevention | Random nonce per bundle |
| Forward secrecy | Not applicable (offline, no sessions) |
