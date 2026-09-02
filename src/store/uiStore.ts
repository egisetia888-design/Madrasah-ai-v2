import { create } from 'zustand';

interface UIState {
  searchOpen: boolean;
  quickAddOpen: boolean;
  shortcutGuideOpen: boolean;
  aboutOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean) => void;
  setShortcutGuideOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  searchOpen: false,
  quickAddOpen: false,
  shortcutGuideOpen: false,
  aboutOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),
  setShortcutGuideOpen: (open) => set({ shortcutGuideOpen: open }),
  setAboutOpen: (open) => set({ aboutOpen: open }),
}));
