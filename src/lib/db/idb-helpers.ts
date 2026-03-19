/**
 * Shared IndexedDB and encoding helpers.
 *
 * Central definition of openDB, IDB promise wrappers, and
 * Base64 encoding utilities used across the storage layer.
 */

const DB_NAME = "health-dashboard";
const DB_VERSION = 1;

export const STORES = {
  documents: "documents",
  healthData: "healthData",
  meta: "meta",
} as const;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.documents)) {
        const docStore = db.createObjectStore(STORES.documents, {
          keyPath: "id",
        });
        docStore.createIndex("sourceFile", "sourceFile", { unique: false });
        docStore.createIndex("hash", "hash", { unique: true });
      }

      if (!db.objectStoreNames.contains(STORES.healthData)) {
        db.createObjectStore(STORES.healthData, { keyPath: "documentId" });
      }

      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function idbGet<T>(
  source: IDBObjectStore | IDBIndex,
  key: IDBValidKey
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = source.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export function idbGetAll<T>(source: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = source.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export function idbCount(source: IDBObjectStore): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = source.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function idbComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}
