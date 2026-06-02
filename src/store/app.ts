/**
 * Global application state using Zustand.
 */
import { create } from 'zustand';
import type { Dataset, Screen, Toast, AppSettings } from '@/types';

interface AppStore {
  // Navigation
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;

  // Datasets
  datasets: Dataset[];
  setDatasets: (datasets: Dataset[]) => void;
  activeDatasetId: string | null;
  setActiveDatasetId: (id: string | null) => void;

  // Bundle opening
  pendingBundlePath: string | null;
  setPendingBundlePath: (path: string | null) => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Settings
  settings: AppSettings | null;
  setSettings: (settings: AppSettings) => void;

  // Loading
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

let toastCounter = 0;

export const useAppStore = create<AppStore>((set) => ({
  currentScreen: 'home',
  setScreen: (screen) => set({ currentScreen: screen }),

  datasets: [],
  setDatasets: (datasets) => set({ datasets }),
  activeDatasetId: null,
  setActiveDatasetId: (id) => set({ activeDatasetId: id }),

  pendingBundlePath: null,
  setPendingBundlePath: (path) => set({ pendingBundlePath: path }),

  toasts: [],
  addToast: (toast) => {
    const id = String(++toastCounter);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  settings: null,
  setSettings: (settings) => set({ settings }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
}));
