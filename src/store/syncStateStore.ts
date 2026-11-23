import { create } from 'zustand';

export type LocalStorageStatus = 'ready' | 'saving' | 'saved' | 'error';

interface LocalStorageState {
  status: LocalStorageStatus;
  lastSavedAt: number | null;
  lastStoreName: string | null;
  errorMessage: string | null;
  setSaving: (storeName?: string) => void;
  recordLocalWrite: (storeName: string) => void;
  setError: (errorMessage: string) => void;
  resetStatus: () => void;
}

const LAST_SAVED_KEY = 'madrasah_last_saved_at';

function readInitialTimestamp(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_SAVED_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export const useSyncStateStore = create<LocalStorageState>((set) => ({
  status: readInitialTimestamp() ? 'saved' : 'ready',
  lastSavedAt: readInitialTimestamp(),
  lastStoreName: null,
  errorMessage: null,
  setSaving: (storeName) =>
    set((state) => ({
      status: 'saving',
      lastStoreName: storeName ?? state.lastStoreName,
      errorMessage: null,
    })),
  recordLocalWrite: (storeName) => {
    const now = Date.now();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LAST_SAVED_KEY, String(now));
      } catch {
        // Abaikan jika storage terbatas
      }
    }
    set({
      status: 'saved',
      lastSavedAt: now,
      lastStoreName: storeName,
      errorMessage: null,
    });
  },
  setError: (errorMessage) => set({ status: 'error', errorMessage }),
  resetStatus: () => set({ status: 'ready', lastSavedAt: null, lastStoreName: null, errorMessage: null }),
}));
