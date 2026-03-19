/**
 * Types for medical API responses.
 */

/** NLM Clinical Tables API - LOINC code lookup result */
export interface LoincLookup {
  loincCode: string;
  longCommonName: string;
  component: string;
  system: string;
}

/** MedlinePlus Connect API - health topic result */
export interface MedlinePlusArticle {
  title: string;
  url: string;
  snippet: string;
  fullSummary?: string;
  source: "MedlinePlus";
}

/** OpenFDA drug label result */
export interface DrugLabel {
  brandName?: string;
  genericName: string;
  indications?: string;
  adverseReactions?: string;
  drugInteractions?: string;
  warnings?: string;
  dosage?: string;
}

/** OpenFDA adverse event summary */
export interface AdverseEventSummary {
  drugName: string;
  topReactions: Array<{ term: string; count: number }>;
  totalReports: number;
}

/** Unified enrichment context returned by the facade */
export interface MedicalContext {
  query: string;
  loincCode?: string;
  articles: MedlinePlusArticle[];
  drugLabel?: DrugLabel;
  adverseEvents?: AdverseEventSummary;
  fromCache: boolean;
}
