import { useState } from 'react';
import { useAppStore } from '@/store/app';
import {
  renameDataset, deleteDataset, listDatasets,
  createBundle, saveBundleDialog, exportBackup, importBackup,
  saveBackupDialog, openBackupDialog, formatNumber, formatDate, formatBytes,
} from '@/utils/tauri';
import type { Dataset } from '@/types';
import {
  DatabaseIcon, EditIcon, TrashIcon, ShareIcon, DownloadIcon,
  UploadIcon,
} from '@/components/ui/Icons';
import PasswordInput from '@/components/ui/PasswordInput';

type Modal =
  | { type: 'rename'; dataset: Dataset }
  | { type: 'delete'; dataset: Dataset }
  | { type: 'share'; dataset: Dataset }
  | { type: 'backup-export' }
  | { type: 'backup-import' }
  | null;

export default function ManageScreen() {
  const { datasets, setDatasets, addToast, setScreen, setActiveDatasetId } = useAppStore();
  const [modal, setModal] = useState<Modal>(null);
  const [renameValue, setRenameValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRename() {
    if (modal?.type !== 'rename') return;
    setLoading(true);
    try {
      await renameDataset(modal.dataset.id, renameValue);
      const updated = await listDatasets();
      setDatasets(updated);
      addToast({ type: 'success', message: 'Dataset renamed' });
      setModal(null);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    setLoading(true);
    try {
      await deleteDataset(modal.dataset.id);
      const updated = await listDatasets();
      setDatasets(updated);
      addToast({ type: 'success', message: `"${modal.dataset.name}" deleted` });
      setModal(null);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (modal?.type !== 'share') return;
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const safeName = modal.dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_');
      const outputPath = await saveBundleDialog(safeName);
      if (!outputPath) { setLoading(false); return; }

      await createBundle({
        dataset_id: modal.dataset.id,
        output_path: outputPath,
        password,
        include_original: false,
      });

      addToast({ type: 'success', message: 'Bundle created successfully' });
      setModal(null);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleExportBackup() {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const outputPath = await saveBackupDialog();
      if (!outputPath) { setLoading(false); return; }
      const result = await exportBackup(outputPath, password);
      addToast({ type: 'success', message: `Backup created — ${result.dataset_count} datasets` });
      setModal(null);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleImportBackup() {
    if (password.length < 4) { setError('Enter the backup password'); return; }
    setLoading(true);
    try {
      const backupPath = await openBackupDialog();
      if (!backupPath) { setLoading(false); return; }
      const imported = await importBackup(backupPath, password);
      const updated = await listDatasets();
      setDatasets(updated);
      addToast({ type: 'success', message: `Restored: ${imported.join(', ')}` });
      setModal(null);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function openModal(m: Modal) {
    setModal(m);
    setPassword('');
    setConfirmPassword('');
    setError('');
    if (m?.type === 'rename') setRenameValue(m.dataset.name);
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Manage Datasets</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} stored locally
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => openModal({ type: 'backup-import' })}>
            <UploadIcon size={14} /> Restore Backup
          </button>
          <button className="btn btn-secondary" onClick={() => openModal({ type: 'backup-export' })} disabled={datasets.length === 0}>
            <DownloadIcon size={14} /> Export Backup
          </button>
          <button className="btn btn-primary" onClick={() => setScreen('import')}>
            + Import New
          </button>
        </div>
      </div>

      {/* Empty */}
      {datasets.length === 0 && (
        <div className="empty-state card">
          <DatabaseIcon size={40} />
          <h3>No datasets</h3>
          <p>Import a spreadsheet to get started.</p>
          <button className="btn btn-primary" onClick={() => setScreen('import')}>Import Spreadsheet</button>
        </div>
      )}

      {/* Dataset list */}
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
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setActiveDatasetId(dataset.id);
                    setScreen('search');
                  }}
                >
                  Search
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => openModal({ type: 'rename', dataset })}>
                  <EditIcon size={13} /> Rename
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => openModal({ type: 'share', dataset })}>
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

      {/* Modals */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" role="dialog" aria-modal="true">

            {/* Rename */}
            {modal.type === 'rename' && (
              <>
                <h2 className="modal-title">Rename Dataset</h2>
                <div className="form-group">
                  <label className="form-label" htmlFor="rename-input">New name</label>
                  <input
                    id="rename-input"
                    className="input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
                  />
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

            {/* Delete */}
            {modal.type === 'delete' && (
              <>
                <h2 className="modal-title">Delete Dataset</h2>
                <p>Are you sure you want to permanently delete <strong>"{modal.dataset.name}"</strong>?
                  This will remove {formatNumber(modal.dataset.record_count)} records and cannot be undone.</p>
                {error && <p className="form-error" style={{ marginTop: '8px' }}>{error}</p>}
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>
                    {loading ? 'Deleting…' : 'Delete Permanently'}
                  </button>
                </div>
              </>
            )}

            {/* Share */}
            {modal.type === 'share' && (
              <>
                <h2 className="modal-title">Share Dataset</h2>
                <p style={{ marginBottom: '16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Creates an encrypted <strong>.companybundle</strong> file you can email to a colleague.
                  They will need the password to open it.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <PasswordInput
                    id="share-password"
                    label="Bundle Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="At least 8 characters"
                    hint="Share this password separately — don't include it in the email."
                    minLength={8}
                    autoFocus
                  />
                  <PasswordInput
                    id="share-password-confirm"
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Re-enter password"
                    error={confirmPassword && confirmPassword !== password ? 'Passwords do not match' : undefined}
                  />
                </div>
                {error && <p className="form-error" style={{ marginTop: '8px' }}>{error}</p>}
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleShare} disabled={loading}>
                    {loading ? 'Creating…' : <><ShareIcon size={14} /> Create Bundle</>}
                  </button>
                </div>
              </>
            )}

            {/* Backup Export */}
            {modal.type === 'backup-export' && (
              <>
                <h2 className="modal-title">Export Backup</h2>
                <p style={{ marginBottom: '16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  All {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} will be exported to an encrypted backup file.
                </p>
                <PasswordInput
                  id="backup-password"
                  label="Backup Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 8 characters"
                  minLength={8}
                  autoFocus
                />
                {error && <p className="form-error" style={{ marginTop: '8px' }}>{error}</p>}
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleExportBackup} disabled={loading}>
                    {loading ? 'Exporting…' : <><DownloadIcon size={14} /> Export Backup</>}
                  </button>
                </div>
              </>
            )}

            {/* Backup Import */}
            {modal.type === 'backup-import' && (
              <>
                <h2 className="modal-title">Restore Backup</h2>
                <p style={{ marginBottom: '16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Select an encrypted backup file and enter the password to restore your datasets.
                </p>
                <PasswordInput
                  id="restore-password"
                  label="Backup Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter backup password"
                  autoFocus
                />
                {error && <p className="form-error" style={{ marginTop: '8px' }}>{error}</p>}
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleImportBackup} disabled={loading}>
                    {loading ? 'Restoring…' : <><UploadIcon size={14} /> Select Backup File</>}
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
