import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Deck, Flashcard } from '../types';
import { createSyncMetadata, updateSyncMetadata } from './syncUtils';
import { syncSaveDeck, syncDeleteDeck, syncSaveFlashcard, syncDeleteFlashcard } from '../lib/firestoreSync';
import { SyncMetadata } from '../types';
import { createIndexedDbStorage } from './indexedDbStorage';

interface ReviewState {
  decks: Deck[];
  flashcards: Flashcard[];
  
  addDeck: (deck: Omit<Deck, 'id' | 'createdAt' | keyof SyncMetadata> & { id?: string }) => string;
  deleteDeck: (id: string) => void;
  
  addFlashcard: (flashcard: Omit<Flashcard, 'id' | 'createdAt' | 'interval' | 'repetition' | 'efactor' | 'dueDate' | keyof SyncMetadata>) => void;
  reviewFlashcard: (id: string, quality: number) => void; // quality 0-5
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      decks: [],
      flashcards: [],
      
      addDeck: (deckData) => {
        const id = deckData.id || crypto.randomUUID();
        const newDeck: Deck = {
          ...deckData,
          id,
          createdAt: Date.now(),
          ...createSyncMetadata(),
        };
        set((state) => ({
          decks: [
            newDeck,
            ...state.decks
          ]
        }));
        syncSaveDeck(newDeck);
        return id;
      },
      
      deleteDeck: (id) => {
        set((state) => ({
          decks: state.decks.filter(d => d.id !== id),
          flashcards: state.flashcards.filter(f => f.deckId !== id),
        }));
        syncDeleteDeck(id);
      },

      addFlashcard: (flashcardData) => {
        const newFlashcard: Flashcard = {
          ...flashcardData,
          id: crypto.randomUUID(),
          interval: 0,
          repetition: 0,
          efactor: 2.5,
          dueDate: Date.now(),
          createdAt: Date.now(),
          ...createSyncMetadata(),
        };
        set((state) => ({
          flashcards: [
            ...state.flashcards,
            newFlashcard
          ]
        }));
        syncSaveFlashcard(newFlashcard);
      },
      
      reviewFlashcard: (id, quality) => set((state) => {
        const updatedFlashcards = state.flashcards.map(f => {
          if (f.id !== id) return f;
          
          let efactor = f.efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
          if (efactor < 1.3) efactor = 1.3;
          
          let repetition = f.repetition;
          let interval = f.interval;
          
          if (quality < 3) {
            repetition = 0;
            interval = 1;
          } else {
            repetition += 1;
            if (repetition === 1) interval = 1;
            else if (repetition === 2) interval = 6;
            else interval = Math.round(interval * efactor);
          }
          
          const dueDate = Date.now() + interval * 24 * 60 * 60 * 1000;
          
          const updatedCard = {
            ...f,
            efactor,
            repetition,
            interval,
            dueDate,
            ...updateSyncMetadata(f),
          };
          syncSaveFlashcard(updatedCard);
          return updatedCard;
        });
        return { flashcards: updatedFlashcards };
      }),
    }),
    {
      name: 'madrasah-review-storage-v2',
      storage: createJSONStorage(() => createIndexedDbStorage('review_store')),
    }
  )
);
