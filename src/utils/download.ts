// Téléchargement de fichiers générés côté client (blobs locaux, pas de réseau).

export function downloadText(
  fileName: string,
  content: string,
  mime = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libère l'URL après un court instant (laisse le temps au téléchargement).
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Taille max d'un fichier joint ou importé (le coffre entier est synchronisé). */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/**
 * Lit un fichier choisi par l'utilisateur en texte UTF-8.
 * `maxBytes` refuse les fichiers trop gros avant lecture.
 */
export function readFileAsText(file: File, maxBytes?: number): Promise<string> {
  if (maxBytes !== undefined && file.size > maxBytes) {
    return Promise.reject(
      new Error(
        `Fichier trop volumineux (${formatBytes(file.size)}, max ${formatBytes(maxBytes)}).`,
      ),
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Lecture échouée."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  });
}

// --- « Enregistrer sous… » --------------------------------------------------

/** Nom de fichier proposé pour un document : nom joint, sinon nom de l'entrée. */
export function documentFileName(
  name: string,
  fileName: string | undefined,
  kind: "value" | "json" | "file",
): string {
  const stored = fileName?.trim();
  if (stored) return stored;
  const base = name.trim() || "document";
  if (kind === "json" && !/\.json$/i.test(base)) return `${base}.json`;
  return base;
}

/** Taille lisible d'un nombre d'octets. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Taille lisible du contenu (octets UTF-8). */
export function formatSize(content: string): string {
  return formatBytes(new TextEncoder().encode(content).length);
}

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

/**
 * Enregistre un fichier en laissant l'utilisateur choisir le dossier (Bureau ou
 * autre) via la boîte « Enregistrer sous » du navigateur (Chrome / Edge).
 * Sans cette API (Firefox, Safari, iOS), repli sur un téléchargement classique.
 * Tout est généré sur l'appareil, rien n'est envoyé.
 *
 * À appeler directement depuis un clic (le navigateur exige un geste utilisateur).
 */
export async function saveFileAs(
  fileName: string,
  content: string,
  mime = "text/plain;charset=utf-8",
): Promise<"saved" | "downloaded" | "cancelled"> {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker })
    .showSaveFilePicker;
  if (!picker) {
    downloadText(fileName, content, mime);
    return "downloaded";
  }
  const ext = /(\.[a-z0-9]{1,10})$/i.exec(fileName)?.[1]?.toLowerCase();
  const baseMime = mime.split(";")[0];
  try {
    const handle = await picker({
      suggestedName: fileName,
      types: ext ? [{ description: "Document", accept: { [baseMime]: [ext] } }] : undefined,
    });
    const writable = await handle.createWritable();
    await writable.write(new Blob([content], { type: mime }));
    await writable.close();
    return "saved";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    // API présente mais refusée (contexte non sécurisé, iframe…) : repli.
    if (e instanceof DOMException && e.name === "SecurityError") {
      downloadText(fileName, content, mime);
      return "downloaded";
    }
    throw e;
  }
}
