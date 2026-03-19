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

/**
 * Extract follow-up suggestions from a parsed CCD document.
 */
export function extractFollowUps(ccd: ParsedCCD): FollowUp[] {
  return [];
}
