import { describe, it, expect, beforeEach } from "vitest";
import { migrateUnencryptedData } from "@/lib/db/migration";
import { storeDocument } from "@/lib/db/idb-store";
import { getAllEncryptedHealthData } from "@/lib/db/encrypted-store";
import { generateKey } from "@/lib/crypto/encryption";
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

describe("migrateUnencryptedData", () => {
  it("migrates unencrypted data to encrypted format", async () => {
    // Store unencrypted data (old way)
    await storeDocument(makeFakeCCD("doc-1"), "<xml>1</xml>");
    await storeDocument(makeFakeCCD("doc-2"), "<xml>2</xml>");

    const key = await generateKey();
    const migrated = await migrateUnencryptedData(key);
    expect(migrated).toBe(2);

    // Data should now be readable via encrypted store
    const data = await getAllEncryptedHealthData(key);
    expect(data).toHaveLength(2);
    expect(data.map((d) => d.documentInfo.id).sort()).toEqual(["doc-1", "doc-2"]);
  });

  it("returns 0 when no unencrypted data exists", async () => {
    const key = await generateKey();
    const migrated = await migrateUnencryptedData(key);
    expect(migrated).toBe(0);
  });

  it("does not duplicate already-migrated data", async () => {
    await storeDocument(makeFakeCCD("doc-1"), "<xml>1</xml>");
    const key = await generateKey();

    await migrateUnencryptedData(key);
    const migrated2 = await migrateUnencryptedData(key);
    expect(migrated2).toBe(0);
  });
});
