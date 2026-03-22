# M4 Plan 1: PHI Scrubber + Enrichment Types + IDB v3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PHI scrubbing utilities, enrichment type definitions (Annotation, Insight), IDB v3 migration with annotations/insights stores, encrypted enrichment storage, and .enrichment.json import support.

**Architecture:** A new `src/lib/scrub/` module provides pure functions that strip patient-identifiable fields from health records. A new `src/lib/enrichment/` module defines the Annotation and Insight types plus the EnrichmentExport JSON schema. IDB bumps from v2 to v3 adding `annotations` and `insights` stores. Encrypted storage functions follow the existing encrypted-appointments pattern. FileUpload accepts `.enrichment.json` files.

**Tech Stack:** TypeScript, IndexedDB, Web Crypto API, Vitest + jsdom + fake-indexeddb

**Spec:** `docs/superpowers/specs/2026-03-19-m4-health-enrichment-pipeline-design.md` (Subsystems 1 + 4)

---

### Task 1: Enrichment types

**Files:**
- Create: `src/lib/enrichment/types.ts`
- Create: `src/lib/enrichment/index.ts`

- [ ] **Step 1: Create enrichment types**

Create `src/lib/enrichment/types.ts`:

```typescript
/**
 * Types for health data enrichments.
 *
 * Annotations attach to individual health records (lab results, medications, etc.)
 * Insights are standalone cross-record analyses (trends, patterns).
 * EnrichmentExport is the JSON schema for importing enrichments from CLI.
 */

export interface Annotation {
  id: string;
  recordId: string;
  recordType: "lab" | "medication" | "problem" | "allergy" | "vital";
  tags: string[];
  severity: "info" | "warning" | "alert";
  title: string;
  explanation: string;
  sources: string[];
  enrichedAt: string;
}

export interface Insight {
  id: string;
  tags: string[];
  title: string;
  summary: string;
  detail: string;
  trendData?: Array<{ date: string; value: number; label: string }>;
  dateRange?: { start: string; end: string };
  enrichedAt: string;
}

export interface EnrichmentExport {
  version: 1;
  generatedAt: string;
  annotations: Array<Omit<Annotation, "id" | "enrichedAt">>;
  insights: Array<Omit<Insight, "id" | "enrichedAt">>;
}
```

- [ ] **Step 2: Create barrel export**

Create `src/lib/enrichment/index.ts`:

```typescript
export type { Annotation, Insight, EnrichmentExport } from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/enrichment/types.ts src/lib/enrichment/index.ts
git commit -m "feat: add enrichment types (Annotation, Insight, EnrichmentExport)"
```

---

### Task 2: PHI scrubber (TDD)

**Files:**
- Create: `src/__tests__/lib/scrub/scrubber.test.ts`
- Create: `src/lib/scrub/scrubber.ts`
- Create: `src/lib/scrub/index.ts`

- [ ] **Step 1: Write failing scrubber tests**

Create `src/__tests__/lib/scrub/scrubber.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { scrubForExport, type RawHealthRecord } from "@/lib/scrub/scrubber";

describe("scrubForExport", () => {
  it("strips patient name from record data", () => {
    const records: RawHealthRecord[] = [
      {
        type: "lab",
        originalId: "lab-1",
        data: {
          patientName: "John Doe",
          panelName: "Lipid Panel",
          value: "210",
          unit: "mg/dL",
        },
      },
    ];

    const scrubbed = scrubForExport(records);
    expect(scrubbed[0].data).not.toHaveProperty("patientName");
    expect(scrubbed[0].data.panelName).toBe("Lipid Panel");
    expect(scrubbed[0].data.value).toBe("210");
  });

  it("strips date of birth", () => {
    const records: RawHealthRecord[] = [
      {
        type: "medication",
        originalId: "med-1",
        data: {
          dateOfBirth: "1960-01-15",
          name: "Metformin",
          dose: "500mg",
        },
      },
    ];

    const scrubbed = scrubForExport(records);
    expect(scrubbed[0].data).not.toHaveProperty("dateOfBirth");
    expect(scrubbed[0].data.name).toBe("Metformin");
  });

  it("strips address fields", () => {
    const records: RawHealthRecord[] = [
      {
        type: "problem",
        originalId: "prob-1",
        data: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
          name: "Hypertension",
          status: "active",
        },
      },
    ];

    const scrubbed = scrubForExport(records);
    expect(scrubbed[0].data).not.toHaveProperty("street");
    expect(scrubbed[0].data).not.toHaveProperty("city");
    expect(scrubbed[0].data).not.toHaveProperty("state");
    expect(scrubbed[0].data).not.toHaveProperty("zip");
    expect(scrubbed[0].data.name).toBe("Hypertension");
  });

  it("replaces document IDs with placeholders", () => {
    const records: RawHealthRecord[] = [
      {
        type: "lab",
        originalId: "lab-1",
        data: {
          documentId: "doc-abc-123-real-id",
          panelName: "CBC",
        },
      },
    ];

    const scrubbed = scrubForExport(records);
    expect(scrubbed[0].data.documentId).toBe("doc-1");
  });

  it("strips source file names", () => {
    const records: RawHealthRecord[] = [
      {
        type: "lab",
        originalId: "lab-1",
        data: {
          sourceFile: "John_Doe_Lab_Results_2026.xml",
          panelName: "TSH",
        },
      },
    ];

    const scrubbed = scrubForExport(records);
    expect(scrubbed[0].data).not.toHaveProperty("sourceFile");
  });

  it("preserves clinical values and medical codes", () => {
    const records: RawHealthRecord[] = [
      {
        type: "lab",
        originalId: "lab-1",
        data: {
          patientName: "Jane Smith",
          panelName: "Hemoglobin A1c",
          loincCode: "4548-4",
          value: "6.8",
          unit: "%",
          referenceRangeLow: "4.0",
          referenceRangeHigh: "5.6",
          interpretation: "high",
          date: "2026-03-01",
        },
      },
    ];

    const scrubbed = scrubForExport(records);
    expect(scrubbed[0].data.panelName).toBe("Hemoglobin A1c");
    expect(scrubbed[0].data.loincCode).toBe("4548-4");
    expect(scrubbed[0].data.value).toBe("6.8");
    expect(scrubbed[0].data.unit).toBe("%");
    expect(scrubbed[0].data.referenceRangeLow).toBe("4.0");
    expect(scrubbed[0].data.referenceRangeHigh).toBe("5.6");
    expect(scrubbed[0].data.interpretation).toBe("high");
    expect(scrubbed[0].data.date).toBe("2026-03-01");
  });

  it("preserves originalId for linking enrichments back", () => {
    const records: RawHealthRecord[] = [
      {
        type: "vital",
        originalId: "vital-abc-123",
        data: { name: "Blood Pressure", value: "140/90" },
      },
    ];

    const scrubbed = scrubForExport(records);
    expect(scrubbed[0].originalId).toBe("vital-abc-123");
    expect(scrubbed[0].type).toBe("vital");
  });

  it("handles multiple records with sequential doc ID placeholders", () => {
    const records: RawHealthRecord[] = [
      {
        type: "lab",
        originalId: "lab-1",
        data: { documentId: "real-doc-1", panelName: "CBC" },
      },
      {
        type: "lab",
        originalId: "lab-2",
        data: { documentId: "real-doc-2", panelName: "BMP" },
      },
    ];

    const scrubbed = scrubForExport(records);
    expect(scrubbed[0].data.documentId).toBe("doc-1");
    expect(scrubbed[1].data.documentId).toBe("doc-2");
  });

  it("does not mutate the original records", () => {
    const records: RawHealthRecord[] = [
      {
        type: "medication",
        originalId: "med-1",
        data: { patientName: "John", name: "Aspirin" },
      },
    ];

    scrubForExport(records);
    expect(records[0].data.patientName).toBe("John");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/scrub/scrubber.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the PHI scrubber**

Create `src/lib/scrub/scrubber.ts`:

```typescript
/**
 * PHI scrubber for health record data.
 *
 * Strips patient-identifiable fields (name, DOB, address, document IDs,
 * source filenames) before outbound API calls. Preserves all clinical
 * values, dates of service, and medical codes.
 */

export interface RawHealthRecord {
  type: "lab" | "medication" | "problem" | "allergy" | "vital" | "appointment";
  data: Record<string, unknown>;
  originalId: string;
}

export interface ScrubbedRecord {
  type: "lab" | "medication" | "problem" | "allergy" | "vital" | "appointment";
  data: Record<string, unknown>;
  originalId: string;
}

/** Fields that contain patient-identifiable information */
const PHI_FIELDS = new Set([
  "patientName",
  "dateOfBirth",
  "street",
  "city",
  "state",
  "zip",
  "address",
  "sourceFile",
  "gender",
  "phone",
  "email",
  "ssn",
  "mrn",
  "medicalRecordNumber",
]);

/**
 * Scrub PHI from health records for safe export to external APIs.
 * Returns new records with PHI removed. Does not mutate inputs.
 * Document IDs are replaced with sequential placeholders.
 */
export function scrubForExport(records: RawHealthRecord[]): ScrubbedRecord[] {
  let docCounter = 0;
  const docIdMap = new Map<string, string>();

  return records.map((record) => {
    const cleanData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record.data)) {
      if (PHI_FIELDS.has(key)) {
        continue;
      }

      if (key === "documentId" && typeof value === "string") {
        if (!docIdMap.has(value)) {
          docCounter++;
          docIdMap.set(value, `doc-${docCounter}`);
        }
        cleanData[key] = docIdMap.get(value);
        continue;
      }

      cleanData[key] = value;
    }

    return {
      type: record.type,
      originalId: record.originalId,
      data: cleanData,
    };
  });
}
```

- [ ] **Step 4: Create barrel export**

Create `src/lib/scrub/index.ts`:

```typescript
export { scrubForExport, type RawHealthRecord, type ScrubbedRecord } from "./scrubber";
```

- [ ] **Step 5: Run scrubber tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/scrub/scrubber.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/scrub/ src/__tests__/lib/scrub/
git commit -m "feat: add PHI scrubber for safe health data export"
```

---

### Task 3: IDB v3 migration (TDD)

**Files:**
- Create: `src/__tests__/lib/db/idb-migration-v3.test.ts`
- Modify: `src/lib/db/idb-helpers.ts`

- [ ] **Step 1: Write failing v3 migration tests**

Create `src/__tests__/lib/db/idb-migration-v3.test.ts`:

```typescript
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
    // Simulate v2 database
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

    // Write test data to v2
    await new Promise<void>((resolve, reject) => {
      const tx = dbV2.transaction("meta", "readwrite");
      tx.objectStore("meta").put({ key: "test-v3", value: "preserved" });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    dbV2.close();

    // Open with v3
    const db = await openDB();
    expect(db.objectStoreNames.contains("annotations")).toBe(true);
    expect(db.objectStoreNames.contains("insights")).toBe(true);

    // Verify old data preserved
    const tx = db.transaction("meta", "readonly");
    const request = tx.objectStore("meta").get("test-v3");
    const result = await new Promise<{ key: string; value: string } | undefined>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    expect(result?.value).toBe("preserved");
    db.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/db/idb-migration-v3.test.ts
```

Expected: FAIL (STORES.annotations does not exist, DB_VERSION is still 2).

- [ ] **Step 3: Update idb-helpers.ts for v3**

In `src/lib/db/idb-helpers.ts`:

1. Change `DB_VERSION` from 2 to 3.

2. Add `annotations` and `insights` to `STORES`:

```typescript
export const STORES = {
  documents: "documents",
  healthData: "healthData",
  meta: "meta",
  appointments: "appointments",
  annotations: "annotations",
  insights: "insights",
} as const;
```

3. Add the v3 migration block after the v2 block in `onupgradeneeded`:

```typescript
      // v2 -> v3: Add annotations and insights stores
      if (oldVersion < 3) {
        const annotStore = db.createObjectStore(STORES.annotations, {
          keyPath: "id",
        });
        annotStore.createIndex("recordId", "recordId", { unique: false });
        annotStore.createIndex("tags", "tags", { unique: false, multiEntry: true });

        const insightStore = db.createObjectStore(STORES.insights, {
          keyPath: "id",
        });
        insightStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
      }
```

- [ ] **Step 4: Run migration tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/db/idb-migration-v3.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/idb-helpers.ts src/__tests__/lib/db/idb-migration-v3.test.ts
git commit -m "feat: bump IDB to v3, add annotations and insights stores"
```

---

### Task 4: Encrypted enrichment storage (TDD)

**Files:**
- Create: `src/__tests__/lib/db/encrypted-enrichments.test.ts`
- Create: `src/lib/db/encrypted-enrichments.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: Write failing enrichment store tests**

Create `src/__tests__/lib/db/encrypted-enrichments.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  storeEncryptedAnnotation,
  getAllEncryptedAnnotations,
  getAnnotationsForRecord,
  storeEncryptedInsight,
  getAllEncryptedInsights,
  deleteAnnotation,
  deleteInsight,
} from "@/lib/db/encrypted-enrichments";
import { generateKey } from "@/lib/crypto/encryption";
import type { Annotation, Insight } from "@/lib/enrichment/types";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: crypto.randomUUID(),
    recordId: "lab-001",
    recordType: "lab",
    tags: ["labs"],
    severity: "info",
    title: "Test annotation",
    explanation: "Test explanation",
    sources: ["MedlinePlus"],
    enrichedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: crypto.randomUUID(),
    tags: ["trends"],
    title: "Test insight",
    summary: "Test summary",
    detail: "Test detail",
    enrichedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("encrypted annotations", () => {
  it("stores and retrieves an annotation", async () => {
    const key = await generateKey();
    const annotation = makeAnnotation();

    await storeEncryptedAnnotation(annotation, key);
    const all = await getAllEncryptedAnnotations(key);

    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Test annotation");
    expect(all[0].recordId).toBe("lab-001");
  });

  it("retrieves annotations for a specific record", async () => {
    const key = await generateKey();
    await storeEncryptedAnnotation(makeAnnotation({ recordId: "lab-001" }), key);
    await storeEncryptedAnnotation(makeAnnotation({ recordId: "lab-002" }), key);
    await storeEncryptedAnnotation(makeAnnotation({ recordId: "lab-001", title: "Second" }), key);

    const forRecord = await getAnnotationsForRecord("lab-001", key);
    expect(forRecord).toHaveLength(2);
  });

  it("deduplicates by recordId + recordType + title", async () => {
    const key = await generateKey();
    const a1 = makeAnnotation({ recordId: "lab-001", recordType: "lab", title: "Same" });
    const a2 = makeAnnotation({ recordId: "lab-001", recordType: "lab", title: "Same" });

    const wasNew1 = await storeEncryptedAnnotation(a1, key);
    const wasNew2 = await storeEncryptedAnnotation(a2, key);

    expect(wasNew1).toBe(true);
    expect(wasNew2).toBe(false);

    const all = await getAllEncryptedAnnotations(key);
    expect(all).toHaveLength(1);
  });

  it("deletes an annotation by id", async () => {
    const key = await generateKey();
    const annotation = makeAnnotation();
    await storeEncryptedAnnotation(annotation, key);

    await deleteAnnotation(annotation.id);

    const all = await getAllEncryptedAnnotations(key);
    expect(all).toEqual([]);
  });

  it("fails to decrypt with wrong key", async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    await storeEncryptedAnnotation(makeAnnotation(), key1);
    await expect(getAllEncryptedAnnotations(key2)).rejects.toThrow();
  });
});

describe("encrypted insights", () => {
  it("stores and retrieves an insight", async () => {
    const key = await generateKey();
    const insight = makeInsight();

    await storeEncryptedInsight(insight, key);
    const all = await getAllEncryptedInsights(key);

    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Test insight");
  });

  it("stores insight with trend data", async () => {
    const key = await generateKey();
    const insight = makeInsight({
      trendData: [
        { date: "2026-01-01", value: 6.5, label: "A1C" },
        { date: "2026-03-01", value: 6.2, label: "A1C" },
      ],
      dateRange: { start: "2026-01-01", end: "2026-03-01" },
    });

    await storeEncryptedInsight(insight, key);
    const all = await getAllEncryptedInsights(key);

    expect(all[0].trendData).toHaveLength(2);
    expect(all[0].dateRange?.start).toBe("2026-01-01");
  });

  it("deletes an insight by id", async () => {
    const key = await generateKey();
    const insight = makeInsight();
    await storeEncryptedInsight(insight, key);

    await deleteInsight(insight.id);

    const all = await getAllEncryptedInsights(key);
    expect(all).toEqual([]);
  });

  it("returns empty arrays when no data", async () => {
    const key = await generateKey();
    expect(await getAllEncryptedAnnotations(key)).toEqual([]);
    expect(await getAllEncryptedInsights(key)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/db/encrypted-enrichments.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement encrypted-enrichments.ts**

Create `src/lib/db/encrypted-enrichments.ts`:

```typescript
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
```

- [ ] **Step 4: Update db barrel exports**

Add to `src/lib/db/index.ts`:

```typescript
export {
  storeEncryptedAnnotation,
  getAllEncryptedAnnotations,
  getAnnotationsForRecord,
  storeEncryptedInsight,
  getAllEncryptedInsights,
  deleteAnnotation,
  deleteInsight,
} from "./encrypted-enrichments";
```

- [ ] **Step 5: Run enrichment store tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/db/encrypted-enrichments.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/encrypted-enrichments.ts src/lib/db/index.ts src/__tests__/lib/db/encrypted-enrichments.test.ts
git commit -m "feat: add encrypted annotation and insight storage"
```

---

### Task 5: Update deleteHealthDataOnly + enrichment import in FileUpload

**Files:**
- Modify: `src/lib/db/encrypted-store.ts`
- Modify: `src/components/import/file-upload.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read current files**

Read `src/lib/db/encrypted-store.ts`, `src/components/import/file-upload.tsx`, and `src/app/page.tsx`.

- [ ] **Step 2: Update deleteHealthDataOnly**

In `src/lib/db/encrypted-store.ts`, add `STORES.annotations` and `STORES.insights` to the transaction:

```typescript
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
```

- [ ] **Step 3: Update FileUpload to accept .enrichment.json**

In `src/components/import/file-upload.tsx`:

1. Add to `FileUploadProps`:

```typescript
onImportEnrichment?: (data: string) => Promise<{ annotations: number; insights: number }>;
```

2. Add `enrichmentFile?: boolean` and `enrichmentCounts?: { annotations: number; insights: number }` to `ImportResult` interface.

3. In `processFiles`, add a new branch for `.enrichment.json` files (check `file.name.endsWith(".enrichment.json")`):

```typescript
} else if (file.name.endsWith(".enrichment.json")) {
  try {
    const text = await file.text();
    if (onImportEnrichment) {
      const counts = await onImportEnrichment(text);
      importResults.push({
        file: file.name,
        success: true,
        enrichmentFile: true,
        enrichmentCounts: counts,
      });
    } else {
      importResults.push({
        file: file.name,
        success: false,
        error: "Enrichment import not available",
      });
    }
  } catch (e) {
    importResults.push({
      file: file.name,
      success: false,
      error: e instanceof Error ? e.message : "Import error",
    });
  }
}
```

Important: The `.enrichment.json` check MUST come before the `.json` fallback (if any) and the `.ics` check. Place it as the first condition since `.enrichment.json` also ends with `.json`.

4. Update the `accept` attribute to `.xml,.ics,.enrichment.json`.

5. Add enrichment result display in the results section:

```tsx
{result.success && result.enrichmentFile && (
  <span className="text-gray-400 text-xs ml-auto">
    {result.enrichmentCounts
      ? `${result.enrichmentCounts.annotations} annotations, ${result.enrichmentCounts.insights} insights`
      : "enrichments imported"}
  </span>
)}
```

- [ ] **Step 4: Create useEnrichments hook**

Create `src/lib/hooks/use-enrichments.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Annotation, Insight, EnrichmentExport } from "@/lib/enrichment/types";
import {
  storeEncryptedAnnotation,
  getAllEncryptedAnnotations,
  storeEncryptedInsight,
  getAllEncryptedInsights,
} from "@/lib/db/encrypted-enrichments";

export function useEnrichments(masterKey: CryptoKey | null) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEnrichments = useCallback(async () => {
    if (!masterKey) {
      setAnnotations([]);
      setInsights([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [storedAnnotations, storedInsights] = await Promise.all([
        getAllEncryptedAnnotations(masterKey),
        getAllEncryptedInsights(masterKey),
      ]);
      setAnnotations(storedAnnotations);
      setInsights(storedInsights);
    } finally {
      setIsLoading(false);
    }
  }, [masterKey]);

  useEffect(() => {
    loadEnrichments();
  }, [loadEnrichments]);

  const importEnrichmentJson = useCallback(
    async (jsonString: string): Promise<{ annotations: number; insights: number }> => {
      if (!masterKey) throw new Error("Vault is locked");

      const parsed = JSON.parse(jsonString) as EnrichmentExport;
      if (parsed.version !== 1) {
        throw new Error(`Unsupported enrichment version: ${parsed.version}`);
      }

      let annotationCount = 0;
      let insightCount = 0;

      for (const annot of parsed.annotations) {
        const full: Annotation = {
          ...annot,
          id: crypto.randomUUID(),
          enrichedAt: parsed.generatedAt,
        };
        const wasNew = await storeEncryptedAnnotation(full, masterKey);
        if (wasNew) annotationCount++;
      }

      for (const ins of parsed.insights) {
        const full: Insight = {
          ...ins,
          id: crypto.randomUUID(),
          enrichedAt: parsed.generatedAt,
        };
        await storeEncryptedInsight(full, masterKey);
        insightCount++;
      }

      await loadEnrichments();
      return { annotations: annotationCount, insights: insightCount };
    },
    [loadEnrichments, masterKey]
  );

  const getAnnotationsForRecordId = useCallback(
    (recordId: string): Annotation[] => {
      return annotations.filter((a) => a.recordId === recordId);
    },
    [annotations]
  );

  const getInsightsByTag = useCallback(
    (tag: string): Insight[] => {
      return insights.filter((i) => i.tags.includes(tag));
    },
    [insights]
  );

  return {
    annotations,
    insights,
    isLoading,
    importEnrichmentJson,
    getAnnotationsForRecordId,
    getInsightsByTag,
    hasEnrichments: annotations.length > 0 || insights.length > 0,
  };
}
```

- [ ] **Step 5: Wire into page.tsx**

In `src/app/page.tsx`:

1. Import the hook:

```typescript
import { useEnrichments } from "@/lib/hooks/use-enrichments";
```

2. Add alongside other hooks:

```typescript
const { importEnrichmentJson } = useEnrichments(masterKey);
```

3. Pass `onImportEnrichment` to both `FileUpload` instances:

```tsx
onImportEnrichment={async (data) => {
  const result = await importEnrichmentJson(data);
  setTimeout(() => setShowImport(false), 1000);
  return result;
}}
```

- [ ] **Step 6: Verify build**

```bash
cd /e/Projects/health-dashboard && bun run build
```

Expected: Build succeeds.

- [ ] **Step 7: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/encrypted-store.ts src/components/import/file-upload.tsx src/app/page.tsx src/lib/hooks/use-enrichments.ts
git commit -m "feat: add enrichment import support and useEnrichments hook"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the Architecture section after the Comfort Mode block:

```markdown
### Enrichments (`src/lib/enrichment/`, `src/lib/db/encrypted-enrichments.ts`)
- Annotations: per-record explainers (lab explanations, medication reviews) tagged to surface on relevant tabs
- Insights: cross-record analyses (trends, patterns) displayed on landing page and tagged tabs
- Encrypted in IDB `annotations` and `insights` stores (v3 migration)
- Imported via `.enrichment.json` files from CLI enrichment skill
- `useEnrichments` hook provides React state with record and tag filtering

### PHI Scrubber (`src/lib/scrub/`)
- Strips patient-identifiable fields before outbound API calls
- Removes: name, DOB, address, document IDs, source filenames
- Preserves: clinical values, dates of service, medical codes, provider names
- Pure function, no side effects
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add enrichment and PHI scrubber architecture to CLAUDE.md"
```
