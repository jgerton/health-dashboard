/**
 * Encrypted IndexedDB storage adapter.
 *
 * Wraps the storage layer to encrypt ParsedCCD data before writing
 * to the healthData store and decrypts on read. Document metadata
 * is stored unencrypted for listing (title, date, hash for dedup).
 * Patient name in document metadata is redacted to "Encrypted".
 */

import type { ParsedCCD } from "@/lib/ccd/types";
import { encrypt, decrypt, type EncryptedData } from "@/lib/crypto/encryption";
import { openDB, STORES, idbGet, idbGetAll, idbCount, idbComplete, hashContent } from "./idb-helpers";

interface DocumentRecord {
  id: string;
  title: string;
  effectiveTime: string;
  sourceFile?: string;
  hash: string;
  importedAt: string;
  patientName: string;
}

interface EncryptedHealthDataRecord {
  documentId: string;
  data: EncryptedData;
}

/**
 * Store a parsed CCD document with encrypted health data.
 * Returns true if new, false if duplicate (same content hash).
 */
export async function storeEncryptedDocument(
  ccd: ParsedCCD,
  rawXml: string,
  masterKey: CryptoKey
): Promise<boolean> {
  const db = await openDB();
  const hash = await hashContent(rawXml);

  // Check for duplicate by document ID or content hash
  const tx1 = db.transaction(STORES.documents, "readonly");
  const store = tx1.objectStore(STORES.documents);
  const existingById = await idbGet<DocumentRecord>(store, ccd.documentInfo.id);
  const existingByHash = await idbGet<DocumentRecord>(store.index("hash"), hash);

  if (existingById || existingByHash) {
    db.close();
    return false;
  }

  // Encrypt the full ParsedCCD as JSON
  const encryptedData = await encrypt(JSON.stringify(ccd), masterKey);

  const docRecord: DocumentRecord = {
    id: ccd.documentInfo.id,
    title: ccd.documentInfo.title,
    effectiveTime: ccd.documentInfo.effectiveTime,
    sourceFile: ccd.documentInfo.sourceFile,
    hash,
    importedAt: new Date().toISOString(),
    patientName: "Encrypted",
  };

  const healthRecord: EncryptedHealthDataRecord = {
    documentId: ccd.documentInfo.id,
    data: encryptedData,
  };

  const tx2 = db.transaction(
    [STORES.documents, STORES.healthData],
    "readwrite"
  );
  tx2.objectStore(STORES.documents).put(docRecord);
  tx2.objectStore(STORES.healthData).put(healthRecord);
  await idbComplete(tx2);

  db.close();
  return true;
}

/**
 * Read and decrypt all health data from IDB.
 */
export async function getAllEncryptedHealthData(
  masterKey: CryptoKey
): Promise<ParsedCCD[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.healthData, "readonly");
  const records = await idbGetAll<EncryptedHealthDataRecord>(
    tx.objectStore(STORES.healthData)
  );
  db.close();

  const decrypted: ParsedCCD[] = [];
  for (const record of records) {
    const json = await decrypt(record.data, masterKey);
    decrypted.push(JSON.parse(json) as ParsedCCD);
  }
  return decrypted;
}

/**
 * Get all document records (unencrypted metadata).
 */
export async function getEncryptedDocuments(): Promise<DocumentRecord[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.documents, "readonly");
  const docs = await idbGetAll<DocumentRecord>(
    tx.objectStore(STORES.documents)
  );
  db.close();
  return docs.sort((a, b) =>
    b.effectiveTime.localeCompare(a.effectiveTime)
  );
}

/**
 * Get count of stored documents.
 */
export async function getEncryptedDocumentCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORES.documents, "readonly");
  const count = await idbCount(tx.objectStore(STORES.documents));
  db.close();
  return count;
}

/**
 * Delete all stored data (all three stores, including vault).
 * Use deleteHealthDataOnly to preserve the vault.
 */
export { deleteAllData } from "./idb-store";

/**
 * Delete health data only (documents + healthData stores).
 * Preserves the vault/meta store so the user stays authenticated.
 */
export async function deleteHealthDataOnly(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [STORES.documents, STORES.healthData, STORES.appointments, STORES.annotations, STORES.insights],
    "readwrite"
  );
  tx.objectStore(STORES.documents).clear();
  tx.objectStore(STORES.healthData).clear();
  tx.objectStore(STORES.appointments).clear();
  tx.objectStore(STORES.annotations).clear();
  tx.objectStore(STORES.insights).clear();
  await idbComplete(tx);
  db.close();
}
