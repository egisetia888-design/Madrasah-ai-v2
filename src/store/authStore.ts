import { create } from 'zustand';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthState {
  hasCompletedOnboarding: boolean;
  isCloudAuthenticated: boolean;
  isAuthLoading: boolean;
  user: User | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  hasCompletedOnboarding: localStorage.getItem("madrasah_auth") !== "false",
  isCloudAuthenticated: false,
  isAuthLoading: true,
  user: null,

  loginWithGoogle: async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      localStorage.setItem("madrasah_auth", "true");
      set({ hasCompletedOnboarding: true, isCloudAuthenticated: true, user: result.user, isAuthLoading: false });
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error", e);
    }
    localStorage.setItem("madrasah_auth", "false");
    set({ hasCompletedOnboarding: false, isCloudAuthenticated: false, user: null, isAuthLoading: false });
  },

  setUser: (user) => {
    set({
      user,
      hasCompletedOnboarding: !!user,
      isCloudAuthenticated: !!user,
      isAuthLoading: false
    });
  }
}));

// Synchronize Firebase auth listener
onAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    localStorage.setItem("madrasah_auth", "true");
    useAuthStore.getState().setUser(firebaseUser);
  } else {
    useAuthStore.getState().setUser(null);
  }
});
