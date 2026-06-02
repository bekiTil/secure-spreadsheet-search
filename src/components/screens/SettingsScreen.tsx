import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { getSettings, saveSettings } from '@/utils/tauri';
import type { AppSettings } from '@/types';
import { ShieldIcon, SunIcon, MoonIcon } from '@/components/ui/Icons';

export default function SettingsScreen() {
  const { settings: storedSettings, setSettings, addToast } = useAppStore();
  const [settings, setLocal] = useState<AppSettings | null>(storedSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) {
      getSettings().then(setLocal);
    }
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      setSettings(settings);
      addToast({ type: 'success', message: 'Settings saved' });
    } catch (e: any) {
      addToast({ type: 'error', message: String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <div className="screen"><div className="spinner" /></div>;
  }

  return (
    <div className="screen">
      <div style={{ maxWidth: '600px' }}>
        <h1 style={{ marginBottom: '24px' }}>Settings</h1>

        {/* Appearance */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginBottom: '16px' }}>Appearance</h3>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Theme</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  className={`btn ${settings.theme === t ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setLocal({ ...settings, theme: t })}
                >
                  {t === 'light' && <SunIcon size={14} />}
                  {t === 'dark' && <MoonIcon size={14} />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Text Size</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { value: 'normal', label: 'Normal' },
                { value: 'large', label: 'Large' },
                { value: 'larger', label: 'Larger' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  className={`btn ${settings.font_size === value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setLocal({ ...settings, font_size: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginBottom: '16px' }}>Search</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="search-limit">Results per page</label>
            <select
              id="search-limit"
              className="input"
              style={{ maxWidth: '200px' }}
              value={settings.default_search_limit}
              onChange={(e) => setLocal({ ...settings, default_search_limit: Number(e.target.value) })}
            >
              {[50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>{n} results</option>
              ))}
            </select>
          </div>
        </div>

        {/* Privacy */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ShieldIcon size={18} />
            <h3>Privacy</h3>
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            <div>✓ All data stays on your computer</div>
            <div>✓ No internet connection is ever made</div>
            <div>✓ No data is uploaded to any server</div>
            <div>✓ No accounts or login required</div>
            <div>✓ Shared bundles are encrypted automatically</div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
