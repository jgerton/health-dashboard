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
