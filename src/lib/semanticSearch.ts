import { pipeline, env } from '@xenova/transformers';
import { create } from 'zustand';

// Model (~23MB) diunduh sekali saat pertama kali dipakai, lalu di-cache oleh browser.
env.allowRemoteModels = true;
env.allowLocalModels = false;

interface SemanticSearchState {
  isModelLoading: boolean;
  modelError: string | null;
  setIsModelLoading: (loading: boolean) => void;
  setModelError: (error: string | null) => void;
}

export const useSemanticSearchStore = create<SemanticSearchState>((set) => ({
  isModelLoading: false,
  modelError: null,
  setIsModelLoading: (loading: boolean) => set({ isModelLoading: loading }),
  setModelError: (error: string | null) => set({ modelError: error }),
}));

let embedder: any = null;
let embedderPromise: Promise<any> | null = null;

export async function getEmbedder() {
  if (embedder) return embedder;
  if (embedderPromise) return embedderPromise;

  const store = useSemanticSearchStore.getState();
  store.setIsModelLoading(true);
  store.setModelError(null);

  embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    .then((loaded) => {
      embedder = loaded;
      return loaded;
    })
    .catch((err: unknown) => {
      const msg =
        err instanceof Error && err.message
          ? `Model semantik lokal gagal dimuat (${err.message}). Pastikan koneksi tersedia pada unduhan pertama.`
          : 'Model semantik lokal gagal dimuat di peramban.';
      useSemanticSearchStore.getState().setModelError(msg);
      throw err;
    })
    .finally(() => {
      embedderPromise = null;
      useSemanticSearchStore.getState().setIsModelLoading(false);
    });

  return embedderPromise;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const clean = text.trim();
  if (!clean) {
    return [];
  }
  const model = await getEmbedder();
  const output = await model(clean, { pooling: 'mean', normalize: true });
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

export async function searchSemantic(
  query: string,
  items: { id: string; embedding?: number[] }[],
  threshold = 0.38
): Promise<SemanticSearchResult[]> {
  if (!query.trim()) return [];
  const validItems = items.filter((item) => Array.isArray(item.embedding) && item.embedding.length > 0);
  if (validItems.length === 0) return [];

  const queryEmbedding = await generateEmbedding(query);
  if (queryEmbedding.length === 0) return [];

  return validItems
    .map((item) => ({
      id: item.id,
      similarity: cosineSimilarity(queryEmbedding, item.embedding!),
    }))
    .filter((res) => res.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
