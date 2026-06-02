import { useAppStore } from '@/store/app';
import { formatNumber, formatDate } from '@/utils/tauri';
import { UploadIcon, SearchIcon, FolderIcon, ShareIcon, ShieldIcon, DatabaseIcon } from '@/components/ui/Icons';

interface QuickAction {
  icon: React.FC<{ size?: number }>;
  label: string;
  description: string;
  screen: 'import' | 'search' | 'manage' | 'open-bundle';
  accent?: boolean;
}

const actions: QuickAction[] = [
  { icon: UploadIcon, label: 'Import Spreadsheet', description: 'Import XLSX, XLS, CSV, or TSV files', screen: 'import', accent: true },
  { icon: SearchIcon, label: 'Search Data', description: 'Search across your imported datasets', screen: 'search' },
  { icon: FolderIcon, label: 'Manage Datasets', description: 'Rename, delete, backup, or share datasets', screen: 'manage' },
  { icon: ShareIcon, label: 'Open Shared Bundle', description: 'Open a .companybundle file from a colleague', screen: 'open-bundle' },
];

export default function HomeScreen() {
  const { datasets, setScreen } = useAppStore();

  const recentDatasets = datasets.slice(0, 3);
  const totalRecords = datasets.reduce((sum, d) => sum + d.record_count, 0);

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <ShieldIcon size={28} />
          <h1>Secure Spreadsheet Search</h1>
        </div>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Your data stays private. All searches happen offline on your computer.
        </p>
      </div>

      {/* Stats */}
      {datasets.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {[
            { label: 'Datasets', value: datasets.length },
            { label: 'Total Records', value: formatNumber(totalRecords) },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ minWidth: '140px' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-accent)' }}>
                {value}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <h2 style={{ marginBottom: '16px' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {actions.map(({ icon: Icon, label, description, screen, accent }) => (
          <button
            key={screen}
            className="card"
            onClick={() => setScreen(screen)}
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              border: accent ? '2px solid var(--color-accent)' : undefined,
              background: accent ? 'var(--color-accent-light)' : undefined,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; }}
            onMouseLeave={(e) => { if (!accent) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
          >
            <div style={{
              width: '40px', height: '40px',
              background: accent ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px',
              color: accent ? 'white' : 'var(--color-text-secondary)',
            }}>
              <Icon size={20} />
            </div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {description}
            </div>
          </button>
        ))}
      </div>

      {/* Recent Datasets */}
      {recentDatasets.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2>Recent Datasets</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setScreen('manage')}>
              View all →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentDatasets.map((dataset) => (
              <div
                key={dataset.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', cursor: 'pointer' }}
                onClick={() => {
                  useAppStore.getState().setActiveDatasetId(dataset.id);
                  setScreen('search');
                }}
              >
                <DatabaseIcon size={20} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 } as any} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dataset.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {formatNumber(dataset.record_count)} records · {formatDate(dataset.imported_at)}
                  </div>
                </div>
                <span className="badge badge-accent">Search →</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {datasets.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ marginBottom: '16px', opacity: 0.4 }}>
            <DatabaseIcon size={48} />
          </div>
          <h3 style={{ marginBottom: '8px' }}>No datasets yet</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            Import a spreadsheet to get started. Your data is encrypted and stays on your computer.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => setScreen('import')}>
            <UploadIcon size={16} />
            Import Your First Spreadsheet
          </button>
        </div>
      )}

      {/* Privacy notice */}
      <div style={{
        marginTop: '32px',
        padding: '12px 16px',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
      }}>
        <ShieldIcon size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-success)' } as any} />
        <span>
          <strong style={{ color: 'var(--color-text-primary)' }}>100% Private.</strong>{' '}
          Your data never leaves your computer. No internet connection, no accounts, no cloud storage.
        </span>
      </div>
    </div>
  );
}
