import { create } from 'zustand';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

interface AuthState {
  hasCompletedOnboarding: boolean;
  isCloudAuthenticated: boolean;
  isLocalMode: boolean;
  isAuthLoading: boolean;
  user: User | null;
  loginWithGoogle: () => Promise<void>;
  continueLocally: () => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  hasCompletedOnboarding: localStorage.getItem("madrasah_auth") !== "false",
  isCloudAuthenticated: false,
  isLocalMode: localStorage.getItem("madrasah_auth") !== "false",
  isAuthLoading: isFirebaseConfigured,
  user: null,

  loginWithGoogle: async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error("Layanan Firebase Cloud Auth belum dikonfigurasi.");
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      localStorage.setItem("madrasah_auth", "true");
      set({ hasCompletedOnboarding: true, isCloudAuthenticated: true, isLocalMode: false, user: result.user, isAuthLoading: false });
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  },

  continueLocally: () => {
    localStorage.setItem("madrasah_auth", "true");
    set({ hasCompletedOnboarding: true, isLocalMode: true, isCloudAuthenticated: false, isAuthLoading: false });
  },

  logout: async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Sign out error", e);
      }
    }
    localStorage.setItem("madrasah_auth", "false");
    set({ hasCompletedOnboarding: false, isCloudAuthenticated: false, isLocalMode: false, user: null, isAuthLoading: false });
  },

  setUser: (user) => {
    if (user) {
      set({
        user,
        hasCompletedOnboarding: true,
        isCloudAuthenticated: true,
        isLocalMode: false,
        isAuthLoading: false
      });
    } else {
      set({
        user: null,
        isCloudAuthenticated: false,
        isAuthLoading: false
      });
    }
  }
}));

// Synchronize Firebase auth listener only if Firebase is configured
if (isFirebaseConfigured && auth) {
  try {
    onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          localStorage.setItem("madrasah_auth", "true");
          useAuthStore.getState().setUser(firebaseUser);
        } else {
          useAuthStore.getState().setUser(null);
        }
      },
      (error) => {
        console.warn("Firebase onAuthStateChanged error:", error);
        useAuthStore.setState({ isAuthLoading: false });
      }
    );
  } catch (err) {
    console.warn("Gagal memasang listener auth Firebase:", err);
    useAuthStore.setState({ isAuthLoading: false });
  }
} else {
  // Langsung tandai auth loading selesai jika tanpa cloud config
  useAuthStore.setState({ isAuthLoading: false });
}

