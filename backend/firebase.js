import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';

let db;

export async function initializeFirebase() {
  try {
    const serviceAccount = JSON.parse(
      await readFile(new URL('./serviceAccountKey.json', import.meta.url))
    );

    const app = initializeApp({
      credential: cert(serviceAccount),
    });

    db = getFirestore(app);
    console.log('Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
}

export function getFirestoreInstance() {
  if (!db) throw new Error('Firebase not initialized');
  return db;
}
