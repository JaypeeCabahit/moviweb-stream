import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// Firebase is optional — if no config is provided the app still works,
// users just can't sign in or use the watchlist.
export const firebaseEnabled = !!apiKey;

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;

if (firebaseEnabled) {
  app = initializeApp({
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  _auth = getAuth(app);
  _db = getDatabase(app);
}

export const auth = _auth;
export const googleProvider = new GoogleAuthProvider();
export const db = _db;
