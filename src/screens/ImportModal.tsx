// Import .env / JSON : analyse et classement SUR L'APPAREIL (aucune IA, aucun
// appel externe). Aperçu masqué, doublons signalés, aucun écrasement silencieux.

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { parseEnv } from "@/vault/envParser";
import { classifyJson, classifyName } from "@/vault/classify";
import type { EntryKind, Rubric } from "@/vault/types";
import { MAX_ATTACHMENT_BYTES, readFileAsText } from "@/utils/download";

export interface ImportedEntry {
  name: string;
  value: string;
  rubric: Rubric;
  kind: EntryKind;
  fileName?: string;
  replaceExisting: boolean;
}

export interface ImportPayload {
  entries: ImportedEntry[];
  original: { kind: "env" | "json" | "file"; fileName: string; content: string };
}

interface ImportModalProps {
  rubrics: Rubric[];
  existingNames: Set<string>;
  onClose: () => void;
  onConfirm: (payload: ImportPayload) => void;
}

type Tab = "env" | "json";
type RowAction = "import" | "skip" | "replace";

interface EnvRow {
  name: string;
  value: string;
  rubric: Rubric;
  isDuplicate: boolean;
  action: RowAction;
}

export function ImportModal({
  rubrics,
  existingNames,
  onClose,
  onConfirm,
}: ImportModalProps) {
  const [tab, setTab] = useState<Tab>("env");

  // --- Entrée brute ---
  const [envText, setEnvText] = useState("");
  const [envFileName, setEnvFileName] = useState(".env.local");
  const [jsonText, setJsonText] = useState("");
  const [jsonFileName, setJsonFileName] = useState("document.txt");

  const [revealAll, setRevealAll] = useState(false);
  const [rows, setRows] = useState<EnvRow[] | null>(null);
  const [envErrors, setEnvErrors] = useState<
    { line: number; message: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const onPickFile = async (
    file: File | null,
    setText: (v: string) => void,
    setName: (v: string) => void,
  ) => {
    if (!file) return;
    try {
      const text = await readFileAsText(file, MAX_ATTACHMENT_BYTES);
      setText(text);
      setName(file.name);
      setRows(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture impossible.");
    }
  };

  const analyzeEnv = () => {
    setError(null);
    const { vars, errors } = parseEnv(envText);
    if (vars.length === 0 && errors.length === 0) {
      setError("Aucune variable détectée dans le contenu fourni.");
      return;
    }
    const seen = new Set<string>();
    const nextRows: EnvRow[] = vars.map((v) => {
      const isDuplicate = existingNames.has(v.name) || seen.has(v.name);
      seen.add(v.name);
      return {
        name: v.name,
        value: v.value,
        rubric: classifyName(v.name),
        isDuplicate,
        // Par défaut : importer les nouvelles ; pour un doublon, ne rien écraser
        // tant que l'utilisateur ne choisit pas explicitement « Remplacer ».
        action: isDuplicate ? "skip" : "import",
      };
    });
    setRows(nextRows);
    setEnvErrors(errors.map((e) => ({ line: e.line, message: e.message })));
  };

  const updateRow = (index: number, patch: Partial<EnvRow>) => {
    setRows((prev) =>
      prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev,
    );
  };

  const selectedCount = useMemo(
    () => rows?.filter((r) => r.action !== "skip").length ?? 0,
    [rows],
  );

  const confirmEnv = () => {
    if (!rows) return;
    const entries: ImportedEntry[] = rows
      .filter((r) => r.action !== "skip")
      .map((r) => ({
        name: r.name,
        value: r.value,
        rubric: r.rubric,
        kind: "value" as const,
        replaceExisting: r.action === "replace",
      }));
    if (entries.length === 0) {
      setError("Aucune variable sélectionnée à importer.");
      return;
    }
    onConfirm({
      entries,
      original: { kind: "env", fileName: envFileName || ".env.local", content: envText },
    });
  };

  // --- JSON ---
  const jsonRubric = useMemo(
    () => (jsonText ? classifyJson(jsonFileName, jsonText) : "Autres"),
    [jsonFileName, jsonText],
  );
  const [jsonRubricChoice, setJsonRubricChoice] = useState<Rubric | null>(null);
  const jsonValid = useMemo(() => {
    if (!jsonText.trim()) return null;
    try {
      JSON.parse(jsonText);
      return true;
    } catch {
      return false;
    }
  }, [jsonText]);

  // Un document est considéré « JSON » si son nom finit par .json ou si son
  // contenu est un JSON valide ; sinon c'est un fichier générique conservé tel quel.
  const looksJson = useMemo(
    () => /\.json$/i.test(jsonFileName.trim()) || jsonValid === true,
    [jsonFileName, jsonValid],
  );

  const confirmJson = () => {
    setError(null);
    if (!jsonText.trim()) {
      setError("Collez ou choisissez un fichier.");
      return;
    }
    const name = jsonFileName.trim() || "document.txt";
    const rubric = jsonRubricChoice ?? jsonRubric;
    const replaceExisting = existingNames.has(name);
    const kind = looksJson ? "json" : "file";
    onConfirm({
      entries: [
        { name, value: jsonText, rubric, kind, fileName: name, replaceExisting },
      ],
      original: { kind, fileName: name, content: jsonText },
    });
  };

  return (
    <Modal
      title="Importer"
      maxWidth={680}
      onClose={onClose}
      footer={
        tab === "env" ? (
          rows ? (
            <>
              <button type="button" onClick={() => setRows(null)}>
                Retour
              </button>
              <button type="button" className="btn-primary" onClick={confirmEnv}>
                Importer {selectedCount} variable(s)
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={analyzeEnv}
                disabled={!envText.trim()}
              >
                Analyser
              </button>
            </>
          )
        ) : (
          <>
            <button type="button" onClick={onClose}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={confirmJson}
              disabled={!jsonText.trim()}
            >
              Importer le document
            </button>
          </>
        )
      }
    >
      <div className="rubric-filter" role="tablist">
        <button
          className="chip"
          aria-pressed={tab === "env"}
          onClick={() => setTab("env")}
        >
          Fichier .env
        </button>
        <button
          className="chip"
          aria-pressed={tab === "json"}
          onClick={() => setTab("json")}
        >
          Document / fichier
        </button>
      </div>

      {tab === "env" && !rows && (
        <div className="stack">
          <div className="field">
            <label htmlFor="env-file">Fichier .env.local</label>
            <input
              id="env-file"
              type="file"
              accept=".env,.local,text/plain,*/*"
              onChange={(e) =>
                onPickFile(e.target.files?.[0] ?? null, setEnvText, setEnvFileName)
              }
            />
          </div>
          <div className="field">
            <label htmlFor="env-text">… ou collez le contenu</label>
            <textarea
              id="env-text"
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              spellCheck={false}
              placeholder={"FIREBASE_API_KEY=...\nSUPABASE_URL=...\n"}
              style={{ minHeight: 160 }}
            />
          </div>
          <p className="muted text-sm">
            L'analyse est locale : aucun envoi réseau, aucune interprétation shell.
          </p>
          {error && <div className="inline-error">{error}</div>}
        </div>
      )}

      {tab === "env" && rows && (
        <div className="stack">
          <div className="row">
            <span className="muted text-sm">
              {rows.length} variable(s) — doublons signalés en jaune.
            </span>
            <div className="spacer" />
            <button
              className="btn-ghost btn-sm btn-icon"
              aria-pressed={revealAll}
              title={revealAll ? "Masquer les valeurs" : "Afficher les valeurs"}
              onClick={() => setRevealAll((v) => !v)}
            >
              {revealAll ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          <div className="preview-table">
            {rows.map((row, i) => (
              <div
                key={`${row.name}-${i}`}
                className={`preview-row${row.isDuplicate ? " dup" : ""}`}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="preview-name">
                    {row.name}
                    {row.isDuplicate && (
                      <span
                        className="badge"
                        style={{ marginLeft: "0.5rem", color: "var(--warning)" }}
                      >
                        doublon
                      </span>
                    )}
                  </div>
                  <div className="secret-content" style={{ marginTop: "0.3rem" }}>
                    {revealAll
                      ? row.value
                      : "•".repeat(Math.min(Math.max(row.value.length, 4), 18))}
                  </div>
                </div>
                <div className="preview-controls">
                  <select
                    aria-label={`Rubrique de ${row.name}`}
                    value={row.rubric}
                    onChange={(e) => updateRow(i, { rubric: e.target.value })}
                  >
                    {rubrics.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Action pour ${row.name}`}
                    value={row.action}
                    onChange={(e) =>
                      updateRow(i, { action: e.target.value as RowAction })
                    }
                  >
                    {row.isDuplicate ? (
                      <>
                        <option value="skip">Garder l'existant</option>
                        <option value="replace">Remplacer</option>
                      </>
                    ) : (
                      <>
                        <option value="import">Importer</option>
                        <option value="skip">Ignorer</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {envErrors.length > 0 && (
            <div className="callout callout-warning text-sm">
              <b>Lignes ignorées :</b>
              <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
                {envErrors.map((e, idx) => (
                  <li key={idx}>
                    Ligne {e.line} — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <div className="inline-error">{error}</div>}
        </div>
      )}

      {tab === "json" && (
        <div className="stack">
          <div className="field">
            <label htmlFor="json-file">
              Fichier (JSON, .yml, .toml, .ini, .pem, .txt…)
            </label>
            <input
              id="json-file"
              type="file"
              onChange={(e) =>
                onPickFile(e.target.files?.[0] ?? null, setJsonText, setJsonFileName)
              }
            />
          </div>
          <div className="field">
            <label htmlFor="json-name">Nom du fichier (conservé tel quel)</label>
            <input
              id="json-name"
              value={jsonFileName}
              onChange={(e) => setJsonFileName(e.target.value)}
              className="mono"
            />
          </div>
          <div className="field">
            <label htmlFor="json-text">… ou collez le contenu</label>
            <textarea
              id="json-text"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              style={{ minHeight: 160 }}
              placeholder={'{ "type": "service_account", ... }  — ou tout autre contenu (YAML, PEM, texte…)'}
            />
          </div>
          <div className="row" style={{ gap: "0.75rem", alignItems: "flex-end" }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="json-rubric">Rubrique proposée</label>
              <select
                id="json-rubric"
                value={jsonRubricChoice ?? jsonRubric}
                onChange={(e) => setJsonRubricChoice(e.target.value)}
              >
                {rubrics.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {/\.json$/i.test(jsonFileName.trim()) ? (
              jsonValid === false ? (
                <span className="badge" style={{ color: "var(--warning)" }}>
                  JSON non valide (importé tel quel)
                </span>
              ) : jsonValid === true ? (
                <span className="badge badge-accent">JSON valide</span>
              ) : null
            ) : (
              jsonText.trim() && (
                <span className="badge">Document conservé tel quel</span>
              )
            )}
          </div>
          <p className="muted text-sm">
            Le document est conservé sans découpage automatique ; octets et nom
            préservés pour un téléchargement exact.
          </p>
          {error && <div className="inline-error">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
