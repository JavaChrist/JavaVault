// Affichage d'une valeur secrète, masquée par défaut, avec bouton œil + copie.

import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { EyeIcon, EyeOffIcon } from "./icons";

interface SecretValueProps {
  value: string;
  /** Nom (non secret) utilisé pour les libellés d'accessibilité. */
  name?: string;
}

export function SecretValue({ value, name }: SecretValueProps) {
  const [revealed, setRevealed] = useState(false);
  const isMultiline = value.includes("\n");
  const masked = "•".repeat(Math.min(Math.max(value.length, 4), 24));

  return (
    <div className="secret-value">
      <pre className={`secret-content${revealed ? " revealed" : ""}`}>
        {revealed ? value : masked}
      </pre>
      <div className="secret-actions">
        <button
          type="button"
          className="btn-ghost btn-icon btn-sm"
          aria-pressed={revealed}
          aria-label={revealed ? "Masquer la valeur" : "Afficher la valeur"}
          title={revealed ? "Masquer" : "Afficher"}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <CopyButton
          value={value}
          label={name ? `Copier ${name}` : "Copier la valeur"}
        />
      </div>
      {isMultiline && (
        <span className="badge" style={{ marginLeft: "auto" }}>
          multiligne
        </span>
      )}
    </div>
  );
}
