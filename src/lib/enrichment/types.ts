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
