# M4 Plan 2: Medical API Client

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a TypeScript module that wraps free medical APIs (NLM Clinical Tables, MedlinePlus Connect, MedlinePlus Health Topics, OpenFDA) for use by the CLI enrichment skill, plus set up Health Reference and Health Journal NotebookLM notebooks.

**Architecture:** A new `src/lib/medical-apis/` module with one file per API client plus a unified facade. Each client is a pure async function that calls a public API and returns typed results. A local JSON file cache prevents redundant API calls. NotebookLM notebooks are created via the CLI tool.

**Tech Stack:** TypeScript, fetch API, Vitest, NotebookLM CLI

**Spec:** `docs/superpowers/specs/2026-03-19-m4-health-enrichment-pipeline-design.md` (Subsystem 2)

---

### Task 1: API response types

**Files:**
- Create: `src/lib/medical-apis/types.ts`
- Create: `src/lib/medical-apis/index.ts`

- [ ] **Step 1: Create API types**

Create `src/lib/medical-apis/types.ts`:

```typescript
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
```

- [ ] **Step 2: Create barrel export**

Create `src/lib/medical-apis/index.ts`:

```typescript
export type {
  LoincLookup,
  MedlinePlusArticle,
  DrugLabel,
  AdverseEventSummary,
  MedicalContext,
} from "./types";
export { lookupLoinc } from "./clinical-tables";
export { lookupMedlinePlus, searchHealthTopics } from "./medlineplus";
export { lookupDrugLabel, lookupAdverseEvents } from "./openfda";
export { getMedicalContext } from "./facade";
```

Note: This will have import errors until the other files are created. That's expected.

- [ ] **Step 3: Commit**

```bash
git add src/lib/medical-apis/types.ts src/lib/medical-apis/index.ts
git commit -m "feat: add medical API response types"
```

---

### Task 2: NLM Clinical Tables client (TDD)

**Files:**
- Create: `src/__tests__/lib/medical-apis/clinical-tables.test.ts`
- Create: `src/lib/medical-apis/clinical-tables.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/medical-apis/clinical-tables.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { lookupLoinc } from "@/lib/medical-apis/clinical-tables";

describe("lookupLoinc", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns LOINC code for a known lab test", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          1,
          [["3094-0", "Urea nitrogen", "Urea nitrogen [Mass/volume] in Serum or Plasma", "Ser/Plas"]],
          null,
          [["3094-0", "Urea nitrogen", "Urea nitrogen [Mass/volume] in Serum or Plasma", "Ser/Plas"]],
        ]),
        { status: 200 }
      )
    );

    const result = await lookupLoinc("BUN");
    expect(result).not.toBeNull();
    expect(result!.loincCode).toBe("3094-0");
    expect(result!.component).toBe("Urea nitrogen");
  });

  it("returns null when no results found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([0, [], null, []]), { status: 200 })
    );

    const result = await lookupLoinc("xyznonexistent");
    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const result = await lookupLoinc("BUN");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/medical-apis/clinical-tables.test.ts
```

- [ ] **Step 3: Implement Clinical Tables client**

Create `src/lib/medical-apis/clinical-tables.ts`:

```typescript
/**
 * NLM Clinical Tables API client.
 * Looks up LOINC codes by lab test name.
 * https://clinicaltables.nlm.nih.gov/
 */

import type { LoincLookup } from "./types";

const BASE_URL = "https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search";

/**
 * Look up a LOINC code by lab test name.
 * Returns the best match or null if not found.
 */
export async function lookupLoinc(testName: string): Promise<LoincLookup | null> {
  try {
    const params = new URLSearchParams({
      terms: testName,
      df: "LOINC_NUM,COMPONENT,LONG_COMMON_NAME,SYSTEM",
      maxList: "1",
    });

    const response = await fetch(`${BASE_URL}?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    const results = data[3] as string[][] | undefined;

    if (!results || results.length === 0) return null;

    const [loincCode, component, longCommonName, system] = results[0];
    return { loincCode, component, longCommonName, system };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests, all tests, commit**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/medical-apis/clinical-tables.test.ts
cd /e/Projects/health-dashboard && bunx vitest run
git add src/lib/medical-apis/clinical-tables.ts src/__tests__/lib/medical-apis/
git commit -m "feat: add NLM Clinical Tables LOINC lookup client"
```

---

### Task 3: MedlinePlus clients (TDD)

**Files:**
- Create: `src/__tests__/lib/medical-apis/medlineplus.test.ts`
- Create: `src/lib/medical-apis/medlineplus.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/medical-apis/medlineplus.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { lookupMedlinePlus, searchHealthTopics } from "@/lib/medical-apis/medlineplus";

describe("lookupMedlinePlus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns article for a LOINC code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          feed: {
            entry: [
              {
                title: { _value: "BUN (Blood Urea Nitrogen) Test" },
                link: [{ href: "https://medlineplus.gov/lab-tests/bun/" }],
                summary: { _value: "<p>A BUN test measures the amount of urea nitrogen in your blood.</p>" },
              },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const result = await lookupMedlinePlus("3094-0", "loinc");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("BUN (Blood Urea Nitrogen) Test");
    expect(result!.source).toBe("MedlinePlus");
  });

  it("returns null when no entries found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ feed: {} }), { status: 200 })
    );

    const result = await lookupMedlinePlus("9999-9", "loinc");
    expect(result).toBeNull();
  });
});

describe("searchHealthTopics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns articles for a search term", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        `<?xml version="1.0"?>
        <nlmSearchResult>
          <list>
            <document rank="1" url="https://medlineplus.gov/cholesterol.html">
              <content name="title">Cholesterol</content>
              <content name="FullSummary">Cholesterol is a waxy substance.</content>
              <content name="snippet">Your body needs cholesterol to build cells.</content>
            </document>
          </list>
        </nlmSearchResult>`,
        { status: 200, headers: { "Content-Type": "text/xml" } }
      )
    );

    const results = await searchHealthTopics("cholesterol");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Cholesterol");
    expect(results[0].source).toBe("MedlinePlus");
  });

  it("returns empty array on error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const results = await searchHealthTopics("anything");
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/medical-apis/medlineplus.test.ts
```

- [ ] **Step 3: Implement MedlinePlus clients**

Create `src/lib/medical-apis/medlineplus.ts`:

```typescript
/**
 * MedlinePlus API clients.
 *
 * - MedlinePlus Connect: LOINC/ICD code to plain-language health topic
 * - Health Topics Web Service: keyword search for health articles
 */

import type { MedlinePlusArticle } from "./types";

const CONNECT_URL = "https://connect.medlineplus.gov/service";
const TOPICS_URL = "https://wsearch.nlm.nih.gov/ws/query";

/**
 * Look up a health topic by medical code (LOINC or ICD).
 */
export async function lookupMedlinePlus(
  code: string,
  codeSystem: "loinc" | "icd"
): Promise<MedlinePlusArticle | null> {
  try {
    const params = new URLSearchParams({
      "mainSearchCriteria.v.c": code,
      "mainSearchCriteria.v.cs": codeSystem === "loinc" ? "2.16.840.1.113883.6.1" : "2.16.840.1.113883.6.90",
      "knowledgeResponseType": "application/json",
    });

    const response = await fetch(`${CONNECT_URL}?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    const entries = data?.feed?.entry;

    if (!entries || entries.length === 0) return null;

    const entry = entries[0];
    const title = entry.title?._value || entry.title || "";
    const url = entry.link?.[0]?.href || "";
    const summary = entry.summary?._value || "";

    // Strip HTML tags from summary
    const snippet = summary.replace(/<[^>]*>/g, "").trim();

    return {
      title,
      url,
      snippet,
      fullSummary: summary,
      source: "MedlinePlus",
    };
  } catch {
    return null;
  }
}

/**
 * Search MedlinePlus Health Topics by keyword.
 */
export async function searchHealthTopics(
  query: string
): Promise<MedlinePlusArticle[]> {
  try {
    const params = new URLSearchParams({
      db: "healthTopics",
      term: query,
      retmax: "5",
    });

    const response = await fetch(`${TOPICS_URL}?${params}`);
    if (!response.ok) return [];

    const text = await response.text();
    const articles: MedlinePlusArticle[] = [];

    // Simple XML parsing for the response
    const docRegex = /<document[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/document>/g;
    let match;

    while ((match = docRegex.exec(text)) !== null) {
      const url = match[1];
      const content = match[2];

      const titleMatch = content.match(/<content name="title">([\s\S]*?)<\/content>/);
      const snippetMatch = content.match(/<content name="snippet">([\s\S]*?)<\/content>/);
      const summaryMatch = content.match(/<content name="FullSummary">([\s\S]*?)<\/content>/);

      if (titleMatch) {
        articles.push({
          title: titleMatch[1].trim(),
          url,
          snippet: snippetMatch ? snippetMatch[1].trim() : "",
          fullSummary: summaryMatch ? summaryMatch[1].trim() : undefined,
          source: "MedlinePlus",
        });
      }
    }

    return articles;
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests, all tests, commit**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/medical-apis/medlineplus.test.ts
cd /e/Projects/health-dashboard && bunx vitest run
git add src/lib/medical-apis/medlineplus.ts src/__tests__/lib/medical-apis/medlineplus.test.ts
git commit -m "feat: add MedlinePlus Connect and Health Topics clients"
```

---

### Task 4: OpenFDA client (TDD)

**Files:**
- Create: `src/__tests__/lib/medical-apis/openfda.test.ts`
- Create: `src/lib/medical-apis/openfda.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/medical-apis/openfda.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { lookupDrugLabel, lookupAdverseEvents } from "@/lib/medical-apis/openfda";

describe("lookupDrugLabel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns drug label for a known drug", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              openfda: {
                brand_name: ["GLUCOPHAGE"],
                generic_name: ["METFORMIN HYDROCHLORIDE"],
              },
              indications_and_usage: ["For treatment of type 2 diabetes."],
              adverse_reactions: ["Common: nausea, diarrhea."],
              drug_interactions: ["Alcohol may increase risk of lactic acidosis."],
              warnings: ["Lactic acidosis warning."],
              dosage_and_administration: ["500mg twice daily."],
            },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await lookupDrugLabel("metformin");
    expect(result).not.toBeNull();
    expect(result!.genericName).toBe("METFORMIN HYDROCHLORIDE");
    expect(result!.indications).toContain("type 2 diabetes");
  });

  it("returns null when drug not found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 })
    );

    const result = await lookupDrugLabel("nonexistentdrug");
    expect(result).toBeNull();
  });
});

describe("lookupAdverseEvents", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns adverse event summary", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          meta: { results: { total: 50000 } },
          results: [
            { term: "NAUSEA", count: 5000 },
            { term: "DIARRHOEA", count: 4000 },
            { term: "HEADACHE", count: 3000 },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await lookupAdverseEvents("metformin");
    expect(result).not.toBeNull();
    expect(result!.drugName).toBe("metformin");
    expect(result!.topReactions).toHaveLength(3);
    expect(result!.topReactions[0].term).toBe("NAUSEA");
  });

  it("returns null on error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const result = await lookupAdverseEvents("anything");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/medical-apis/openfda.test.ts
```

- [ ] **Step 3: Implement OpenFDA client**

Create `src/lib/medical-apis/openfda.ts`:

```typescript
/**
 * OpenFDA API client.
 *
 * - Drug labels: prescribing information (indications, interactions, warnings)
 * - Adverse events: real-world side effect reports with counts
 */

import type { DrugLabel, AdverseEventSummary } from "./types";

const LABEL_URL = "https://api.fda.gov/drug/label.json";
const EVENT_URL = "https://api.fda.gov/drug/event.json";

/**
 * Look up drug prescribing information by generic name.
 */
export async function lookupDrugLabel(drugName: string): Promise<DrugLabel | null> {
  try {
    const params = new URLSearchParams({
      search: `openfda.generic_name:"${drugName}"`,
      limit: "1",
    });

    const response = await fetch(`${LABEL_URL}?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) return null;

    return {
      brandName: result.openfda?.brand_name?.[0],
      genericName: result.openfda?.generic_name?.[0] || drugName,
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
 * Look up adverse event reports for a drug.
 * Returns the top 10 most-reported reactions.
 */
export async function lookupAdverseEvents(
  drugName: string
): Promise<AdverseEventSummary | null> {
  try {
    const params = new URLSearchParams({
      search: `patient.drug.openfda.generic_name:"${drugName}"`,
      count: "patient.reaction.reactionmeddrapt.exact",
    });

    const response = await fetch(`${EVENT_URL}?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    const results = data?.results;
    if (!results || results.length === 0) return null;

    const topReactions = results.slice(0, 10).map((r: { term: string; count: number }) => ({
      term: r.term,
      count: r.count,
    }));

    return {
      drugName,
      topReactions,
      totalReports: data.meta?.results?.total || 0,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests, all tests, commit**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/medical-apis/openfda.test.ts
cd /e/Projects/health-dashboard && bunx vitest run
git add src/lib/medical-apis/openfda.ts src/__tests__/lib/medical-apis/openfda.test.ts
git commit -m "feat: add OpenFDA drug label and adverse event clients"
```

---

### Task 5: Unified facade (TDD)

**Files:**
- Create: `src/__tests__/lib/medical-apis/facade.test.ts`
- Create: `src/lib/medical-apis/facade.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/medical-apis/facade.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMedicalContext } from "@/lib/medical-apis/facade";
import * as clinicalTables from "@/lib/medical-apis/clinical-tables";
import * as medlineplus from "@/lib/medical-apis/medlineplus";
import * as openfda from "@/lib/medical-apis/openfda";

describe("getMedicalContext", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns lab context with LOINC lookup and MedlinePlus article", async () => {
    vi.spyOn(clinicalTables, "lookupLoinc").mockResolvedValueOnce({
      loincCode: "3094-0",
      longCommonName: "Urea nitrogen [Mass/volume] in Serum or Plasma",
      component: "Urea nitrogen",
      system: "Ser/Plas",
    });
    vi.spyOn(medlineplus, "lookupMedlinePlus").mockResolvedValueOnce({
      title: "BUN Test",
      url: "https://medlineplus.gov/lab-tests/bun/",
      snippet: "A BUN test measures urea nitrogen.",
      source: "MedlinePlus",
    });

    const ctx = await getMedicalContext("BUN", "lab");
    expect(ctx.loincCode).toBe("3094-0");
    expect(ctx.articles).toHaveLength(1);
    expect(ctx.articles[0].title).toBe("BUN Test");
  });

  it("returns medication context with drug label and adverse events", async () => {
    vi.spyOn(openfda, "lookupDrugLabel").mockResolvedValueOnce({
      genericName: "METFORMIN",
      indications: "Type 2 diabetes",
      adverseReactions: "Nausea, diarrhea",
      drugInteractions: "Alcohol",
      warnings: "Lactic acidosis",
      dosage: "500mg",
    });
    vi.spyOn(openfda, "lookupAdverseEvents").mockResolvedValueOnce({
      drugName: "metformin",
      topReactions: [{ term: "NAUSEA", count: 5000 }],
      totalReports: 50000,
    });

    const ctx = await getMedicalContext("metformin", "medication");
    expect(ctx.drugLabel).not.toBeNull();
    expect(ctx.drugLabel!.genericName).toBe("METFORMIN");
    expect(ctx.adverseEvents).not.toBeNull();
  });

  it("returns condition context with health topic search", async () => {
    vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValueOnce([
      {
        title: "Hypertension",
        url: "https://medlineplus.gov/hypertension.html",
        snippet: "High blood pressure.",
        source: "MedlinePlus",
      },
    ]);

    const ctx = await getMedicalContext("hypertension", "problem");
    expect(ctx.articles).toHaveLength(1);
    expect(ctx.articles[0].title).toBe("Hypertension");
  });

  it("handles all API failures gracefully", async () => {
    vi.spyOn(clinicalTables, "lookupLoinc").mockResolvedValueOnce(null);
    vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValueOnce([]);

    const ctx = await getMedicalContext("unknown", "lab");
    expect(ctx.articles).toEqual([]);
    expect(ctx.loincCode).toBeUndefined();
    expect(ctx.fromCache).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/medical-apis/facade.test.ts
```

- [ ] **Step 3: Implement facade**

Create `src/lib/medical-apis/facade.ts`:

```typescript
/**
 * Unified medical context facade.
 *
 * Routes queries to the appropriate API based on record type
 * and assembles a MedicalContext with all available information.
 */

import type { MedicalContext, MedlinePlusArticle } from "./types";
import { lookupLoinc } from "./clinical-tables";
import { lookupMedlinePlus, searchHealthTopics } from "./medlineplus";
import { lookupDrugLabel, lookupAdverseEvents } from "./openfda";

type RecordType = "lab" | "medication" | "problem" | "allergy" | "vital";

/**
 * Get medical context for a query based on its record type.
 *
 * - lab: LOINC lookup -> MedlinePlus Connect -> health topic fallback
 * - medication: OpenFDA drug label + adverse events
 * - problem/allergy: MedlinePlus Health Topics search
 * - vital: MedlinePlus Health Topics search
 */
export async function getMedicalContext(
  query: string,
  recordType: RecordType
): Promise<MedicalContext> {
  const context: MedicalContext = {
    query,
    articles: [],
    fromCache: false,
  };

  switch (recordType) {
    case "lab": {
      // Try LOINC lookup first
      const loinc = await lookupLoinc(query);
      if (loinc) {
        context.loincCode = loinc.loincCode;

        // Use LOINC code to get MedlinePlus article
        const article = await lookupMedlinePlus(loinc.loincCode, "loinc");
        if (article) {
          context.articles.push(article);
        }
      }

      // Fallback to keyword search if no LOINC match or no article
      if (context.articles.length === 0) {
        const topics = await searchHealthTopics(query);
        context.articles.push(...topics);
      }
      break;
    }

    case "medication": {
      const [label, events] = await Promise.all([
        lookupDrugLabel(query),
        lookupAdverseEvents(query),
      ]);
      context.drugLabel = label || undefined;
      context.adverseEvents = events || undefined;

      // Also search MedlinePlus for medication info
      const topics = await searchHealthTopics(query);
      context.articles.push(...topics);
      break;
    }

    case "problem":
    case "allergy":
    case "vital": {
      const topics = await searchHealthTopics(query);
      context.articles.push(...topics);
      break;
    }
  }

  return context;
}
```

- [ ] **Step 4: Run tests, all tests, commit**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/medical-apis/facade.test.ts
cd /e/Projects/health-dashboard && bunx vitest run
git add src/lib/medical-apis/facade.ts src/lib/medical-apis/index.ts src/__tests__/lib/medical-apis/facade.test.ts
git commit -m "feat: add unified medical context facade"
```

---

### Task 6: Create NotebookLM notebooks + CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create Health Reference notebook**

```bash
PYTHONIOENCODING=utf-8 notebooklm notebook create --title "Health Reference" --json
```

Record the notebook ID from the output.

- [ ] **Step 2: Create Health Journal notebook**

```bash
PYTHONIOENCODING=utf-8 notebooklm notebook create --title "Health Journal" --json
```

Record the notebook ID from the output.

- [ ] **Step 3: Update CLAUDE.md**

Add to the Architecture section after the PHI Scrubber block:

```markdown
### Medical APIs (`src/lib/medical-apis/`)
- NLM Clinical Tables: LOINC code lookup by lab test name
- MedlinePlus Connect: LOINC/ICD code to plain-language health topic
- MedlinePlus Health Topics: keyword search for consumer health articles
- OpenFDA: drug labels (indications, interactions, warnings) and adverse event reports
- Unified facade routes queries by record type (lab, medication, problem, etc.)
- All APIs are free, no registration, no API keys required
```

Also update the ai-asst CLAUDE.md NotebookLM table with the two new notebook IDs.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add medical API architecture and NotebookLM notebooks"
```

Note: The NotebookLM notebook creation may fail if auth has expired. If so, skip that step and just update CLAUDE.md with placeholder IDs. The notebooks can be created later.
