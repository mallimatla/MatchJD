'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';

interface UseCollectionOptions {
  constraints?: QueryConstraint[];
  enabled?: boolean;
}

// Hook for real-time collection subscription
export function useCollection<T extends DocumentData>(
  collectionName: string,
  options: UseCollectionOptions = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { constraints = [], enabled = true } = options;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const user = firebaseAuth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // Build query with tenant isolation
    const baseConstraints = [
      where('tenantId', '==', user.uid),
      ...constraints,
    ];

    const q = query(collection(firebaseDb, collectionName), ...baseConstraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error fetching ${collectionName}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, enabled, JSON.stringify(constraints)]);

  return { data, loading, error };
}

// Hook for real-time document subscription
export function useDocument<T extends DocumentData>(
  collectionName: string,
  documentId: string | null,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !documentId) {
      setLoading(false);
      return;
    }

    const docRef = doc(firebaseDb, collectionName, documentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as unknown as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error fetching document:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, documentId, enabled]);

  return { data, loading, error };
}

// Hook for projects with real-time updates
export function useProjects() {
  return useCollection('projects', {
    constraints: [orderBy('createdAt', 'desc')],
  });
}

// Hook for documents in a project with real-time updates
export function useDocuments(projectId: string | null) {
  return useCollection('documents', {
    constraints: projectId
      ? [where('projectId', '==', projectId), orderBy('createdAt', 'desc')]
      : [],
    enabled: !!projectId,
  });
}

// Hook for review queue with real-time updates
export function useReviewQueue() {
  return useCollection('hitlRequests', {
    constraints: [
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    ],
  });
}

// Hook for parcels in a project
export function useParcels(projectId: string | null) {
  return useCollection('parcels', {
    constraints: projectId ? [where('projectId', '==', projectId)] : [],
    enabled: !!projectId,
  });
}
