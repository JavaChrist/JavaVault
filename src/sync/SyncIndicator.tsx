// Indicateur de synchronisation (compact, pour l'en-tête).

import { useSync, type SyncStatus } from "./SyncContext";

const LABELS: Record<SyncStatus, string> = {
  unavailable: "Local",
  "signed-out": "Déconnecté",
  unauthorized: "Non autorisé",
  offline: "Hors ligne",
  syncing: "Synchronisation…",
  synced: "Synchronisé",
  conflict: "Conflit",
  error: "Erreur",
};

const COLORS: Partial<Record<SyncStatus, string>> = {
  synced: "var(--success)",
  conflict: "var(--warning)",
  error: "var(--danger)",
  unauthorized: "var(--danger)",
  syncing: "var(--accent)",
  unavailable: "var(--accent)",
};

// Le badge « en attente » n'a de sens que si une synchro distante est active.
const PENDING_RELEVANT: SyncStatus[] = ["offline", "synced", "syncing", "error"];

export function SyncIndicator() {
  const { status, pendingChanges } = useSync();
  const color = COLORS[status] ?? "var(--muted-2)";
  const label = LABELS[status];
  const showPending = pendingChanges && PENDING_RELEVANT.includes(status);

  return (
    <span
      className="sync-indicator"
      title={
        status === "unavailable"
          ? "Synchronisation non configurée (lot 2)"
          : label
      }
    >
      <span
        className="sync-dot"
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
      {showPending && (
        <span className="badge" style={{ marginLeft: "0.35rem" }}>
          en attente
        </span>
      )}
    </span>
  );
}
