import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LearningPath, Phase, Competency } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { syncSaveLearningPath, syncDeleteLearningPath, syncSavePhase, syncDeletePhase, syncSaveCompetency, syncDeleteCompetency } from '../lib/firestoreSync';
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
        syncSaveLearningPath(newPath);
      },
      
      updatePath: (id, updates) => set((state) => {
        const updatedPaths = state.paths.map(p => {
          if (p.id === id) {
            const updated = { ...p, ...updates, ...updateSyncMetadata(p) };
            syncSaveLearningPath(updated);
            return updated;
          }
          return p;
        });
        return { paths: updatedPaths };
      }),

      deletePath: (id) => {
        set((state) => ({
          paths: state.paths.filter(p => p.id !== id),
          phases: state.phases.filter(ph => ph.pathId !== id)
        }));
        syncDeleteLearningPath(id);
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
        syncSavePhase(newPhase);
      },

      updatePhase: (id, updates) => set((state) => {
        const updatedPhases = state.phases.map(ph => {
          if (ph.id === id) {
            const updated = { ...ph, ...updates, ...updateSyncMetadata(ph) };
            syncSavePhase(updated);
            return updated;
          }
          return ph;
        });
        return { phases: updatedPhases };
      }),

      deletePhase: (id) => {
        set((state) => ({
          phases: state.phases.filter(ph => ph.id !== id),
          competencies: state.competencies.filter(c => c.phaseId !== id)
        }));
        syncDeletePhase(id);
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
        syncSaveCompetency(newComp);
      },

      updateCompetency: (id, updates) => set((state) => {
        const updatedComps = state.competencies.map(c => {
          if (c.id === id) {
            const updated = { ...c, ...updates, ...updateSyncMetadata(c) };
            syncSaveCompetency(updated);
            return updated;
          }
          return c;
        });
        return { competencies: updatedComps };
      }),

      deleteCompetency: (id) => {
        set((state) => ({
          competencies: state.competencies.filter(c => c.id !== id)
        }));
        syncDeleteCompetency(id);
      },
    }),
    {
      name: 'madrasah-curriculum-storage-v2',
      storage: createJSONStorage(() => createIndexedDbStorage('curriculum_store')),
    }
  )
);
