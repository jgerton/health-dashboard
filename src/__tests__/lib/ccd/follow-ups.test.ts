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
