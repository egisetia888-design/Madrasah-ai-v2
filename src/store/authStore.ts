import { create } from 'zustand';

const AUTH_STORAGE_KEY = 'madrasah_auth';
const WORKSPACE_NAME_KEY = 'madrasah_workspace_name';

function readInitialEntered(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
}

function readInitialWorkspaceName(): string {
  if (typeof window === 'undefined') return 'Ruang Belajar Pribadi';
  return window.localStorage.getItem(WORKSPACE_NAME_KEY)?.trim() || 'Ruang Belajar Pribadi';
}

interface AuthState {
  hasCompletedOnboarding: boolean;
  isLocalMode: boolean;
  isAuthLoading: boolean;
  workspaceName: string;
  enterWorkspace: (workspaceName?: string) => void;
  setWorkspaceName: (workspaceName: string) => void;
  continueLocally: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  hasCompletedOnboarding: readInitialEntered(),
  isLocalMode: true,
  isAuthLoading: false,
  workspaceName: readInitialWorkspaceName(),

  enterWorkspace: (name) => {
    const cleanName = name?.trim() || readInitialWorkspaceName();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      window.localStorage.setItem(WORKSPACE_NAME_KEY, cleanName);
    }
    set({
      hasCompletedOnboarding: true,
      isLocalMode: true,
      isAuthLoading: false,
      workspaceName: cleanName,
    });
  },

  setWorkspaceName: (name) => {
    const cleanName = name.trim() || 'Ruang Belajar Pribadi';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WORKSPACE_NAME_KEY, cleanName);
    }
    set({ workspaceName: cleanName });
  },

  continueLocally: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    }
    set({
      hasCompletedOnboarding: true,
      isLocalMode: true,
      isAuthLoading: false,
    });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_STORAGE_KEY, 'false');
    }
    set({
      hasCompletedOnboarding: false,
      isLocalMode: true,
      isAuthLoading: false,
    });
  },
}));
