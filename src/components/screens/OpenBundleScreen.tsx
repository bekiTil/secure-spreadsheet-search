import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app';
import {
  openBundleDialog, validateBundle, openBundle, listDatasets, formatNumber,
} from '@/utils/tauri';
import type { BundleManifest } from '@/types';
import { PackageIcon, LockIcon, CheckIcon, AlertIcon } from '@/components/ui/Icons';
import PasswordInput from '@/components/ui/PasswordInput';

type Step = 'select' | 'confirm' | 'opening' | 'done' | 'error';

export default function OpenBundleScreen() {
  const { pendingBundlePath, setPendingBundlePath, setDatasets, setScreen, setActiveDatasetId, addToast } = useAppStore();

  const [step, setStep] = useState<Step>('select');
  const [bundlePath, setBundlePath] = useState(pendingBundlePath ?? '');
  const [manifest, setManifest] = useState<BundleManifest | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [importedDatasetId, setImportedDatasetId] = useState('');

  // Auto-open if a pending bundle was passed via file association
  useEffect(() => {
    if (pendingBundlePath) {
      handleValidate(pendingBundlePath);
    }
  }, []);

  async function handleSelectFile() {
    const path = await openBundleDialog();
    if (!path) return;
    handleValidate(path);
  }

  async function handleValidate(path: string) {
    setLoading(true);
    setErrorMessage('');
    try {
      const m = await validateBundle(path);
      setBundlePath(path);
      setManifest(m);
      setStep('confirm');
    } catch (e: any) {
      setErrorMessage(String(e));
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen() {
    if (!bundlePath || !password) return;
    setLoading(true);
    setPasswordError('');
    setStep('opening');
    try {
      const result = await openBundle(bundlePath, password);
      const datasets = await listDatasets();
      setDatasets(datasets);
      setImportedDatasetId(result.dataset_id);
      setStep('done');
      setPendingBundlePath(null);
      addToast({ type: 'success', message: `"${result.dataset_name}" imported — ${formatNumber(result.record_count)} records` });
    } catch (e: any) {
      const msg = String(e);
      if (msg.toLowerCase().includes('decrypt') || msg.toLowerCase().includes('password')) {
        setPasswordError('Incorrect password. Please try again.');
        setStep('confirm');
      } else if (msg.toLowerCase().includes('tamper')) {
        setErrorMessage('This bundle has been tampered with and cannot be opened.');
        setStep('error');
      } else {
        setErrorMessage(msg);
        setStep('error');
      }
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
            margin: '0 auto 16px',
            color: 'var(--color-accent)',
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
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSelectFile}
              disabled={loading}
            >
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Loading…</> : <><PackageIcon size={16} /> Select Bundle File</>}
            </button>
            <p style={{ marginTop: '16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Or double-click a .companybundle file to open it directly.
            </p>
          </div>
        )}

        {/* Confirm */}
        {step === 'confirm' && manifest && (
          <div>
            <div className="card" style={{ marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '12px' }}>Bundle Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-sm)' }}>
                {[
                  { label: 'Dataset Name', value: manifest.dataset_name },
                  { label: 'Records', value: formatNumber(manifest.record_count) },
                  { label: 'Created', value: new Date(manifest.created_at).toLocaleString() },
                  { label: 'Encryption', value: manifest.encryption_algorithm },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: '16px' }}>
              <PasswordInput
                id="bundle-password"
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Enter bundle password"
                error={passwordError}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setStep('select'); setManifest(null); setPendingBundlePath(null); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleOpen}
                disabled={!password || loading}
              >
                <LockIcon size={14} /> Open Bundle
              </button>
            </div>
          </div>
        )}

        {/* Opening */}
        {step === 'opening' && (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 24px' }} />
            <h2>Opening Bundle…</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              Verifying integrity and decrypting data…
            </p>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--color-success-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              color: 'var(--color-success)',
            }}>
              <CheckIcon size={28} />
            </div>
            <h2>Import Successful</h2>
            <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 24px' }}>
              Search ready. You can now search across this dataset.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                setActiveDatasetId(importedDatasetId);
                setScreen('search');
              }}
            >
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
              margin: '0 auto 24px',
              color: 'var(--color-danger)',
            }}>
              <AlertIcon size={28} />
            </div>
            <h2 style={{ color: 'var(--color-danger)' }}>Cannot Open Bundle</h2>
            <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 24px' }}>
              {errorMessage}
            </p>
            <button className="btn btn-primary" onClick={() => { setStep('select'); setErrorMessage(''); }}>
              Try Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
