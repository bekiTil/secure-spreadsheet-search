// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface Dataset {
  id: string;
  name: string;
  source_filename: string;
  record_count: number;
  column_names: string[];
  searchable_columns: string[];
  imported_at: string;
  size_bytes: number;
}

export interface ImportPreview {
  filename: string;
  columns: string[];
  preview_rows: Record<string, string>[];
  estimated_total_rows: number;
  file_type: string;
}

export interface ImportOptions {
  file_path: string;
  dataset_name: string;
  searchable_columns: string[];
  include_original_in_bundle: boolean;
}

export interface ImportSummary {
  dataset_id: string;
  dataset_name: string;
  record_count: number;
  column_names: string[];
  searchable_columns: string[];
  imported_at: string;
  size_bytes: number;
}

export interface SearchOptions {
  dataset_id: string;
  query: string;
  columns: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResults {
  rows: Record<string, string>[];
  total: number;
  offset: number;
  limit: number;
}

export interface BundleManifest {
  magic: string;
  format_version: number;
  bundle_id: string;
  dataset_name: string;
  source_filename: string;
  record_count: number;
  column_names: string[];
  searchable_columns: string[];
  created_at: string;
  created_by_version: string;
  has_original_file: boolean;
  kdf_algorithm: string;
  encryption_algorithm: string;
  hmac_algorithm: string;
}

export interface OpenBundleResult {
  dataset_id: string;
  dataset_name: string;
  record_count: number;
  column_names: string[];
  searchable_columns: string[];
}

export interface CreateBundleOptions {
  dataset_id: string;
  output_path: string;
  password: string;
  include_original: boolean;
  original_file_path?: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  font_size: 'normal' | 'large' | 'larger';
  auto_lock: boolean;
  auto_lock_minutes: number;
  default_search_limit: number;
}

// ─── UI Types ─────────────────────────────────────────────────────────────────

export type Screen =
  | 'home'
  | 'import'
  | 'search'
  | 'manage'
  | 'settings'
  | 'open-bundle';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
