import type { MedlinePlusArticle } from "./types";

const CONNECT_URL = "https://connect.medlineplus.gov/service";
const SEARCH_URL = "https://wsearch.nlm.nih.gov/ws/query";

const CODE_SYSTEM_OID: Record<"loinc" | "icd", string> = {
  loinc: "2.16.840.1.113883.6.1",
  icd: "2.16.840.1.113883.6.90",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * Looks up a MedlinePlus article for a given code (LOINC or ICD).
 * Returns the first matching article or null if not found or on error.
 */
export async function lookupMedlinePlus(
  code: string,
  codeSystem: "loinc" | "icd"
): Promise<MedlinePlusArticle | null> {
  const params = new URLSearchParams({
    "mainSearchCriteria.v.c": code,
    "mainSearchCriteria.v.cs": CODE_SYSTEM_OID[codeSystem],
    knowledgeResponseType: "application/json",
  });

  try {
    const response = await fetch(`${CONNECT_URL}?${params}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      feed?: {
        entry?: Array<{
          title?: { _value?: string };
          link?: Array<{ href?: string }>;
          summary?: { _value?: string };
        }>;
      };
    };

    const entries = data?.feed?.entry;
    if (!entries || entries.length === 0) {
      return null;
    }

    const entry = entries[0];
    const title = entry.title?._value ?? "";
    const url = entry.link?.[0]?.href ?? "";
    const rawSummary = entry.summary?._value ?? "";
    const snippet = stripHtml(rawSummary);

    return { title, url, snippet, source: "MedlinePlus" };
  } catch {
    return null;
  }
}

/**
 * Searches MedlinePlus Health Topics for a given query string.
 * Returns up to 5 articles, or an empty array on error or no results.
 */
export async function searchHealthTopics(query: string): Promise<MedlinePlusArticle[]> {
  const params = new URLSearchParams({
    db: "healthTopics",
    term: query,
    retmax: "5",
  });

  try {
    const response = await fetch(`${SEARCH_URL}?${params}`);
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();

    // Parse documents with regex: <document url="...">...</document>
    const docRegex = /<document url="([^"]+)">([\s\S]*?)<\/document>/g;
    const titleRegex = /<content name="title">([\s\S]*?)<\/content>/;
    const snippetRegex = /<content name="snippet">([\s\S]*?)<\/content>/;
    const fullSummaryRegex = /<content name="FullSummary">([\s\S]*?)<\/content>/;

    const articles: MedlinePlusArticle[] = [];
    let match: RegExpExecArray | null;

    while ((match = docRegex.exec(xml)) !== null) {
      const url = match[1];
      const body = match[2];

      const titleMatch = titleRegex.exec(body);
      const snippetMatch = snippetRegex.exec(body);
      const fullSummaryMatch = fullSummaryRegex.exec(body);

      const title = titleMatch ? stripHtml(titleMatch[1]) : "";
      const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";
      const fullSummary = fullSummaryMatch ? stripHtml(fullSummaryMatch[1]) : undefined;

      articles.push({ title, url, snippet, ...(fullSummary ? { fullSummary } : {}), source: "MedlinePlus" });
    }

    return articles;
  } catch {
    return [];
  }
}
