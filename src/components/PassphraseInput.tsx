// Champ de phrase maître / mot de passe avec bouton œil.

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

interface PassphraseInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  onEnter?: () => void;
}

export function PassphraseInput({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete = "off",
  onEnter,
}: PassphraseInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="passphrase-input">
      <input
        id={id}
        type={revealed ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
      />
      <button
        type="button"
        className="btn-ghost btn-icon"
        aria-pressed={revealed}
        aria-label={revealed ? "Masquer" : "Afficher"}
        title={revealed ? "Masquer" : "Afficher"}
        onClick={() => setRevealed((v) => !v)}
      >
        {revealed ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
