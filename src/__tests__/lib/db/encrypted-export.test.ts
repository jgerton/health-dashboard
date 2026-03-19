import { describe, it, expect, beforeEach } from "vitest";
import {
  exportEncryptedData,
  importEncryptedData,
  type EncryptedExportPayload,
} from "@/lib/db/encrypted-export";
import { storeEncryptedDocument } from "@/lib/db/encrypted-store";
import { generateKey } from "@/lib/crypto/encryption";
import { deriveKeyFromPassphrase } from "@/lib/crypto/encryption";
import type { ParsedCCD } from "@/lib/ccd/types";

beforeEach(() => {
  indexedDB = new IDBFactory();
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
    medications: [{ id: "med-1", name: "Metformin", status: "active" }],
    results: [],
    problems: [],
    allergies: [],
    vitalSigns: [],
    immunizations: [],
  };
}

describe("encrypted-export", () => {
  describe("exportEncryptedData", () => {
    it("exports data encrypted with export passphrase", async () => {
      const masterKey = await generateKey();
      await storeEncryptedDocument(makeFakeCCD("doc-1"), "<xml>1</xml>", masterKey);

      const payload = await exportEncryptedData(masterKey, "export-pass");
      expect(payload.version).toBe(2);
      expect(payload.encrypted).toBeDefined();
      expect(payload.salt).toBeDefined();
      // Should not contain plaintext health data
      expect(JSON.stringify(payload)).not.toContain("Metformin");
    });
  });

  describe("importEncryptedData", () => {
    it("round-trips through export and import", async () => {
      const masterKey = await generateKey();
      await storeEncryptedDocument(makeFakeCCD("doc-1"), "<xml>1</xml>", masterKey);

      const payload = await exportEncryptedData(masterKey, "export-pass");

      // Clear DB and import into fresh state
      indexedDB = new IDBFactory();
      const newMasterKey = await generateKey();

      const result = await importEncryptedData(
        JSON.stringify(payload),
        "export-pass",
        newMasterKey
      );
      expect(result.imported).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it("fails with wrong export passphrase", async () => {
      const masterKey = await generateKey();
      await storeEncryptedDocument(makeFakeCCD("doc-1"), "<xml>1</xml>", masterKey);

      const payload = await exportEncryptedData(masterKey, "correct-pass");

      indexedDB = new IDBFactory();
      const newMasterKey = await generateKey();

      await expect(
        importEncryptedData(
          JSON.stringify(payload),
          "wrong-pass",
          newMasterKey
        )
      ).rejects.toThrow();
    });

    it("rejects invalid JSON", async () => {
      const key = await generateKey();
      const result = await importEncryptedData("not json", "pass", key);
      expect(result.imported).toBe(0);
      expect(result.errors).toContain("Invalid export file");
    });

    it("rejects v1 unencrypted exports with clear error", async () => {
      const key = await generateKey();
      const v1 = JSON.stringify({ version: 1, healthData: [] });
      const result = await importEncryptedData(v1, "pass", key);
      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain("unencrypted");
    });
  });
});
