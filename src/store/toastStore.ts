import { create } from 'zustand';

export type ToastType = 'loading' | 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'> & { id?: string }) => string;
  updateToast: (id: string, toast: Partial<Omit<Toast, 'id'>>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (toast) => {
    const id = toast.id || Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));
    
    // Auto remove success/error/info toasts after 3s
    if (toast.type !== 'loading') {
      setTimeout(() => {
        get().removeToast(id);
      }, 3000);
    }
    return id;
  },
  updateToast: (id, updatedToast) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updatedToast } : t))
    }));
    
    // Auto remove if type changed from loading to something else
    if (updatedToast.type && updatedToast.type !== 'loading') {
      setTimeout(() => {
        get().removeToast(id);
      }, 3000);
    }
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  }))
}));
