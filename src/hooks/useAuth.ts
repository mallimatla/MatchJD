'use client';

import { useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setState({ user, loading: false, error: null });
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to sign in',
      }));
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const { user } = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );

      // Create user document in Firestore
      await setDoc(doc(firebaseDb, 'users', user.uid), {
        email,
        displayName,
        tenantId: user.uid, // Use UID as tenant ID for single-tenant setup
        role: 'admin',
        createdAt: new Date(),
      });
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to sign up',
      }));
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(firebaseAuth, provider);

      // Check if user document exists, create if not
      const userDoc = await getDoc(doc(firebaseDb, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(firebaseDb, 'users', user.uid), {
          email: user.email,
          displayName: user.displayName || user.email,
          tenantId: user.uid,
          role: 'admin',
          createdAt: new Date(),
        });
      }
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to sign in with Google',
      }));
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(firebaseAuth);
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.message || 'Failed to sign out',
      }));
      throw error;
    }
  };

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!state.user,
  };
}
