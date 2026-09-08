import { create } from 'zustand';

export type GlobalSyncStatus = 'synced' | 'syncing' | 'offline' | 'local_only' | 'error';

interface SyncState {
  status: GlobalSyncStatus;
  lastSyncedAt: number | null;
  errorMessage: string | null;
  setStatus: (status: GlobalSyncStatus, errorMessage?: string | null) => void;
  setLastSyncedAt: (timestamp: number) => void;
}

export const useSyncStateStore = create<SyncState>((set) => ({
  status: 'local_only',
  lastSyncedAt: null,
  errorMessage: null,
  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt, status: 'synced', errorMessage: null }),
}));
