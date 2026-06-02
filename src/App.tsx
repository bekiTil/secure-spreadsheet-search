import { useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { getSettings, listDatasets, onOpenBundle } from '@/utils/tauri';
import Sidebar from '@/components/Sidebar';
import ToastContainer from '@/components/ui/ToastContainer';
import HomeScreen from '@/components/screens/HomeScreen';
import ImportScreen from '@/components/screens/ImportScreen';
import SearchScreen from '@/components/screens/SearchScreen';
import ManageScreen from '@/components/screens/ManageScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import OpenBundleScreen from '@/components/screens/OpenBundleScreen';

export default function App() {
  const {
    currentScreen,
    settings,
    setSettings,
    setDatasets,
    setPendingBundlePath,
    setScreen,
    addToast,
  } = useAppStore();

  // Load settings and datasets on startup
  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {/* use defaults */});

    listDatasets()
      .then(setDatasets)
      .catch(() => addToast({ type: 'error', message: 'Failed to load datasets' }));

    // Listen for file association (double-click .companybundle)
    const unlisten = onOpenBundle((path) => {
      setPendingBundlePath(path);
      setScreen('open-bundle');
    });

    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Apply theme
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const theme = settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme;
    root.dataset.theme = theme;
    root.dataset.fontSize = settings.font_size;
  }, [settings]);

  const screens: Record<string, JSX.Element> = {
    home: <HomeScreen />,
    import: <ImportScreen />,
    search: <SearchScreen />,
    manage: <ManageScreen />,
    settings: <SettingsScreen />,
    'open-bundle': <OpenBundleScreen />,
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {screens[currentScreen] ?? <HomeScreen />}
      </main>
      <ToastContainer />
    </div>
  );
}
