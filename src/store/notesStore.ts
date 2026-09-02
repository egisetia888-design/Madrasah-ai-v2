import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { Note, Folder, Tag } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { SyncMetadata } from '../types';
import { generateEmbedding } from '../lib/semanticSearch';
import { syncSaveNote, syncDeleteNote } from '../lib/firestoreSync';

localforage.config({
  name: 'madrasah_db',
  storeName: 'notes_store'
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

interface NotesState {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  
  addNote: (note: Omit<Note, 'id' | 'createdAt' | keyof SyncMetadata>) => string;
  updateNote: (id: string, note: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  addFolder: (name: string, parentId?: string | null) => string;
  updateFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;

  addTag: (name: string) => string;
  deleteTag: (id: string) => void;
  indexNote: (id: string) => Promise<void>;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      folders: [],
      tags: [],
      
      addNote: (noteData) => {
        const id = crypto.randomUUID();
        const newNote: Note = {
          type: 'knowledge',
          status: 'unprocessed',
          ...noteData,
          id,
          createdAt: Date.now(),
          ...createSyncMetadata(),
          
        };
        set((state) => ({
          notes: [newNote, ...state.notes]
        }));
        syncSaveNote(newNote);
        return id;
      },
      
      updateNote: (id, noteData) => {
        set((state) => {
          const updatedNotes = state.notes.map(n => {
            if (n.id === id) {
              const updated = { ...n, ...noteData, ...updateSyncMetadata(n) };
              syncSaveNote(updated);
              return updated;
            }
            return n;
          });
          return { notes: updatedNotes };
        });
      },
      
      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter(n => n.id !== id)
        }));
        syncDeleteNote(id);
      },

      addFolder: (name, parentId = null) => {
        const id = crypto.randomUUID();
        set((state) => ({
          folders: [
            ...state.folders,
            { id, name, parentId, createdAt: Date.now(), ...createSyncMetadata() }
          ]
        }));
        return id;
      },

      updateFolder: (id, name) => set((state) => ({
        folders: state.folders.map(f => f.id === id ? { ...f, name } : f)
      })),

      deleteFolder: (id) => set((state) => ({
        folders: state.folders.filter(f => f.id !== id),
        notes: state.notes.map(n => n.folderId === id ? { ...n, folderId: null } : n)
      })),

      addTag: (name) => {
        const state = get();
        const existing = state.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing.id;
        
        const id = crypto.randomUUID();
        set((state) => ({
          tags: [...state.tags, { id, name, ...createSyncMetadata() }]
        }));
        return id;
      },

      deleteTag: (id) => set((state) => ({
        tags: state.tags.filter(t => t.id !== id),
        notes: state.notes.map(n => ({
          ...n,
          tags: n.tags.filter(tagId => tagId !== id)
        }))
      })),

      indexNote: async (id) => {
        const state = get();
        const note = state.notes.find(n => n.id === id);
        if (!note) return;

        try {
          const textToEmbed = `${note.title} ${note.content}`;
          const embedding = await generateEmbedding(textToEmbed);
          
          set((state) => ({
            notes: state.notes.map(n => {
              if (n.id === id) {
                const updated = { ...n, embedding };
                syncSaveNote(updated);
                return updated;
              }
              return n;
            })
          }));
        } catch (error) {
          console.error('Failed to index note:', error);
        }
      },

    }),
    {
      name: 'madrasah-notes-storage-v2',
      storage: createJSONStorage(() => storage),
    }
  )
);

