/**
 * Key manager for the health data vault.
 *
 * Manages a randomly generated master key that encrypts health data.
 * The master key is wrapped (encrypted) with a passphrase-derived key
 * and stored in the IDB meta store. This allows passphrase changes
 * without re-encrypting all data.
 */

import {
  generateKey,
  deriveKeyFromPassphrase,
  encrypt,
  decrypt,
  exportKey,
  importKey,
  type EncryptedData,
} from "./encryption";
import {
  openDB,
  STORES,
  arrayBufferToBase64,
  base64ToUint8Array,
} from "@/lib/db/idb-helpers";

const VAULT_KEY = "vault";

interface VaultRecord {
  key: "vault";
  wrappedMasterKey: EncryptedData;
  salt: string;
}

/** In-memory master key, cleared on lock */
let cachedMasterKey: CryptoKey | null = null;

/**
 * Check if a vault (wrapped master key) exists in IDB.
 */
export async function isVaultInitialized(): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.meta, "readonly");
    const request = tx.objectStore(STORES.meta).get(VAULT_KEY);
    request.onsuccess = () => {
      db.close();
      resolve(request.result !== undefined);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Initialize a new vault: generate a master key, wrap it with the
 * passphrase, and store in IDB. Returns the master key for immediate use.
 */
export async function initializeVault(
  passphrase: string
): Promise<CryptoKey> {
  if (await isVaultInitialized()) {
    throw new Error("Vault already initialized");
  }

  // Generate random master key
  const masterKey = await generateKey();

  // Derive wrapping key from passphrase
  const { key: wrappingKey, salt } =
    await deriveKeyFromPassphrase(passphrase);

  // Wrap: export master key as string, encrypt with wrapping key
  const masterKeyExported = await exportKey(masterKey);
  const wrappedMasterKey = await encrypt(masterKeyExported, wrappingKey);

  // Store in IDB
  const saltBase64 = arrayBufferToBase64(salt.buffer as ArrayBuffer);
  const record: VaultRecord = {
    key: VAULT_KEY,
    wrappedMasterKey,
    salt: saltBase64,
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.meta, "readwrite");
    tx.objectStore(STORES.meta).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  cachedMasterKey = masterKey;
  return masterKey;
}

/**
 * Unlock the vault with a passphrase. Returns the master key.
 */
export async function unlockVault(passphrase: string): Promise<CryptoKey> {
  const db = await openDB();
  const record = await new Promise<VaultRecord | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(STORES.meta, "readonly");
      const request = tx.objectStore(STORES.meta).get(VAULT_KEY);
      request.onsuccess = () =>
        resolve(request.result as VaultRecord | undefined);
      request.onerror = () => reject(request.error);
    }
  );
  db.close();

  if (!record) {
    throw new Error("Vault not initialized");
  }

  // Re-derive wrapping key from passphrase + stored salt
  const salt = base64ToUint8Array(record.salt);
  const { key: wrappingKey } = await deriveKeyFromPassphrase(passphrase, salt);

  // Unwrap: decrypt the wrapped master key, then import it
  const masterKeyExported = await decrypt(record.wrappedMasterKey, wrappingKey);
  const masterKey = await importKey(masterKeyExported);

  cachedMasterKey = masterKey;
  return masterKey;
}

/**
 * Change the vault passphrase. Re-wraps the master key with a new
 * passphrase-derived key. Does not re-encrypt any health data.
 */
export async function changePassphrase(
  oldPassphrase: string,
  newPassphrase: string
): Promise<void> {
  // Unlock with old passphrase to get master key
  const masterKey = await unlockVault(oldPassphrase);

  // Derive new wrapping key
  const { key: newWrappingKey, salt: newSalt } =
    await deriveKeyFromPassphrase(newPassphrase);

  // Re-wrap master key
  const masterKeyExported = await exportKey(masterKey);
  const newWrappedMasterKey = await encrypt(masterKeyExported, newWrappingKey);

  // Update in IDB
  const record: VaultRecord = {
    key: VAULT_KEY,
    wrappedMasterKey: newWrappedMasterKey,
    salt: arrayBufferToBase64(newSalt.buffer as ArrayBuffer),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.meta, "readwrite");
    tx.objectStore(STORES.meta).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  cachedMasterKey = masterKey;
}

/**
 * Clear the in-memory master key. Vault must be unlocked again to use.
 */
export function lockVault(): void {
  cachedMasterKey = null;
}

/**
 * Get the cached master key. Returns null if vault is locked.
 */
export function getMasterKey(): CryptoKey | null {
  return cachedMasterKey;
}
