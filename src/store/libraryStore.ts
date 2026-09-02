import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { Book, Author, Category } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { SyncMetadata } from '../types';
import { syncSaveBook, syncDeleteBook } from '../lib/firestoreSync';

localforage.config({
  name: 'madrasah_db',
  storeName: 'library_store'
});

const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await localforage.getItem(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await localforage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await localforage.removeItem(name);
  },
};

interface LibraryState {
  books: Book[];
  authors: Author[];
  categories: Category[];
  
  // Actions
  addBook: (book: Omit<Book, 'id' | 'createdAt' | keyof SyncMetadata>) => string;
  updateBook: (id: string, book: Partial<Book>) => void;
  deleteBook: (id: string) => void;
  
  addAuthor: (name: string) => string; // returns new ID
  addCategory: (name: string) => string;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      authors: [],
      categories: [],
      
      addBook: (bookData) => {
        const id = crypto.randomUUID();
        const newBook: Book = {
          ...bookData,
          id,
          createdAt: Date.now(),
          ...createSyncMetadata(),
          
        };
        set((state) => ({
          books: [newBook, ...state.books]
        }));
        syncSaveBook(newBook);
        return id;
      },
      
      updateBook: (id, bookData) => {
        set((state) => {
          const updatedBooks = state.books.map(b => {
            if (b.id === id) {
              const updated = { ...b, ...bookData, ...updateSyncMetadata(b) };
              syncSaveBook(updated);
              return updated;
            }
            return b;
          });
          return { books: updatedBooks };
        });
      },
      
      deleteBook: (id) => {
        set((state) => ({
          books: state.books.filter(b => b.id !== id)
        }));
        syncDeleteBook(id);
      },

      addAuthor: (name) => {
        const id = crypto.randomUUID();
        set((state) => ({
          authors: [...state.authors, { id, name, createdAt: Date.now(), ...createSyncMetadata() }]
        }));
        return id;
      },

      addCategory: (name) => {
        const id = crypto.randomUUID();
        set((state) => ({
          categories: [...state.categories, { id, name, createdAt: Date.now(), ...createSyncMetadata() }]
        }));
        return id;
      }
    }),
    {
      name: 'madrasah-library-storage-v2',
      storage: createJSONStorage(() => storage),
    }
  )
);

