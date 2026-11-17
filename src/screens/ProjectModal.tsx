// Création / édition d'un projet.

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmProvider";
import type { Project } from "@/vault/types";

export interface ProjectDraft {
  name: string;
  githubUrl: string;
  note: string;
}

interface ProjectModalProps {
  initial?: Project;
  onClose: () => void;
  onSave: (draft: ProjectDraft) => void;
}

export function ProjectModal({ initial, onClose, onSave }: ProjectModalProps) {
  const confirm = useConfirm();
  const [name, setName] = useState(initial?.name ?? "");
  const [githubUrl, setGithubUrl] = useState(initial?.githubUrl ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== (initial?.name ?? "") ||
    githubUrl !== (initial?.githubUrl ?? "") ||
    note !== (initial?.note ?? "");

  const requestClose = async () => {
    if (!dirty) return onClose();
    const ok = await confirm({
      title: "Abandonner les modifications ?",
      message: "Les changements non enregistrés seront perdus.",
      confirmLabel: "Abandonner",
      cancelLabel: "Continuer l'édition",
      danger: true,
    });
    if (ok) onClose();
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Le nom du projet est obligatoire.");
      return;
    }
    onSave({ name: trimmed, githubUrl: githubUrl.trim(), note });
  };

  return (
    <Modal
      title={initial ? "Modifier le projet" : "Nouveau projet"}
      onClose={requestClose}
      footer={
        <>
          <button type="button" onClick={requestClose}>
            Annuler
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            {initial ? "Enregistrer" : "Créer"}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="p-name">Nom du projet</label>
        <input
          id="p-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="ex. Cubelyo"
        />
      </div>
      <div className="field">
        <label htmlFor="p-github">Lien GitHub (facultatif)</label>
        <input
          id="p-github"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="https://github.com/…"
          inputMode="url"
        />
      </div>
      <div className="field">
        <label htmlFor="p-note">Note (facultatif)</label>
        <textarea
          id="p-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Contexte, rappels…"
        />
      </div>
      {error && <div className="inline-error">{error}</div>}
    </Modal>
  );
}
