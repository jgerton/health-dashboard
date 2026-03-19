import type { LoincLookup } from "./types";

const BASE_URL = "https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search";

/**
 * Looks up a LOINC code for a given lab test name using the NLM Clinical Tables API.
 * Returns the first match or null if not found or on error.
 */
export async function lookupLoinc(testName: string): Promise<LoincLookup | null> {
  const params = new URLSearchParams({
    terms: testName,
    df: "LOINC_NUM,COMPONENT,LONG_COMMON_NAME,SYSTEM",
    maxList: "1",
  });

  try {
    const response = await fetch(`${BASE_URL}?${params}`);
    if (!response.ok) {
      return null;
    }

    // Response format: [totalCount, matchingCodes, null, [["LOINC_NUM", "COMPONENT", "LONG_COMMON_NAME", "SYSTEM"], ...]]
    const data = await response.json() as [number, string[], null, string[][]];
    const results = data[3];

    if (!results || results.length === 0) {
      return null;
    }

    const [loincCode, component, longCommonName, system] = results[0];
    return { loincCode, component, longCommonName, system };
  } catch {
    return null;
  }
}
