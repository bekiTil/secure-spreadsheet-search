import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { openBundleDialog, validateBundle, openBundle, listDatasets, formatNumber } from '@/utils/tauri';
import type { BundleManifest } from '@/types';
import { PackageIcon, CheckIcon, AlertIcon } from '@/components/ui/Icons';

type Step = 'select' | 'importing' | 'done' | 'error';

export default function OpenBundleScreen() {
  const { pendingBundlePath, setPendingBundlePath, setDatasets, setScreen, setActiveDatasetId, addToast } = useAppStore();

  const [step, setStep] = useState<Step>('select');
  const [manifest, setManifest] = useState<BundleManifest | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [importedDatasetId, setImportedDatasetId] = useState('');

  useEffect(() => {
    if (pendingBundlePath) handleOpen(pendingBundlePath);
  }, []);

  async function handleSelectFile() {
    const path = await openBundleDialog();
    if (!path) return;
    handleOpen(path);
  }

  async function handleOpen(path: string) {
    setLoading(true);
    setStep('importing');
    setErrorMessage('');
    try {
      // Read manifest for display
      const m = await validateBundle(path);
      setManifest(m);
      // Open bundle (no password needed)
      const result = await openBundle(path, '');
      const datasets = await listDatasets();
      setDatasets(datasets);
      setImportedDatasetId(result.dataset_id);
      setStep('done');
      setPendingBundlePath(null);
      addToast({ type: 'success', message: `"${result.dataset_name}" imported — ${formatNumber(result.record_count)} records` });
    } catch (e: any) {
      setErrorMessage(String(e));
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--color-accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: 'var(--color-accent)',
          }}>
            <PackageIcon size={28} />
          </div>
          <h1>Open Shared Bundle</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
            Open a .companybundle file shared by a colleague
          </p>
        </div>

        {/* Select */}
        {step === 'select' && (
          <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
            <button className="btn btn-primary btn-lg" onClick={handleSelectFile} disabled={loading}>
              <PackageIcon size={16} /> Select Bundle File
            </button>
            <p style={{ marginTop: '16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Or double-click a .companybundle file to open it directly.
            </p>
          </div>
        )}

        {/* Importing */}
        {step === 'importing' && (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 24px' }} />
            <h2>Opening Bundle…</h2>
            {manifest && (
              <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                Importing <strong>{manifest.dataset_name}</strong> ({formatNumber(manifest.record_count)} records)
              </p>
            )}
          </div>
        )}

        {/* Done */}
        {step === 'done' && manifest && (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--color-success-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', color: 'var(--color-success)',
            }}>
              <CheckIcon size={28} />
            </div>
            <h2>Import Successful</h2>
            <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 24px' }}>
              <strong>{manifest.dataset_name}</strong> is ready to search.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => { setActiveDatasetId(importedDatasetId); setScreen('search'); }}>
              Search Dataset →
            </button>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="card" style={{ textAlign: 'center', padding: '48px', borderColor: 'var(--color-danger)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--color-danger-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', color: 'var(--color-danger)',
            }}>
              <AlertIcon size={28} />
            </div>
            <h2>Cannot Open Bundle</h2>
            <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 24px' }}>{errorMessage}</p>
            <button className="btn btn-primary" onClick={() => { setStep('select'); setErrorMessage(''); }}>
              Try Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
