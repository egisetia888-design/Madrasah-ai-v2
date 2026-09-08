import localforage from 'localforage';
import { StateStorage } from 'zustand/middleware';

/**
 * Creates an isolated IndexedDB storage engine for a Zustand store using localforage.
 * Features:
 * - Dedicated object store per state domain (prevents store collision).
 * - Automatic migration from legacy localStorage if data is found there and missing in IndexedDB.
 * - Graceful fallback to localStorage in environments where IndexedDB is blocked or unavailable.
 */
export function createIndexedDbStorage(storeName: string): StateStorage {
  const instance = localforage.createInstance({
    name: 'madrasah_db',
    storeName: storeName,
    driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
    description: `Madrasah Personal Knowledge OS - ${storeName}`,
  });

  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const item = await instance.getItem<string>(name);
        if (item !== null && item !== undefined) {
          return item;
        }

        // Auto-migration check: if item not found in IndexedDB, look in localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          const legacyItem = window.localStorage.getItem(name);
          if (legacyItem) {
            // Save into IndexedDB for subsequent reads
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
      } catch (err) {
        console.warn(`[IndexedDB] Error writing key "${name}" to store "${storeName}":`, err);
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
      } catch (err) {
        console.warn(`[IndexedDB] Error removing key "${name}" from store "${storeName}":`, err);
      }
    },
  };
}
