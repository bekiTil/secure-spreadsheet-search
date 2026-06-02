import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/app';
import { searchDataset, formatNumber } from '@/utils/tauri';
import type { SearchResults } from '@/types';
import { SearchIcon, DatabaseIcon } from '@/components/ui/Icons';

const PAGE_SIZE = 100;
const DEBOUNCE_MS = 200;

export default function SearchScreen() {
  const { datasets, activeDatasetId, setActiveDatasetId, addToast } = useAppStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) ?? datasets[0] ?? null;

  // Auto-select first dataset if none selected
  useEffect(() => {
    if (!activeDatasetId && datasets.length > 0) {
      setActiveDatasetId(datasets[0].id);
    }
  }, [datasets, activeDatasetId]);

  const doSearch = useCallback(async (q: string, off: number) => {
    if (!activeDataset) return;
    setLoading(true);
    try {
      const r = await searchDataset({
        dataset_id: activeDataset.id,
        query: q,
        columns: activeDataset.searchable_columns,
        limit: PAGE_SIZE,
        offset: off,
      });
      setResults(r);
    } catch (e: any) {
      addToast({ type: 'error', message: String(e) });
    } finally {
      setLoading(false);
    }
  }, [activeDataset]);

  // Debounced search on query change
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      doSearch(query, 0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, activeDataset?.id]);

  // Reload when offset changes
  useEffect(() => {
    if (results !== null) doSearch(query, offset);
  }, [offset]);

  const columns = activeDataset?.column_names ?? [];
  const totalPages = results ? Math.ceil(results.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  if (datasets.length === 0) {
    return (
      <div className="screen">
        <div className="empty-state">
          <DatabaseIcon size={48} />
          <h2>No datasets yet</h2>
          <p>Import a spreadsheet first, then you can search it here.</p>
          <button className="btn btn-primary" onClick={() => useAppStore.getState().setScreen('import')}>
            Import a Spreadsheet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {/* Toolbar */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {/* Dataset selector */}
        <select
          className="input"
          style={{ maxWidth: '220px', flex: '0 0 auto' }}
          value={activeDataset?.id ?? ''}
          onChange={(e) => {
            setActiveDatasetId(e.target.value);
            setQuery('');
            setResults(null);
            setOffset(0);
          }}
          aria-label="Select dataset"
        >
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {/* Search input */}
        <div style={{ flex: 1, position: 'relative', minWidth: '200px' }}>
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }}>
            <SearchIcon size={16} />
          </div>
          <input
            className="input"
            style={{ paddingLeft: '36px' }}
            type="search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search query"
            autoFocus
          />
        </div>

        {/* Status */}
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="spinner" style={{ width: 14, height: 14 }} /> Searching…
            </span>
          ) : results ? (
            `${formatNumber(results.total)} result${results.total !== 1 ? 's' : ''}`
          ) : ''}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {results && results.rows.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {results.rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col} title={String(row[col] ?? '')}>{String(row[col] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : results && results.rows.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px' }}>
            <SearchIcon size={40} />
            <h3>No results</h3>
            <p>No records match "{query}"</p>
          </div>
        ) : !results && !loading ? (
          <div className="empty-state" style={{ padding: '48px' }}>
            <SearchIcon size={40} />
            <h3>Start typing to search</h3>
            <p>{activeDataset ? `Searching across ${formatNumber(activeDataset.record_count)} records in "${activeDataset.name}"` : ''}</p>
          </div>
        ) : null}
      </div>

      {/* Pagination */}
      {results && totalPages > 1 && (
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--color-surface)',
        }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={offset + PAGE_SIZE >= results.total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
