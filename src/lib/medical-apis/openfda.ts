import type { DrugLabel, AdverseEventSummary } from "./types";

const LABEL_URL = "https://api.fda.gov/drug/label.json";
const EVENT_URL = "https://api.fda.gov/drug/event.json";

/**
 * Looks up FDA drug label information for a given drug name.
 * Returns label details or null if not found or on error.
 */
export async function lookupDrugLabel(drugName: string): Promise<DrugLabel | null> {
  const params = new URLSearchParams({
    search: `openfda.generic_name:"${drugName}"`,
    limit: "1",
  });

  try {
    const response = await fetch(`${LABEL_URL}?${params}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      results?: Array<{
        openfda?: {
          brand_name?: string[];
          generic_name?: string[];
        };
        indications_and_usage?: string[];
        adverse_reactions?: string[];
        drug_interactions?: string[];
        warnings?: string[];
        dosage_and_administration?: string[];
      }>;
    };

    const result = data?.results?.[0];
    if (!result) {
      return null;
    }

    const genericName = result.openfda?.generic_name?.[0];
    if (!genericName) {
      return null;
    }

    return {
      brandName: result.openfda?.brand_name?.[0],
      genericName,
      indications: result.indications_and_usage?.[0],
      adverseReactions: result.adverse_reactions?.[0],
      drugInteractions: result.drug_interactions?.[0],
      warnings: result.warnings?.[0],
      dosage: result.dosage_and_administration?.[0],
    };
  } catch {
    return null;
  }
}

/**
 * Looks up the top adverse event reactions for a given drug name using the FDA FAERS database.
 * Returns summary with top 10 reactions or null if not found or on error.
 */
export async function lookupAdverseEvents(drugName: string): Promise<AdverseEventSummary | null> {
  const params = new URLSearchParams({
    search: `patient.drug.openfda.generic_name:"${drugName}"`,
    count: "patient.reaction.reactionmeddrapt.exact",
  });

  try {
    const response = await fetch(`${EVENT_URL}?${params}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      meta?: { results?: { total?: number } };
      results?: Array<{ term: string; count: number }>;
    };

    const results = data?.results;
    if (!results) {
      return null;
    }

    const totalReports = data?.meta?.results?.total ?? 0;
    const topReactions = results.slice(0, 10).map(({ term, count }) => ({ term, count }));

    return { drugName, topReactions, totalReports };
  } catch {
    return null;
  }
}
