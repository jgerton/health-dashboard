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
