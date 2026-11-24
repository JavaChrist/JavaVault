// Couche Firestore : stockage du coffre CHIFFRÉ et contrôle de révision.
//
// Le serveur ne reçoit jamais de secret en clair : seulement l'enveloppe
// AES-GCM (ciphertext) et un numéro de révision. L'accès est restreint à l'UID
// autorisé côté règles Firestore (voir firestore.rules).

import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from "firebase/firestore";
import { getDb } from "@/firebase/config";
import { assertEnvelope } from "@/crypto/crypto";
import type { EncryptedEnvelope } from "@/crypto/types";

const COLLECTION = "vaults";
const CHUNKS = "chunks";

// Firestore limite une valeur de champ à ~1 Mo et un document à 1 Mio.
// Au-delà de CHUNK_CHARS, le ciphertext (base64, donc ASCII) est découpé en
// morceaux stockés dans vaults/{uid}/chunks/{set}_{i}. En dessous, il reste
// dans le document principal (format historique, lisible par les anciens clients).
const CHUNK_CHARS = 700_000;
// Une transaction Firestore est limitée à ~10 Mio : on garde une marge.
export const MAX_REMOTE_CIPHERTEXT_CHARS = 9_000_000;

export interface RemoteVault {
  envelope: EncryptedEnvelope;
  revision: number;
  updatedAt: number | null;
}

/** Levée lorsqu'un push est refusé car le distant a changé entre-temps. */
export class RemoteConflictError extends Error {
  constructor(public remoteRevision: number) {
    super("Le coffre distant a changé : conflit de révisions.");
    this.name = "RemoteConflictError";
  }
}

/** Levée lorsque le coffre chiffré dépasse la taille synchronisable. */
export class RemoteTooLargeError extends Error {
  constructor(public size: number) {
    super(
      `Coffre trop volumineux pour la synchronisation (${Math.round(size / 1_000_000)} Mo chiffrés, max ${MAX_REMOTE_CIPHERTEXT_CHARS / 1_000_000} Mo). Retirez des fichiers joints volumineux.`,
    );
    this.name = "RemoteTooLargeError";
  }
}

function vaultRef(uid: string): DocumentReference {
  return doc(getDb(), COLLECTION, uid);
}

function chunkRef(uid: string, set: string, index: number): DocumentReference {
  return doc(getDb(), COLLECTION, uid, CHUNKS, `${set}_${index}`);
}

interface ChunkInfo {
  set: string;
  count: number;
}

function readChunkInfo(data: Record<string, unknown> | undefined): ChunkInfo | null {
  const set = data?.chunkSet;
  const count = data?.chunkCount;
  if (typeof set === "string" && set && typeof count === "number" && count > 0) {
    return { set, count };
  }
  return null;
}

async function loadCiphertext(uid: string, info: ChunkInfo): Promise<string> {
  const parts = await Promise.all(
    Array.from({ length: info.count }, (_, i) => getDoc(chunkRef(uid, info.set, i))),
  );
  return parts
    .map((snap, i) => {
      const data = snap.data()?.data;
      if (typeof data !== "string") {
        throw new Error(`Morceau ${i + 1}/${info.count} du coffre distant introuvable.`);
      }
      return data;
    })
    .join("");
}

async function parseRemote(
  uid: string,
  data: Record<string, unknown> | undefined,
): Promise<RemoteVault | null> {
  if (!data) return null;
  const revision = data.revision as unknown;
  if (typeof revision !== "number") return null;
  const info = readChunkInfo(data);
  const raw = data.envelope as Record<string, unknown> | undefined;
  const envelope: unknown =
    info && raw ? { ...raw, ciphertext: await loadCiphertext(uid, info) } : raw;
  assertEnvelope(envelope);
  const ts = data.updatedAt as { toMillis?: () => number } | null;
  return {
    envelope,
    revision,
    updatedAt: ts?.toMillis ? ts.toMillis() : null,
  };
}

export async function readRemote(uid: string): Promise<RemoteVault | null> {
  // Un push concurrent peut supprimer les morceaux entre la lecture du document
  // et celle des morceaux : on relit une fois le document dans ce cas.
  for (let attempt = 0; ; attempt++) {
    const snap = await getDoc(vaultRef(uid));
    try {
      return snap.exists() ? await parseRemote(uid, snap.data()) : null;
    } catch (e) {
      if (attempt >= 1) throw e;
    }
  }
}

/**
 * Abonnement temps réel au coffre distant.
 * `onChange` reçoit null si le document n'existe pas encore.
 */
export function subscribeRemote(
  uid: string,
  onChange: (remote: RemoteVault | null) => void,
  onError: (error: Error) => void,
): () => void {
  let seq = 0;
  return onSnapshot(
    vaultRef(uid),
    (snap) => {
      const current = ++seq;
      const load = snap.exists()
        ? parseRemote(uid, snap.data()).catch(() => readRemote(uid))
        : Promise.resolve(null);
      load.then(
        (remote) => {
          // Ignore un résultat dépassé par un instantané plus récent.
          if (current === seq) onChange(remote);
        },
        (err: unknown) => {
          if (current === seq) onError(err instanceof Error ? err : new Error(String(err)));
        },
      );
    },
    (err) => onError(err),
  );
}

/**
 * Pousse l'enveloppe locale de façon transactionnelle.
 * Échoue avec RemoteConflictError si la révision distante ne correspond pas à
 * `expectedRemoteRevision` (quelqu'un a écrit entre-temps), et avec
 * RemoteTooLargeError si le coffre chiffré dépasse la taille synchronisable.
 *
 * @param expectedRemoteRevision révision distante attendue (0 si inexistant).
 */
export async function pushRemote(
  uid: string,
  envelope: EncryptedEnvelope,
  revision: number,
  expectedRemoteRevision: number,
): Promise<void> {
  const { ciphertext } = envelope;
  if (ciphertext.length > MAX_REMOTE_CIPHERTEXT_CHARS) {
    throw new RemoteTooLargeError(ciphertext.length);
  }
  const chunked = ciphertext.length > CHUNK_CHARS;
  const set = chunked ? crypto.randomUUID().replace(/-/g, "").slice(0, 12) : "";
  const parts: string[] = [];
  if (chunked) {
    for (let i = 0; i < ciphertext.length; i += CHUNK_CHARS) {
      parts.push(ciphertext.slice(i, i + CHUNK_CHARS));
    }
  }

  const ref = vaultRef(uid);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : undefined;
    const currentRevision = (data?.revision as number | undefined) ?? 0;
    if (currentRevision !== expectedRemoteRevision) {
      throw new RemoteConflictError(currentRevision);
    }
    // Les morceaux de la version précédente sont supprimés dans la même transaction.
    const previous = readChunkInfo(data);
    if (previous) {
      for (let i = 0; i < previous.count; i++) tx.delete(chunkRef(uid, previous.set, i));
    }
    parts.forEach((part, i) => tx.set(chunkRef(uid, set, i), { data: part }));
    tx.set(ref, {
      envelope: chunked ? { ...envelope, ciphertext: "" } : envelope,
      revision,
      updatedAt: serverTimestamp(),
      ...(chunked ? { chunkSet: set, chunkCount: parts.length } : {}),
    });
  });
}
