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

/** Lit un fichier choisi par l'utilisateur en texte UTF-8. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Lecture échouée."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  });
}
