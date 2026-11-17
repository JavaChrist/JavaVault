// Bouton de copie avec retour bref « Copié ».

import { copyText } from "@/utils/clipboard";
import { useToast } from "./ToastProvider";
import { CopyIcon } from "./icons";

interface CopyButtonProps {
  value: string;
  label?: string;
  /** Message de succès (par défaut « Copié »). */
  successMessage?: string;
  small?: boolean;
}

export function CopyButton({
  value,
  label,
  successMessage = "Copié",
  small = true,
}: CopyButtonProps) {
  const toast = useToast();

  const onClick = async () => {
    const ok = await copyText(value);
    if (ok) toast.show(successMessage, "success");
    else toast.show("Copie impossible sur ce navigateur.", "error");
  };

  return (
    <button
      type="button"
      className={`btn-ghost btn-icon${small ? " btn-sm" : ""}`}
      onClick={onClick}
      aria-label={label ?? "Copier"}
      title={label ?? "Copier"}
    >
      <CopyIcon />
    </button>
  );
}
