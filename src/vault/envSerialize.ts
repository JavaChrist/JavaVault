// Sérialisation .env à partir des entrées du coffre (export de convivialité).
//
// Rappel : la restitution strictement fidèle d'un fichier importé passe par le
// téléchargement de l'original conservé. Cet export reconstruit un .env valide
// depuis les entrées (utile après modifications ou pour un sous-ensemble).

export interface EnvPair {
  name: string;
  value: string;
}

/** Détermine s'il faut entourer la valeur de guillemets doubles. */
function needsQuoting(value: string): boolean {
  if (value === "") return false;
  // Espaces en bord, retours à la ligne, ou caractères significatifs en shell.
  return (
    /[\n\r"'#=\s]/.test(value) ||
    value !== value.trim()
  );
}

function quoteValue(value: string): string {
  if (!needsQuoting(value)) return value;
  // Guillemets doubles ; on échappe UNIQUEMENT le guillemet double (symétrique du
  // parseur). Les antislashes restent littéraux pour ne pas altérer une valeur
  // du type "-----BEGIN...\n...-----END-----" (clés privées au format env).
  const escaped = value.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function serializeEnv(pairs: EnvPair[]): string {
  const body = pairs.map((p) => `${p.name}=${quoteValue(p.value)}`).join("\n");
  return body.length > 0 ? body + "\n" : "";
}
