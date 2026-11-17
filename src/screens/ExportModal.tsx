// Export : .env en clair (action explicite + rappel secrets), téléchargement des
// originaux importés (octets exacts), et export de secours chiffré du coffre.

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { DownloadIcon } from "@/components/icons";
import { serializeEnv } from "@/vault/envSerialize";
import { downloadText } from "@/utils/download";
import type { Project } from "@/vault/types";
import type { BackupFile } from "@/vault/backup";

interface ExportModalProps {
  project: Project;
  onClose: () => void;
  onExportBackup: () => Promise<BackupFile>;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours(),
  )}${p(d.getMinutes())}`;
}

export function ExportModal({ project, onClose, onExportBackup }: ExportModalProps) {
  const confirm = useConfirm();
  const toast = useToast();

  const valueEntries = useMemo(
    () => project.entries.filter((e) => e.kind === "value"),
    [project.entries],
  );
  const rubrics = useMemo(
    () => Array.from(new Set(valueEntries.map((e) => e.rubric))),
    [valueEntries],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(rubrics));

  const toggleRubric = (r: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const chosen = valueEntries.filter((e) => selected.has(e.rubric));

  const exportEnv = async () => {
    if (chosen.length === 0) {
      toast.show("Aucune variable sélectionnée.", "error");
      return;
    }
    const ok = await confirm({
      title: "Exporter en clair",
      message: (
        <div className="callout callout-danger">
          Ce fichier contiendra {chosen.length} secret(s) <b>en clair</b>.
          Manipulez-le avec précaution et supprimez-le après usage.
        </div>
      ),
      confirmLabel: "Télécharger quand même",
      danger: true,
    });
    if (!ok) return;
    const content = serializeEnv(chosen.map((e) => ({ name: e.name, value: e.value })));
    downloadText(".env.local", content, "text/plain;charset=utf-8");
    toast.show("Export .env téléchargé", "success");
  };

  const exportBackup = async () => {
    try {
      const file = await onExportBackup();
      downloadText(
        `javavault-secours-${timestamp()}.json`,
        JSON.stringify(file, null, 2),
        "application/json",
      );
      toast.show("Export de secours chiffré téléchargé", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Export impossible.", "error");
    }
  };

  const downloadOriginal = (fileName: string, content: string, kind: string) => {
    downloadText(
      fileName,
      content,
      kind === "json" ? "application/json" : "text/plain;charset=utf-8",
    );
    toast.show("Original téléchargé", "success");
  };

  return (
    <Modal
      title={`Exporter — ${project.name}`}
      maxWidth={620}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose}>
          Fermer
        </button>
      }
    >
      <section>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
          Export .env.local (en clair)
        </h3>
        {valueEntries.length === 0 ? (
          <p className="muted text-sm">Aucune variable de type « valeur » à exporter.</p>
        ) : (
          <>
            <p className="muted text-sm" style={{ marginBottom: "0.6rem" }}>
              Choisissez les rubriques à inclure :
            </p>
            <div className="rubric-filter">
              {rubrics.map((r) => (
                <button
                  key={r}
                  className="chip"
                  aria-pressed={selected.has(r)}
                  onClick={() => toggleRubric(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={exportEnv}>
              <span className="row" style={{ gap: "0.4rem" }}>
                <DownloadIcon /> Télécharger .env ({chosen.length})
              </span>
            </button>
          </>
        )}
      </section>

      <div className="section-sep" />

      <section>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
          Originaux importés
        </h3>
        {project.originals.length === 0 ? (
          <p className="muted text-sm">
            Aucun original conservé pour ce projet.
          </p>
        ) : (
          <div className="stack">
            {project.originals.map((o) => (
              <div key={o.id} className="row preview-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <div>
                  <div className="preview-name">{o.fileName}</div>
                  <div className="text-sm muted">
                    {(o.kind === "file"
                      ? o.fileName.split(".").pop()?.toUpperCase() || "FICHIER"
                      : o.kind.toUpperCase())}{" "}
                    · importé le{" "}
                    {new Date(o.importedAt).toLocaleString("fr-FR")}
                  </div>
                </div>
                <button
                  className="btn-sm"
                  onClick={() => downloadOriginal(o.fileName, o.content, o.kind)}
                >
                  <span className="row" style={{ gap: "0.35rem" }}>
                    <DownloadIcon /> Original exact
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="section-sep" />

      <section>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
          Export de secours (chiffré, tout le coffre)
        </h3>
        <p className="muted text-sm" style={{ marginBottom: "0.6rem" }}>
          Fichier chiffré avec votre phrase maître, restaurable sur un navigateur
          neuf. À conserver en lieu sûr.
        </p>
        <button className="btn-primary" onClick={exportBackup}>
          <span className="row" style={{ gap: "0.4rem" }}>
            <DownloadIcon /> Télécharger l'export de secours
          </span>
        </button>
      </section>
    </Modal>
  );
}
