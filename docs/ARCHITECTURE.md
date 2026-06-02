# Secure Spreadsheet Search — System Architecture

## Overview

Secure Spreadsheet Search is a cross-platform offline desktop application built with Tauri, React, and SQLite. It allows non-technical users to import spreadsheet data, search it instantly, and securely share datasets using an encrypted bundle format.

## Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Desktop shell | Tauri v1 | Lightweight, secure, cross-platform |
| Frontend | React + TypeScript | Component-based UI, type safety |
| Build tool | Vite | Fast development, optimized builds |
| Backend | Rust | Memory safety, performance, encryption |
| Database | SQLite (rusqlite) | Zero-config, embedded, portable |
| Full-text search | SQLite FTS5 | Sub-second search on 500k+ rows |
| Encryption | AES-256-GCM (aes-gcm) | AEAD, tamper-resistant |
| Key derivation | Argon2id | Memory-hard, phishing-resistant |
| Integrity | HMAC-SHA256 | Bundle tamper detection |
| State management | Zustand | Minimal, reactive |

---

## Folder Structure

```
secure-spreadsheet-search/
├── src/                          # React frontend
│   ├── components/
│   │   ├── screens/              # Full-screen views
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── ImportScreen.tsx
│   │   │   ├── SearchScreen.tsx
│   │   │   ├── ManageScreen.tsx
│   │   │   ├── SettingsScreen.tsx
│   │   │   └── OpenBundleScreen.tsx
│   │   ├── ui/                   # Reusable UI components
│   │   │   ├── Icons.tsx
│   │   │   ├── PasswordInput.tsx
│   │   │   └── ToastContainer.tsx
│   │   └── Sidebar.tsx
│   ├── store/
│   │   └── app.ts                # Global state (Zustand)
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── utils/
│   │   └── tauri.ts              # Type-safe Tauri API bridge
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri command handlers
│   │   │   ├── import.rs         # File import commands
│   │   │   ├── search.rs         # Search commands
│   │   │   ├── datasets.rs       # Dataset CRUD commands
│   │   │   ├── bundle.rs         # Bundle create/open commands
│   │   │   ├── backup.rs         # Backup commands
│   │   │   └── settings.rs       # App settings commands
│   │   ├── bundle.rs             # Bundle format implementation
│   │   ├── crypto.rs             # Cryptographic primitives
│   │   ├── db.rs                 # SQLite database layer + FTS5
│   │   ├── import.rs             # Spreadsheet parsing engine
│   │   ├── backup.rs             # Backup system
│   │   ├── error.rs              # Error types
│   │   ├── lib.rs                # App setup
│   │   └── main.rs               # Entry point
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── tests/
│   ├── unit/                     # Frontend unit tests
│   ├── integration/              # Integration tests
│   ├── performance/              # Performance benchmarks
│   └── setup.ts                  # Vitest + Tauri mocks
├── docs/
│   ├── ARCHITECTURE.md           # This document
│   ├── SECURITY.md
│   ├── BUNDLE_FORMAT.md
│   └── USER_GUIDE.md
└── .github/workflows/build.yml   # CI/CD pipeline
```

---

## Database Schema

```sql
-- Dataset metadata
CREATE TABLE datasets (
  id             TEXT PRIMARY KEY,      -- UUID v4
  name           TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  record_count   INTEGER NOT NULL DEFAULT 0,
  column_names   TEXT NOT NULL,        -- JSON array
  searchable_columns TEXT NOT NULL,    -- JSON array
  imported_at    TEXT NOT NULL,        -- ISO 8601
  size_bytes     INTEGER NOT NULL DEFAULT 0
);

-- Data rows (row_json is JSON object: {column: value})
CREATE TABLE data_rows (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id     TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  row_json       BLOB NOT NULL
);

-- Full-text search index (FTS5 with unicode61 tokenizer)
CREATE VIRTUAL TABLE search_index USING fts5(
  dataset_id UNINDEXED,
  row_id     UNINDEXED,
  searchable_text,
  tokenize = 'unicode61 remove_diacritics 1'
);

-- App settings
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**Performance optimizations:**
- WAL journal mode (concurrent reads during write)
- FTS5 BM25 ranking for relevance ordering
- Prefix search via `"token"*` syntax — sub-100ms on 500k rows
- Bulk insert wrapped in transactions (batch size: unlimited, chunked implicitly)

---

## Security Architecture

### Data at Rest

All spreadsheet data is stored in SQLite in plaintext columns BUT the SQLite database file itself is stored in the platform-specific app data directory with OS-level access control:

- **Windows:** `%APPDATA%\com.securespreadsheet.search\secure_data.db`
- **macOS:** `~/Library/Application Support/com.securespreadsheet.search/secure_data.db`
- **Linux:** `~/.local/share/com.securespreadsheet.search/secure_data.db`

Future versions can add full SQLite database encryption via SQLCipher with zero schema changes.

### Bundle Encryption

See `docs/BUNDLE_FORMAT.md` for the full bundle specification.

**Key derivation:** Argon2id with 64 MiB memory, 3 iterations, 4 lanes.  
**Encryption:** AES-256-GCM (authenticated encryption — provides both confidentiality and integrity).  
**Integrity:** HMAC-SHA256 over the encrypted data blob using a separately derived signing key.

### Password Security

- Passwords are never stored anywhere
- Bundle passwords are used only for Argon2id key derivation
- Password verification happens implicitly through AES-GCM authentication tag — wrong password = decryption fails

### What Never Happens

- ❌ No telemetry
- ❌ No network requests
- ❌ No cloud storage
- ❌ No logging of search queries
- ❌ No logging of data contents
- ❌ No account creation
- ❌ No analytics

---

## Search Architecture

Search uses SQLite FTS5 (Full-Text Search v5):

1. On import, each row's searchable column values are concatenated and indexed
2. On search, a sanitized FTS5 query using prefix tokens enables partial match
3. Results join `search_index` with `data_rows` to retrieve full row data
4. Pagination via LIMIT/OFFSET

**Search types supported:**
- Exact match: `"alice smith"*`
- Partial/prefix: `ali*`
- Contains: `"smith"*`
- Multi-word: `"alice"* "smith"*`
- Case-insensitive: handled by unicode61 tokenizer

---

## Bundle Format

See `docs/BUNDLE_FORMAT.md` for the complete specification.

---

## Cross-Platform Build Targets

| Platform | Format | Notes |
|---|---|---|
| Windows | `.msi`, `.exe` | NSIS and MSI installers |
| macOS | `.dmg` | Universal binary (Intel + Apple Silicon) |
| Linux | `.AppImage`, `.deb` | Self-contained + Debian package |

File association (`.companybundle` → app) is registered at install time on all platforms via `tauri.conf.json → bundle.fileAssociations`.
