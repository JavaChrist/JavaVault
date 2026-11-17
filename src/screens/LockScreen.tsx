// Écran de verrouillage : création du coffre, déverrouillage, ou restauration.
// Sépare clairement « déverrouiller » de toute notion de compte distant.

import { useState } from "react";
import { PassphraseInput } from "@/components/PassphraseInput";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { DecryptionError, useVault } from "@/vault/VaultContext";
import { assertBackupFile, type BackupFile } from "@/vault/backup";
import { readFileAsText } from "@/utils/download";
import { APP_VERSION } from "@/config";

type Mode = "unlock" | "create" | "restore";

const MIN_LENGTH = 10;

export function LockScreen() {
  const { status, createVault, unlock, restoreFromBackup, destroy, busy } =
    useVault();
  const confirm = useConfirm();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(status === "empty" ? "create" : "unlock");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [backup, setBackup] = useState<BackupFile | null>(null);
  const [backupName, setBackupName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPassphrase("");
    setConfirmPhrase("");
    setError(null);
  };

  const onCreate = async () => {
    setError(null);
    if (passphrase.length < MIN_LENGTH) {
      setError(`La phrase maître doit faire au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (passphrase !== confirmPhrase) {
      setError("Les deux saisies ne correspondent pas.");
      return;
    }
    const ok = await confirm({
      title: "Créer le coffre",
      message: (
        <>
          <p>
            Votre phrase maître chiffre tout le coffre. <b>Elle n'est jamais
            envoyée nulle part</b> et ne peut pas être récupérée si vous
            l'oubliez.
          </p>
          <p className="muted">
            Aucune récupération administrateur, aucune clé cachée. Prévoyez un
            export de secours chiffré une fois le coffre créé.
          </p>
        </>
      ),
      confirmLabel: "J'ai compris, créer",
    });
    if (!ok) return;
    try {
      await createVault(passphrase);
      reset();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const onUnlock = async () => {
    setError(null);
    try {
      await unlock(passphrase);
      reset();
    } catch (e) {
      if (e instanceof DecryptionError) {
        setError("Phrase maître incorrecte. Aucun contenu n'a été révélé.");
      } else {
        setError(messageOf(e));
      }
    }
  };

  const onPickBackup = async (file: File | null) => {
    setError(null);
    setBackup(null);
    setBackupName("");
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text) as unknown;
      assertBackupFile(parsed);
      setBackup(parsed);
      setBackupName(file.name);
    } catch (e) {
      setError(messageOf(e, "Fichier de secours illisible."));
    }
  };

  const onRestore = async () => {
    setError(null);
    if (!backup) {
      setError("Choisissez d'abord un fichier de secours.");
      return;
    }
    try {
      await restoreFromBackup(passphrase, backup);
      toast.show("Coffre restauré", "success");
      reset();
    } catch (e) {
      if (e instanceof DecryptionError) {
        setError("Phrase maître incorrecte pour ce fichier de secours.");
      } else {
        setError(messageOf(e));
      }
    }
  };

  const onDestroy = async () => {
    const ok = await confirm({
      title: "Réinitialiser le coffre local",
      message: (
        <>
          <p>
            Cette action supprime définitivement le coffre chiffré stocké sur cet
            appareil.
          </p>
          <div className="callout callout-danger">
            Sans export de secours ni synchronisation, les données seront
            perdues. Cette opération ne peut pas être annulée.
          </div>
        </>
      ),
      confirmLabel: "Supprimer le coffre local",
      danger: true,
    });
    if (!ok) return;
    await destroy();
    setMode("create");
    reset();
    toast.show("Coffre local supprimé", "info");
  };

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="brand">
          <img src="/icons/logo-192.png" alt="" />
          <h1>JavaVault</h1>
          <p className="muted text-sm">
            {status === "empty"
              ? "Créez votre coffre personnel chiffré."
              : "Coffre verrouillé — entrez votre phrase maître."}
          </p>
        </div>

        {mode === "create" && (
          <div className="stack">
            <div className="field">
              <label htmlFor="new-phrase">Phrase maître</label>
              <PassphraseInput
                id="new-phrase"
                value={passphrase}
                onChange={setPassphrase}
                placeholder="Au moins 10 caractères"
                autoFocus
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-phrase">Confirmer la phrase maître</label>
              <PassphraseInput
                id="confirm-phrase"
                value={confirmPhrase}
                onChange={setConfirmPhrase}
                placeholder="Ressaisissez la phrase"
                autoComplete="new-password"
                onEnter={onCreate}
              />
            </div>
            <div className="callout callout-warning text-sm">
              Une phrase maître oubliée ne peut pas être récupérée. Conservez-la
              en lieu sûr et faites un export de secours.
            </div>
            {error && <div className="inline-error">{error}</div>}
            <button className="btn-primary" onClick={onCreate} disabled={busy}>
              Créer le coffre
            </button>
          </div>
        )}

        {mode === "unlock" && (
          <div className="stack">
            <div className="field">
              <label htmlFor="phrase">Phrase maître</label>
              <PassphraseInput
                id="phrase"
                value={passphrase}
                onChange={setPassphrase}
                placeholder="Votre phrase maître"
                autoFocus
                autoComplete="current-password"
                onEnter={onUnlock}
              />
            </div>
            {error && <div className="inline-error">{error}</div>}
            <button className="btn-primary" onClick={onUnlock} disabled={busy}>
              Déverrouiller
            </button>
          </div>
        )}

        {mode === "restore" && (
          <div className="stack">
            <div className="field">
              <label htmlFor="backup-file">Fichier de secours (.json)</label>
              <input
                id="backup-file"
                type="file"
                accept="application/json,.json"
                onChange={(e) => onPickBackup(e.target.files?.[0] ?? null)}
              />
              {backupName && (
                <p className="text-sm muted" style={{ marginTop: "0.4rem" }}>
                  Sélectionné : {backupName}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="restore-phrase">Phrase maître du secours</label>
              <PassphraseInput
                id="restore-phrase"
                value={passphrase}
                onChange={setPassphrase}
                placeholder="Phrase maître d'origine"
                autoComplete="current-password"
                onEnter={onRestore}
              />
            </div>
            {error && <div className="inline-error">{error}</div>}
            <button
              className="btn-primary"
              onClick={onRestore}
              disabled={busy || !backup}
            >
              Restaurer le coffre
            </button>
          </div>
        )}

        <div className="section-sep" />

        <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          {mode !== "unlock" && status === "locked" && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setMode("unlock");
                reset();
              }}
            >
              Déverrouiller
            </button>
          )}
          {mode !== "create" && status === "empty" && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setMode("create");
                reset();
              }}
            >
              Créer un coffre
            </button>
          )}
          {mode !== "restore" && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setMode("restore");
                reset();
              }}
            >
              Restaurer un secours
            </button>
          )}
          <div className="spacer" />
          {status === "locked" && (
            <button className="btn-ghost btn-sm" onClick={onDestroy}>
              Réinitialiser
            </button>
          )}
        </div>

        <p
          className="muted text-sm"
          style={{ textAlign: "center", marginTop: "1rem" }}
        >
          Version {APP_VERSION}
        </p>
      </div>
    </div>
  );
}

function messageOf(e: unknown, fallback = "Une erreur est survenue."): string {
  return e instanceof Error ? e.message : fallback;
}
