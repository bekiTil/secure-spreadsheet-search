import { useAppStore } from '@/store/app';
import type { Screen } from '@/types';
import {
  HomeIcon,
  UploadIcon,
  SearchIcon,
  FolderIcon,
  SettingsIcon,
  ShieldIcon,
} from '@/components/ui/Icons';

interface NavItem {
  screen: Screen;
  label: string;
  icon: React.FC<{ size?: number }>;
}

const navItems: NavItem[] = [
  { screen: 'home', label: 'Home', icon: HomeIcon },
  { screen: 'import', label: 'Import', icon: UploadIcon },
  { screen: 'search', label: 'Search', icon: SearchIcon },
  { screen: 'manage', label: 'Datasets', icon: FolderIcon },
  { screen: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const { currentScreen, setScreen, datasets } = useAppStore();

  return (
    <nav className="sidebar" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <ShieldIcon size={24} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.2 }}>
            Secure Spreadsheet
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            Search
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: '8px' }}>
        {navItems.map(({ screen, label, icon: Icon }) => {
          const isActive = currentScreen === screen;
          return (
            <button
              key={screen}
              className={`btn btn-ghost${isActive ? ' active' : ''}`}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                padding: '8px 12px',
                marginBottom: '2px',
                background: isActive ? 'var(--color-accent-light)' : undefined,
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)',
                fontWeight: isActive ? 600 : 400,
                borderRadius: 'var(--radius-md)',
              }}
              onClick={() => setScreen(screen)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Dataset count */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--color-border)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Datasets</span>
          <span className="badge">{datasets.length}</span>
        </div>
        <div style={{ marginTop: '4px', fontSize: '11px' }}>
          🔒 All data stored locally
        </div>
      </div>
    </nav>
  );
}
