// Réglages : état de synchronisation, version, verrouillage, réinitialisation.

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { PassphraseInput } from "@/components/PassphraseInput";
import { useVault } from "@/vault/VaultContext";
import { useSync } from "@/sync/SyncContext";
import { AUTHORIZED_UID } from "@/firebase/config";
import { APP_VERSION, BUILD_STAGE } from "@/config";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { lock, destroy, revision, updatedAt } = useVault();
  const sync = useSync();
  const confirm = useConfirm();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const doSignIn = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await sync.signIn(email.trim(), password);
      setPassword("");
      toast.show("Connecté", "success");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setAuthBusy(false);
    }
  };

  const doSignOut = async () => {
    await sync.signOutAccount();
    toast.show("Déconnecté", "info");
  };

  const onDestroy = async () => {
    const ok = await confirm({
      title: "Réinitialiser le coffre local",
      message: (
        <>
          <p>Supprime définitivement le coffre chiffré de cet appareil.</p>
          <div className="callout callout-danger">
            Sans export de secours, les données seront perdues. Action
            irréversible.
          </div>
        </>
      ),
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await destroy();
    toast.show("Coffre local supprimé", "info");
    onClose();
  };

  return (
    <Modal
      title="Réglages"
      maxWidth={480}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose}>
          Fermer
        </button>
      }
    >
      <div className="stack">
        <div className="kv">
          <b>Version</b>
          <span className="spacer" />
          <span className="muted">{APP_VERSION}</span>
        </div>
        <div className="kv">
          <b>Étape</b>
          <span className="spacer" />
          <span className="muted">{BUILD_STAGE}</span>
        </div>
        <div className="kv">
          <b>Révision locale</b>
          <span className="spacer" />
          <span className="muted">
            #{revision}
            {sync.pendingChanges ? " · modifs en attente" : ""}
            {updatedAt
              ? ` · ${new Date(updatedAt).toLocaleString("fr-FR")}`
              : ""}
          </span>
        </div>

        <div className="section-sep" />

        <h3 style={{ fontSize: "0.95rem" }}>Synchronisation</h3>
        {!sync.available ? (
          <div className="callout text-sm">
            Synchronisation non configurée. Renseignez la configuration Firebase
            publique (variables <span className="mono">VITE_FIREBASE_*</span>)
            pour activer la sauvegarde et la reprise entre appareils.
          </div>
        ) : !sync.account ? (
          <>
            <p className="muted text-sm">
              Connexion au stockage distant (indépendante du déverrouillage du
              coffre).
            </p>
            <div className="field">
              <label htmlFor="s-email">E-mail</label>
              <input
                id="s-email"
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
              />
            </div>
            <div className="field">
              <label htmlFor="s-pass">Mot de passe du compte</label>
              <PassphraseInput
                id="s-pass"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                placeholder="Mot de passe Firebase (pas la phrase maître)"
                onEnter={doSignIn}
              />
            </div>
            {authError && <div className="inline-error">{authError}</div>}
            <button className="btn-primary" onClick={doSignIn} disabled={authBusy}>
              Se connecter
            </button>
            <p className="muted text-sm">
              Le mot de passe du compte sert à la connexion distante. Il est
              différent de la phrase maître qui chiffre le coffre.
            </p>
          </>
        ) : (
          <>
            <div className="kv">
              <b>Compte</b>
              <span className="spacer" />
              <span className="muted">{sync.account.email ?? sync.account.uid}</span>
            </div>
            <div className="kv">
              <b>État</b>
              <span className="spacer" />
              <span className="sync-indicator">
                <span className="sync-dot local" /> {statusLabel(sync.status)}
              </span>
            </div>
            {!sync.authorized && (
              <div className="callout callout-danger text-sm">
                Ce compte n'est pas l'UID autorisé
                {AUTHORIZED_UID ? "" : " (VITE_AUTHORIZED_UID non défini)"}. La
                synchronisation est refusée.
              </div>
            )}
            {sync.error && (
              <div className="inline-error">{sync.error}</div>
            )}
            {sync.lastSyncedAt && (
              <p className="muted text-sm">
                Dernière synchro : {new Date(sync.lastSyncedAt).toLocaleString("fr-FR")}
              </p>
            )}
            <div className="row">
              <button onClick={sync.syncNow} disabled={!sync.authorized}>
                Synchroniser maintenant
              </button>
              <button className="btn-ghost" onClick={doSignOut}>
                Se déconnecter
              </button>
            </div>
          </>
        )}

        <div className="section-sep" />

        <button className="btn-primary" onClick={lock}>
          Verrouiller maintenant
        </button>
        <button className="btn-danger" onClick={onDestroy}>
          Réinitialiser le coffre local
        </button>
        <p className="muted text-sm">
          La synchronisation stocke le coffre <b>chiffré</b> : le serveur ne voit
          jamais vos secrets. Conservez tout de même un export de secours.
        </p>
      </div>
    </Modal>
  );
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    unavailable: "Non configurée",
    "signed-out": "Déconnecté",
    unauthorized: "Non autorisé",
    offline: "Hors ligne",
    syncing: "Synchronisation…",
    synced: "Synchronisé",
    conflict: "Conflit à résoudre",
    error: "Erreur",
  };
  return labels[status] ?? status;
}
