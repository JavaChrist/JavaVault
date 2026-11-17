// Parseur .env exécuté SUR L'APPAREIL, sans aucune interprétation shell.
//
// Garanties :
// - Jamais d'exécution, jamais d'expansion de variables ($VAR), jamais de
//   résolution de code shell.
// - Noms, valeurs, caractères spéciaux et clés multilignes préservés.
// - L'original importé est conservé séparément pour un téléchargement exact :
//   ce parseur sert à gérer/afficher, la restitution fidèle vient de l'original.

export interface ParsedEnvVar {
  name: string;
  /** Valeur logique (guillemets entourants retirés, contenu non réinterprété). */
  value: string;
  /** Guillemet d'origine, pour information. */
  quote: '"' | "'" | null;
  /** Numéro de ligne (1-indexé) du début de la variable. */
  line: number;
}

export interface EnvParseError {
  line: number;
  content: string;
  message: string;
}

export interface EnvParseResult {
  vars: ParsedEnvVar[];
  errors: EnvParseError[];
}

const ASSIGNMENT = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=(.*)$/s;

export function parseEnv(content: string): EnvParseResult {
  const lines = content.split(/\r?\n/);
  const vars: ParsedEnvVar[] = [];
  const errors: EnvParseError[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const lineNo = i + 1;
    const trimmedStart = rawLine.replace(/^\s+/, "");

    // Lignes vides et commentaires : ignorés (pas d'erreur).
    if (trimmedStart === "" || trimmedStart.startsWith("#")) {
      i++;
      continue;
    }

    const m = ASSIGNMENT.exec(rawLine);
    if (!m) {
      errors.push({
        line: lineNo,
        content: rawLine,
        message: "Ligne non reconnue (ni commentaire, ni affectation NAME=…).",
      });
      i++;
      continue;
    }

    const name = m[1];
    const rest = m[2];
    const firstChar = rest[0];

    if (firstChar === '"' || firstChar === "'") {
      const quote = firstChar as '"' | "'";
      const { value, nextIndex, closed } = readQuoted(lines, i, rest, quote);
      if (!closed) {
        errors.push({
          line: lineNo,
          content: rawLine,
          message: `Guillemet ${quote} non fermé pour « ${name} ».`,
        });
      }
      vars.push({ name, value, quote, line: lineNo });
      i = nextIndex;
      continue;
    }

    // Valeur non entre guillemets : contenu brut jusqu'à la fin de ligne,
    // on retire seulement un éventuel retour chariot déjà géré par le split.
    vars.push({ name, value: rest, quote: null, line: lineNo });
    i++;
  }

  return { vars, errors };
}

/**
 * Lit une valeur entre guillemets pouvant s'étendre sur plusieurs lignes
 * (ex. clé privée). Les guillemets doubles acceptent \" comme littéral échappé ;
 * aucune autre séquence n'est interprétée.
 */
function readQuoted(
  lines: string[],
  startIndex: number,
  firstRest: string,
  quote: '"' | "'",
): { value: string; nextIndex: number; closed: boolean } {
  // Retire le guillemet ouvrant.
  let buffer = firstRest.slice(1);
  let index = startIndex;

  for (;;) {
    const end = findClosingQuote(buffer, quote);
    if (end !== -1) {
      const inner = buffer.slice(0, end);
      return {
        value: unescapeQuote(inner, quote),
        nextIndex: index + 1,
        closed: true,
      };
    }
    // Pas de fermeture sur cette ligne : on continue sur la suivante.
    index++;
    if (index >= lines.length) {
      return { value: unescapeQuote(buffer, quote), nextIndex: index, closed: false };
    }
    buffer += "\n" + lines[index];
  }
}

function findClosingQuote(text: string, quote: '"' | "'"): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === quote) {
      // Pour les guillemets doubles, un antislash échappe le guillemet.
      if (quote === '"' && i > 0 && countTrailingBackslashes(text, i) % 2 === 1) {
        continue;
      }
      return i;
    }
  }
  return -1;
}

function countTrailingBackslashes(text: string, index: number): number {
  let n = 0;
  let j = index - 1;
  while (j >= 0 && text[j] === "\\") {
    n++;
    j--;
  }
  return n;
}

/** Retire uniquement l'échappement du guillemet lui-même (\" -> "). */
function unescapeQuote(inner: string, quote: '"' | "'"): string {
  if (quote === '"') return inner.replace(/\\"/g, '"');
  return inner;
}
