# User Guide — Secure Spreadsheet Search

## What is this app?

Secure Spreadsheet Search lets you import company spreadsheets and search through them instantly. Everything happens on your computer — nothing is uploaded to the internet.

---

## Getting Started

### Step 1 — Install

Run the installer for your operating system:
- **Windows:** Double-click `SecureSpreadsheetSearch_1.0.0_x64_en-US.msi`
- **macOS:** Open `SecureSpreadsheetSearch_1.0.0_x64.dmg` and drag to Applications
- **Linux:** Run `SecureSpreadsheetSearch_1.0.0_amd64.AppImage` or install the `.deb`

### Step 2 — Import a Spreadsheet

1. Open the app
2. Click **Import Spreadsheet**
3. Select your file (XLSX, XLS, CSV, or TSV)
4. Review the preview and give your dataset a name
5. Choose which columns to search
6. Click **Import**

Your data is now available for searching.

### Step 3 — Search

1. Click **Search Data**
2. Select your dataset from the dropdown
3. Start typing — results appear as you type

### Step 4 — Share

1. Go to **Manage Datasets**
2. Click **Share** next to a dataset
3. Enter a password (share this password separately — not by email)
4. Save the `.companybundle` file
5. Email the file to your colleague

---

## Receiving a Shared Bundle

### If you have the app installed:
1. Double-click the `.companybundle` file
2. Enter the password your colleague shared
3. Click **Open Bundle**
4. The dataset is imported and ready to search

### If you don't have the app installed:
1. Download and install the app from your IT department
2. Double-click the `.companybundle` file
3. Enter the password and click **Open Bundle**

---

## Backup & Restore

### Create a Backup
1. Go to **Manage Datasets**
2. Click **Export Backup**
3. Enter a backup password
4. Save the backup file somewhere safe

### Restore a Backup
1. Go to **Manage Datasets**
2. Click **Restore Backup**
3. Enter the backup password
4. Select your backup file

---

## Privacy & Security

- ✅ All data stays on your computer
- ✅ No internet connection is ever made
- ✅ No accounts or logins required
- ✅ Shared bundles are encrypted with your password
- ✅ No one can read a bundle without the correct password
- ✅ Bundles are tamper-resistant (any modification is detected)

---

## Supported File Formats

| Format | Extension |
|---|---|
| Excel Workbook | `.xlsx` |
| Legacy Excel | `.xls` |
| Comma-Separated Values | `.csv` |
| Tab-Separated Values | `.tsv` |

---

## Troubleshooting

**"Cannot open bundle" error**
- Make sure you're using the correct password
- Make sure the file wasn't modified or corrupted during transfer
- Ask the sender to create a new bundle

**Import fails**
- Check the file is not password-protected in Excel
- Try saving as CSV if the XLSX import fails
- Very large files (500k+ rows) may take a few minutes

**Search returns no results**
- Check the correct dataset is selected
- Try a shorter search term
- Check the column you're searching was selected during import

---

## Data Management

- **Rename:** Change the name of a dataset
- **Delete:** Permanently remove a dataset from your computer
- **Backup:** Export all datasets to an encrypted backup file
- **Share:** Create an encrypted bundle to share with colleagues
