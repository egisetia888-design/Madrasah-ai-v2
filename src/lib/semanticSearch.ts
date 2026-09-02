import { pipeline, env } from '@xenova/transformers';
import { create } from 'zustand';

// Model (~23MB) diunduh sekali saat pertama kali dipakai, lalu di-cache oleh browser.
env.allowRemoteModels = true;
env.allowLocalModels = false;

interface SemanticSearchState {
  isModelLoading: boolean;
  setIsModelLoading: (loading: boolean) => void;
}

export const useSemanticSearchStore = create<SemanticSearchState>((set) => ({
  isModelLoading: false,
  setIsModelLoading: (loading: boolean) => set({ isModelLoading: loading }),
}));

let embedder: any = null;

export async function getEmbedder() {
  if (!embedder) {
    useSemanticSearchStore.getState().setIsModelLoading(true);
    try {
      // Using a small, efficient model: all-MiniLM-L6-v2
      // It's ~23MB in ONNX format
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } finally {
      useSemanticSearchStore.getState().setIsModelLoading(false);
    }
  }
  return embedder;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    mA += valA * valA;
    mB += valB * valB;
  }
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

export interface SemanticSearchResult {
  id: string;
  similarity: number;
}

export async function searchSemantic(query: string, items: { id: string, embedding?: number[] }[]): Promise<SemanticSearchResult[]> {
  if (!query.trim()) return [];
  
  const queryEmbedding = await generateEmbedding(query);
  
  const results = items
    .filter(item => item.embedding && item.embedding.length > 0)
    .map(item => ({
      id: item.id,
      similarity: cosineSimilarity(queryEmbedding, item.embedding!)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .filter(res => res.similarity > 0.5); // Threshold for relevance
    
  return results;
}
