import { useState } from 'react';
import { useAppStore } from '@/store/app';
import {
  renameDataset, deleteDataset, listDatasets,
  createBundle, saveBundleDialog, exportBackup, importBackup,
  saveBackupDialog, openBackupDialog, formatNumber, formatDate, formatBytes,
} from '@/utils/tauri';
import type { Dataset } from '@/types';
import { DatabaseIcon, EditIcon, TrashIcon, ShareIcon, DownloadIcon, UploadIcon } from '@/components/ui/Icons';

type Modal =
  | { type: 'rename'; dataset: Dataset }
  | { type: 'delete'; dataset: Dataset }
  | null;

export default function ManageScreen() {
  const { datasets, setDatasets, addToast, setScreen, setActiveDatasetId } = useAppStore();
  const [modal, setModal] = useState<Modal>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRename() {
    if (modal?.type !== 'rename') return;
    setLoading(true);
    try {
      await renameDataset(modal.dataset.id, renameValue);
      setDatasets(await listDatasets());
      addToast({ type: 'success', message: 'Dataset renamed' });
      setModal(null);
    } catch (e: any) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    setLoading(true);
    try {
      await deleteDataset(modal.dataset.id);
      setDatasets(await listDatasets());
      addToast({ type: 'success', message: `"${modal.dataset.name}" deleted` });
      setModal(null);
    } catch (e: any) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleShare(dataset: Dataset) {
    try {
      const safeName = dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_');
      const outputPath = await saveBundleDialog(safeName);
      if (!outputPath) return;
      setLoading(true);
      await createBundle({ dataset_id: dataset.id, output_path: outputPath, password: '', include_original: false });
      addToast({ type: 'success', message: 'Bundle created — ready to share' });
    } catch (e: any) { addToast({ type: 'error', message: String(e) }); }
    finally { setLoading(false); }
  }

  async function handleExportBackup() {
    try {
      const outputPath = await saveBackupDialog();
      if (!outputPath) return;
      setLoading(true);
      const result = await exportBackup(outputPath, '');
      addToast({ type: 'success', message: `Backup saved — ${result.dataset_count} datasets` });
    } catch (e: any) { addToast({ type: 'error', message: String(e) }); }
    finally { setLoading(false); }
  }

  async function handleImportBackup() {
    try {
      const backupPath = await openBackupDialog();
      if (!backupPath) return;
      setLoading(true);
      const imported = await importBackup(backupPath, '');
      setDatasets(await listDatasets());
      addToast({ type: 'success', message: `Restored: ${imported.join(', ')}` });
    } catch (e: any) { addToast({ type: 'error', message: String(e) }); }
    finally { setLoading(false); }
  }

  function openModal(m: Modal) {
    setModal(m);
    setError('');
    if (m?.type === 'rename') setRenameValue(m.dataset.name);
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Datasets</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} stored on your computer
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleImportBackup} disabled={loading}>
            <UploadIcon size={14} /> Restore Backup
          </button>
          <button className="btn btn-secondary" onClick={handleExportBackup} disabled={datasets.length === 0 || loading}>
            <DownloadIcon size={14} /> Backup All
          </button>
          <button className="btn btn-primary" onClick={() => setScreen('import')}>
            + Import New
          </button>
        </div>
      </div>

      {datasets.length === 0 && (
        <div className="empty-state card">
          <DatabaseIcon size={40} />
          <h3>No datasets yet</h3>
          <p>Import a spreadsheet to get started.</p>
          <button className="btn btn-primary" onClick={() => setScreen('import')}>Import Spreadsheet</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {datasets.map((dataset) => (
          <div key={dataset.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)', marginBottom: '4px' }}>
                  {dataset.name}
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  <span>{formatNumber(dataset.record_count)} records</span>
                  <span>{dataset.column_names.length} columns</span>
                  <span>{formatBytes(dataset.size_bytes)}</span>
                  <span>Imported {formatDate(dataset.imported_at)}</span>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {dataset.searchable_columns.map((col) => (
                    <span key={col} className="badge badge-accent">{col}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { setActiveDatasetId(dataset.id); setScreen('search'); }}>
                  Search
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => openModal({ type: 'rename', dataset })}>
                  <EditIcon size={13} /> Rename
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleShare(dataset)} disabled={loading}>
                  <ShareIcon size={13} /> Share
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => openModal({ type: 'delete', dataset })}>
                  <TrashIcon size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" role="dialog" aria-modal="true">

            {modal.type === 'rename' && (
              <>
                <h2 className="modal-title">Rename Dataset</h2>
                <div className="form-group">
                  <label className="form-label" htmlFor="rename-input">New name</label>
                  <input id="rename-input" className="input" value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }} />
                  {error && <span className="form-error">{error}</span>}
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleRename} disabled={loading || !renameValue.trim()}>
                    {loading ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}

            {modal.type === 'delete' && (
              <>
                <h2 className="modal-title">Delete Dataset</h2>
                <p>Permanently delete <strong>"{modal.dataset.name}"</strong>?
                  This removes {formatNumber(modal.dataset.record_count)} records and cannot be undone.</p>
                {error && <p className="form-error" style={{ marginTop: '8px' }}>{error}</p>}
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>
                    {loading ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
