import { useState } from 'react';
import { useAppStore } from '@/store/app';
import {
  openSpreadsheetDialog,
  previewFile,
  importSpreadsheet,
  listDatasets,
} from '@/utils/tauri';
import type { ImportPreview, ImportSummary } from '@/types';
import { UploadIcon, CheckIcon, FileIcon, ArrowLeftIcon } from '@/components/ui/Icons';

type Step = 'select' | 'preview' | 'columns' | 'importing' | 'done';

export default function ImportScreen() {
  const { addToast, setDatasets, setScreen } = useAppStore();

  const [step, setStep] = useState<Step>('select');
  const [filePath, setFilePath] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const stepIndex: Record<Step, number> = {
    select: 0, preview: 1, columns: 2, importing: 3, done: 3,
  };
  const stepLabels = ['Select File', 'Preview', 'Configure', 'Import'];

  async function handleSelectFile() {
    const path = await openSpreadsheetDialog();
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      const p = await previewFile(path);
      setFilePath(path);
      setPreview(p);
      setDatasetName(p.filename.replace(/\.[^.]+$/, ''));
      setSelectedCols([...p.columns]);
      setStep('preview');
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!filePath || selectedCols.length === 0) return;
    setStep('importing');
    setError('');
    try {
      const result = await importSpreadsheet({
        file_path: filePath,
        dataset_name: datasetName.trim() || preview!.filename,
        searchable_columns: selectedCols,
        include_original_in_bundle: false,
      });
      setSummary(result);
      setStep('done');
      const datasets = await listDatasets();
      setDatasets(datasets);
      addToast({ type: 'success', message: `"${result.dataset_name}" imported — ${result.record_count.toLocaleString()} records` });
    } catch (e: any) {
      setError(String(e));
      setStep('columns');
    }
  }

  function toggleColumn(col: string) {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  function resetWizard() {
    setStep('select');
    setFilePath('');
    setPreview(null);
    setDatasetName('');
    setSelectedCols([]);
    setSummary(null);
    setError('');
  }

  const currentStepIndex = stepIndex[step];

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        {step !== 'select' && step !== 'done' && (
          <button className="btn btn-ghost btn-icon" onClick={() => setStep(step === 'preview' ? 'select' : 'preview')} aria-label="Go back">
            <ArrowLeftIcon size={16} />
          </button>
        )}
        <div>
          <h1>Import Spreadsheet</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Import XLSX, XLS, CSV, or TSV files
          </p>
        </div>
      </div>

      {/* Wizard steps */}
      {step !== 'done' && (
        <div className="wizard-steps" style={{ marginBottom: '32px' }}>
          {stepLabels.map((label, i) => (
            <div key={label} className="wizard-step" style={{ flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <div className={`wizard-step-number ${i < currentStepIndex ? 'done' : ''} ${i === currentStepIndex ? 'active' : ''}`}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: '12px', flexShrink: 0,
                    background: i < currentStepIndex ? 'var(--color-success)' : i === currentStepIndex ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                    color: i <= currentStepIndex ? 'white' : 'var(--color-text-secondary)',
                    border: `2px solid ${i < currentStepIndex ? 'var(--color-success)' : i === currentStepIndex ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  }}
                >
                  {i < currentStepIndex ? <CheckIcon size={12} /> : i + 1}
                </div>
                {i < stepLabels.length - 1 && (
                  <div style={{
                    flex: 1, height: '2px', marginLeft: '8px',
                    background: i < currentStepIndex ? 'var(--color-success)' : 'var(--color-border)',
                  }} />
                )}
              </div>
              <span style={{
                fontSize: '11px', marginLeft: '2px',
                color: i === currentStepIndex ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: i === currentStepIndex ? 600 : 400,
              }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px',
          background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)',
          borderRadius: 'var(--radius-md)', color: 'var(--color-danger)',
          fontSize: 'var(--font-size-sm)',
        }} role="alert">
          {error}
        </div>
      )}

      {/* Step: Select */}
      {step === 'select' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ marginBottom: '24px', opacity: 0.5 }}>
            <UploadIcon size={48} />
          </div>
          <h2 style={{ marginBottom: '8px' }}>Select a spreadsheet file</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            Supported: XLSX, XLS, CSV, TSV
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSelectFile}
            disabled={loading}
          >
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Analyzing…</> : <><UploadIcon size={16} /> Choose File</>}
          </button>
          <p style={{ marginTop: '16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Your file will be imported into encrypted local storage.
            The original file is not required after import.
          </p>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && preview && (
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <FileIcon size={20} />
              <div>
                <div style={{ fontWeight: 600 }}>{preview.filename}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {preview.file_type} · ~{preview.estimated_total_rows.toLocaleString()} rows · {preview.columns.length} columns
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="dataset-name">Dataset Name</label>
              <input
                id="dataset-name"
                className="input"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="Enter a name for this dataset"
              />
            </div>
          </div>

          {/* Preview table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
              Preview (first {preview.preview_rows.length} rows)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {preview.columns.map((col) => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview_rows.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map((col) => (
                        <td key={col} title={String(row[col] ?? '')}>{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={resetWizard}>Cancel</button>
            <button className="btn btn-primary" onClick={() => setStep('columns')}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step: Columns */}
      {step === 'columns' && preview && (
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ marginBottom: '8px' }}>Select Searchable Columns</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Choose which columns to include in search. Only selected columns will be indexed.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCols([...preview.columns])}>
                Select All
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCols([])}>
                Deselect All
              </button>
            </div>

            <div className="checkbox-group">
              {preview.columns.map((col) => {
                const checked = selectedCols.includes(col);
                return (
                  <label key={col} className={`checkbox-item ${checked ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(col)}
                    />
                    {col}
                  </label>
                );
              })}
            </div>

            {selectedCols.length === 0 && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)', marginTop: '8px' }}>
                Select at least one column to search.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setStep('preview')}>← Back</button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={selectedCols.length === 0}
            >
              Import {preview.estimated_total_rows.toLocaleString()} Records
            </button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 24px' }} />
          <h2>Importing…</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
            Processing and encrypting your data. This may take a moment for large files.
          </p>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && summary && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--color-success-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            color: 'var(--color-success)',
          }}>
            <CheckIcon size={28} />
          </div>
          <h2 style={{ marginBottom: '8px' }}>Import Successful</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            Your dataset is ready to search.
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
            textAlign: 'left', marginBottom: '32px',
          }}>
            {[
              { label: 'Dataset Name', value: summary.dataset_name },
              { label: 'Records Imported', value: summary.record_count.toLocaleString() },
              { label: 'Searchable Columns', value: summary.searchable_columns.join(', ') },
              { label: 'Import Date', value: new Date(summary.imported_at).toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={resetWizard}>Import Another</button>
            <button className="btn btn-primary" onClick={() => {
              useAppStore.getState().setActiveDatasetId(summary.dataset_id);
              setScreen('search');
            }}>
              Search This Dataset →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
