// Création / édition d'une entrée (clé, variable, document JSON…).

import { useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmProvider";
import { classifyJson, classifyName } from "@/vault/classify";
import { readFileAsText } from "@/utils/download";
import type { EntryKind, Rubric, VaultEntry } from "@/vault/types";

export interface EntryDraft {
  name: string;
  value: string;
  rubric: Rubric;
  kind: EntryKind;
  note: string;
  /** Nom du fichier joint (documents JSON / fichiers), utilisé au téléchargement. */
  fileName: string;
}

interface EntryModalProps {
  rubrics: Rubric[];
  initial?: VaultEntry;
  defaultRubric?: Rubric;
  onClose: () => void;
  onSave: (draft: EntryDraft) => void;
  onAddRubric: (name: string) => void;
}

const NEW_RUBRIC = "__new__";

export function EntryModal({
  rubrics,
  initial,
  defaultRubric,
  onClose,
  onSave,
  onAddRubric,
}: EntryModalProps) {
  const confirm = useConfirm();
  const [name, setName] = useState(initial?.name ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [rubric, setRubric] = useState<Rubric>(
    initial?.rubric ?? defaultRubric ?? rubrics[0] ?? "Autres",
  );
  const [kind, setKind] = useState<EntryKind>(initial?.kind ?? "value");
  const [note, setNote] = useState(initial?.note ?? "");
  const [fileName, setFileName] = useState(initial?.fileName ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newRubric, setNewRubric] = useState("");
  const [addingRubric, setAddingRubric] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Suggestion automatique de rubrique tant que l'utilisateur n'a pas choisi.
  const [rubricTouched, setRubricTouched] = useState(Boolean(initial));

  const dirty =
    name !== (initial?.name ?? "") ||
    value !== (initial?.value ?? "") ||
    note !== (initial?.note ?? "") ||
    fileName !== (initial?.fileName ?? "") ||
    rubric !== (initial?.rubric ?? defaultRubric ?? rubrics[0] ?? "Autres") ||
    kind !== (initial?.kind ?? "value");

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

  const onNameBlur = () => {
    if (!rubricTouched && name.trim()) {
      setRubric(classifyName(name.trim()));
    }
  };

  const onRubricChange = (val: string) => {
    if (val === NEW_RUBRIC) {
      setAddingRubric(true);
      return;
    }
    setRubricTouched(true);
    setRubric(val);
  };

  const confirmNewRubric = () => {
    const r = newRubric.trim();
    if (!r) return;
    onAddRubric(r);
    setRubric(r);
    setRubricTouched(true);
    setAddingRubric(false);
    setNewRubric("");
  };

  // Joindre un fichier : remplit le contenu (octets exacts en UTF-8) et retient
  // son nom. Lecture locale uniquement, rien n'est envoyé.
  const onPickFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      setValue(text);
      setFileName(file.name);
      if (!name.trim()) setName(file.name);
      if (!rubricTouched) {
        setRubric(
          kind === "json" ? classifyJson(file.name, text) : classifyName(file.name),
        );
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture du fichier impossible.");
    }
  };

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (!value) {
      setError("La valeur ou le contenu est obligatoire.");
      return;
    }
    onSave({ name: trimmedName, value, rubric, kind, note, fileName: fileName.trim() });
  };

  return (
    <Modal
      title={initial ? "Modifier l'entrée" : "Nouvelle entrée"}
      onClose={requestClose}
      footer={
        <>
          <button type="button" onClick={requestClose}>
            Annuler
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            {initial ? "Enregistrer" : "Ajouter"}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="e-name">Nom exact</label>
        <input
          id="e-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={onNameBlur}
          autoFocus
          spellCheck={false}
          placeholder="ex. FIREBASE_API_KEY"
          className="mono"
        />
      </div>

      <div className="row" style={{ gap: "0.75rem", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label htmlFor="e-rubric">Rubrique</label>
          {addingRubric ? (
            <div className="row">
              <input
                value={newRubric}
                onChange={(e) => setNewRubric(e.target.value)}
                placeholder="Nom de la rubrique"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && confirmNewRubric()}
              />
              <button type="button" className="btn-sm" onClick={confirmNewRubric}>
                OK
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setAddingRubric(false)}
              >
                ✕
              </button>
            </div>
          ) : (
            <select
              id="e-rubric"
              value={rubric}
              onChange={(e) => onRubricChange(e.target.value)}
            >
              {rubrics.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value={NEW_RUBRIC}>+ Nouvelle rubrique…</option>
            </select>
          )}
        </div>
        <div className="field" style={{ width: 150, marginBottom: 0 }}>
          <label htmlFor="e-kind">Type</label>
          <select
            id="e-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as EntryKind)}
          >
            <option value="value">Valeur / clé</option>
            <option value="json">Document JSON</option>
            {initial?.kind === "file" && <option value="file">Fichier texte</option>}
          </select>
        </div>
      </div>

      {kind !== "value" && (
        <div className="row" style={{ gap: "0.75rem", marginTop: "0.9rem", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="e-file">Fichier</label>
            <input
              ref={fileInputRef}
              id="e-file"
              type="file"
              hidden
              accept={kind === "json" ? ".json,application/json" : undefined}
              onChange={(e) => {
                onPickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              style={{ width: "100%" }}
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? "Remplacer le fichier…" : "Choisir un fichier…"}
            </button>
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="e-filename">Nom du fichier</label>
            <input
              id="e-filename"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              spellCheck={false}
              placeholder={kind === "json" ? "service-account.json" : "config.yml"}
              className="mono"
            />
          </div>
        </div>
      )}

      <div className="field" style={{ marginTop: "0.9rem" }}>
        <label htmlFor="e-value">
          {kind === "json"
            ? "Contenu JSON (ou collez-le)"
            : kind === "file"
              ? "Contenu du fichier"
              : "Valeur ou contenu"}
        </label>
        <textarea
          id="e-value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          placeholder={
            kind === "json"
              ? '{ "type": "service_account", … }'
              : "Clés multilignes, guillemets et caractères spéciaux préservés."
          }
          style={{ minHeight: kind === "value" ? 110 : 160 }}
        />
      </div>

      <div className="field">
        <label htmlFor="e-note">Note (facultatif)</label>
        <textarea
          id="e-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="À quoi sert cette entrée ?"
          style={{ minHeight: 70 }}
        />
      </div>

      {error && <div className="inline-error">{error}</div>}
    </Modal>
  );
}
