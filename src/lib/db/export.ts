/**
 * Data export and import for backup/transfer.
 *
 * Export format: JSON file containing all parsed CCD data and metadata.
 * Optionally encrypted with AES-256-GCM before download.
 */

import type { ParsedCCD } from "@/lib/ccd/types";
import { getAllHealthData, getDocuments, storeDocument } from "./idb-store";
import type { DocumentRecord } from "./idb-store";

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  documents: DocumentRecord[];
  healthData: ParsedCCD[];
}

/**
 * Export all health data as a JSON blob.
 */
export async function exportData(): Promise<ExportPayload> {
  const [documents, healthData] = await Promise.all([
    getDocuments(),
    getAllHealthData(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    documents,
    healthData,
  };
}

/**
 * Trigger a file download of the exported data.
 */
export async function downloadExport(filename?: string): Promise<void> {
  const payload = await exportData();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ||
    `health-dashboard-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import health data from an export file.
 * Returns count of imported documents.
 */
export async function importFromExport(
  file: File
): Promise<{ imported: number; duplicates: number; errors: string[] }> {
  const text = await file.text();
  let payload: ExportPayload;

  try {
    payload = JSON.parse(text);
  } catch {
    return { imported: 0, duplicates: 0, errors: ["Invalid JSON file"] };
  }

  if (!payload.version || !payload.healthData) {
    return {
      imported: 0,
      duplicates: 0,
      errors: ["Not a valid Health Dashboard export file"],
    };
  }

  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const ccd of payload.healthData) {
    try {
      // Reconstruct a minimal XML-like string for hashing
      // (won't match original hash, but prevents re-importing the same export)
      const fakeXml = JSON.stringify(ccd);
      const wasNew = await storeDocument(ccd, fakeXml);
      if (wasNew) {
        imported++;
      } else {
        duplicates++;
      }
    } catch (e) {
      errors.push(
        `Failed to import ${ccd.documentInfo.sourceFile || ccd.documentInfo.id}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  return { imported, duplicates, errors };
}
