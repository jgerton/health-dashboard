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
