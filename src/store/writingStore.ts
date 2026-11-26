import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Draft } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { SyncMetadata } from '../types';
import { generateEmbedding } from '../lib/semanticSearch';
import { createIndexedDbStorage } from './indexedDbStorage';

interface WritingState {
  drafts: Draft[];
  
  addDraft: (draft: Omit<Draft, 'id' | 'createdAt' | 'status' | keyof SyncMetadata> & { status?: Draft['status'] }) => string;
  updateDraft: (id: string, draft: Partial<Draft>) => void;
  deleteDraft: (id: string) => void;
  indexDraft: (id: string) => Promise<boolean>;
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
        return id;
      },
      
      updateDraft: (id, draftData) => {
        set((state) => ({
          drafts: state.drafts.map(d =>
            d.id === id ? { ...d, ...draftData, ...updateSyncMetadata(d) } : d
          )
        }));
      },
      
      deleteDraft: (id) => {
        set((state) => ({
          drafts: state.drafts.filter(d => d.id !== id)
        }));
      },

      indexDraft: async (id) => {
        const state = get();
        const draft = state.drafts.find(d => d.id === id);
        if (!draft) return false;

        const textToEmbed = `${draft.title} ${draft.content}`.trim();
        if (!textToEmbed) return false;

        try {
          const embedding = await generateEmbedding(textToEmbed);
          if (!Array.isArray(embedding) || embedding.length === 0) return false;

          set((state) => ({
            drafts: state.drafts.map(d =>
              d.id === id ? { ...d, embedding } : d
            )
          }));
          return true;
        } catch (error) {
          console.error('Failed to index draft:', error);
          return false;
        }
      },
    }),
    {
      name: 'madrasah-writing-storage-v2',
      storage: createJSONStorage(() => createIndexedDbStorage('writing_store')),
    }
  )
);

