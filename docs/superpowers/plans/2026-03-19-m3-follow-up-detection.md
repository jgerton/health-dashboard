# M3 Plan 2: Follow-up Detection from CCD Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract follow-up suggestions (future appointments, rechecks, return visits) from parsed CCD health records and surface them in the health data hook.

**Architecture:** A new `src/lib/ccd/follow-ups.ts` module scans `ParsedCCD` data for follow-up indicators: problems with future dates, lab results with common recheck intervals, and free-text patterns like "follow up in 3 months". Results are typed as `FollowUp[]` and exposed via `useHealthData` as part of `AggregatedHealthData`. Follow-ups are derived at read time, not stored separately.

**Tech Stack:** TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-milestone3-appointments-comfort-design.md` (Follow-up Detection section)

---

### Task 1: FollowUp type

**Files:**
- Create: `src/lib/ccd/follow-ups.ts` (types only, implementation in Task 2)

- [ ] **Step 1: Create FollowUp type and empty extractor**

Create `src/lib/ccd/follow-ups.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ccd/follow-ups.ts
git commit -m "feat: add FollowUp type and empty extractor"
```

---

### Task 2: Follow-up extraction logic (TDD)

**Files:**
- Create: `src/__tests__/lib/ccd/follow-ups.test.ts`
- Modify: `src/lib/ccd/follow-ups.ts`

- [ ] **Step 1: Write failing follow-up tests**

Create `src/__tests__/lib/ccd/follow-ups.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractFollowUps } from "@/lib/ccd/follow-ups";
import type { ParsedCCD } from "@/lib/ccd/types";

function makeMinimalCCD(overrides: Partial<ParsedCCD> = {}): ParsedCCD {
  return {
    patient: { name: "Test Patient", dateOfBirth: "1960-01-01", gender: "M" },
    medications: [],
    results: [],
    problems: [],
    allergies: [],
    vitalSigns: [],
    immunizations: [],
    documentInfo: { id: "doc-001", title: "Test CCD", effectiveTime: "2026-03-01" },
    ...overrides,
  };
}

describe("extractFollowUps", () => {
  it("returns empty array when no follow-up indicators", () => {
    const ccd = makeMinimalCCD();
    expect(extractFollowUps(ccd)).toEqual([]);
  });

  it("detects problem with future onset date as follow-up", () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const ccd = makeMinimalCCD({
      problems: [
        {
          id: "prob-1",
          name: "Annual Physical",
          status: "active",
          onsetDate: futureDateStr,
        },
      ],
    });

    const followUps = extractFollowUps(ccd);
    expect(followUps).toHaveLength(1);
    expect(followUps[0].suggestedDate).toBe(futureDateStr);
    expect(followUps[0].reason).toContain("Annual Physical");
    expect(followUps[0].documentId).toBe("doc-001");
  });

  it("ignores problems with past onset dates", () => {
    const ccd = makeMinimalCCD({
      problems: [
        {
          id: "prob-1",
          name: "Resolved Condition",
          status: "resolved",
          onsetDate: "2020-01-15",
        },
      ],
    });

    expect(extractFollowUps(ccd)).toEqual([]);
  });

  it("suggests recheck for recent lab results at common intervals", () => {
    // Lab result from 10 months ago should suggest a 12-month recheck
    const tenMonthsAgo = new Date();
    tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);
    const labDate = tenMonthsAgo.toISOString().split("T")[0];

    const ccd = makeMinimalCCD({
      results: [
        {
          id: "lab-1",
          panelName: "Lipid Panel",
          date: labDate,
          observations: [
            {
              name: "Total Cholesterol",
              value: "210",
              unit: "mg/dL",
              date: labDate,
            },
          ],
        },
      ],
    });

    const followUps = extractFollowUps(ccd);
    expect(followUps.length).toBeGreaterThanOrEqual(1);
    const lipidFollowUp = followUps.find((f) => f.reason.includes("Lipid Panel"));
    expect(lipidFollowUp).toBeDefined();
    expect(lipidFollowUp!.source).toContain("Lab Results");
  });

  it("does not suggest recheck for very old lab results", () => {
    const ccd = makeMinimalCCD({
      results: [
        {
          id: "lab-1",
          panelName: "CBC",
          date: "2020-01-01",
          observations: [
            { name: "WBC", value: "7.5", unit: "K/uL", date: "2020-01-01" },
          ],
        },
      ],
    });

    // Lab from 6+ years ago: recheck date is long past, no follow-up
    expect(extractFollowUps(ccd)).toEqual([]);
  });

  it("handles CCD with no problems or results gracefully", () => {
    const ccd = makeMinimalCCD({
      problems: [],
      results: [],
    });
    expect(extractFollowUps(ccd)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/ccd/follow-ups.test.ts
```

Expected: Tests that check for non-empty results FAIL (extractor returns []).

- [ ] **Step 3: Implement follow-up extraction**

Update `src/lib/ccd/follow-ups.ts` to replace the empty `extractFollowUps`:

```typescript
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
```

- [ ] **Step 4: Run follow-up tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/ccd/follow-ups.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass (83 existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ccd/follow-ups.ts src/__tests__/lib/ccd/follow-ups.test.ts
git commit -m "feat: add follow-up detection from CCD data"
```

---

### Task 3: Wire follow-ups into useHealthData

**Files:**
- Modify: `src/lib/hooks/use-health-data.ts`

- [ ] **Step 1: Read current file**

Read `src/lib/hooks/use-health-data.ts` to understand current structure.

- [ ] **Step 2: Add followUps to AggregatedHealthData**

In `src/lib/hooks/use-health-data.ts`:

1. Add import at top:

```typescript
import { extractFollowUps, type FollowUp } from "@/lib/ccd/follow-ups";
```

2. Add `followUps` to the `AggregatedHealthData` interface:

```typescript
export interface AggregatedHealthData {
  medications: Medication[];
  results: LabResult[];
  problems: Problem[];
  allergies: Allergy[];
  vitalSigns: VitalSign[];
  immunizations: Immunization[];
  followUps: FollowUp[];
  patientName?: string;
  summary: HealthDataSummary;
}
```

3. Add `followUps` to the aggregation computation (inside the `useHealthData` function, in the `aggregated` object):

```typescript
  followUps: data.flatMap((d) => extractFollowUps(d)),
```

Place this line after the `immunizations` line in the aggregated object.

- [ ] **Step 3: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Verify build**

```bash
cd /e/Projects/health-dashboard && bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/use-health-data.ts
git commit -m "feat: expose follow-ups in useHealthData aggregation"
```
