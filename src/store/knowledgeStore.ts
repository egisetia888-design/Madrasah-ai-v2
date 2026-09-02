import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { Concept, SourceFragment, Relation } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { syncSaveConcept, syncDeleteConcept, syncSaveSourceFragment, syncDeleteSourceFragment, syncSaveRelation, syncDeleteRelation } from '../lib/firestoreSync';
import { SyncMetadata } from '../types';

localforage.config({
  name: 'madrasah_db',
  storeName: 'knowledge_store'
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

interface KnowledgeState {
  concepts: Concept[];
  sourceFragments: SourceFragment[];
  relations: Relation[];

  // Concept Actions
  addConcept: (concept: Omit<Concept, 'id' | 'createdAt' | keyof SyncMetadata>) => string;
  updateConcept: (id: string, data: Partial<Concept>) => void;
  deleteConcept: (id: string) => void;

  // SourceFragment Actions
  addSourceFragment: (fragment: Omit<SourceFragment, 'id' | 'createdAt' | keyof SyncMetadata>) => string;
  updateSourceFragment: (id: string, data: Partial<SourceFragment>) => void;
  deleteSourceFragment: (id: string) => void;

  // Relation Actions
  addRelation: (relation: Omit<Relation, 'id' | 'createdAt' | keyof SyncMetadata>) => string;
  updateRelation: (id: string, data: Partial<Relation>) => void;
  deleteRelation: (id: string) => void;
}

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set, get) => ({
      concepts: [],
      sourceFragments: [],
      relations: [],

      // Concept Actions
      addConcept: (conceptData) => {
        const newId = crypto.randomUUID();
        set((state) => ({
          concepts: [
            ...state.concepts,
            {
              ...conceptData,
              id: newId,
              createdAt: Date.now(),
              ...createSyncMetadata(),
            }
          ]
        }));

        const state = get();
        const concept = state.concepts.find(c => c.id === newId);
        if (concept) syncSaveConcept(concept);
        return newId;
      },
      updateConcept: (id, data) => set((state) => {
        const updatedConcepts = state.concepts.map((c) => {
          if (c.id === id) {
            const updated = { ...c, ...data, ...updateSyncMetadata(c) };
            syncSaveConcept(updated);
            return updated;
          }
          return c;
        });
        return { concepts: updatedConcepts };
      }),
      deleteConcept: (id) => {
        set((state) => ({
          concepts: state.concepts.filter((c) => c.id !== id),
          relations: state.relations.filter((r) => r.sourceNodeId !== id && r.targetNodeId !== id)
        }));
        syncDeleteConcept(id);
      },

      // SourceFragment Actions
      addSourceFragment: (fragmentData) => {
        const newId = crypto.randomUUID();
        set((state) => ({
          sourceFragments: [
            ...state.sourceFragments,
            {
              ...fragmentData,
              id: newId,
              createdAt: Date.now(),
              ...createSyncMetadata(),
            }
          ]
        }));

        const state = get();
        const fragment = state.sourceFragments.find(f => f.id === newId);
        if (fragment) syncSaveSourceFragment(fragment);
        return newId;
      },
      updateSourceFragment: (id, data) => set((state) => {
        const updatedFragments = state.sourceFragments.map((f) => {
          if (f.id === id) {
            const updated = { ...f, ...data, ...updateSyncMetadata(f) };
            syncSaveSourceFragment(updated);
            return updated;
          }
          return f;
        });
        return { sourceFragments: updatedFragments };
      }),
      deleteSourceFragment: (id) => {
        set((state) => ({
          sourceFragments: state.sourceFragments.filter((f) => f.id !== id),
          relations: state.relations.filter((r) => r.sourceNodeId !== id && r.targetNodeId !== id)
        }));
        syncDeleteSourceFragment(id);
      },

      // Relation Actions
      addRelation: (relationData) => {
        const newId = crypto.randomUUID();
        set((state) => ({
          relations: [
            ...state.relations,
            {
              ...relationData,
              id: newId,
              createdAt: Date.now(),
              ...createSyncMetadata(),
            }
          ]
        }));

        const state = get();
        const relation = state.relations.find(r => r.id === newId);
        if (relation) syncSaveRelation(relation);
        return newId;
      },
      updateRelation: (id, data) => set((state) => {
        const updatedRelations = state.relations.map((r) => {
          if (r.id === id) {
            const updated = { ...r, ...data, ...updateSyncMetadata(r) };
            syncSaveRelation(updated);
            return updated;
          }
          return r;
        });
        return { relations: updatedRelations };
      }),
      deleteRelation: (id) => {
        set((state) => ({
          relations: state.relations.filter((r) => r.id !== id)
        }));
        syncDeleteRelation(id);
      },
    }),
    {
      name: 'madrasah-knowledge-storage',
      storage: createJSONStorage(() => storage),
    }
  )
);