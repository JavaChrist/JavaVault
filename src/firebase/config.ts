// Initialisation Firebase — UNIQUEMENT la configuration publique (VITE_*).
//
// Aucune clé privée ni SDK Admin ici. Si la configuration est absente,
// l'application reste pleinement fonctionnelle en local (lot 1) et la
// synchronisation est simplement « non configurée ».

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** UID personnel autorisé (contrôle d'accès, aussi appliqué côté règles). */
export const AUTHORIZED_UID: string | undefined =
  import.meta.env.VITE_AUTHORIZED_UID || undefined;

/** Vrai si la configuration publique minimale est présente. */
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase n'est pas configuré (variables VITE_FIREBASE_* manquantes).");
  }
  if (!app) app = initializeApp(config);
  return app;
}

export function getAuthInstance(): Auth {
  if (!authInstance) authInstance = getAuth(ensureApp());
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(ensureApp());
  return dbInstance;
}
