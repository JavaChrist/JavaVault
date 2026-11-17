// Création d'une rubrique simple (sans modèles ni règles personnalisables).

import { useState } from "react";
import { Modal } from "@/components/Modal";
import type { Rubric } from "@/vault/types";

interface RubricModalProps {
  existing: Rubric[];
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function RubricModal({ existing, onClose, onCreate }: RubricModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const r = name.trim();
    if (!r) {
      setError("Le nom de la rubrique est obligatoire.");
      return;
    }
    if (existing.some((x) => x.toLowerCase() === r.toLowerCase())) {
      setError("Cette rubrique existe déjà.");
      return;
    }
    onCreate(r);
  };

  return (
    <Modal
      title="Nouvelle rubrique"
      maxWidth={420}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            Créer
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="r-name">Nom de la rubrique</label>
        <input
          id="r-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          autoFocus
          placeholder="ex. Base de données"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </div>
      <p className="muted text-sm">
        Les rubriques sont communes à tout le coffre et apparaissent dans les
        filtres et à la création d'une entrée.
      </p>
      {error && <div className="inline-error">{error}</div>}
    </Modal>
  );
}
