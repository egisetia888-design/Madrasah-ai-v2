import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TourState {
  hasSeenTour: boolean;
  isTourOpen: boolean;
  startTour: () => void;
  stopTour: () => void;
  completeTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasSeenTour: false,
      isTourOpen: false,
      startTour: () => set({ isTourOpen: true }),
      stopTour: () => set({ isTourOpen: false }),
      completeTour: () => set({ isTourOpen: false, hasSeenTour: true }),
    }),
    {
      name: 'madrasah-tour-storage-v3',
      partialize: (state) => ({ hasSeenTour: state.hasSeenTour }),
    }
  )
)
