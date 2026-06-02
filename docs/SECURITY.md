# Security Design — Secure Spreadsheet Search

## Threat Model

This application is designed to protect sensitive company data against:

1. **Unauthorized local access** — another user on the same machine accessing app data
2. **Bundle interception** — an attacker intercepting a .companybundle file in transit
3. **Bundle tampering** — an attacker modifying a bundle before the recipient opens it
4. **Brute-force password attacks** — an attacker trying many passwords offline
5. **Data leakage through logs** — sensitive data appearing in application logs

---

## Cryptographic Primitives

### Key Derivation — Argon2id

All user passwords are converted to cryptographic keys using **Argon2id** (winner of the Password Hashing Competition):

| Parameter | Value | Rationale |
|---|---|---|
| Memory | 65,536 KiB (64 MiB) | Forces 64 MB of RAM per attempt — prevents GPU attacks |
| Iterations | 3 | Increases time per attempt |
| Parallelism | 4 | Uses 4 CPU threads |
| Output | 32 bytes | AES-256 key |

An attacker with a powerful GPU cluster would still need significant time per password guess due to the memory constraint.

### Encryption — AES-256-GCM

Bundle data and backups use **AES-256-GCM** (Galois/Counter Mode):

- **256-bit key** — quantum-resistant for the foreseeable future
- **Authenticated encryption** — provides both confidentiality AND integrity
- **Random 96-bit nonce** — unique per encryption operation, preventing replay
- **16-byte authentication tag** — any modification to ciphertext is detected

### Integrity — HMAC-SHA256

A separate **HMAC-SHA256** signature is computed over the encrypted bundle data:
- Uses a separately derived signing key (`Argon2id(password + ":SIGN", separate_salt)`)
- Verified **before** decryption — prevents oracle attacks
- Stored as hex in `hmac.sig` alongside the signing salt

---

## Bundle Security Flow

### Creating a Bundle (Sender)

```
password (user input)
    │
    ├─► Argon2id(password, random_salt) ──► 256-bit encryption key
    │                                            │
    │                                            ▼
    │                               AES-256-GCM(rows_json)
    │                                            │
    │                                            ▼
    │                                     data.enc
    │
    └─► Argon2id(password+":SIGN", sign_salt) ──► signing key
                                                        │
                                                        ▼
                                              HMAC-SHA256(data.enc)
                                                        │
                                                        ▼
                                                    hmac.sig
```

### Opening a Bundle (Receiver)

```
password (user input)
    │
    ├─► Read hmac.sig → derive signing key → verify HMAC
    │   └─ If HMAC fails: reject immediately (tamper detected)
    │
    └─► Derive encryption key → AES-GCM decrypt data.enc
        └─ If decryption fails: wrong password or corrupt data
```

---

## What Is Never Done

| Action | Why |
|---|---|
| Store password anywhere | Unnecessary — passwords are only used to derive keys |
| Log search queries | Search terms may contain sensitive data |
| Log row contents | Data must never appear in logs |
| Send any data to a server | Application is 100% offline |
| Use cloud storage | Data must remain under user control |
| Phone home for analytics | Zero telemetry policy |

---

## Platform Security

### Data Storage

App data is stored in the platform-specific application data directory:

- **Windows:** `%APPDATA%\com.securespreadsheet.search\`
- **macOS:** `~/Library/Application Support/com.securespreadsheet.search/`
- **Linux:** `~/.local/share/com.securespreadsheet.search/`

These directories are protected by OS-level user account isolation. Only the logged-in user and administrators can access them.

### Content Security Policy

The app's webview enforces a strict CSP:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:
```

This prevents XSS and injection of external resources.

### Tauri Allowlist

Only necessary OS capabilities are enabled:
- File dialog (open/save)
- Path resolution
- Window management

All other Tauri capabilities (HTTP client, clipboard, notification, etc.) are disabled.

---

## Future Enhancements

- Full SQLite database encryption via SQLCipher (transparent, no schema changes needed)
- PIN-protected app lock (auto-lock after inactivity)
- Key rotation for long-lived datasets
- Certificate-based bundle signing (verifiable sender identity)
