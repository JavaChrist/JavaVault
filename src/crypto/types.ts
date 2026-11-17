// Format d'enveloppe chiffrée, versionné pour permettre des évolutions sûres.

export const CRYPTO_VERSION = 1 as const;
export const KDF_NAME = "PBKDF2" as const;
export const KDF_HASH = "SHA-256" as const;
export const CIPHER_NAME = "AES-GCM" as const;

// Paramètres de dérivation (OWASP : PBKDF2-HMAC-SHA256 >= 310 000 itérations).
export const DEFAULT_ITERATIONS = 310_000;
export const SALT_BYTES = 16;
export const NONCE_BYTES = 12; // AES-GCM : nonce de 96 bits recommandé
export const KEY_BITS = 256;

export interface EncryptedEnvelope {
  /** Version du format cryptographique. */
  v: typeof CRYPTO_VERSION;
  /** Fonction de dérivation de clé. */
  kdf: typeof KDF_NAME;
  /** Hash utilisé par le KDF. */
  hash: typeof KDF_HASH;
  /** Algorithme de chiffrement authentifié. */
  cipher: typeof CIPHER_NAME;
  /** Nombre d'itérations PBKDF2. */
  iterations: number;
  /** Sel de dérivation (base64). */
  salt: string;
  /** Nonce AES-GCM, unique à chaque chiffrement (base64). */
  nonce: string;
  /** Contenu chiffré + tag d'authentification (base64). */
  ciphertext: string;
}

/** Paramètres de dérivation associés à un coffre (stockés en clair, non secrets). */
export interface KdfParams {
  salt: string;
  iterations: number;
}
