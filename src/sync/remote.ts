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

function vaultRef(uid: string): DocumentReference {
  return doc(getDb(), COLLECTION, uid);
}

function parseRemote(data: Record<string, unknown> | undefined): RemoteVault | null {
  if (!data) return null;
  const envelope = data.envelope as unknown;
  const revision = data.revision as unknown;
  if (typeof revision !== "number") return null;
  assertEnvelope(envelope);
  const ts = data.updatedAt as { toMillis?: () => number } | null;
  return {
    envelope,
    revision,
    updatedAt: ts?.toMillis ? ts.toMillis() : null,
  };
}

export async function readRemote(uid: string): Promise<RemoteVault | null> {
  const snap = await getDoc(vaultRef(uid));
  return snap.exists() ? parseRemote(snap.data()) : null;
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
  return onSnapshot(
    vaultRef(uid),
    (snap) => onChange(snap.exists() ? parseRemote(snap.data()) : null),
    (err) => onError(err),
  );
}

/**
 * Pousse l'enveloppe locale de façon transactionnelle.
 * Échoue avec RemoteConflictError si la révision distante ne correspond pas à
 * `expectedRemoteRevision` (quelqu'un a écrit entre-temps).
 *
 * @param expectedRemoteRevision révision distante attendue (0 si inexistant).
 */
export async function pushRemote(
  uid: string,
  envelope: EncryptedEnvelope,
  revision: number,
  expectedRemoteRevision: number,
): Promise<void> {
  const ref = vaultRef(uid);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const currentRevision = snap.exists()
      ? (snap.data().revision as number) ?? 0
      : 0;
    if (currentRevision !== expectedRemoteRevision) {
      throw new RemoteConflictError(currentRevision);
    }
    tx.set(ref, {
      envelope,
      revision,
      updatedAt: serverTimestamp(),
    });
  });
}
