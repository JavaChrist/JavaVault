// Export de secours chiffré et restauration, format versionné.
//
// Le fichier de secours est autonome : il contient une enveloppe AES-GCM
// déchiffrable avec la phrase maître (sel + itérations inclus dans l'enveloppe).
// Tester la restauration sur un navigateur neuf : la synchronisation ne remplace
// pas une sauvegarde de secours.

import { decryptJson, deriveKey, encryptJson } from "@/crypto/crypto";
import type { EncryptedEnvelope, KdfParams } from "@/crypto/types";
import type { VaultData } from "./types";

export const BACKUP_FORMAT = 1 as const;

export interface BackupFile {
  app: "JavaVault";
  type: "backup";
  format: typeof BACKUP_FORMAT;
  createdAt: string;
  envelope: EncryptedEnvelope;
}

/**
 * Chiffre le coffre dans un conteneur de secours à l'aide de la clé en mémoire
 * et des paramètres KDF courants (le fichier reste déchiffrable avec la phrase
 * maître, puisque sel + itérations sont inscrits dans l'enveloppe).
 */
export async function createBackup(
  key: CryptoKey,
  params: KdfParams,
  data: VaultData,
): Promise<BackupFile> {
  const envelope = await encryptJson(key, data, params);
  return {
    app: "JavaVault",
    type: "backup",
    format: BACKUP_FORMAT,
    createdAt: new Date().toISOString(),
    envelope,
  };
}

export function assertBackupFile(value: unknown): asserts value is BackupFile {
  const b = value as Partial<BackupFile> | null;
  if (
    !b ||
    typeof b !== "object" ||
    b.app !== "JavaVault" ||
    b.type !== "backup" ||
    b.format !== BACKUP_FORMAT ||
    !b.envelope
  ) {
    throw new Error("Fichier de secours invalide ou format non reconnu.");
  }
}

/** Restaure un coffre depuis un fichier de secours et la phrase maître. */
export async function restoreBackup(
  passphrase: string,
  file: BackupFile,
): Promise<VaultData> {
  assertBackupFile(file);
  const key = await deriveKey(passphrase, {
    salt: file.envelope.salt,
    iterations: file.envelope.iterations,
  });
  return decryptJson<VaultData>(key, file.envelope);
}
