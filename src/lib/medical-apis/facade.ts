import type { MedicalContext } from "./types";
import { lookupLoinc } from "./clinical-tables";
import { lookupMedlinePlus, searchHealthTopics } from "./medlineplus";
import { lookupDrugLabel, lookupAdverseEvents } from "./openfda";

type RecordType = "lab" | "medication" | "problem" | "allergy" | "vital";

/**
 * Unified facade that retrieves contextual medical information for a given query
 * and record type by routing to the appropriate underlying API clients.
 */
export async function getMedicalContext(
  query: string,
  recordType: RecordType
): Promise<MedicalContext> {
  switch (recordType) {
    case "lab":
      return getLabContext(query);

    case "medication":
      return getMedicationContext(query);

    case "problem":
    case "allergy":
    case "vital":
      return getGenericContext(query);
  }
}

async function getLabContext(query: string): Promise<MedicalContext> {
  const loinc = await lookupLoinc(query);

  if (loinc) {
    const article = await lookupMedlinePlus(loinc.loincCode, "loinc");
    return {
      query,
      loincCode: loinc.loincCode,
      articles: article ? [article] : [],
      fromCache: false,
    };
  }

  // Fallback to health topic search
  const articles = await searchHealthTopics(query);
  return {
    query,
    articles,
    fromCache: false,
  };
}

async function getMedicationContext(query: string): Promise<MedicalContext> {
  const [drugLabel, adverseEvents, articles] = await Promise.all([
    lookupDrugLabel(query),
    lookupAdverseEvents(query),
    searchHealthTopics(query),
  ]);

  return {
    query,
    articles,
    drugLabel: drugLabel ?? undefined,
    adverseEvents: adverseEvents ?? undefined,
    fromCache: false,
  };
}

async function getGenericContext(query: string): Promise<MedicalContext> {
  const articles = await searchHealthTopics(query);
  return {
    query,
    articles,
    fromCache: false,
  };
}
