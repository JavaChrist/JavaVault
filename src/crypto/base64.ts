// Conversions binaire <-> base64 et texte, sans dépendance.
// Utilisées pour sérialiser sels, nonces et contenus chiffrés.

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000; // évite "Maximum call stack" sur gros buffers
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function textToBytes(text: string): Uint8Array {
  return encoder.encode(text);
}

export function bytesToText(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}
