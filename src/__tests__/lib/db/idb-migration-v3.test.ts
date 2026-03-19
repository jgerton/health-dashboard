import { describe, it, expect, beforeEach } from "vitest";
import { openDB, STORES } from "@/lib/db/idb-helpers";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

describe("IDB v3 migration", () => {
  it("creates annotations store on fresh install", async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains(STORES.annotations)).toBe(true);
    db.close();
  });

  it("creates insights store on fresh install", async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains(STORES.insights)).toBe(true);
    db.close();
  });

  it("annotations store has recordId and tags indexes", async () => {
    const db = await openDB();
    const tx = db.transaction(STORES.annotations, "readonly");
    const store = tx.objectStore(STORES.annotations);
    expect(store.indexNames.contains("recordId")).toBe(true);
    expect(store.indexNames.contains("tags")).toBe(true);
    db.close();
  });

  it("insights store has tags index", async () => {
    const db = await openDB();
    const tx = db.transaction(STORES.insights, "readonly");
    const store = tx.objectStore(STORES.insights);
    expect(store.indexNames.contains("tags")).toBe(true);
    db.close();
  });

  it("preserves all existing stores", async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains(STORES.documents)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.healthData)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.meta)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.appointments)).toBe(true);
    db.close();
  });

  it("upgrades from v2 to v3 without data loss", async () => {
    const dbV2 = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("health-dashboard", 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("documents")) {
          const docStore = db.createObjectStore("documents", { keyPath: "id" });
          docStore.createIndex("sourceFile", "sourceFile", { unique: false });
          docStore.createIndex("hash", "hash", { unique: true });
        }
        if (!db.objectStoreNames.contains("healthData")) {
          db.createObjectStore("healthData", { keyPath: "documentId" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("appointments")) {
          const apptStore = db.createObjectStore("appointments", { keyPath: "id" });
          apptStore.createIndex("uid", "uid", { unique: false });
          apptStore.createIndex("dateTime", "dateTime", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = dbV2.transaction("meta", "readwrite");
      tx.objectStore("meta").put({ key: "test-v3", value: "preserved" });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    dbV2.close();

    const db = await openDB();
    expect(db.objectStoreNames.contains("annotations")).toBe(true);
    expect(db.objectStoreNames.contains("insights")).toBe(true);

    const tx = db.transaction("meta", "readonly");
    const request = tx.objectStore("meta").get("test-v3");
    const result = await new Promise<{ key: string; value: string } | undefined>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    expect(result?.value).toBe("preserved");
    db.close();
  });
});
