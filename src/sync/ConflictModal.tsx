// Résolution de conflit : choix explicite après déverrouillage.
// Les deux versions chiffrées sont conservées jusqu'au choix ; pas de fusion.

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { useSync } from "./SyncContext";

export function ConflictModal() {
  const { resolveConflict } = useSync();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const resolve = async (choice: "local" | "remote") => {
    setBusy(true);
    try {
      await resolveConflict(choice);
      toast.show(
        choice === "local"
          ? "Version de cet appareil conservée"
          : "Version distante adoptée",
        "success",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Conflit de synchronisation"
      maxWidth={520}
      dismissible={false}
      onClose={() => {
        /* non fermable : un choix est requis */
      }}
      footer={
        <>
          <button
            type="button"
            onClick={() => resolve("remote")}
            disabled={busy}
          >
            Garder la version distante
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => resolve("local")}
            disabled={busy}
          >
            Garder la version de cet appareil
          </button>
        </>
      }
    >
      <p style={{ lineHeight: 1.5 }}>
        Le coffre a été modifié à la fois sur cet appareil et ailleurs. Les deux
        versions chiffrées sont conservées. Choisissez celle à garder :
      </p>
      <div className="callout callout-warning text-sm">
        « Garder la version de cet appareil » écrase la version distante.
        « Garder la version distante » remplace vos modifications locales non
        synchronisées. Aucune fusion automatique n'est effectuée.
      </div>
    </Modal>
  );
}
