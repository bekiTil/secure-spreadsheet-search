import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app';

describe('AppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentScreen: 'home',
      datasets: [],
      activeDatasetId: null,
      pendingBundlePath: null,
      toasts: [],
      settings: null,
      isLoading: false,
    });
  });

  it('starts on home screen', () => {
    expect(useAppStore.getState().currentScreen).toBe('home');
  });

  it('can navigate to import screen', () => {
    useAppStore.getState().setScreen('import');
    expect(useAppStore.getState().currentScreen).toBe('import');
  });

  it('can set active dataset', () => {
    useAppStore.getState().setActiveDatasetId('dataset-123');
    expect(useAppStore.getState().activeDatasetId).toBe('dataset-123');
  });

  it('can add and auto-remove toasts', async () => {
    vi.useFakeTimers();
    useAppStore.getState().addToast({ type: 'success', message: 'Test' });
    expect(useAppStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(6000);
    expect(useAppStore.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });

  it('can remove a toast by id', () => {
    useAppStore.getState().addToast({ type: 'info', message: 'Hello' });
    const id = useAppStore.getState().toasts[0].id;
    useAppStore.getState().removeToast(id);
    expect(useAppStore.getState().toasts).toHaveLength(0);
  });

  it('stores multiple datasets', () => {
    const datasets = [
      { id: '1', name: 'DS1', source_filename: 'a.csv', record_count: 100, column_names: ['A'], searchable_columns: ['A'], imported_at: '', size_bytes: 0 },
      { id: '2', name: 'DS2', source_filename: 'b.csv', record_count: 200, column_names: ['B'], searchable_columns: ['B'], imported_at: '', size_bytes: 0 },
    ];
    useAppStore.getState().setDatasets(datasets);
    expect(useAppStore.getState().datasets).toHaveLength(2);
  });
});
