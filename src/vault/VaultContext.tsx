/* eslint-disable react-refresh/only-export-components */
// Fournisseur d'état du coffre.
//
// Sécurité :
// - La clé dérivée et les données déchiffrées vivent UNIQUEMENT en mémoire.
// - Le verrouillage (manuel, auto-inactivité, fermeture) efface clé et données.
// - Rien de déchiffré n'est écrit en localStorage ni dans les caches.
// - L'« enveloppe » (ciphertext) n'est pas un secret : elle peut être conservée
//   et synchronisée même coffre verrouillé.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DecryptionError,
  decryptJson,
  deriveKey,
  encryptJson,
  newKdfParams,
} from "@/crypto/crypto";
import type { EncryptedEnvelope, KdfParams } from "@/crypto/types";
import {
  destroyStoredVault,
  loadStoredVault,
  saveStoredVault,
  setStoredBaseRevision,
} from "@/storage/db";
import { createBackup, restoreBackup, type BackupFile } from "./backup";
import { emptyVault, type VaultData } from "./types";

export type VaultStatus = "loading" | "empty" | "locked" | "unlocked";

/** Délai d'auto-verrouillage par défaut (5 minutes d'inactivité). */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

/** Résultat de l'adoption d'une version distante. */
export type ApplyRemoteResult = "refreshed" | "stored" | "relocked";

interface VaultContextValue {
  status: VaultStatus;
  data: VaultData | null;
  revision: number;
  /** Dernière révision confirmée synchronisée (0 = jamais). */
  baseRevision: number;
  /** Modifications locales non encore synchronisées. */
  pendingChanges: boolean;
  /** Enveloppe chiffrée courante (ciphertext, non secret). */
  currentEnvelope: EncryptedEnvelope | null;
  updatedAt: number | null;
  busy: boolean;
  createVault: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  update: (mutator: (draft: VaultData) => void) => Promise<void>;
  exportBackup: () => Promise<BackupFile>;
  restoreFromBackup: (passphrase: string, file: BackupFile) => Promise<void>;
  destroy: () => Promise<void>;
  resetInactivity: () => void;
  // --- Primitives de synchronisation (utilisées par SyncProvider) ---
  confirmSynced: (revision: number) => Promise<void>;
  applyRemote: (
    envelope: EncryptedEnvelope,
    revision: number,
  ) => Promise<ApplyRemoteResult>;
  prepareConflictOverwrite: (
    remoteRevision: number,
  ) => Promise<{ envelope: EncryptedEnvelope; revision: number }>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [data, setData] = useState<VaultData | null>(null);
  const [revision, setRevision] = useState(0);
  const [baseRevision, setBaseRevision] = useState(0);
  const [currentEnvelope, setCurrentEnvelope] =
    useState<EncryptedEnvelope | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Secrets en mémoire seule (hors state React pour limiter l'exposition).
  const keyRef = useRef<CryptoKey | null>(null);
  const paramsRef = useRef<KdfParams | null>(null);
  const timerRef = useRef<number | null>(null);
  // Miroirs pour éviter les fermetures obsolètes dans les callbacks de sync.
  const revisionRef = useRef(0);
  const baseRef = useRef(0);
  const dataRef = useRef<VaultData | null>(null);

  const applyRevision = useCallback((rev: number) => {
    revisionRef.current = rev;
    setRevision(rev);
  }, []);
  const applyBase = useCallback((base: number) => {
    baseRef.current = base;
    setBaseRevision(base);
  }, []);
  const applyData = useCallback((next: VaultData | null) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const wipeSecrets = useCallback(() => {
    keyRef.current = null;
    paramsRef.current = null;
    applyData(null);
  }, [applyData]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const lock = useCallback(() => {
    clearTimer();
    wipeSecrets();
    setStatus((prev) => (prev === "empty" ? "empty" : "locked"));
  }, [clearTimer, wipeSecrets]);

  // Détection d'un coffre existant au démarrage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadStoredVault();
      if (cancelled) return;
      if (stored) {
        applyRevision(stored.revision);
        applyBase(stored.baseRevision ?? 0);
        setCurrentEnvelope(stored.envelope);
        setUpdatedAt(stored.updatedAt);
        setStatus("locked");
      } else {
        setStatus("empty");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRevision, applyBase]);

  // Auto-verrouillage sur inactivité + verrouillage à la fermeture/masquage.
  const armInactivity = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(lock, AUTO_LOCK_MS);
  }, [clearTimer, lock]);

  const resetInactivity = useCallback(() => {
    if (keyRef.current) armInactivity();
  }, [armInactivity]);

  useEffect(() => {
    if (status !== "unlocked") return;
    armInactivity();
    const onHide = () => {
      if (document.visibilityState === "hidden") lock();
    };
    let last = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - last > 1000) {
        last = now;
        armInactivity();
      }
    };
    window.addEventListener("pagehide", lock);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("pagehide", lock);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [status, armInactivity, lock]);

  const persist = useCallback(
    async (next: VaultData) => {
      const key = keyRef.current;
      const params = paramsRef.current;
      if (!key || !params) throw new Error("Coffre verrouillé.");
      const envelope = await encryptJson(key, next, params);
      const nextRevision = revisionRef.current + 1;
      const record = await saveStoredVault(envelope, nextRevision, baseRef.current);
      applyRevision(record.revision);
      setCurrentEnvelope(envelope);
      setUpdatedAt(record.updatedAt);
    },
    [applyRevision],
  );

  const createVault = useCallback(
    async (passphrase: string) => {
      setBusy(true);
      try {
        const params = newKdfParams();
        const key = await deriveKey(passphrase, params);
        keyRef.current = key;
        paramsRef.current = params;
        const fresh = emptyVault();
        const envelope = await encryptJson(key, fresh, params);
        // base = 0 : jamais synchronisé, sera poussé à la première connexion.
        const record = await saveStoredVault(envelope, 1, 0);
        applyData(fresh);
        applyRevision(record.revision);
        applyBase(0);
        setCurrentEnvelope(envelope);
        setUpdatedAt(record.updatedAt);
        setStatus("unlocked");
      } finally {
        setBusy(false);
      }
    },
    [applyData, applyRevision, applyBase],
  );

  const unlock = useCallback(
    async (passphrase: string) => {
      setBusy(true);
      try {
        const stored = await loadStoredVault();
        if (!stored) {
          setStatus("empty");
          throw new Error("Aucun coffre local à déverrouiller.");
        }
        const params: KdfParams = {
          salt: stored.envelope.salt,
          iterations: stored.envelope.iterations,
        };
        const key = await deriveKey(passphrase, params);
        // Lève DecryptionError si la phrase est fausse OU si les données sont altérées.
        const decrypted = await decryptJson<VaultData>(key, stored.envelope);
        keyRef.current = key;
        paramsRef.current = params;
        applyData(decrypted);
        applyRevision(stored.revision);
        applyBase(stored.baseRevision ?? 0);
        setCurrentEnvelope(stored.envelope);
        setUpdatedAt(stored.updatedAt);
        setStatus("unlocked");
      } finally {
        setBusy(false);
      }
    },
    [applyData, applyRevision, applyBase],
  );

  const update = useCallback(
    async (mutator: (draft: VaultData) => void) => {
      if (!dataRef.current) throw new Error("Coffre verrouillé.");
      const draft = clone(dataRef.current);
      mutator(draft);
      await persist(draft);
      applyData(draft);
      resetInactivity();
    },
    [persist, applyData, resetInactivity],
  );

  const exportBackup = useCallback(async () => {
    const key = keyRef.current;
    const params = paramsRef.current;
    if (!key || !params || !dataRef.current) throw new Error("Coffre verrouillé.");
    return createBackup(key, params, dataRef.current);
  }, []);

  const restoreFromBackup = useCallback(
    async (passphrase: string, file: BackupFile) => {
      setBusy(true);
      try {
        const restored = await restoreBackup(passphrase, file);
        const params = newKdfParams();
        const key = await deriveKey(passphrase, params);
        const envelope = await encryptJson(key, restored, params);
        const nextRev = revisionRef.current + 1;
        // base = 0 : contenu restauré à (re)synchroniser.
        const record = await saveStoredVault(envelope, nextRev, 0);
        keyRef.current = key;
        paramsRef.current = params;
        applyData(restored);
        applyRevision(record.revision);
        applyBase(0);
        setCurrentEnvelope(envelope);
        setUpdatedAt(record.updatedAt);
        setStatus("unlocked");
      } finally {
        setBusy(false);
      }
    },
    [applyData, applyRevision, applyBase],
  );

  const destroy = useCallback(async () => {
    await destroyStoredVault();
    clearTimer();
    wipeSecrets();
    applyRevision(0);
    applyBase(0);
    setCurrentEnvelope(null);
    setUpdatedAt(null);
    setStatus("empty");
  }, [clearTimer, wipeSecrets, applyRevision, applyBase]);

  // --- Primitives de synchronisation --------------------------------------

  const confirmSynced = useCallback(
    async (rev: number) => {
      await setStoredBaseRevision(rev);
      applyBase(rev);
    },
    [applyBase],
  );

  /**
   * Adopte une version distante : enregistre l'enveloppe, aligne révisions, et
   * — si le coffre est déverrouillé — rafraîchit les données déchiffrées. Si la
   * clé en mémoire ne peut pas déchiffrer (sel différent), reverrouille.
   */
  const applyRemote = useCallback(
    async (
      envelope: EncryptedEnvelope,
      rev: number,
    ): Promise<ApplyRemoteResult> => {
      await saveStoredVault(envelope, rev, rev);
      applyRevision(rev);
      applyBase(rev);
      setCurrentEnvelope(envelope);
      setUpdatedAt(Date.now());
      paramsRef.current = { salt: envelope.salt, iterations: envelope.iterations };

      if (keyRef.current) {
        try {
          const decrypted = await decryptJson<VaultData>(keyRef.current, envelope);
          applyData(decrypted);
          return "refreshed";
        } catch {
          lock();
          return "relocked";
        }
      }
      return "stored";
    },
    [applyRevision, applyBase, applyData, lock],
  );

  /**
   * Prépare l'écrasement du distant par la version locale (résolution de
   * conflit « garder local »). Nécessite le coffre déverrouillé.
   */
  const prepareConflictOverwrite = useCallback(
    async (remoteRevision: number) => {
      const key = keyRef.current;
      const params = paramsRef.current;
      if (!key || !params || !dataRef.current) {
        throw new Error("Déverrouillez le coffre pour résoudre le conflit.");
      }
      const nextRev = Math.max(revisionRef.current, remoteRevision) + 1;
      const envelope = await encryptJson(key, dataRef.current, params);
      await saveStoredVault(envelope, nextRev, baseRef.current);
      applyRevision(nextRev);
      setCurrentEnvelope(envelope);
      return { envelope, revision: nextRev };
    },
    [applyRevision],
  );

  const pendingChanges = revision > baseRevision;

  const value = useMemo<VaultContextValue>(
    () => ({
      status,
      data,
      revision,
      baseRevision,
      pendingChanges,
      currentEnvelope,
      updatedAt,
      busy,
      createVault,
      unlock,
      lock,
      update,
      exportBackup,
      restoreFromBackup,
      destroy,
      resetInactivity,
      confirmSynced,
      applyRemote,
      prepareConflictOverwrite,
    }),
    [
      status,
      data,
      revision,
      baseRevision,
      pendingChanges,
      currentEnvelope,
      updatedAt,
      busy,
      createVault,
      unlock,
      lock,
      update,
      exportBackup,
      restoreFromBackup,
      destroy,
      resetInactivity,
      confirmSynced,
      applyRemote,
      prepareConflictOverwrite,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault doit être utilisé dans <VaultProvider>.");
  return ctx;
}

export { DecryptionError };
