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

const DB_NAME = "health-dashboard";
const DB_VERSION = 1;

const STORES = {
  documents: "documents",
  healthData: "healthData",
  meta: "meta",
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Documents store: keyed by document ID
      if (!db.objectStoreNames.contains(STORES.documents)) {
        const docStore = db.createObjectStore(STORES.documents, {
          keyPath: "id",
        });
        docStore.createIndex("sourceFile", "sourceFile", { unique: false });
        docStore.createIndex("hash", "hash", { unique: true });
      }

      // Health data store: keyed by document ID, contains full parsed CCD
      if (!db.objectStoreNames.contains(STORES.healthData)) {
        db.createObjectStore(STORES.healthData, { keyPath: "documentId" });
      }

      // Meta store: app settings, encryption keys, etc.
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Compute a SHA-256 hash of the raw XML for deduplication.
 */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

// --- IDB Promise Helpers ---

function idbGet<T>(
  source: IDBObjectStore | IDBIndex,
  key: IDBValidKey
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = source.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function idbGetAll<T>(source: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = source.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function idbCount(source: IDBObjectStore): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = source.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
