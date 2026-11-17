// Classement des variables par rubrique, d'après préfixes et noms connus.
// Exécuté sur l'appareil, sans IA ni appel externe. En cas de doute : « Autres ».

import { DEFAULT_RUBRICS, type Rubric } from "./types";

// Préfixes de frameworks retirés avant analyse (ne changent pas la nature).
const FRAMEWORK_PREFIXES = [
  "VITE_",
  "NEXT_PUBLIC_",
  "REACT_APP_",
  "NUXT_PUBLIC_",
  "PUBLIC_",
  "EXPO_PUBLIC_",
];

interface Rule {
  rubric: Rubric;
  matchers: RegExp[];
}

const RULES: Rule[] = [
  {
    rubric: "Firebase",
    matchers: [/^FIREBASE/, /^FIREBASE_ADMIN/, /FIREBASE/],
  },
  {
    rubric: "Supabase",
    matchers: [/^SUPABASE/, /SUPABASE/],
  },
  {
    rubric: "Vercel",
    matchers: [/^VERCEL/, /VERCEL/, /^KV_/, /^POSTGRES_/, /^BLOB_/, /^EDGE_CONFIG/],
  },
  {
    rubric: "Google Cloud",
    matchers: [
      /^GOOGLE_CLOUD/,
      /^GOOGLE_APPLICATION/,
      /^GCLOUD/,
      /^GCP/,
      /^GOOGLE_/,
    ],
  },
  {
    rubric: "API et services",
    matchers: [
      /^STRIPE/,
      /^OPENAI/,
      /^ANTHROPIC/,
      /^RESEND/,
      /^SENDGRID/,
      /^MAILGUN/,
      /^TWILIO/,
      /^AWS_/,
      /^S3_/,
      /^CLOUDINARY/,
      /^SENTRY/,
      /^ALGOLIA/,
      /^GITHUB_TOKEN/,
      /API[_-]?KEY/,
      /SECRET[_-]?KEY/,
      /ACCESS[_-]?TOKEN/,
    ],
  },
];

function normalizeName(name: string): string {
  let n = name.toUpperCase();
  for (const prefix of FRAMEWORK_PREFIXES) {
    if (n.startsWith(prefix)) {
      n = n.slice(prefix.length);
      break;
    }
  }
  return n;
}

/** Propose une rubrique pour un nom de variable. « Autres » par défaut. */
export function classifyName(name: string): Rubric {
  const normalized = normalizeName(name);
  const original = name.toUpperCase();
  for (const rule of RULES) {
    for (const matcher of rule.matchers) {
      if (matcher.test(normalized) || matcher.test(original)) {
        return rule.rubric;
      }
    }
  }
  return "Autres";
}

/**
 * Classification enrichie prenant en compte les rubriques de l'utilisateur.
 *
 * Priorité aux rubriques PERSONNALISÉES (hors rubriques par défaut) : si le nom
 * de la variable contient le libellé de la rubrique comme jeton (ex. rubrique
 * « Clerk » ↔ `CLERK_SECRET_KEY`), on l'y classe. Sinon, on applique les règles
 * par défaut (`classifyName`). Jeton minimum 3 caractères pour éviter les faux
 * positifs (ex. « API »).
 */
export function classifyNameWithRubrics(name: string, rubrics: Rubric[]): Rubric {
  const normalized = normalizeName(name);
  const original = name.toUpperCase();
  for (const rubric of rubrics) {
    if (rubric === "Autres" || isKnownRubric(rubric)) continue;
    const token = rubric.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (token.length < 3) continue;
    const re = new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`);
    if (normalized.startsWith(token) || re.test(normalized) || re.test(original)) {
      return rubric;
    }
  }
  return classifyName(name);
}

/** Propose une rubrique pour un document JSON d'après son contenu. */
export function classifyJson(fileName: string, content: string): Rubric {
  const haystack = `${fileName}\n${content}`.toLowerCase();
  if (haystack.includes("firebase-adminsdk") || haystack.includes("firebaseio")) {
    return "Firebase";
  }
  if (haystack.includes("supabase")) return "Supabase";
  if (
    haystack.includes('"type": "service_account"') ||
    haystack.includes('"type":"service_account"') ||
    haystack.includes("googleapis.com") ||
    haystack.includes("google")
  ) {
    return "Google Cloud";
  }
  return "Autres";
}

export function isKnownRubric(rubric: string): boolean {
  return (DEFAULT_RUBRICS as readonly string[]).includes(rubric);
}
