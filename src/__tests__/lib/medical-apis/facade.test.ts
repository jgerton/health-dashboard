import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMedicalContext } from "@/lib/medical-apis/facade";
import * as clinicalTables from "@/lib/medical-apis/clinical-tables";
import * as medlineplus from "@/lib/medical-apis/medlineplus";
import * as openfda from "@/lib/medical-apis/openfda";
import type { LoincLookup, MedlinePlusArticle, DrugLabel, AdverseEventSummary } from "@/lib/medical-apis/types";

const MOCK_LOINC: LoincLookup = {
  loincCode: "3094-0",
  component: "Urea nitrogen",
  longCommonName: "Urea nitrogen [Mass/volume] in Serum or Plasma",
  system: "Ser/Plas",
};

const MOCK_ARTICLE: MedlinePlusArticle = {
  title: "Blood Urea Nitrogen Test",
  url: "https://medlineplus.gov/lab-tests/blood-urea-nitrogen-test/",
  snippet: "A blood urea nitrogen test measures the amount of urea nitrogen in your blood.",
  source: "MedlinePlus",
};

const MOCK_DRUG_LABEL: DrugLabel = {
  brandName: "Glucophage",
  genericName: "metformin hydrochloride",
  indications: "Treatment of type 2 diabetes mellitus.",
};

const MOCK_ADVERSE_EVENTS: AdverseEventSummary = {
  drugName: "metformin",
  topReactions: [{ term: "NAUSEA", count: 500 }],
  totalReports: 12345,
};

describe("getMedicalContext", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("lab record type", () => {
    it("resolves LOINC and fetches MedlinePlus article when LOINC found", async () => {
      const lookupLoincSpy = vi.spyOn(clinicalTables, "lookupLoinc").mockResolvedValue(MOCK_LOINC);
      const lookupMedlinePlusSpy = vi.spyOn(medlineplus, "lookupMedlinePlus").mockResolvedValue(MOCK_ARTICLE);
      const searchSpy = vi.spyOn(medlineplus, "searchHealthTopics");

      const context = await getMedicalContext("BUN", "lab");

      expect(context.query).toBe("BUN");
      expect(context.loincCode).toBe("3094-0");
      expect(context.articles).toContainEqual(MOCK_ARTICLE);
      expect(context.fromCache).toBe(false);
      expect(lookupLoincSpy).toHaveBeenCalledWith("BUN");
      expect(lookupMedlinePlusSpy).toHaveBeenCalledWith("3094-0", "loinc");
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it("falls back to searchHealthTopics when LOINC not found", async () => {
      vi.spyOn(clinicalTables, "lookupLoinc").mockResolvedValue(null);
      const searchSpy = vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValue([MOCK_ARTICLE]);
      const lookupMedlinePlusSpy = vi.spyOn(medlineplus, "lookupMedlinePlus");

      const context = await getMedicalContext("unknown test", "lab");

      expect(context.loincCode).toBeUndefined();
      expect(context.articles).toContainEqual(MOCK_ARTICLE);
      expect(searchSpy).toHaveBeenCalledWith("unknown test");
      expect(lookupMedlinePlusSpy).not.toHaveBeenCalled();
    });

    it("returns empty articles when all lookups fail gracefully", async () => {
      vi.spyOn(clinicalTables, "lookupLoinc").mockResolvedValue(null);
      vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValue([]);

      const context = await getMedicalContext("bad query", "lab");

      expect(context.articles).toEqual([]);
      expect(context.loincCode).toBeUndefined();
      expect(context.fromCache).toBe(false);
    });
  });

  describe("medication record type", () => {
    it("fetches drug label, adverse events, and health topics in parallel", async () => {
      const labelSpy = vi.spyOn(openfda, "lookupDrugLabel").mockResolvedValue(MOCK_DRUG_LABEL);
      const eventSpy = vi.spyOn(openfda, "lookupAdverseEvents").mockResolvedValue(MOCK_ADVERSE_EVENTS);
      const searchSpy = vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValue([MOCK_ARTICLE]);

      const context = await getMedicalContext("metformin", "medication");

      expect(context.query).toBe("metformin");
      expect(context.drugLabel).toEqual(MOCK_DRUG_LABEL);
      expect(context.adverseEvents).toEqual(MOCK_ADVERSE_EVENTS);
      expect(context.articles).toContainEqual(MOCK_ARTICLE);
      expect(context.fromCache).toBe(false);
      expect(labelSpy).toHaveBeenCalledWith("metformin");
      expect(eventSpy).toHaveBeenCalledWith("metformin");
      expect(searchSpy).toHaveBeenCalledWith("metformin");
    });

    it("handles partial medication failures gracefully", async () => {
      vi.spyOn(openfda, "lookupDrugLabel").mockResolvedValue(null);
      vi.spyOn(openfda, "lookupAdverseEvents").mockResolvedValue(null);
      vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValue([MOCK_ARTICLE]);

      const context = await getMedicalContext("unknowndrug", "medication");

      expect(context.drugLabel).toBeUndefined();
      expect(context.adverseEvents).toBeUndefined();
      expect(context.articles).toContainEqual(MOCK_ARTICLE);
    });
  });

  describe("problem record type", () => {
    it("searches health topics for problem type", async () => {
      const searchSpy = vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValue([MOCK_ARTICLE]);

      const context = await getMedicalContext("hypertension", "problem");

      expect(context.articles).toContainEqual(MOCK_ARTICLE);
      expect(searchSpy).toHaveBeenCalledWith("hypertension");
      expect(context.loincCode).toBeUndefined();
      expect(context.drugLabel).toBeUndefined();
    });
  });

  describe("allergy record type", () => {
    it("searches health topics for allergy type", async () => {
      const searchSpy = vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValue([MOCK_ARTICLE]);

      const context = await getMedicalContext("penicillin allergy", "allergy");

      expect(context.articles).toContainEqual(MOCK_ARTICLE);
      expect(searchSpy).toHaveBeenCalledWith("penicillin allergy");
    });
  });

  describe("vital record type", () => {
    it("searches health topics for vital type", async () => {
      const searchSpy = vi.spyOn(medlineplus, "searchHealthTopics").mockResolvedValue([MOCK_ARTICLE]);

      const context = await getMedicalContext("blood pressure", "vital");

      expect(context.articles).toContainEqual(MOCK_ARTICLE);
      expect(searchSpy).toHaveBeenCalledWith("blood pressure");
    });
  });
});
