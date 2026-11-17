// Stockage local chiffré (IndexedDB via idb).
//
// Ne contient JAMAIS de secret en clair ni de clé maître : uniquement une
// enveloppe chiffrée (AES-GCM) + métadonnées non sensibles (révision, date).
// La consultation hors ligne se fait en déchiffrant en mémoire après
// déverrouillage ; rien de déchiffré n'est réécrit sur disque.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { EncryptedEnvelope } from "@/crypto/types";

const DB_NAME = "javavault";
const DB_VERSION = 1;
const STORE = "vault";
const PRIMARY_KEY = "primary";

/** Enregistrement persistant du coffre. */
export interface StoredVault {
  id: typeof PRIMARY_KEY;
  /** Enveloppe chiffrée contenant l'intégralité du coffre. */
  envelope: EncryptedEnvelope;
  /** Numéro de révision, incrémenté à chaque enregistrement. */
  revision: number;
  /** Dernière révision confirmée synchronisée avec le serveur (0 = jamais). */
  baseRevision: number;
  /** Date du dernier enregistrement local (ms). */
  updatedAt: number;
}

interface JavaVaultDB extends DBSchema {
  vault: {
    key: string;
    value: StoredVault;
  };
}

let dbPromise: Promise<IDBPDatabase<JavaVaultDB>> | null = null;

function getDb(): Promise<IDBPDatabase<JavaVaultDB>> {
  if (!dbPromise) {
    dbPromise = openDB<JavaVaultDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadStoredVault(): Promise<StoredVault | undefined> {
  const db = await getDb();
  return db.get(STORE, PRIMARY_KEY);
}

export async function hasStoredVault(): Promise<boolean> {
  return (await loadStoredVault()) !== undefined;
}

export async function saveStoredVault(
  envelope: EncryptedEnvelope,
  revision: number,
  baseRevision: number,
): Promise<StoredVault> {
  const db = await getDb();
  const record: StoredVault = {
    id: PRIMARY_KEY,
    envelope,
    revision,
    baseRevision,
    updatedAt: Date.now(),
  };
  await db.put(STORE, record);
  return record;
}

/** Met à jour uniquement la révision de base (après synchronisation réussie). */
export async function setStoredBaseRevision(
  baseRevision: number,
): Promise<StoredVault | undefined> {
  const db = await getDb();
  const current = await db.get(STORE, PRIMARY_KEY);
  if (!current) return undefined;
  const record: StoredVault = { ...current, baseRevision };
  await db.put(STORE, record);
  return record;
}

/** Supprime entièrement le coffre local (réinitialisation explicite). */
export async function destroyStoredVault(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, PRIMARY_KEY);
}
