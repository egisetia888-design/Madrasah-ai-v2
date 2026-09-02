import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { Draft } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { SyncMetadata } from '../types';
import { generateEmbedding } from '../lib/semanticSearch';
import { syncSaveDraft, syncDeleteDraft } from '../lib/firestoreSync';

localforage.config({
  name: 'madrasah_db',
  storeName: 'writing_store'
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

interface WritingState {
  drafts: Draft[];
  
  addDraft: (draft: Omit<Draft, 'id' | 'createdAt' | 'status' | keyof SyncMetadata> & { status?: Draft['status'] }) => string;
  updateDraft: (id: string, draft: Partial<Draft>) => void;
  deleteDraft: (id: string) => void;
  indexDraft: (id: string) => Promise<void>;
}

export const useWritingStore = create<WritingState>()(
  persist(
    (set, get) => ({
      drafts: [],
      
      addDraft: (draftData) => {
        const id = crypto.randomUUID();
        const newDraft: Draft = {
          title: draftData.title,
          content: draftData.content,
          icon: draftData.icon,
          tags: draftData.tags,
          embedding: draftData.embedding,
          id,
          status: draftData.status || 'idea',
          createdAt: Date.now(),
          ...createSyncMetadata(),
        };
        set((state) => ({
          drafts: [newDraft, ...state.drafts]
        }));
        syncSaveDraft(newDraft);
        return id;
      },
      
      updateDraft: (id, draftData) => {
        set((state) => {
          const updatedDrafts = state.drafts.map(d => {
            if (d.id === id) {
              const updated = { ...d, ...draftData, ...updateSyncMetadata(d) };
              syncSaveDraft(updated);
              return updated;
            }
            return d;
          });
          return { drafts: updatedDrafts };
        });
      },
      
      deleteDraft: (id) => {
        set((state) => ({
          drafts: state.drafts.filter(d => d.id !== id)
        }));
        syncDeleteDraft(id);
      },

      indexDraft: async (id) => {
        const state = get();
        const draft = state.drafts.find(d => d.id === id);
        if (!draft) return;

        try {
          const textToEmbed = `${draft.title} ${draft.content}`;
          const embedding = await generateEmbedding(textToEmbed);
          
          set((state) => ({
            drafts: state.drafts.map(d => {
              if (d.id === id) {
                const updated = { ...d, embedding };
                syncSaveDraft(updated);
                return updated;
              }
              return d;
            })
          }));
        } catch (error) {
          console.error('Failed to index draft:', error);
        }
      },
    }),
    {
      name: 'madrasah-writing-storage-v2',
      storage: createJSONStorage(() => storage),
    }
  )
);

