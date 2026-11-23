import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Concept, SourceFragment, Relation } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { SyncMetadata } from '../types';
import { createIndexedDbStorage } from './indexedDbStorage';

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
        return newId;
      },
      updateConcept: (id, data) => set((state) => ({
        concepts: state.concepts.map((c) =>
          c.id === id ? { ...c, ...data, ...updateSyncMetadata(c) } : c
        )
      })),
      deleteConcept: (id) => {
        set((state) => ({
          concepts: state.concepts.filter((c) => c.id !== id),
          relations: state.relations.filter((r) => r.sourceNodeId !== id && r.targetNodeId !== id)
        }));
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
        return newId;
      },
      updateSourceFragment: (id, data) => set((state) => ({
        sourceFragments: state.sourceFragments.map((f) =>
          f.id === id ? { ...f, ...data, ...updateSyncMetadata(f) } : f
        )
      })),
      deleteSourceFragment: (id) => {
        set((state) => ({
          sourceFragments: state.sourceFragments.filter((f) => f.id !== id),
          relations: state.relations.filter((r) => r.sourceNodeId !== id && r.targetNodeId !== id)
        }));
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
        return newId;
      },
      updateRelation: (id, data) => set((state) => ({
        relations: state.relations.map((r) =>
          r.id === id ? { ...r, ...data, ...updateSyncMetadata(r) } : r
        )
      })),
      deleteRelation: (id) => {
        set((state) => ({
          relations: state.relations.filter((r) => r.id !== id)
        }));
      },
    }),
    {
      name: 'madrasah-knowledge-storage',
      storage: createJSONStorage(() => createIndexedDbStorage('knowledge_store')),
    }
  )
);