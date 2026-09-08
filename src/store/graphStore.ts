import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Node, Edge } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { SyncMetadata } from '../types';
import { createIndexedDbStorage } from './indexedDbStorage';

interface GraphState {
  nodes: Node[];
  edges: Edge[];
  
  addNode: (node: Omit<Node, 'id'>) => void;
  addEdge: (edge: Omit<Edge, 'id'>) => void;
  deleteNode: (id: string) => void;
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      
      addNode: (nodeData) => set((state) => ({
        nodes: [
          ...state.nodes,
          {
            ...nodeData,
            id: crypto.randomUUID(),
          }
        ]
      })),
      
      addEdge: (edgeData) => set((state) => ({
        edges: [
          ...state.edges,
          {
            ...edgeData,
            id: crypto.randomUUID(),
          }
        ]
      })),
      
      deleteNode: (id) => set((state) => ({
        nodes: state.nodes.filter(n => n.id !== id),
        edges: state.edges.filter(e => e.source !== id && e.target !== id),
      })),
    }),
    {
      name: 'madrasah-graph-storage-v2',
      storage: createJSONStorage(() => createIndexedDbStorage('graph_store')),
    }
  )
);
