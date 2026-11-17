// Modèle de données du coffre. Tout ceci est chiffré avant persistance :
// noms de projets, rubriques, notes, valeurs et fichiers inclus.

/** Rubriques initiales proposées. L'utilisateur peut en ajouter de simples. */
export const DEFAULT_RUBRICS = [
  "Firebase",
  "Supabase",
  "Vercel",
  "Google Cloud",
  "API et services",
  "Autres",
] as const;

export type Rubric = string;

/** Type de contenu d'une entrée. */
export type EntryKind = "value" | "json";

export interface VaultEntry {
  id: string;
  /** Nom exact (ex. nom de la variable), préservé tel quel. */
  name: string;
  /** Valeur ou contenu, multiligne possible, caractères spéciaux préservés. */
  value: string;
  rubric: Rubric;
  kind: EntryKind;
  note?: string;
  /** Pour un document JSON importé : nom de fichier d'origine. */
  fileName?: string;
  createdAt: number;
  updatedAt: number;
}

/** Original importé conservé tel quel, pour téléchargement exact ultérieur. */
export interface ImportedOriginal {
  id: string;
  kind: "env" | "json";
  fileName: string;
  /** Contenu exact importé (octets en texte UTF-8), jamais réinterprété. */
  content: string;
  importedAt: number;
}

export interface Project {
  id: string;
  name: string;
  githubUrl?: string;
  note?: string;
  entries: VaultEntry[];
  originals: ImportedOriginal[];
  createdAt: number;
  updatedAt: number;
}

/** Données déchiffrées du coffre, présentes en mémoire uniquement. */
export interface VaultData {
  schema: 1;
  rubrics: Rubric[];
  projects: Project[];
}

export function emptyVault(): VaultData {
  return {
    schema: 1,
    rubrics: [...DEFAULT_RUBRICS],
    projects: [],
  };
}

export function newId(): string {
  return globalThis.crypto.randomUUID();
}
