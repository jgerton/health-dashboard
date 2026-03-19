import { describe, it, expect, beforeEach } from "vitest";
import {
  storeEncryptedDocument,
  getAllEncryptedHealthData,
  deleteAllData,
  deleteHealthDataOnly,
} from "@/lib/db/encrypted-store";
import { generateKey } from "@/lib/crypto/encryption";
import { isVaultInitialized, initializeVault, lockVault } from "@/lib/crypto/key-manager";
import type { ParsedCCD } from "@/lib/ccd/types";

// Reset IDB and in-memory key state between tests
beforeEach(() => {
  indexedDB = new IDBFactory();
  lockVault();
});

function makeFakeCCD(id: string): ParsedCCD {
  return {
    documentInfo: {
      id,
      title: `Test Doc ${id}`,
      effectiveTime: "2025-01-10",
      sourceFile: `${id}.xml`,
    },
    patient: {
      name: "Jane Doe",
      dateOfBirth: "1980-01-15",
      gender: "Female",
    },
    medications: [
      {
        id: "med-1",
        name: "Metformin",
        status: "active",
      },
    ],
    results: [],
    problems: [],
    allergies: [],
    vitalSigns: [],
    immunizations: [],
  };
}

describe("encrypted-store", () => {
  describe("storeEncryptedDocument", () => {
    it("stores and retrieves encrypted health data", async () => {
      const key = await generateKey();
      const ccd = makeFakeCCD("doc-1");

      const wasNew = await storeEncryptedDocument(ccd, "<xml>doc-1</xml>", key);
      expect(wasNew).toBe(true);

      const allData = await getAllEncryptedHealthData(key);
      expect(allData).toHaveLength(1);
      expect(allData[0].documentInfo.id).toBe("doc-1");
      expect(allData[0].medications[0].name).toBe("Metformin");
    });

    it("deduplicates by content hash", async () => {
      const key = await generateKey();
      const ccd = makeFakeCCD("doc-1");

      await storeEncryptedDocument(ccd, "<xml>same</xml>", key);
      const wasNew = await storeEncryptedDocument(ccd, "<xml>same</xml>", key);
      expect(wasNew).toBe(false);

      const allData = await getAllEncryptedHealthData(key);
      expect(allData).toHaveLength(1);
    });

    it("deduplicates by document ID even with different content", async () => {
      const key = await generateKey();
      const ccd = makeFakeCCD("doc-1");

      await storeEncryptedDocument(ccd, "<xml>version-1</xml>", key);
      const wasNew = await storeEncryptedDocument(ccd, "<xml>version-2</xml>", key);
      expect(wasNew).toBe(false);

      const allData = await getAllEncryptedHealthData(key);
      expect(allData).toHaveLength(1);
    });

    it("stores multiple documents", async () => {
      const key = await generateKey();
      await storeEncryptedDocument(makeFakeCCD("a"), "<xml>a</xml>", key);
      await storeEncryptedDocument(makeFakeCCD("b"), "<xml>b</xml>", key);

      const allData = await getAllEncryptedHealthData(key);
      expect(allData).toHaveLength(2);
    });
  });

  describe("getAllEncryptedHealthData", () => {
    it("returns empty array when no data", async () => {
      const key = await generateKey();
      const allData = await getAllEncryptedHealthData(key);
      expect(allData).toEqual([]);
    });

    it("fails to decrypt with wrong key", async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();
      const ccd = makeFakeCCD("doc-1");

      await storeEncryptedDocument(ccd, "<xml>doc-1</xml>", key1);
      await expect(getAllEncryptedHealthData(key2)).rejects.toThrow();
    });
  });

  describe("deleteAllData", () => {
    it("clears all stores including vault", async () => {
      const key = await generateKey();
      await storeEncryptedDocument(makeFakeCCD("doc-1"), "<xml>1</xml>", key);
      await initializeVault("test-pass");

      await deleteAllData();

      const allData = await getAllEncryptedHealthData(key);
      expect(allData).toEqual([]);
      expect(await isVaultInitialized()).toBe(false);
    });
  });

  describe("deleteHealthDataOnly", () => {
    it("clears health data but preserves vault", async () => {
      await initializeVault("test-pass");
      const key = await generateKey();
      await storeEncryptedDocument(makeFakeCCD("doc-1"), "<xml>1</xml>", key);

      await deleteHealthDataOnly();

      const allData = await getAllEncryptedHealthData(key);
      expect(allData).toEqual([]);
      // Vault should still exist
      expect(await isVaultInitialized()).toBe(true);
    });
  });
});
