import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration (hardcoded - these are public client keys, safe to expose)
const firebaseConfig = {
  apiKey: "AIzaSyAhYCWMCI1v-jLMu46bVLgS8OUwKavzDeo",
  authDomain: "skillquest-f0a12.firebaseapp.com",
  projectId: "skillquest-f0a12",
  storageBucket: "skillquest-f0a12.firebasestorage.app",
  messagingSenderId: "134564755489",
  appId: "1:134564755489:web:b29158bda40709e117cb60",
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
