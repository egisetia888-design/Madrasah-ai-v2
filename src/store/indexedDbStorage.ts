import localforage from 'localforage';
import { StateStorage } from 'zustand/middleware';
import { useSyncStateStore } from './syncStateStore';

export const ALL_DOMAIN_STORES = [
  'notes_store',
  'writing_store',
  'projects_store',
  'library_store',
  'knowledge_store',
  'curriculum_store',
  'review_store',
  'graph_store',
] as const;

export type DomainStoreName = (typeof ALL_DOMAIN_STORES)[number];

const LEGACY_KEY_TO_STORE: Record<string, DomainStoreName> = {
  'madrasah-notes-storage-v2': 'notes_store',
  'madrasah-writing-storage-v2': 'writing_store',
  'madrasah-projects-storage-v2': 'projects_store',
  'madrasah-library-storage-v2': 'library_store',
  'madrasah-knowledge-storage': 'knowledge_store',
  'madrasah-curriculum-storage-v2': 'curriculum_store',
  'madrasah-review-storage-v2': 'review_store',
  'madrasah-graph-storage-v2': 'graph_store',
};

const LOCAL_PREFERENCE_KEYS = [
  'madrasah_workspace_name',
  'madrasah_publishing_settings',
  'madrasah-tour-storage-v3',
  'madrasah_ai_relation_backfill_v1',
] as const;

const storeRegistry = new Map<string, LocalForage>();

function getStoreInstance(storeName: string): LocalForage {
  const existing = storeRegistry.get(storeName);
  if (existing) return existing;

  const instance = localforage.createInstance({
    name: 'madrasah_db',
    storeName,
    driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
    description: `Madrasah Personal Knowledge OS - ${storeName}`,
  });

  storeRegistry.set(storeName, instance);
  return instance;
}

// Daftarkan seluruh store domain sejak awal agar diagnostik & backup selalu lengkap
ALL_DOMAIN_STORES.forEach((storeName) => {
  getStoreInstance(storeName);
});

/**
 * Creates an isolated IndexedDB storage engine for a Zustand store using localforage.
 * Features:
 * - Dedicated object store per state domain (prevents store collision).
 * - Registered in central storage registry for unified backup/restore & diagnostics.
 * - Automatic migration from legacy localStorage if data is found there and missing in IndexedDB.
 * - Graceful fallback to localStorage in environments where IndexedDB is blocked or unavailable.
 */
export function createIndexedDbStorage(storeName: string): StateStorage {
  const instance = getStoreInstance(storeName);

  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const item = await instance.getItem<unknown>(name);
        if (item !== null && item !== undefined) {
          return typeof item === 'string' ? item : JSON.stringify(item);
        }

        // Auto-migration check: if item not found in IndexedDB, look in localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          const legacyItem = window.localStorage.getItem(name);
          if (legacyItem) {
            await instance.setItem(name, legacyItem);
            return legacyItem;
          }
        }
        return null;
      } catch (err) {
        console.warn(`[IndexedDB] Error reading key "${name}" from store "${storeName}":`, err);
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(name);
        }
        return null;
      }
    },

    setItem: async (name: string, value: string): Promise<void> => {
      try {
        await instance.setItem(name, value);
        useSyncStateStore.getState().recordLocalWrite(storeName);
      } catch (err) {
        console.warn(`[IndexedDB] Error writing key "${name}" to store "${storeName}":`, err);
        useSyncStateStore.getState().setError('Gagal menulis ke IndexedDB, beralih ke cadangan peramban.');
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(name, value);
          } catch (localErr) {
            console.error(`[localStorage fallback failed]`, localErr);
          }
        }
      }
    },

    removeItem: async (name: string): Promise<void> => {
      try {
        await instance.removeItem(name);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(name);
        }
        useSyncStateStore.getState().recordLocalWrite(storeName);
      } catch (err) {
        console.warn(`[IndexedDB] Error removing key "${name}" from store "${storeName}":`, err);
      }
    },
  };
}

export interface BackupSummary {
  version: number;
  timestamp: string;
  storeCount: number;
  totalEntities: number;
  breakdown: {
    notes: number;
    books: number;
    drafts: number;
    concepts: number;
    projects: number;
    paths: number;
    flashcards: number;
    relations: number;
  };
}

export interface UnifiedBackupPayload {
  _madrasah_backup: true;
  format: 'madrasah-local-v2';
  version: 2;
  timestamp: string;
  summary: BackupSummary['breakdown'];
  stores: Record<string, Record<string, unknown>>;
  preferences: Record<string, string>;
}

export interface LocalStorageDiagnostics {
  driver: string;
  estimatedBytes: number;
  quotaBytes: number | null;
  usageBytes: number | null;
  isPersisted: boolean | null;
  totalEntities: number;
  breakdown: BackupSummary['breakdown'];
}

function parseStoreValue(raw: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (obj.state && typeof obj.state === 'object') {
        return obj.state as Record<string, unknown>;
      }
      return obj;
    }
  } catch {
    // Abaikan payload non-JSON
  }
  return null;
}

function arrayLen(obj: Record<string, unknown> | null, key: string): number {
  if (!obj) return 0;
  const val = obj[key];
  return Array.isArray(val) ? val.length : 0;
}

function computeEntityBreakdown(storesMap: Record<string, Record<string, unknown>>): {
  breakdown: BackupSummary['breakdown'];
  totalEntities: number;
} {
  const breakdown: BackupSummary['breakdown'] = {
    notes: 0,
    books: 0,
    drafts: 0,
    concepts: 0,
    projects: 0,
    paths: 0,
    flashcards: 0,
    relations: 0,
  };

  for (const entries of Object.values(storesMap)) {
    for (const rawVal of Object.values(entries)) {
      const state = parseStoreValue(rawVal);
      if (!state) continue;
      breakdown.notes += arrayLen(state, 'notes');
      breakdown.books += arrayLen(state, 'books');
      breakdown.drafts += arrayLen(state, 'drafts');
      breakdown.concepts += arrayLen(state, 'concepts');
      breakdown.projects += arrayLen(state, 'projects');
      breakdown.paths += arrayLen(state, 'paths');
      breakdown.flashcards += arrayLen(state, 'flashcards');
      breakdown.relations += arrayLen(state, 'relations');
    }
  }

  const totalEntities = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  return { breakdown, totalEntities };
}

async function readAllDomainStores(): Promise<{
  stores: Record<string, Record<string, unknown>>;
  estimatedBytes: number;
  activeDriver: string;
}> {
  const stores: Record<string, Record<string, unknown>> = {};
  let estimatedBytes = 0;
  let activeDriver = 'IndexedDB';

  for (const storeName of ALL_DOMAIN_STORES) {
    const instance = getStoreInstance(storeName);
    const keys = await instance.keys();
    const storeData: Record<string, unknown> = {};

    const driver = instance.driver();
    if (driver === localforage.LOCALSTORAGE) activeDriver = 'LocalStorage Fallback';
    else if (driver === localforage.WEBSQL) activeDriver = 'WebSQL';

    for (const key of keys) {
      const val = await instance.getItem<unknown>(key);
      if (val === null || val === undefined) continue;
      if (typeof val === 'string') {
        estimatedBytes += val.length * 2;
        try {
          storeData[key] = JSON.parse(val);
        } catch {
          storeData[key] = val;
        }
      } else {
        const serialized = JSON.stringify(val);
        estimatedBytes += serialized.length * 2;
        storeData[key] = val;
      }
    }

    if (Object.keys(storeData).length > 0) {
      stores[storeName] = storeData;
    }
  }

  return { stores, estimatedBytes, activeDriver };
}

export async function getLocalStorageDiagnostics(): Promise<LocalStorageDiagnostics> {
  const { stores, estimatedBytes, activeDriver } = await readAllDomainStores();
  const { breakdown, totalEntities } = computeEntityBreakdown(stores);

  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;
  let isPersisted: boolean | null = null;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.estimate === 'function') {
        const estimate = await navigator.storage.estimate();
        quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null;
        usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null;
      }
      if (typeof navigator.storage.persisted === 'function') {
        isPersisted = await navigator.storage.persisted();
      }
    } catch {
      // Abaikan jika browser membatasi StorageManager API
    }
  }

  return {
    driver: activeDriver,
    estimatedBytes,
    quotaBytes,
    usageBytes,
    isPersisted,
    totalEntities,
    breakdown,
  };
}

export async function requestPersistentStorage(): Promise<{ supported: boolean; persisted: boolean }> {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.persist !== 'function') {
    return { supported: false, persisted: false };
  }
  try {
    const persisted = await navigator.storage.persist();
    return { supported: true, persisted };
  } catch {
    return { supported: true, persisted: false };
  }
}

export async function exportUnifiedBackup(): Promise<UnifiedBackupPayload> {
  const { stores } = await readAllDomainStores();
  const { breakdown } = computeEntityBreakdown(stores);
  const preferences: Record<string, string> = {};

  if (typeof window !== 'undefined' && window.localStorage) {
    for (const prefKey of LOCAL_PREFERENCE_KEYS) {
      const val = window.localStorage.getItem(prefKey);
      if (val !== null) {
        preferences[prefKey] = val;
      }
    }
  }

  return {
    _madrasah_backup: true,
    format: 'madrasah-local-v2',
    version: 2,
    timestamp: new Date().toISOString(),
    summary: breakdown,
    stores,
    preferences,
  };
}

function normalizeIncomingBackup(rawJson: string): {
  stores: Record<string, Record<string, unknown>>;
  preferences: Record<string, string>;
  summary: BackupSummary;
} {
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Format berkas JSON tidak dikenali.');
  }

  // Format v2 terpadu
  if (parsed._madrasah_backup && parsed.version === 2) {
    if (!parsed.stores || typeof parsed.stores !== 'object' || Array.isArray(parsed.stores)) {
      throw new Error('Struktur stores pada backup versi 2 tidak valid.');
    }
    const stores = parsed.stores as Record<string, Record<string, unknown>>;
    const preferences = (parsed.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : {}) as Record<string, string>;
    const { breakdown, totalEntities } = computeEntityBreakdown(stores);
    const storeCount = Object.keys(stores).length;
    if (storeCount === 0 && Object.keys(preferences).length === 0) {
      throw new Error('Berkas backup kosong.');
    }
    return {
      stores,
      preferences,
      summary: {
        version: 2,
        timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
        storeCount,
        totalEntities,
        breakdown,
      },
    };
  }

  if (parsed._madrasah_backup && typeof parsed.version === 'number' && parsed.version > 2) {
    throw new Error('Versi backup lebih baru daripada versi aplikasi saat ini.');
  }

  // Fallback format v1 atau dump datar kunci Zustand
  const flatData: Record<string, unknown> =
    parsed._madrasah_backup && parsed.data && typeof parsed.data === 'object'
      ? (parsed.data as Record<string, unknown>)
      : (parsed as Record<string, unknown>);

  const stores: Record<string, Record<string, unknown>> = {};
  const preferences: Record<string, string> = {};

  for (const [key, value] of Object.entries(flatData)) {
    if ((LOCAL_PREFERENCE_KEYS as readonly string[]).includes(key) && typeof value === 'string') {
      preferences[key] = value;
      continue;
    }
    const mappedStore = LEGACY_KEY_TO_STORE[key];
    if (mappedStore) {
      if (!stores[mappedStore]) stores[mappedStore] = {};
      stores[mappedStore][key] = value;
    } else if (ALL_DOMAIN_STORES.includes(key as DomainStoreName) && value && typeof value === 'object') {
      stores[key] = value as Record<string, unknown>;
    }
  }

  const storeCount = Object.keys(stores).length;
  if (storeCount === 0 && Object.keys(preferences).length === 0) {
    throw new Error('Berkas backup tidak memuat data Madrasah yang valid.');
  }

  const { breakdown, totalEntities } = computeEntityBreakdown(stores);
  return {
    stores,
    preferences,
    summary: {
      version: 1,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
      storeCount,
      totalEntities,
      breakdown,
    },
  };
}

export function validateAndPreviewBackup(rawJson: string): BackupSummary {
  return normalizeIncomingBackup(rawJson).summary;
}

export async function importUnifiedBackup(rawJson: string): Promise<BackupSummary> {
  const { stores, preferences, summary } = normalizeIncomingBackup(rawJson);

  for (const [storeName, entries] of Object.entries(stores)) {
    const instance = getStoreInstance(storeName);
    await instance.clear();
    for (const [key, value] of Object.entries(entries)) {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await instance.setItem(key, serialized);
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    for (const [prefKey, prefVal] of Object.entries(preferences)) {
      if (typeof prefVal === 'string') {
        window.localStorage.setItem(prefKey, prefVal);
      }
    }
    window.localStorage.setItem('madrasah_auth', 'true');
  }

  useSyncStateStore.getState().recordLocalWrite('backup_restore');
  return summary;
}

export async function clearAllLocalStorageData(): Promise<void> {
  for (const storeName of ALL_DOMAIN_STORES) {
    const instance = getStoreInstance(storeName);
    await instance.clear();
  }
  await localforage.clear();

  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('madrasah')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  }
  useSyncStateStore.getState().resetStatus();
}
