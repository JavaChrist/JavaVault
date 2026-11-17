// Création / édition d'un projet.

import { useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmProvider";
import type { Project } from "@/vault/types";

export interface ProjectDraft {
  name: string;
  githubUrl: string;
  note: string;
  icon: string;
}

interface ProjectModalProps {
  initial?: Project;
  onClose: () => void;
  onSave: (draft: ProjectDraft) => void;
}

const ICON_SIZE = 512;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 Mo avant redimensionnement

/**
 * Charge une image et la redimensionne/recadre en carré 512×512 (couverture),
 * puis la renvoie en data URL (WebP, sinon PNG). Tout reste en mémoire : rien
 * n'est envoyé sur le réseau.
 */
async function toSquareIcon(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image invalide."));
    image.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Rendu de l'icône impossible.");
  // Recadrage « cover » : on garde le centre de l'image.
  const scale = Math.max(ICON_SIZE / img.width, ICON_SIZE / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (ICON_SIZE - dw) / 2;
  const dy = (ICON_SIZE - dh) / 2;
  ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
  ctx.drawImage(img, dx, dy, dw, dh);
  const webp = canvas.toDataURL("image/webp", 0.92);
  // Repli PNG si le navigateur ne sait pas exporter en WebP.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

export function ProjectModal({ initial, onClose, onSave }: ProjectModalProps) {
  const confirm = useConfirm();
  const [name, setName] = useState(initial?.name ?? "");
  const [githubUrl, setGithubUrl] = useState(initial?.githubUrl ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    name !== (initial?.name ?? "") ||
    githubUrl !== (initial?.githubUrl ?? "") ||
    note !== (initial?.note ?? "") ||
    icon !== (initial?.icon ?? "");

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

  const pickIcon = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Veuillez choisir un fichier image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image trop lourde (8 Mo maximum).");
      return;
    }
    setProcessing(true);
    try {
      const square = await toSquareIcon(file);
      setIcon(square);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Icône invalide.");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Le nom du projet est obligatoire.");
      return;
    }
    if (!initial && !icon) {
      setError("Veuillez téléverser une icône (redimensionnée en 512×512).");
      return;
    }
    onSave({ name: trimmed, githubUrl: githubUrl.trim(), note, icon });
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
        <label>Icône du projet (512×512)</label>
        <div className="icon-picker">
          <div className="icon-preview" aria-hidden={!icon}>
            {icon ? (
              <img src={icon} alt="" />
            ) : (
              <span className="icon-placeholder">
                {name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="icon-picker-actions">
            <input
              ref={fileRef}
              id="p-icon"
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void pickIcon(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
            >
              {processing
                ? "Traitement…"
                : icon
                  ? "Changer l'icône"
                  : "Téléverser une icône"}
            </button>
            <p className="muted text-sm">
              L'image est automatiquement recadrée et redimensionnée en 512×512.
            </p>
          </div>
        </div>
      </div>
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
