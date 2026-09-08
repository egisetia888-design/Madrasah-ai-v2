import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Book, Author, Category, ReadingLog, SyncMetadata } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { syncSaveBook, syncDeleteBook, syncSaveReadingLog, syncDeleteReadingLog } from '../lib/firestoreSync';
import { createIndexedDbStorage } from './indexedDbStorage';

interface LibraryState {
  books: Book[];
  authors: Author[];
  categories: Category[];
  readingLogs: ReadingLog[];
  
  // Actions
  addBook: (book: Omit<Book, 'id' | 'createdAt' | keyof SyncMetadata>) => string;
  updateBook: (id: string, book: Partial<Book>) => void;
  deleteBook: (id: string) => void;
  
  addAuthor: (name: string) => string; // returns new ID
  addCategory: (name: string) => string;

  addReadingLog: (log: Omit<ReadingLog, 'id' | 'createdAt' | keyof SyncMetadata>) => string;
  deleteReadingLog: (id: string) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      authors: [],
      categories: [],
      readingLogs: [],
      
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
          books: state.books.filter(b => b.id !== id),
          // Also clean up reading logs for deleted book
          readingLogs: (state.readingLogs || []).filter(l => l.bookId !== id)
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
      },

      addReadingLog: (logData) => {
        const id = crypto.randomUUID();
        const newLog: ReadingLog = {
          ...logData,
          id,
          createdAt: Date.now(),
          ...createSyncMetadata(),
        };
        set((state) => ({
          readingLogs: [newLog, ...(state.readingLogs || [])]
        }));
        syncSaveReadingLog(newLog);
        return id;
      },

      deleteReadingLog: (id) => {
        set((state) => ({
          readingLogs: (state.readingLogs || []).filter(l => l.id !== id)
        }));
        syncDeleteReadingLog(id);
      },
    }),
    {
      name: 'madrasah-library-storage-v2',
      storage: createJSONStorage(() => createIndexedDbStorage('library_store')),
    }
  )
);
