import { SyncMetadata } from '../types';

export const createSyncMetadata = (): SyncMetadata => ({
  revision: 1,
  updatedAt: Date.now(),
  syncStatus: 'local_only',
});

export const updateSyncMetadata = (existing: Partial<SyncMetadata> | undefined): SyncMetadata => ({
  revision: (existing?.revision || 0) + 1,
  updatedAt: Date.now(),
  syncStatus: 'local_only',
});
