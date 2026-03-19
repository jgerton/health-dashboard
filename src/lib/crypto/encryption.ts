/**
 * Web Crypto API encryption layer for health data.
 * Uses AES-256-GCM for authenticated encryption at rest.
 *
 * Key derivation: PBKDF2 from user passphrase (or generated key for passkey users).
 * All health data is encrypted before storage in IndexedDB.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 600_000;

export interface EncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded IV */
  iv: string;
  /** Base64-encoded salt (only present for passphrase-derived keys) */
  salt?: string;
}

/**
 * Generate a random AES-256-GCM encryption key.
 * Used for passkey-based auth where no passphrase is available.
 */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable for export/backup
    ["encrypt", "decrypt"]
  );
}

/**
 * Derive an AES-256-GCM key from a passphrase using PBKDF2.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt?: Uint8Array<ArrayBuffer>
): Promise<{ key: CryptoKey; salt: Uint8Array<ArrayBuffer> }> {
  const actualSalt = salt || (crypto.getRandomValues(new Uint8Array(SALT_LENGTH)) as Uint8Array<ArrayBuffer>);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: actualSalt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );

  return { key, salt: actualSalt };
}

/**
 * Encrypt data with AES-256-GCM.
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(data);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt AES-256-GCM encrypted data.
 */
export async function decrypt(
  encrypted: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = base64ToArrayBuffer(encrypted.iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Export a CryptoKey to a portable format (for backup/transfer).
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

/**
 * Import a CryptoKey from a portable format.
 */
export async function importKey(keyData: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(keyData);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

// --- Helpers ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
