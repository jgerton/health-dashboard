import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupLoinc } from "@/lib/medical-apis/clinical-tables";

const MOCK_SUCCESS_RESPONSE = [
  1,
  ["3094-0"],
  null,
  [["3094-0", "Urea nitrogen", "Urea nitrogen [Mass/volume] in Serum or Plasma", "Ser/Plas"]],
];

describe("lookupLoinc", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns LOINC lookup for a known test name", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_SUCCESS_RESPONSE,
    } as Response);

    const result = await lookupLoinc("Urea nitrogen");

    expect(result).not.toBeNull();
    expect(result?.loincCode).toBe("3094-0");
    expect(result?.component).toBe("Urea nitrogen");
    expect(result?.longCommonName).toBe("Urea nitrogen [Mass/volume] in Serum or Plasma");
    expect(result?.system).toBe("Ser/Plas");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("clinicaltables.nlm.nih.gov");
    expect(calledUrl).toContain("Urea+nitrogen");
  });

  it("returns null when no results are found", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [0, [], null, []],
    } as Response);

    const result = await lookupLoinc("nonexistent test xyz");

    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const result = await lookupLoinc("Urea nitrogen");

    expect(result).toBeNull();
  });

  it("returns null when response is not ok", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await lookupLoinc("Urea nitrogen");

    expect(result).toBeNull();
  });
});
