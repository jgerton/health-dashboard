import { describe, it, expect, beforeEach } from "vitest";
import { openDB, STORES } from "@/lib/db/idb-helpers";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

describe("IDB v2 migration", () => {
  it("creates appointments store on fresh install", async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains(STORES.appointments)).toBe(true);
    db.close();
  });

  it("appointments store has uid index", async () => {
    const db = await openDB();
    const tx = db.transaction(STORES.appointments, "readonly");
    const store = tx.objectStore(STORES.appointments);
    expect(store.indexNames.contains("uid")).toBe(true);
    expect(store.indexNames.contains("dateTime")).toBe(true);
    db.close();
  });

  it("preserves existing stores", async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains(STORES.documents)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.healthData)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.meta)).toBe(true);
    db.close();
  });

  it("upgrades from v1 to v2 without data loss", async () => {
    // Simulate v1 database by opening with old version first
    const dbV1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("health-dashboard", 1);
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
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Write some data to v1
    await new Promise<void>((resolve, reject) => {
      const tx = dbV1.transaction("meta", "readwrite");
      tx.objectStore("meta").put({ key: "test", value: "preserved" });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    dbV1.close();

    // Now open with v2 (via our openDB which uses DB_VERSION=2)
    const db = await openDB();

    // Verify appointments store was added
    expect(db.objectStoreNames.contains("appointments")).toBe(true);

    // Verify old data preserved
    const tx = db.transaction("meta", "readonly");
    const request = tx.objectStore("meta").get("test");
    const result = await new Promise<{ key: string; value: string } | undefined>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    expect(result?.value).toBe("preserved");

    db.close();
  });
});
