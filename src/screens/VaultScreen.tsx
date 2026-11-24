// Écran principal du coffre déverrouillé : projets, rubriques, entrées,
// recherche, import/export, réglages.

import { useMemo, useState, type ReactNode } from "react";
import { useVault } from "@/vault/VaultContext";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { SecretValue } from "@/components/SecretValue";
import {
  DownloadIcon,
  EditIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/icons";
import { ProjectModal, type ProjectDraft } from "./ProjectModal";
import { EntryModal, type EntryDraft } from "./EntryModal";
import { ImportModal, type ImportPayload } from "./ImportModal";
import { ExportModal } from "./ExportModal";
import { SettingsModal } from "./SettingsModal";
import { RubricModal } from "./RubricModal";
import { SyncIndicator } from "@/sync/SyncIndicator";
import { ConflictModal } from "@/sync/ConflictModal";
import { useSync } from "@/sync/SyncContext";
import { classifyNameWithRubrics } from "@/vault/classify";
import { downloadText } from "@/utils/download";
import { newId, type Project, type Rubric, type VaultEntry } from "@/vault/types";

type ModalState =
  | { type: "project"; project?: Project }
  | { type: "entry"; entry?: VaultEntry; rubric?: Rubric }
  | { type: "import" }
  | { type: "export" }
  | { type: "settings" }
  | { type: "rubric" }
  | null;

export function VaultScreen() {
  const { data, update, lock, exportBackup, revision } = useVault();
  const sync = useSync();
  const confirm = useConfirm();
  const toast = useToast();

  const projects = useMemo(() => data?.projects ?? [], [data]);
  const rubrics = useMemo(() => data?.rubrics ?? [], [data]);

  // Par défaut : page d'accueil « lanceur » (aucun projet ouvert).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rubricFilter, setRubricFilter] = useState<Rubric | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  // Accueil « lanceur » : ni recherche ni projet ouvert → grille d'icônes seule.
  const isHome = !searching && !selected;

  // --- Mutations ------------------------------------------------------------

  const addProject = async (draft: ProjectDraft) => {
    const id = newId();
    const now = Date.now();
    await update((v) => {
      v.projects.push({
        id,
        name: draft.name,
        githubUrl: draft.githubUrl || undefined,
        note: draft.note || undefined,
        icon: draft.icon || undefined,
        entries: [],
        originals: [],
        createdAt: now,
        updatedAt: now,
      });
    });
    setSelectedId(id);
    setModal(null);
    toast.show("Projet créé", "success");
  };

  const editProject = async (project: Project, draft: ProjectDraft) => {
    await update((v) => {
      const p = v.projects.find((x) => x.id === project.id);
      if (!p) return;
      p.name = draft.name;
      p.githubUrl = draft.githubUrl || undefined;
      p.note = draft.note || undefined;
      p.icon = draft.icon || undefined;
      p.updatedAt = Date.now();
    });
    setModal(null);
    toast.show("Projet mis à jour", "success");
  };

  const deleteProject = async (project: Project) => {
    const ok = await confirm({
      title: "Supprimer le projet ?",
      message: (
        <>
          <p>
            Le projet « {project.name} » et ses {project.entries.length}{" "}
            entrée(s) seront supprimés.
          </p>
          <div className="callout callout-danger">Action irréversible.</div>
        </>
      ),
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await update((v) => {
      v.projects = v.projects.filter((x) => x.id !== project.id);
    });
    if (selectedId === project.id) {
      setSelectedId(projects.find((p) => p.id !== project.id)?.id ?? null);
    }
    toast.show("Projet supprimé", "info");
  };

  const saveEntry = async (draft: EntryDraft, existing?: VaultEntry) => {
    if (!selected) return;
    const now = Date.now();
    await update((v) => {
      const p = v.projects.find((x) => x.id === selected.id);
      if (!p) return;
      if (existing) {
        const e = p.entries.find((x) => x.id === existing.id);
        if (!e) return;
        e.name = draft.name;
        e.value = draft.value;
        e.rubric = draft.rubric;
        e.kind = draft.kind;
        e.note = draft.note || undefined;
        e.fileName = draft.kind === "value" ? undefined : draft.fileName || undefined;
        e.updatedAt = now;
      } else {
        p.entries.push({
          id: newId(),
          name: draft.name,
          value: draft.value,
          rubric: draft.rubric,
          kind: draft.kind,
          note: draft.note || undefined,
          fileName: draft.kind === "value" ? undefined : draft.fileName || undefined,
          createdAt: now,
          updatedAt: now,
        });
      }
      p.updatedAt = now;
    });
    setModal(null);
    toast.show(existing ? "Entrée mise à jour" : "Entrée ajoutée", "success");
  };

  const deleteEntry = async (entry: VaultEntry) => {
    if (!selected) return;
    const ok = await confirm({
      title: "Supprimer l'entrée ?",
      message: `« ${entry.name} » sera définitivement supprimée.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await update((v) => {
      const p = v.projects.find((x) => x.id === selected.id);
      if (!p) return;
      p.entries = p.entries.filter((x) => x.id !== entry.id);
      p.updatedAt = Date.now();
    });
    toast.show("Entrée supprimée", "info");
  };

  const addRubric = async (name: string) => {
    const r = name.trim();
    if (!r) return;
    await update((v) => {
      if (!v.rubrics.includes(r)) v.rubrics.push(r);
    });
  };

  const applyImport = async (payload: ImportPayload) => {
    if (!selected) return;
    const now = Date.now();
    await update((v) => {
      const p = v.projects.find((x) => x.id === selected.id);
      if (!p) return;
      for (const imported of payload.entries) {
        if (imported.rubric && !v.rubrics.includes(imported.rubric)) {
          v.rubrics.push(imported.rubric);
        }
        const existing = p.entries.find((e) => e.name === imported.name);
        if (existing && imported.replaceExisting) {
          existing.value = imported.value;
          existing.rubric = imported.rubric;
          existing.kind = imported.kind;
          existing.fileName = imported.fileName;
          existing.updatedAt = now;
        } else if (!existing) {
          p.entries.push({
            id: newId(),
            name: imported.name,
            value: imported.value,
            rubric: imported.rubric,
            kind: imported.kind,
            fileName: imported.fileName,
            createdAt: now,
            updatedAt: now,
          });
        }
        // existing && !replaceExisting : on garde l'existant (aucun écrasement).
      }
      p.originals.push({
        id: newId(),
        kind: payload.original.kind,
        fileName: payload.original.fileName,
        content: payload.original.content,
        importedAt: now,
      });
      p.updatedAt = now;
    });
    setModal(null);
    toast.show(`${payload.entries.length} entrée(s) importée(s)`, "success");
  };

  // --- Téléchargement d'un document (contenu exact, généré sur l'appareil) ---

  const entryFileName = (entry: VaultEntry): string => {
    const stored = entry.fileName?.trim();
    if (stored) return stored;
    const base = entry.name.trim() || "document";
    if (entry.kind === "json" && !/\.json$/i.test(base)) return `${base}.json`;
    return base;
  };

  const downloadEntry = (entry: VaultEntry) => {
    downloadText(
      entryFileName(entry),
      entry.value,
      entry.kind === "json" ? "application/json" : "text/plain;charset=utf-8",
    );
    toast.show("Fichier téléchargé", "success");
  };

  // --- Rendu d'une entrée ---------------------------------------------------

  const renderEntry = (entry: VaultEntry, projectLabel?: string) => (
    <div className="entry-card" key={entry.id}>
      <div className="entry-top">
        <span className="entry-name">{entry.name}</span>
        <span className="badge badge-accent">{entry.rubric}</span>
        {entry.kind === "json" && <span className="badge">JSON</span>}
        {entry.kind === "file" && (
          <span className="badge">
            {(entry.fileName?.split(".").pop() || "FICHIER").toUpperCase()}
          </span>
        )}
        {projectLabel && <span className="badge">{projectLabel}</span>}
        <div className="spacer" />
        {entry.kind !== "value" && (
          <button
            className="btn-ghost btn-icon btn-sm"
            aria-label="Télécharger le fichier"
            title={`Télécharger ${entryFileName(entry)}`}
            onClick={() => downloadEntry(entry)}
          >
            <DownloadIcon />
          </button>
        )}
        <button
          className="btn-ghost btn-icon btn-sm"
          aria-label="Modifier"
          title="Modifier"
          onClick={() => {
            if (projectLabel) setSelectedId(findProjectIdOfEntry(entry.id));
            setModal({ type: "entry", entry });
          }}
        >
          <EditIcon />
        </button>
        <button
          className="btn-ghost btn-icon btn-sm"
          aria-label="Supprimer"
          title="Supprimer"
          onClick={() => {
            if (projectLabel) setSelectedId(findProjectIdOfEntry(entry.id));
            deleteEntry(entry);
          }}
        >
          <TrashIcon />
        </button>
      </div>
      <SecretValue value={entry.value} name={entry.name} />
      {entry.note && <div className="entry-note">{entry.note}</div>}
    </div>
  );

  const findProjectIdOfEntry = (entryId: string): string | null =>
    projects.find((p) => p.entries.some((e) => e.id === entryId))?.id ?? null;

  // --- Résultats de recherche (globale) ------------------------------------

  const searchResults = useMemo(() => {
    if (!searching) return [];
    return projects
      .map((p) => ({
        project: p,
        entries: p.entries.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.rubric.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q),
        ),
      }))
      .filter((r) => r.entries.length > 0);
  }, [projects, q, searching]);

  // --- Entrées du projet sélectionné, groupées par rubrique ----------------

  const groupedEntries = useMemo(() => {
    if (!selected) return [];
    const filtered = selected.entries.filter(
      (e) => !rubricFilter || e.rubric === rubricFilter,
    );
    const byRubric = new Map<Rubric, VaultEntry[]>();
    for (const e of filtered) {
      const list = byRubric.get(e.rubric) ?? [];
      list.push(e);
      byRubric.set(e.rubric, list);
    }
    return Array.from(byRubric.entries());
  }, [selected, rubricFilter]);

  // Toutes les rubriques du coffre (défaut + créées) + d'éventuelles rubriques
  // présentes dans les entrées mais absentes de la liste, par sécurité.
  const filterRubrics = useMemo(() => {
    const set = new Set<Rubric>(rubrics);
    if (selected) selected.entries.forEach((e) => set.add(e.rubric));
    return Array.from(set);
  }, [rubrics, selected]);

  const createRubric = async (name: string) => {
    await addRubric(name);
    setModal(null);
    setRubricFilter(name.trim());
    toast.show("Rubrique créée", "success");
  };

  // Reclasse les entrées du projet selon les rubriques (règles + rubriques
  // personnalisées). Ne déplace jamais une entrée vers « Autres » : on ne touche
  // qu'aux entrées pour lesquelles une rubrique pertinente est trouvée.
  const reanalyze = async () => {
    if (!selected) return;
    const now = Date.now();
    const plan = selected.entries
      .filter((e) => e.kind === "value")
      .map((e) => ({ entry: e, proposal: classifyNameWithRubrics(e.name, rubrics) }))
      .filter((c) => c.proposal !== "Autres" && c.proposal !== c.entry.rubric);
    if (plan.length === 0) {
      toast.show("Aucune entrée à reclasser", "info");
      return;
    }
    const target = new Map(plan.map((c) => [c.entry.id, c.proposal]));
    await update((v) => {
      const p = v.projects.find((x) => x.id === selected.id);
      if (!p) return;
      for (const e of p.entries) {
        const proposal = target.get(e.id);
        if (proposal && proposal !== e.rubric) {
          e.rubric = proposal;
          e.updatedAt = now;
        }
      }
      p.updatedAt = now;
    });
    toast.show(`${plan.length} entrée(s) reclassée(s)`, "success");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="app-brand"
          title="Accueil (tableau de bord)"
          aria-label="Accueil"
          onClick={() => {
            setSelectedId(null);
            setQuery("");
            setRubricFilter(null);
          }}
        >
          <img src="/icons/logo-192.png" alt="" />
          <span className="full">JavaVault</span>
        </button>
        <div className="search">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (projet, nom, rubrique)…"
            aria-label="Rechercher dans le coffre"
            spellCheck={false}
          />
        </div>
        <div className="spacer" />
        <SyncIndicator />
        <button
          className="btn-ghost btn-icon"
          aria-label="Réglages"
          title="Réglages"
          onClick={() => setModal({ type: "settings" })}
        >
          <SettingsIcon />
        </button>
        <button
          className="btn-ghost btn-icon"
          aria-label="Verrouiller"
          title="Verrouiller"
          onClick={lock}
        >
          <LockIcon />
        </button>
      </header>

      <div className={`app-body${isHome ? " app-body--home" : ""}`}>
        {!isHome && (
          <aside className="projects-pane">
            <div className="pane-head">
              <h3>Projets</h3>
              <button
                className="btn-ghost btn-icon btn-sm"
                aria-label="Nouveau projet"
                title="Nouveau projet"
                onClick={() => setModal({ type: "project" })}
              >
                <PlusIcon />
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="empty-state text-sm">Aucun projet.</div>
            ) : (
              <ul className="project-list">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="project-item"
                    aria-selected={!searching && p.id === selectedId}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedId(p.id);
                      setQuery("");
                      setRubricFilter(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(p.id);
                        setQuery("");
                      }
                    }}
                  >
                    <span className="name">{p.name}</span>
                    <span className="meta">
                      {p.entries.length} entrée(s)
                      {p.originals.length > 0 && ` · ${p.originals.length} original(aux)`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <main className="content-pane">
          {searching ? (
            <SearchView results={searchResults} renderEntry={renderEntry} query={query} />
          ) : !selected ? (
            projects.length === 0 ? (
              <div className="empty-state">
                <p>Créez votre premier projet pour commencer.</p>
                <button
                  className="btn-primary"
                  onClick={() => setModal({ type: "project" })}
                >
                  <span className="row" style={{ gap: "0.4rem" }}>
                    <PlusIcon /> Nouveau projet
                  </span>
                </button>
              </div>
            ) : (
              <Dashboard
                projects={projects}
                onOpen={(id) => {
                  setSelectedId(id);
                  setRubricFilter(null);
                }}
                onCreate={() => setModal({ type: "project" })}
                onEdit={(id) => {
                  const project = projects.find((p) => p.id === id);
                  if (project) setModal({ type: "project", project });
                }}
              />
            )
          ) : (
            <>
              <div className="content-head">
                <div style={{ minWidth: 0 }}>
                  <h2>{selected.name}</h2>
                  {selected.githubUrl && (
                    <a
                      href={selected.githubUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm"
                    >
                      {selected.githubUrl}
                    </a>
                  )}
                  {selected.note && (
                    <p className="muted text-sm" style={{ marginTop: "0.3rem" }}>
                      {selected.note}
                    </p>
                  )}
                </div>
                <div className="spacer" />
                <div className="content-actions">
                  <button onClick={() => setModal({ type: "entry" })}>
                    <span className="row" style={{ gap: "0.35rem" }}>
                      <PlusIcon /> Entrée
                    </span>
                  </button>
                  <button onClick={() => setModal({ type: "import" })}>Importer</button>
                  <button onClick={() => setModal({ type: "export" })}>
                    <span className="row" style={{ gap: "0.35rem" }}>
                      <DownloadIcon /> Exporter
                    </span>
                  </button>
                  <button
                    className="btn-ghost btn-icon"
                    aria-label="Modifier le projet"
                    title="Modifier le projet"
                    onClick={() => setModal({ type: "project", project: selected })}
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="btn-ghost btn-icon"
                    aria-label="Supprimer le projet"
                    title="Supprimer le projet"
                    onClick={() => deleteProject(selected)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>

              <div className="rubric-filter">
                {/* Filtre par rubrique : menu déroulant (compact, tous écrans). */}
                <select
                  className="rubric-select"
                  aria-label="Filtrer par rubrique"
                  value={rubricFilter ?? ""}
                  onChange={(e) => setRubricFilter(e.target.value || null)}
                >
                  <option value="">Toutes les rubriques</option>
                  {filterRubrics.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  className="chip"
                  style={{ borderStyle: "dashed", color: "var(--accent)" }}
                  onClick={() => setModal({ type: "rubric" })}
                >
                  <PlusIcon size={14} /> Rubrique
                </button>
                <button
                  className="chip"
                  style={{ marginLeft: "auto" }}
                  title="Reclasser les entrées selon les rubriques (y compris les nouvelles)"
                  onClick={reanalyze}
                >
                  Analyser
                </button>
              </div>

              {selected.entries.length === 0 ? (
                <div className="empty-state">
                  <p>Ce projet est vide.</p>
                  <div className="row" style={{ justifyContent: "center" }}>
                    <button
                      className="btn-primary"
                      onClick={() => setModal({ type: "entry" })}
                    >
                      Ajouter une entrée
                    </button>
                    <button onClick={() => setModal({ type: "import" })}>
                      Importer un .env / JSON
                    </button>
                  </div>
                </div>
              ) : groupedEntries.length === 0 ? (
                <div className="empty-state">
                  <p>
                    Aucune entrée dans la rubrique « {rubricFilter} » pour ce
                    projet.
                  </p>
                  <button
                    className="btn-primary"
                    onClick={() => setModal({ type: "entry" })}
                  >
                    Ajouter une entrée ici
                  </button>
                </div>
              ) : (
                groupedEntries.map(([rubric, entries]) => (
                  <section className="rubric-group" key={rubric}>
                    <h4>{rubric}</h4>
                    {entries.map((e) => renderEntry(e))}
                  </section>
                ))
              )}
            </>
          )}
        </main>
      </div>

      {modal?.type === "project" && (
        <ProjectModal
          initial={modal.project}
          onClose={() => setModal(null)}
          onSave={(draft) =>
            modal.project ? editProject(modal.project, draft) : addProject(draft)
          }
        />
      )}
      {modal?.type === "entry" && selected && (
        <EntryModal
          rubrics={rubrics}
          initial={modal.entry}
          defaultRubric={rubricFilter ?? undefined}
          onClose={() => setModal(null)}
          onSave={(draft) => saveEntry(draft, modal.entry)}
          onAddRubric={addRubric}
        />
      )}
      {modal?.type === "import" && selected && (
        <ImportModal
          rubrics={rubrics}
          existingNames={new Set(selected.entries.map((e) => e.name))}
          onClose={() => setModal(null)}
          onConfirm={applyImport}
        />
      )}
      {modal?.type === "export" && selected && (
        <ExportModal
          project={selected}
          onClose={() => setModal(null)}
          onExportBackup={exportBackup}
        />
      )}
      {modal?.type === "settings" && (
        <SettingsModal onClose={() => setModal(null)} />
      )}
      {modal?.type === "rubric" && (
        <RubricModal
          existing={rubrics}
          onClose={() => setModal(null)}
          onCreate={createRubric}
        />
      )}
      {sync.status === "conflict" && <ConflictModal />}

      {/* révision utilisée pour forcer un rafraîchissement cohérent si besoin */}
      <span hidden data-revision={revision} />
    </div>
  );
}

// --- Tableau de bord (grille d'icônes de projets) ----------------------------

function Dashboard({
  projects,
  onOpen,
  onCreate,
  onEdit,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
}) {
  return (
    <div className="launcher">
      <div className="launcher-grid">
        {projects.map((p) => (
          <div className="launcher-cell" key={p.id}>
            <button
              type="button"
              className="launcher-tile"
              onClick={() => onOpen(p.id)}
              title={p.name}
            >
              <span className="launcher-icon">
                {p.icon ? (
                  <img src={p.icon} alt="" />
                ) : (
                  <span className="icon-placeholder">
                    {p.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                )}
              </span>
              <span className="launcher-name">{p.name}</span>
            </button>
            <button
              type="button"
              className="launcher-edit"
              onClick={() => onEdit(p.id)}
              aria-label={`Modifier ${p.name}`}
              title="Modifier le projet / l'icône"
            >
              <EditIcon size={16} />
            </button>
          </div>
        ))}
        <div className="launcher-cell">
          <button
            type="button"
            className="launcher-tile launcher-tile-add"
            onClick={onCreate}
            title="Nouveau projet"
          >
            <span className="launcher-icon">
              <PlusIcon size={40} />
            </span>
            <span className="launcher-name">Nouveau</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Vue de recherche --------------------------------------------------------

function SearchView({
  results,
  renderEntry,
  query,
}: {
  results: { project: Project; entries: VaultEntry[] }[];
  renderEntry: (entry: VaultEntry, projectLabel?: string) => ReactNode;
  query: string;
}) {
  if (results.length === 0) {
    return (
      <div className="empty-state">
        Aucun résultat pour « {query.trim()} ».
      </div>
    );
  }
  return (
    <>
      <p className="muted text-sm" style={{ marginBottom: "1rem" }}>
        Résultats pour « {query.trim()} »
      </p>
      {results.map(({ project, entries }) => (
        <section className="rubric-group" key={project.id}>
          <h4>{project.name}</h4>
          {entries.map((e) => renderEntry(e, project.name))}
        </section>
      ))}
    </>
  );
}
