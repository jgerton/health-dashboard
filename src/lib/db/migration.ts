/**
 * One-time migration from unencrypted to encrypted IDB storage.
 *
 * Reads all unencrypted healthData records, re-encrypts them with
 * the master key, and replaces the records in place.
 */

import type { ParsedCCD } from "@/lib/ccd/types";
import { encrypt, type EncryptedData } from "@/lib/crypto/encryption";
import { openDB } from "./idb-helpers";

interface UnencryptedHealthDataRecord {
  documentId: string;
  data: ParsedCCD;
}

interface EncryptedHealthDataRecord {
  documentId: string;
  data: EncryptedData;
}

/**
 * Check if a healthData record is unencrypted (has ParsedCCD shape).
 * Encrypted records have { ciphertext, iv } shape instead.
 */
function isUnencrypted(record: { data: unknown }): boolean {
  const data = record.data as Record<string, unknown>;
  return (
    data !== null &&
    typeof data === "object" &&
    "documentInfo" in data &&
    "patient" in data &&
    "medications" in data
  );
}

/**
 * Migrate unencrypted healthData records to encrypted format.
 * Returns the number of records migrated.
 */
export async function migrateUnencryptedData(
  masterKey: CryptoKey
): Promise<number> {
  const db = await openDB();

  // Read all records
  const records = await new Promise<UnencryptedHealthDataRecord[]>(
    (resolve, reject) => {
      const tx = db.transaction("healthData", "readonly");
      const request = tx.objectStore("healthData").getAll();
      request.onsuccess = () =>
        resolve(request.result as UnencryptedHealthDataRecord[]);
      request.onerror = () => reject(request.error);
    }
  );

  // Filter to only unencrypted records
  const unencrypted = records.filter(isUnencrypted);

  if (unencrypted.length === 0) {
    db.close();
    return 0;
  }

  // Encrypt each record
  const encrypted: EncryptedHealthDataRecord[] = [];
  for (const record of unencrypted) {
    const encryptedData = await encrypt(
      JSON.stringify(record.data),
      masterKey
    );
    encrypted.push({
      documentId: record.documentId,
      data: encryptedData,
    });
  }

  // Replace records in a single transaction
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("healthData", "readwrite");
    const store = tx.objectStore("healthData");
    for (const record of encrypted) {
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Update document metadata to redact patient names
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("documents", "readwrite");
    const store = tx.objectStore("documents");
    const request = store.getAll();
    request.onsuccess = () => {
      const docs = request.result;
      for (const doc of docs) {
        doc.patientName = "Encrypted";
        store.put(doc);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return unencrypted.length;
}
