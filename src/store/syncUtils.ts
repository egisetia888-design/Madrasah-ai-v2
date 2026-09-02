import { SyncMetadata, SyncStatus } from '../types';

export const createSyncMetadata = (): SyncMetadata => ({
  revision: 1,
  updatedAt: Date.now(),
  syncStatus: 'pending_sync'
});

export const updateSyncMetadata = (existing: Partial<SyncMetadata> | undefined): SyncMetadata => ({
  revision: (existing?.revision || 0) + 1,
  updatedAt: Date.now(),
  syncStatus: 'pending_sync',
  conflict: undefined // Clear conflict on new local update
});
