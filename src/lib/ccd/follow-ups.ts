/**
 * Follow-up detection from parsed CCD data.
 *
 * Scans problems, lab results, and free text for indicators
 * that a follow-up appointment may be needed. Best-effort
 * pattern matching, not clinical NLP.
 */

import type { ParsedCCD } from "./types";

export interface FollowUp {
  suggestedDate: string;
  reason: string;
  source: string;
  documentId: string;
}

/** Common lab panel recheck intervals in months */
const LAB_RECHECK_MONTHS: Record<string, number> = {
  "lipid panel": 12,
  "comprehensive metabolic panel": 12,
  "basic metabolic panel": 12,
  "cbc": 12,
  "complete blood count": 12,
  "hemoglobin a1c": 6,
  "hba1c": 6,
  "thyroid": 12,
  "tsh": 12,
  "vitamin d": 6,
  "psa": 12,
};

/**
 * Extract follow-up suggestions from a parsed CCD document.
 */
export function extractFollowUps(ccd: ParsedCCD): FollowUp[] {
  const followUps: FollowUp[] = [];
  const now = new Date();
  const documentId = ccd.documentInfo.id;

  // 1. Problems with future onset dates
  for (const problem of ccd.problems) {
    if (!problem.onsetDate) continue;
    const onsetDate = new Date(problem.onsetDate);
    if (onsetDate > now) {
      followUps.push({
        suggestedDate: problem.onsetDate,
        reason: `Follow up: ${problem.name}`,
        source: "Problems",
        documentId,
      });
    }
  }

  // 2. Lab results with common recheck intervals
  for (const result of ccd.results) {
    const panelLower = result.panelName.toLowerCase();
    let recheckMonths: number | undefined;

    for (const [pattern, months] of Object.entries(LAB_RECHECK_MONTHS)) {
      if (panelLower.includes(pattern)) {
        recheckMonths = months;
        break;
      }
    }

    if (!recheckMonths) continue;

    const labDate = new Date(result.date);
    const recheckDate = new Date(labDate);
    recheckDate.setMonth(recheckDate.getMonth() + recheckMonths);

    // Only suggest if recheck date is in the future
    if (recheckDate > now) {
      followUps.push({
        suggestedDate: recheckDate.toISOString().split("T")[0],
        reason: `Recheck: ${result.panelName}`,
        source: "Lab Results",
        documentId,
      });
    }
  }

  return followUps;
}
