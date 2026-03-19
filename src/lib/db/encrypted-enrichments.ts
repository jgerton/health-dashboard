/**
 * Encrypted enrichment storage in IndexedDB.
 *
 * Stores annotations (per-record) and insights (cross-record) with
 * AES-256-GCM encryption. Follows the same encrypt-on-write,
 * decrypt-on-read pattern as encrypted-appointments.ts.
 */

import type { Annotation, Insight } from "@/lib/enrichment/types";
import { encrypt, decrypt, type EncryptedData } from "@/lib/crypto/encryption";
import { openDB, STORES, idbGetAll, idbComplete } from "./idb-helpers";

interface EncryptedAnnotationRecord {
  id: string;
  recordId: string;
  data: EncryptedData;
}

interface EncryptedInsightRecord {
  id: string;
  tags: string[];
  data: EncryptedData;
}

/**
 * Store an encrypted annotation. Returns false if duplicate
 * (same recordId + recordType + title).
 */
export async function storeEncryptedAnnotation(
  annotation: Annotation,
  masterKey: CryptoKey
): Promise<boolean> {
  const db = await openDB();

  // Check for duplicate
  const tx1 = db.transaction(STORES.annotations, "readonly");
  const store = tx1.objectStore(STORES.annotations);
  const existingByRecord = await new Promise<EncryptedAnnotationRecord[]>(
    (resolve, reject) => {
      const index = store.index("recordId");
      const request = index.getAll(annotation.recordId);
      request.onsuccess = () =>
        resolve(request.result as EncryptedAnnotationRecord[]);
      request.onerror = () => reject(request.error);
    }
  );

  // Decrypt existing to check for title match
  for (const existing of existingByRecord) {
    const json = await decrypt(existing.data, masterKey);
    const existingAnnotation = JSON.parse(json) as Annotation;
    if (
      existingAnnotation.recordType === annotation.recordType &&
      existingAnnotation.title === annotation.title
    ) {
      db.close();
      return false;
    }
  }

  const encryptedData = await encrypt(JSON.stringify(annotation), masterKey);
  const record: EncryptedAnnotationRecord = {
    id: annotation.id,
    recordId: annotation.recordId,
    data: encryptedData,
  };

  const tx2 = db.transaction(STORES.annotations, "readwrite");
  tx2.objectStore(STORES.annotations).put(record);
  await idbComplete(tx2);

  db.close();
  return true;
}

/**
 * Read and decrypt all annotations.
 */
export async function getAllEncryptedAnnotations(
  masterKey: CryptoKey
): Promise<Annotation[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.annotations, "readonly");
  const records = await idbGetAll<EncryptedAnnotationRecord>(
    tx.objectStore(STORES.annotations)
  );
  db.close();

  const decrypted: Annotation[] = [];
  for (const record of records) {
    const json = await decrypt(record.data, masterKey);
    decrypted.push(JSON.parse(json) as Annotation);
  }
  return decrypted;
}

/**
 * Get annotations for a specific record by recordId.
 */
export async function getAnnotationsForRecord(
  recordId: string,
  masterKey: CryptoKey
): Promise<Annotation[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.annotations, "readonly");
  const store = tx.objectStore(STORES.annotations);

  const records = await new Promise<EncryptedAnnotationRecord[]>(
    (resolve, reject) => {
      const index = store.index("recordId");
      const request = index.getAll(recordId);
      request.onsuccess = () =>
        resolve(request.result as EncryptedAnnotationRecord[]);
      request.onerror = () => reject(request.error);
    }
  );
  db.close();

  const decrypted: Annotation[] = [];
  for (const record of records) {
    const json = await decrypt(record.data, masterKey);
    decrypted.push(JSON.parse(json) as Annotation);
  }
  return decrypted;
}

/**
 * Delete a single annotation by ID.
 */
export async function deleteAnnotation(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.annotations, "readwrite");
  tx.objectStore(STORES.annotations).delete(id);
  await idbComplete(tx);
  db.close();
}

/**
 * Store an encrypted insight.
 */
export async function storeEncryptedInsight(
  insight: Insight,
  masterKey: CryptoKey
): Promise<void> {
  const db = await openDB();
  const encryptedData = await encrypt(JSON.stringify(insight), masterKey);

  const record: EncryptedInsightRecord = {
    id: insight.id,
    tags: insight.tags,
    data: encryptedData,
  };

  const tx = db.transaction(STORES.insights, "readwrite");
  tx.objectStore(STORES.insights).put(record);
  await idbComplete(tx);
  db.close();
}

/**
 * Read and decrypt all insights.
 */
export async function getAllEncryptedInsights(
  masterKey: CryptoKey
): Promise<Insight[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.insights, "readonly");
  const records = await idbGetAll<EncryptedInsightRecord>(
    tx.objectStore(STORES.insights)
  );
  db.close();

  const decrypted: Insight[] = [];
  for (const record of records) {
    const json = await decrypt(record.data, masterKey);
    decrypted.push(JSON.parse(json) as Insight);
  }
  return decrypted;
}

/**
 * Delete a single insight by ID.
 */
export async function deleteInsight(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.insights, "readwrite");
  tx.objectStore(STORES.insights).delete(id);
  await idbComplete(tx);
  db.close();
}
