import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LearningPath, Phase, Competency } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { SyncMetadata } from '../types';
import { createIndexedDbStorage } from './indexedDbStorage';

interface CurriculumState {
  paths: LearningPath[];
  phases: Phase[];
  competencies: Competency[];
  
  addPath: (path: Omit<LearningPath, 'id' | 'createdAt' | keyof SyncMetadata> & { id?: string }) => void;
  updatePath: (id: string, updates: Partial<LearningPath>) => void;
  deletePath: (id: string) => void;
  addPhase: (phase: Omit<Phase, 'id' | keyof SyncMetadata> & { id?: string }) => void;
  updatePhase: (id: string, updates: Partial<Phase>) => void;
  deletePhase: (id: string) => void;
  addCompetency: (comp: Omit<Competency, 'id' | keyof SyncMetadata>) => void;
  updateCompetency: (id: string, updates: Partial<Competency>) => void;
  deleteCompetency: (id: string) => void;
}

export const useCurriculumStore = create<CurriculumState>()(
  persist(
    (set, get) => ({
      paths: [],
      phases: [],
      competencies: [],
      
      addPath: (pathData) => {
        const newPath = {
          ...pathData,
          id: pathData.id || crypto.randomUUID(),
          createdAt: Date.now(),
          ...createSyncMetadata(),
        };
        set((state) => ({
          paths: [newPath, ...state.paths]
        }));
      },
      
      updatePath: (id, updates) => set((state) => ({
        paths: state.paths.map(p =>
          p.id === id ? { ...p, ...updates, ...updateSyncMetadata(p) } : p
        )
      })),

      deletePath: (id) => {
        set((state) => ({
          paths: state.paths.filter(p => p.id !== id),
          phases: state.phases.filter(ph => ph.pathId !== id)
        }));
      },

      addPhase: (phase) => {
        const newPhase = {
          ...phase,
          id: phase.id || crypto.randomUUID(),
          ...createSyncMetadata(),
        };
        set((state) => ({
          phases: [...state.phases, newPhase]
        }));
      },

      updatePhase: (id, updates) => set((state) => ({
        phases: state.phases.map(ph =>
          ph.id === id ? { ...ph, ...updates, ...updateSyncMetadata(ph) } : ph
        )
      })),

      deletePhase: (id) => {
        set((state) => ({
          phases: state.phases.filter(ph => ph.id !== id),
          competencies: state.competencies.filter(c => c.phaseId !== id)
        }));
      },

      addCompetency: (comp) => {
        const newComp = {
          ...comp,
          id: crypto.randomUUID(),
          ...createSyncMetadata(),
        };
        set((state) => ({
          competencies: [...state.competencies, newComp]
        }));
      },

      updateCompetency: (id, updates) => set((state) => ({
        competencies: state.competencies.map(c =>
          c.id === id ? { ...c, ...updates, ...updateSyncMetadata(c) } : c
        )
      })),

      deleteCompetency: (id) => {
        set((state) => ({
          competencies: state.competencies.filter(c => c.id !== id)
        }));
      },
    }),
    {
      name: 'madrasah-curriculum-storage-v2',
      storage: createJSONStorage(() => createIndexedDbStorage('curriculum_store')),
    }
  )
);
