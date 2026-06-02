/**
 * Type-safe wrapper around Tauri invoke commands.
 * All communication with the Rust backend goes through this module.
 */
import { invoke } from '@tauri-apps/api/tauri';
import { open, save } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import type {
  Dataset,
  ImportPreview,
  ImportOptions,
  ImportSummary,
  SearchOptions,
  SearchResults,
  BundleManifest,
  CreateBundleOptions,
  OpenBundleResult,
  AppSettings,
} from '@/types';

// ─── File Import ──────────────────────────────────────────────────────────────

export async function validateFile(filePath: string): Promise<string> {
  return invoke('validate_file', { filePath });
}

export async function previewFile(filePath: string): Promise<ImportPreview> {
  return invoke('preview_file', { filePath });
}

export async function importSpreadsheet(options: ImportOptions): Promise<ImportSummary> {
  return invoke('import_spreadsheet', { options });
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchDataset(options: SearchOptions): Promise<SearchResults> {
  return invoke('search_dataset', { options });
}

// ─── Datasets ─────────────────────────────────────────────────────────────────

export async function listDatasets(): Promise<Dataset[]> {
  return invoke('list_datasets');
}

export async function getDataset(datasetId: string): Promise<Dataset | null> {
  return invoke('get_dataset', { datasetId });
}

export async function renameDataset(datasetId: string, newName: string): Promise<void> {
  return invoke('rename_dataset', { datasetId, newName });
}

export async function deleteDataset(datasetId: string): Promise<void> {
  return invoke('delete_dataset', { datasetId });
}

// ─── Bundle ───────────────────────────────────────────────────────────────────

export async function createBundle(options: CreateBundleOptions): Promise<string> {
  return invoke('create_bundle', { options });
}

export async function validateBundle(bundlePath: string): Promise<BundleManifest> {
  return invoke('validate_bundle', { bundlePath });
}

export async function openBundle(bundlePath: string, password: string): Promise<OpenBundleResult> {
  return invoke('open_bundle', { bundlePath, password });
}

// ─── Backup ───────────────────────────────────────────────────────────────────

export async function exportBackup(outputPath: string, password: string): Promise<{ output_path: string; dataset_count: number }> {
  return invoke('export_backup', { outputPath, password });
}

export async function importBackup(backupPath: string, password: string): Promise<string[]> {
  return invoke('import_backup', { backupPath, password });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  return invoke('get_settings');
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke('save_settings', { settings });
}

// ─── Native Dialogs ───────────────────────────────────────────────────────────

export async function openSpreadsheetDialog(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv', 'tsv', 'xlsm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return typeof selected === 'string' ? selected : null;
}

export async function openBundleDialog(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'Secure Bundles', extensions: ['companybundle'] },
    ],
  });
  return typeof selected === 'string' ? selected : null;
}

export async function saveBundleDialog(defaultName: string): Promise<string | null> {
  return save({
    defaultPath: defaultName.endsWith('.companybundle')
      ? defaultName
      : `${defaultName}.companybundle`,
    filters: [{ name: 'Secure Bundle', extensions: ['companybundle'] }],
  });
}

export async function saveBackupDialog(): Promise<string | null> {
  return save({
    defaultPath: `backup-${new Date().toISOString().slice(0, 10)}.sssbackup`,
    filters: [{ name: 'Backup File', extensions: ['sssbackup'] }],
  });
}

export async function openBackupDialog(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Backup File', extensions: ['sssbackup'] }],
  });
  return typeof selected === 'string' ? selected : null;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export function onOpenBundle(callback: (path: string) => void) {
  return listen<string>('open-bundle', (event) => {
    callback(event.payload);
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}
