// Chiffrement authentifié sur l'appareil (Web Crypto, primitives standard).
//
// Principes :
// - AES-GCM 256 bits pour confidentialité + intégrité (tag d'authentification).
// - Clé dérivée de la phrase maître par PBKDF2-SHA-256 (sel + itérations stockés).
// - Nonce aléatoire unique à chaque chiffrement.
// - La phrase maître n'est jamais persistée ; la clé dérivée reste en mémoire.
// - Aucun algorithme maison : uniquement window.crypto.subtle.

import {
  base64ToBytes,
  bytesToBase64,
  bytesToText,
  textToBytes,
} from "./base64";
import {
  CIPHER_NAME,
  CRYPTO_VERSION,
  DEFAULT_ITERATIONS,
  EncryptedEnvelope,
  KDF_HASH,
  KDF_NAME,
  KEY_BITS,
  KdfParams,
  NONCE_BYTES,
  SALT_BYTES,
} from "./types";

const subtle = globalThis.crypto?.subtle;

// TS 5.7 type les Uint8Array sur ArrayBufferLike ; Web Crypto attend un
// BufferSource sur ArrayBuffer. Nos octets sont toujours adossés à un
// ArrayBuffer classique, ce cast restreint est donc sûr.
function buf(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

function requireCrypto(): SubtleCrypto {
  if (!subtle) {
    throw new Error(
      "Web Crypto indisponible : ce navigateur ne permet pas le chiffrement sécurisé.",
    );
  }
  return subtle;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function generateSalt(): string {
  return bytesToBase64(randomBytes(SALT_BYTES));
}

/** Dérive une clé AES-GCM à partir de la phrase maître et des paramètres KDF. */
export async function deriveKey(
  passphrase: string,
  params: KdfParams,
): Promise<CryptoKey> {
  const api = requireCrypto();
  const baseKey = await api.importKey(
    "raw",
    buf(textToBytes(passphrase)),
    { name: KDF_NAME },
    false,
    ["deriveKey"],
  );
  return api.deriveKey(
    {
      name: KDF_NAME,
      hash: KDF_HASH,
      salt: buf(base64ToBytes(params.salt)),
      iterations: params.iterations,
    },
    baseKey,
    { name: CIPHER_NAME, length: KEY_BITS },
    false, // clé non exportable
    ["encrypt", "decrypt"],
  );
}

/** Crée des paramètres KDF neufs (nouveau sel) pour un coffre. */
export function newKdfParams(iterations = DEFAULT_ITERATIONS): KdfParams {
  return { salt: generateSalt(), iterations };
}

/** Chiffre des octets avec une clé dérivée. Nonce unique généré ici. */
export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  params: KdfParams,
): Promise<EncryptedEnvelope> {
  const api = requireCrypto();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = await api.encrypt(
    { name: CIPHER_NAME, iv: buf(nonce) },
    key,
    buf(plaintext),
  );
  return {
    v: CRYPTO_VERSION,
    kdf: KDF_NAME,
    hash: KDF_HASH,
    cipher: CIPHER_NAME,
    iterations: params.iterations,
    salt: params.salt,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(cipher)),
  };
}

/**
 * Déchiffre une enveloppe. Lève une erreur si la clé est fausse (mauvaise phrase
 * maître) OU si le contenu a été altéré : AES-GCM vérifie le tag d'intégrité.
 */
export async function decryptBytes(
  key: CryptoKey,
  envelope: EncryptedEnvelope,
): Promise<Uint8Array> {
  const api = requireCrypto();
  assertEnvelope(envelope);
  try {
    const plain = await api.decrypt(
      { name: CIPHER_NAME, iv: buf(base64ToBytes(envelope.nonce)) },
      key,
      buf(base64ToBytes(envelope.ciphertext)),
    );
    return new Uint8Array(plain);
  } catch {
    // Message neutre : ne jamais distinguer "mauvaise clé" de "données altérées"
    // d'une manière qui révèlerait quoi que ce soit du contenu.
    throw new DecryptionError();
  }
}

export class DecryptionError extends Error {
  constructor() {
    super(
      "Déchiffrement impossible : phrase maître incorrecte ou données altérées.",
    );
    this.name = "DecryptionError";
  }
}

/** Valide la forme d'une enveloppe avant tout traitement. */
export function assertEnvelope(value: unknown): asserts value is EncryptedEnvelope {
  const e = value as Partial<EncryptedEnvelope> | null;
  if (
    !e ||
    typeof e !== "object" ||
    e.v !== CRYPTO_VERSION ||
    e.kdf !== KDF_NAME ||
    e.cipher !== CIPHER_NAME ||
    typeof e.iterations !== "number" ||
    typeof e.salt !== "string" ||
    typeof e.nonce !== "string" ||
    typeof e.ciphertext !== "string"
  ) {
    throw new Error("Enveloppe chiffrée invalide ou format non reconnu.");
  }
}

// --- Helpers JSON de haut niveau -------------------------------------------

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
  params: KdfParams,
): Promise<EncryptedEnvelope> {
  return encryptBytes(key, textToBytes(JSON.stringify(value)), params);
}

export async function decryptJson<T>(
  key: CryptoKey,
  envelope: EncryptedEnvelope,
): Promise<T> {
  const bytes = await decryptBytes(key, envelope);
  return JSON.parse(bytesToText(bytes)) as T;
}
