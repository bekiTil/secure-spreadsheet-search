/**
 * Integration tests for import flow (mocked Tauri commands).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImportPreview, ImportSummary } from '@/types';

// The actual tauri module is mocked via setup.ts
const { mockInvoke } = await import('../setup');

describe('Import integration', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('validate_file returns file type for xlsx', async () => {
    mockInvoke.mockResolvedValueOnce('xlsx');
    const { validateFile } = await import('@/utils/tauri');
    const result = await validateFile('/path/to/file.xlsx');
    expect(result).toBe('xlsx');
    expect(mockInvoke).toHaveBeenCalledWith('validate_file', { filePath: '/path/to/file.xlsx' });
  });

  it('preview_file returns columns and preview rows', async () => {
    const preview: ImportPreview = {
      filename: 'employees.csv',
      columns: ['Name', 'Email', 'Department'],
      preview_rows: [{ Name: 'Alice', Email: 'alice@corp.com', Department: 'Engineering' }],
      estimated_total_rows: 500,
      file_type: 'CSV',
    };
    mockInvoke.mockResolvedValueOnce(preview);
    const { previewFile } = await import('@/utils/tauri');
    const result = await previewFile('/path/employees.csv');
    expect(result.columns).toEqual(['Name', 'Email', 'Department']);
    expect(result.preview_rows).toHaveLength(1);
  });

  it('import_spreadsheet returns summary on success', async () => {
    const summary: ImportSummary = {
      dataset_id: 'abc-123',
      dataset_name: 'Employees',
      record_count: 500,
      column_names: ['Name', 'Email'],
      searchable_columns: ['Name', 'Email'],
      imported_at: '2024-01-01T00:00:00Z',
      size_bytes: 50000,
    };
    mockInvoke.mockResolvedValueOnce(summary);
    const { importSpreadsheet } = await import('@/utils/tauri');
    const result = await importSpreadsheet({
      file_path: '/path/employees.csv',
      dataset_name: 'Employees',
      searchable_columns: ['Name', 'Email'],
      include_original_in_bundle: false,
    });
    expect(result.dataset_id).toBe('abc-123');
    expect(result.record_count).toBe(500);
  });

  it('validate_file throws for unsupported format', async () => {
    mockInvoke.mockRejectedValueOnce('Unsupported file type: .pdf');
    const { validateFile } = await import('@/utils/tauri');
    await expect(validateFile('/path/file.pdf')).rejects.toBeTruthy();
  });
});

describe('Search integration', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('searchDataset returns results', async () => {
    mockInvoke.mockResolvedValueOnce({
      rows: [{ Name: 'Alice Smith', Email: 'alice@corp.com' }],
      total: 1,
      offset: 0,
      limit: 100,
    });
    const { searchDataset } = await import('@/utils/tauri');
    const result = await searchDataset({
      dataset_id: 'abc-123',
      query: 'Alice',
      columns: ['Name', 'Email'],
      limit: 100,
      offset: 0,
    });
    expect(result.total).toBe(1);
    expect(result.rows[0].Name).toBe('Alice Smith');
  });

  it('searchDataset with empty query returns all rows', async () => {
    mockInvoke.mockResolvedValueOnce({
      rows: [{ Name: 'Alice' }, { Name: 'Bob' }],
      total: 2,
      offset: 0,
      limit: 100,
    });
    const { searchDataset } = await import('@/utils/tauri');
    const result = await searchDataset({
      dataset_id: 'abc-123',
      query: '',
      columns: ['Name'],
    });
    expect(result.total).toBe(2);
  });
});

describe('Bundle integration', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('validateBundle returns manifest', async () => {
    const manifest = {
      magic: 'SECURE-SPREADSHEET-SEARCH',
      format_version: 1,
      bundle_id: 'xyz',
      dataset_name: 'Test',
      source_filename: 'test.csv',
      record_count: 100,
      column_names: ['Name'],
      searchable_columns: ['Name'],
      created_at: '2024-01-01T00:00:00Z',
      created_by_version: '1.0.0',
      has_original_file: false,
      kdf_algorithm: 'Argon2id',
      encryption_algorithm: 'AES-256-GCM',
      hmac_algorithm: 'HMAC-SHA256',
    };
    mockInvoke.mockResolvedValueOnce(manifest);
    const { validateBundle } = await import('@/utils/tauri');
    const result = await validateBundle('/path/file.companybundle');
    expect(result.magic).toBe('SECURE-SPREADSHEET-SEARCH');
    expect(result.encryption_algorithm).toBe('AES-256-GCM');
  });

  it('openBundle with wrong password throws', async () => {
    mockInvoke.mockRejectedValueOnce('Decryption failed — wrong password or corrupted data');
    const { openBundle } = await import('@/utils/tauri');
    await expect(openBundle('/path/file.companybundle', 'wrong')).rejects.toBeTruthy();
  });

  it('openBundle with tampered file throws', async () => {
    mockInvoke.mockRejectedValueOnce('Bundle tampered — integrity check failed');
    const { openBundle } = await import('@/utils/tauri');
    await expect(openBundle('/path/tampered.companybundle', 'password')).rejects.toBeTruthy();
  });
});
