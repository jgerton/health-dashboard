/**
 * IndexedDB persistence layer for health data.
 *
 * Stores parsed CCD data in IndexedDB for browser persistence.
 * This is the pragmatic first implementation; wa-sqlite + OPFS
 * can replace it later if SQL query performance becomes a need.
 *
 * Data flow: XML file -> parseCCD() -> store in IDB -> read for UI
 */

import type { ParsedCCD } from "@/lib/ccd/types";
import { openDB, STORES, idbGet, idbGetAll, idbCount, idbComplete, hashContent } from "./idb-helpers";

export interface DocumentRecord {
  id: string;
  title: string;
  effectiveTime: string;
  sourceFile?: string;
  hash: string;
  importedAt: string;
  patientName: string;
}

export interface HealthDataRecord {
  documentId: string;
  data: ParsedCCD;
}

/**
 * Store a parsed CCD document. Returns false if duplicate.
 */
export async function storeDocument(
  ccd: ParsedCCD,
  rawXml: string
): Promise<boolean> {
  const db = await openDB();
  const hash = await hashContent(rawXml);

  // Check for duplicate
  const tx1 = db.transaction(STORES.documents, "readonly");
  const existingByHash = await idbGet<DocumentRecord>(
    tx1.objectStore(STORES.documents).index("hash"),
    hash
  );
  if (existingByHash) {
    db.close();
    return false;
  }

  // Store document record and health data
  const tx2 = db.transaction(
    [STORES.documents, STORES.healthData],
    "readwrite"
  );

  const docRecord: DocumentRecord = {
    id: ccd.documentInfo.id,
    title: ccd.documentInfo.title,
    effectiveTime: ccd.documentInfo.effectiveTime,
    sourceFile: ccd.documentInfo.sourceFile,
    hash,
    importedAt: new Date().toISOString(),
    patientName: ccd.patient.name,
  };

  const healthRecord: HealthDataRecord = {
    documentId: ccd.documentInfo.id,
    data: ccd,
  };

  tx2.objectStore(STORES.documents).put(docRecord);
  tx2.objectStore(STORES.healthData).put(healthRecord);

  await idbComplete(tx2);
  db.close();
  return true;
}

/**
 * Get all stored document records.
 */
export async function getDocuments(): Promise<DocumentRecord[]> {
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
 * Get all stored health data (parsed CCDs).
 */
export async function getAllHealthData(): Promise<ParsedCCD[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.healthData, "readonly");
  const records = await idbGetAll<HealthDataRecord>(
    tx.objectStore(STORES.healthData)
  );
  db.close();
  return records.map((r) => r.data);
}

/**
 * Delete all stored data.
 */
export async function deleteAllData(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [STORES.documents, STORES.healthData, STORES.meta],
    "readwrite"
  );
  tx.objectStore(STORES.documents).clear();
  tx.objectStore(STORES.healthData).clear();
  tx.objectStore(STORES.meta).clear();
  await idbComplete(tx);
  db.close();
}

/**
 * Get a count of stored documents.
 */
export async function getDocumentCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORES.documents, "readonly");
  const count = await idbCount(tx.objectStore(STORES.documents));
  db.close();
  return count;
}

