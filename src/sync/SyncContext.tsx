/* eslint-disable react-refresh/only-export-components */
// Orchestrateur de synchronisation.
//
// Sépare nettement :
// - la CONNEXION au stockage distant (Firebase Auth), et
// - le DÉVERROUILLAGE du coffre (phrase maître, géré par VaultContext).
//
// Accès réservé à l'UID autorisé (contrôle client + règles serveur). Le coffre
// est synchronisé chiffré ; contrôle de révision transactionnel ; en conflit,
// les deux versions chiffrées sont conservées et l'utilisateur choisit.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  AUTHORIZED_UID,
  getAuthInstance,
  isFirebaseConfigured,
} from "@/firebase/config";
import {
  RemoteConflictError,
  pushRemote,
  readRemote,
  subscribeRemote,
  type RemoteVault,
} from "./remote";
import { useVault } from "@/vault/VaultContext";

export type SyncStatus =
  | "unavailable" // Firebase non configuré
  | "signed-out"
  | "unauthorized"
  | "offline"
  | "syncing"
  | "synced"
  | "conflict"
  | "error";

export interface SyncAccount {
  uid: string;
  email: string | null;
}

interface SyncContextValue {
  available: boolean;
  status: SyncStatus;
  account: SyncAccount | null;
  authorized: boolean;
  error: string | null;
  pendingChanges: boolean;
  lastSyncedAt: number | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutAccount: () => Promise<void>;
  syncNow: () => void;
  resolveConflict: (choice: "local" | "remote") => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const vault = useVault();
  const {
    revision,
    baseRevision,
    currentEnvelope,
    pendingChanges,
    confirmSynced,
    applyRemote,
    prepareConflictOverwrite,
  } = vault;

  const [account, setAccount] = useState<SyncAccount | null>(null);
  const [status, setStatus] = useState<SyncStatus>(
    isFirebaseConfigured ? "signed-out" : "unavailable",
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const remoteRef = useRef<RemoteVault | null>(null);
  const conflictRemoteRef = useRef<RemoteVault | null>(null);
  const reconcilingRef = useRef(false);
  const authorized = Boolean(
    account && AUTHORIZED_UID && account.uid === AUTHORIZED_UID,
  );

  // --- Auth ----------------------------------------------------------------

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onAuthStateChanged(getAuthInstance(), (user: User | null) => {
      if (user) {
        setAccount({ uid: user.uid, email: user.email });
        if (AUTHORIZED_UID && user.uid !== AUTHORIZED_UID) {
          setStatus("unauthorized");
        }
      } else {
        setAccount(null);
        remoteRef.current = null;
        conflictRemoteRef.current = null;
        setStatus("signed-out");
      }
    });
    return unsub;
  }, []);

  // --- Suivi réseau --------------------------------------------------------

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // --- Réconciliation ------------------------------------------------------

  const reconcile = useCallback(async () => {
    if (!authorized || reconcilingRef.current) return;
    if (!isOnline) {
      setStatus("offline");
      return;
    }
    const uid = account!.uid;
    const remote = remoteRef.current;
    const localEnvelope = currentEnvelope;

    reconcilingRef.current = true;
    setStatus("syncing");
    setError(null);
    try {
      // Pas de coffre local : adopter le distant s'il existe.
      if (!localEnvelope) {
        if (remote) {
          await applyRemote(remote.envelope, remote.revision);
          setLastSyncedAt(Date.now());
        }
        setStatus("synced");
        return;
      }

      // Pas de distant : premier envoi.
      if (!remote) {
        await pushRemote(uid, localEnvelope, revision, 0);
        await confirmSynced(revision);
        setLastSyncedAt(Date.now());
        setStatus("synced");
        return;
      }

      const remoteRev = remote.revision;
      const pendingLocal = revision > baseRevision;
      const remoteAhead = remoteRev > baseRevision;

      if (!pendingLocal && remoteAhead) {
        // Le distant est en avance et rien de local en attente → tirer.
        await applyRemote(remote.envelope, remoteRev);
        setLastSyncedAt(Date.now());
        setStatus("synced");
        return;
      }

      if (pendingLocal && !remoteAhead) {
        // Modifications locales, distant inchangé → pousser. Un
        // RemoteConflictError éventuel est traité par le catch global.
        await pushRemote(uid, localEnvelope, revision, baseRevision);
        await confirmSynced(revision);
        setLastSyncedAt(Date.now());
        setStatus("synced");
        return;
      }

      if (pendingLocal && remoteAhead) {
        // Divergence : conflit, on conserve les deux versions chiffrées.
        conflictRemoteRef.current = remote;
        setStatus("conflict");
        return;
      }

      // Tout aligné.
      setStatus("synced");
    } catch (e) {
      // Tout conflit de révision (y compris premier envoi ou course avec
      // l'abonnement temps réel) doit mener au CHOIX, pas à une erreur morte.
      if (e instanceof RemoteConflictError) {
        try {
          const fresh = await readRemote(uid);
          remoteRef.current = fresh;
          conflictRemoteRef.current = fresh;
          if (fresh) {
            setStatus("conflict");
          } else {
            // Le distant a disparu entre-temps : on retentera au prochain cycle.
            setError("Le coffre distant est momentanément indisponible.");
            setStatus("error");
          }
        } catch {
          setError("Impossible de relire le coffre distant.");
          setStatus("error");
        }
      } else {
        setError(e instanceof Error ? e.message : "Erreur de synchronisation.");
        setStatus("error");
      }
    } finally {
      reconcilingRef.current = false;
    }
  }, [
    authorized,
    isOnline,
    account,
    currentEnvelope,
    revision,
    baseRevision,
    applyRemote,
    confirmSynced,
  ]);

  // Abonnement temps réel au document distant quand autorisé.
  useEffect(() => {
    if (!authorized || !account) return;
    setStatus("syncing");
    const unsub = subscribeRemote(
      account.uid,
      (remote) => {
        remoteRef.current = remote;
        void reconcile();
      },
      (err) => {
        setError(err.message);
        setStatus("error");
      },
    );
    return unsub;
  }, [authorized, account, reconcile]);

  // Re-réconcilier quand l'état local ou le réseau change.
  useEffect(() => {
    if (authorized) void reconcile();
  }, [authorized, revision, baseRevision, currentEnvelope, isOnline, reconcile]);

  // --- Actions utilisateur -------------------------------------------------

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(getAuthInstance(), email, password);
    } catch (e) {
      setError(mapAuthError(e));
      throw new Error(mapAuthError(e));
    }
  }, []);

  const signOutAccount = useCallback(async () => {
    await signOut(getAuthInstance());
  }, []);

  const syncNow = useCallback(() => {
    void reconcile();
  }, [reconcile]);

  const resolveConflict = useCallback(
    async (choice: "local" | "remote") => {
      const remote = conflictRemoteRef.current;
      if (!remote || !account) return;
      reconcilingRef.current = true;
      setStatus("syncing");
      setError(null);
      try {
        if (choice === "remote") {
          await applyRemote(remote.envelope, remote.revision);
        } else {
          const { envelope, revision: newRev } =
            await prepareConflictOverwrite(remote.revision);
          await pushRemote(account.uid, envelope, newRev, remote.revision);
          await confirmSynced(newRev);
        }
        conflictRemoteRef.current = null;
        setLastSyncedAt(Date.now());
        setStatus("synced");
      } catch (e) {
        if (e instanceof RemoteConflictError) {
          // Le distant a encore changé pendant la résolution : relire et
          // redemander un choix plutôt que de rester bloqué en erreur.
          try {
            const fresh = await readRemote(account.uid);
            remoteRef.current = fresh;
            conflictRemoteRef.current = fresh;
            setStatus(fresh ? "conflict" : "error");
            if (!fresh) setError("Le coffre distant est momentanément indisponible.");
          } catch {
            setError("Impossible de relire le coffre distant.");
            setStatus("error");
          }
        } else {
          setError(e instanceof Error ? e.message : "Résolution impossible.");
          setStatus("error");
        }
      } finally {
        reconcilingRef.current = false;
      }
    },
    [account, applyRemote, prepareConflictOverwrite, confirmSynced],
  );

  const value: SyncContextValue = {
    available: isFirebaseConfigured,
    status,
    account,
    authorized,
    error,
    pendingChanges,
    lastSyncedAt,
    signIn,
    signOutAccount,
    syncNow,
    resolveConflict,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync doit être utilisé dans <SyncProvider>.");
  return ctx;
}

function mapAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "Adresse e-mail invalide.";
    case "auth/user-disabled":
      return "Ce compte est désactivé.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Identifiants incorrects.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessayez plus tard.";
    case "auth/network-request-failed":
      return "Échec réseau : vérifiez votre connexion.";
    default:
      return "Connexion impossible.";
  }
}
