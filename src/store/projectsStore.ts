import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { Project, Task, TaskStatus } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { SyncMetadata } from '../types';
import { syncSaveProject, syncDeleteProject } from '../lib/firestoreSync';

localforage.config({
  name: 'madrasah_db',
  storeName: 'projects_store'
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

interface ProjectsState {
  projects: Project[];
  tasks: Task[];
  
  addProject: (project: Omit<Project, 'id' | 'createdAt' | keyof SyncMetadata>) => string;
  updateProject: (id: string, project: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  
  addTask: (task: Omit<Task, 'id' | 'createdAt' | keyof SyncMetadata>) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  updateTaskTitle: (id: string, title: string) => void;
  deleteTask: (id: string) => void;
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      tasks: [],
      
      addProject: (projectData) => {
        const id = crypto.randomUUID();
        const newProject: Project = {
          ...projectData,
          id,
          createdAt: Date.now(),
          ...createSyncMetadata(),
          
        };
        set((state) => ({
          projects: [newProject, ...state.projects]
        }));
        syncSaveProject(newProject);
        return id;
      },
      
      updateProject: (id, projectData) => {
        set((state) => {
          const updatedProjects = state.projects.map(p => {
            if (p.id === id) {
              const updated = { ...p, ...projectData, ...updateSyncMetadata(p) };
              syncSaveProject(updated);
              return updated;
            }
            return p;
          });
          return { projects: updatedProjects };
        });
      },
      
      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter(p => p.id !== id),
          tasks: state.tasks.filter(t => t.projectId !== id),
        }));
        syncDeleteProject(id);
      },

      addTask: (taskData) => set((state) => {
        return {
          tasks: [
            ...state.tasks,
            {
              ...taskData,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
          ...createSyncMetadata(),
              
            }
          ]
        }
      }),

      updateTaskStatus: (id, status) => set((state) => ({
        tasks: state.tasks.map(t => 
          t.id === id 
            ? { ...t, status,  } 
            : t
        )
      })),

      updateTaskTitle: (id, title) => set((state) => ({
        tasks: state.tasks.map(t => 
          t.id === id 
            ? { ...t, title,  } 
            : t
        )
      })),

      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id)
      })),
    }),
    {
      name: 'madrasah-projects-storage-v2',
      storage: createJSONStorage(() => storage),
    }
  )
);

