import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

function initializeFirebase() {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);

  // Connect to emulators in development
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    // Uncomment these lines when using Firebase emulators
    // connectFunctionsEmulator(functions, 'localhost', 5001);
  }

  return { app, auth, db, storage, functions };
}

// Initialize on module load
const firebase = initializeFirebase();

export const { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, storage: firebaseStorage, functions: firebaseFunctions } = firebase;

// Helper to get current user's tenant ID
export async function getCurrentTenantId(): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;

  // In production, you'd fetch this from user's custom claims or a users collection
  // For now, we use the user's UID as tenant ID
  return user.uid;
}
