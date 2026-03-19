import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupDrugLabel, lookupAdverseEvents } from "@/lib/medical-apis/openfda";

// --- lookupDrugLabel mocks ---

const MOCK_DRUG_LABEL_SUCCESS = {
  results: [
    {
      openfda: {
        brand_name: ["Glucophage"],
        generic_name: ["metformin hydrochloride"],
      },
      indications_and_usage: ["Treatment of type 2 diabetes mellitus."],
      adverse_reactions: ["Diarrhea, nausea, vomiting, flatulence."],
      drug_interactions: ["Cationic drugs may reduce metformin elimination."],
      warnings: ["Lactic acidosis risk. Contraindicated with renal impairment."],
      dosage_and_administration: ["Start with 500 mg twice daily with meals."],
    },
  ],
};

const MOCK_DRUG_LABEL_MINIMAL = {
  results: [
    {
      openfda: {
        generic_name: ["aspirin"],
      },
      indications_and_usage: ["Pain relief."],
    },
  ],
};

// --- lookupAdverseEvents mocks ---

const MOCK_ADVERSE_EVENTS_SUCCESS = {
  meta: {
    results: {
      total: 12345,
    },
  },
  results: [
    { term: "NAUSEA", count: 500 },
    { term: "VOMITING", count: 300 },
    { term: "DIARRHOEA", count: 250 },
    { term: "HEADACHE", count: 200 },
    { term: "DIZZINESS", count: 150 },
    { term: "FATIGUE", count: 120 },
    { term: "ABDOMINAL PAIN", count: 100 },
    { term: "RASH", count: 80 },
    { term: "INSOMNIA", count: 60 },
    { term: "DYSPNOEA", count: 50 },
    { term: "SHOULD BE EXCLUDED", count: 30 }, // 11th result, should not appear
  ],
};

describe("lookupDrugLabel", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns drug label for a known drug name", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_DRUG_LABEL_SUCCESS,
    } as Response);

    const result = await lookupDrugLabel("metformin");

    expect(result).not.toBeNull();
    expect(result?.brandName).toBe("Glucophage");
    expect(result?.genericName).toBe("metformin hydrochloride");
    expect(result?.indications).toBe("Treatment of type 2 diabetes mellitus.");
    expect(result?.adverseReactions).toBe("Diarrhea, nausea, vomiting, flatulence.");
    expect(result?.drugInteractions).toBe("Cationic drugs may reduce metformin elimination.");
    expect(result?.warnings).toBe("Lactic acidosis risk. Contraindicated with renal impairment.");
    expect(result?.dosage).toBe("Start with 500 mg twice daily with meals.");

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.fda.gov/drug/label.json");
    expect(calledUrl).toContain("metformin");
  });

  it("handles missing optional fields gracefully", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_DRUG_LABEL_MINIMAL,
    } as Response);

    const result = await lookupDrugLabel("aspirin");

    expect(result).not.toBeNull();
    expect(result?.genericName).toBe("aspirin");
    expect(result?.brandName).toBeUndefined();
    expect(result?.adverseReactions).toBeUndefined();
    expect(result?.drugInteractions).toBeUndefined();
    expect(result?.warnings).toBeUndefined();
    expect(result?.dosage).toBeUndefined();
  });

  it("returns null on 404 not found", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await lookupDrugLabel("nonexistentdrug12345");

    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const result = await lookupDrugLabel("metformin");

    expect(result).toBeNull();
  });
});

describe("lookupAdverseEvents", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns top 10 adverse events for a known drug", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_ADVERSE_EVENTS_SUCCESS,
    } as Response);

    const result = await lookupAdverseEvents("metformin");

    expect(result).not.toBeNull();
    expect(result?.drugName).toBe("metformin");
    expect(result?.totalReports).toBe(12345);
    expect(result?.topReactions).toHaveLength(10);
    expect(result?.topReactions[0]).toEqual({ term: "NAUSEA", count: 500 });
    expect(result?.topReactions[9]).toEqual({ term: "DYSPNOEA", count: 50 });
    // 11th result should be excluded
    expect(result?.topReactions.find((r) => r.term === "SHOULD BE EXCLUDED")).toBeUndefined();

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.fda.gov/drug/event.json");
    expect(calledUrl).toContain("metformin");
  });

  it("returns null on 404 not found", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await lookupAdverseEvents("nonexistentdrug12345");

    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const result = await lookupAdverseEvents("metformin");

    expect(result).toBeNull();
  });
});
