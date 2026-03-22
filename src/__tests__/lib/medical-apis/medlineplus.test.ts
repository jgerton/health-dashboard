import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupMedlinePlus, searchHealthTopics } from "@/lib/medical-apis/medlineplus";

// --- lookupMedlinePlus mocks ---

const MOCK_MEDLINEPLUS_SUCCESS = {
  feed: {
    entry: [
      {
        title: { _value: "Blood Urea Nitrogen (BUN) Test" },
        link: [{ href: "https://medlineplus.gov/lab-tests/blood-urea-nitrogen-test/" }],
        summary: {
          _value:
            "<p>A blood urea nitrogen (BUN) test measures the amount of urea nitrogen in your blood.</p>",
        },
      },
    ],
  },
};

const MOCK_MEDLINEPLUS_EMPTY = {
  feed: {
    entry: [],
  },
};

// --- searchHealthTopics mocks ---

const MOCK_HEALTH_TOPICS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <list>
    <document url="https://medlineplus.gov/cholesterol.html">
      <content name="title">Cholesterol</content>
      <content name="snippet">Cholesterol is a waxy substance your body needs.</content>
      <content name="FullSummary">Cholesterol is a waxy, fat-like substance that is found in all the cells in your body.</content>
    </document>
    <document url="https://medlineplus.gov/ldlbadcholesterol.html">
      <content name="title">LDL: The "Bad" Cholesterol</content>
      <content name="snippet">LDL cholesterol is considered the bad type.</content>
    </document>
  </list>
</result>`;

const MOCK_HEALTH_TOPICS_EMPTY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <list>
  </list>
</result>`;

describe("lookupMedlinePlus", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns article for a known LOINC code", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_MEDLINEPLUS_SUCCESS,
    } as Response);

    const result = await lookupMedlinePlus("3094-0", "loinc");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Blood Urea Nitrogen (BUN) Test");
    expect(result?.url).toBe(
      "https://medlineplus.gov/lab-tests/blood-urea-nitrogen-test/"
    );
    expect(result?.snippet).not.toContain("<p>");
    expect(result?.source).toBe("MedlinePlus");

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("connect.medlineplus.gov");
    expect(calledUrl).toContain("3094-0");
    expect(calledUrl).toContain("2.16.840.1.113883.6.1");
  });

  it("uses ICD OID for icd code system", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_MEDLINEPLUS_SUCCESS,
    } as Response);

    await lookupMedlinePlus("E11.9", "icd");

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("2.16.840.1.113883.6.90");
  });

  it("returns null when no entries found", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_MEDLINEPLUS_EMPTY,
    } as Response);

    const result = await lookupMedlinePlus("99999-0", "loinc");

    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const result = await lookupMedlinePlus("3094-0", "loinc");

    expect(result).toBeNull();
  });

  it("returns null when response is not ok", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await lookupMedlinePlus("3094-0", "loinc");

    expect(result).toBeNull();
  });
});

describe("searchHealthTopics", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns array of articles for a known query", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => MOCK_HEALTH_TOPICS_XML,
    } as Response);

    const results = await searchHealthTopics("cholesterol");

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("Cholesterol");
    expect(results[0].url).toBe("https://medlineplus.gov/cholesterol.html");
    expect(results[0].snippet).toBe("Cholesterol is a waxy substance your body needs.");
    expect(results[0].fullSummary).toContain("waxy, fat-like substance");
    expect(results[0].source).toBe("MedlinePlus");

    expect(results[1].title).toBe('LDL: The "Bad" Cholesterol');

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("wsearch.nlm.nih.gov");
    expect(calledUrl).toContain("healthTopics");
    expect(calledUrl).toContain("cholesterol");
  });

  it("returns empty array when no results found", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => MOCK_HEALTH_TOPICS_EMPTY_XML,
    } as Response);

    const results = await searchHealthTopics("xyznonexistentquery");

    expect(results).toEqual([]);
  });

  it("returns empty array on fetch error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const results = await searchHealthTopics("cholesterol");

    expect(results).toEqual([]);
  });

  it("returns empty array when response is not ok", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    const results = await searchHealthTopics("cholesterol");

    expect(results).toEqual([]);
  });
});
