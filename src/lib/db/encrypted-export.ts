/**
 * Encrypted data export and import.
 *
 * Exports: decrypt health data from IDB with master key, then re-encrypt
 * the entire payload with an export-specific passphrase for safe transfer.
 *
 * Imports: decrypt the export payload with the export passphrase, then
 * re-encrypt each document with the vault's master key for IDB storage.
 */

import type { ParsedCCD } from "@/lib/ccd/types";
import {
  encrypt,
  decrypt,
  deriveKeyFromPassphrase,
  type EncryptedData,
} from "@/lib/crypto/encryption";
import { arrayBufferToBase64, base64ToUint8Array } from "./idb-helpers";
import {
  getAllEncryptedHealthData,
  getEncryptedDocuments,
  storeEncryptedDocument,
} from "./encrypted-store";

export interface EncryptedExportPayload {
  version: 2;
  exportedAt: string;
  encrypted: EncryptedData;
  salt: string;
}

/**
 * Export all health data, encrypted with an export passphrase.
 */
export async function exportEncryptedData(
  masterKey: CryptoKey,
  exportPassphrase: string
): Promise<EncryptedExportPayload> {
  // Decrypt from IDB
  const healthData = await getAllEncryptedHealthData(masterKey);
  const documents = await getEncryptedDocuments();

  // Bundle plaintext
  const plaintext = JSON.stringify({ documents, healthData });

  // Encrypt with export passphrase
  const { key: exportKey, salt } =
    await deriveKeyFromPassphrase(exportPassphrase);
  const encrypted = await encrypt(plaintext, exportKey);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    encrypted,
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

/**
 * Import encrypted export data.
 */
export async function importEncryptedData(
  fileContent: string,
  exportPassphrase: string,
  masterKey: CryptoKey
): Promise<{ imported: number; duplicates: number; errors: string[] }> {
  let payload: EncryptedExportPayload;

  try {
    payload = JSON.parse(fileContent);
  } catch {
    return { imported: 0, duplicates: 0, errors: ["Invalid export file"] };
  }

  if ((payload as any).version === 1) {
    return {
      imported: 0,
      duplicates: 0,
      errors: [
        "This is an unencrypted v1 export. Re-export from a current version.",
      ],
    };
  }

  if (payload.version !== 2 || !payload.encrypted || !payload.salt) {
    return {
      imported: 0,
      duplicates: 0,
      errors: ["Invalid export file"],
    };
  }

  // Decrypt with export passphrase
  const salt = base64ToUint8Array(payload.salt);
  const { key: exportKey } = await deriveKeyFromPassphrase(
    exportPassphrase,
    salt
  );

  // This will throw if passphrase is wrong (AES-GCM auth tag check)
  const plaintext = await decrypt(payload.encrypted, exportKey);
  const { healthData } = JSON.parse(plaintext) as {
    documents: unknown[];
    healthData: ParsedCCD[];
  };

  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const ccd of healthData) {
    try {
      const fakeXml = JSON.stringify(ccd);
      const wasNew = await storeEncryptedDocument(ccd, fakeXml, masterKey);
      if (wasNew) {
        imported++;
      } else {
        duplicates++;
      }
    } catch (e) {
      errors.push(
        `Failed to import ${ccd.documentInfo.sourceFile || ccd.documentInfo.id}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  return { imported, duplicates, errors };
}
