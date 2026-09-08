import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, type Firestore } from 'firebase/firestore';

import firebaseAppletConfig from '../../firebase-applet-config.json';

const rawConfig: any = firebaseAppletConfig || {};

const firebaseConfig = {
  apiKey: rawConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: rawConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: rawConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: rawConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: rawConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: rawConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: rawConfig.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
  firestoreDatabaseId: rawConfig.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)"
};

export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  typeof firebaseConfig.apiKey === 'string' &&
  firebaseConfig.apiKey.trim() !== '' &&
  firebaseConfig.apiKey !== '""' &&
  !firebaseConfig.apiKey.includes('YOUR_') &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.trim() !== ''
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    const customDatabaseId = firebaseConfig.firestoreDatabaseId &&
      firebaseConfig.firestoreDatabaseId !== '(default)' &&
      firebaseConfig.firestoreDatabaseId.trim() !== ''
        ? firebaseConfig.firestoreDatabaseId
        : undefined;

    db = customDatabaseId ? getFirestore(app, customDatabaseId) : getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  } catch (err) {
    console.warn('Gagal menginisialisasi Firebase SDK:', err);
    app = null;
    db = null;
    auth = null;
    googleProvider = null;
  }
}

export { app, db, auth, googleProvider };

export let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && app) {
  isSupported().then(yes => {
    if (yes && app) {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        console.warn('Firebase Analytics initialization warning:', err);
      }
    }
  }).catch(() => {
    // Analytics not supported in this environment
  });
}


export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  if (!isFirebaseConfigured || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently offline or unconfigured.");
    }
  }
}

if (isFirebaseConfigured) {
  testConnection();
}
