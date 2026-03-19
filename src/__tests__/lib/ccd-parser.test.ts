import { describe, it, expect } from "vitest";
import { parseCCD, parseHL7Date } from "@/lib/ccd/parser";

// Minimal C-CDA XML for testing - covers all 6 sections
const MINIMAL_CCD = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <id root="2.16.840.1.113883.3.1826" extension="TEST-001"/>
  <title>Test Referral Note</title>
  <effectiveTime value="20250110084233-0800"/>
  <recordTarget>
    <patientRole>
      <patient>
        <name><given>JANE</given><family>DOE</family></name>
        <administrativeGenderCode code="F" displayName="Female"/>
        <birthTime value="19800115"/>
      </patient>
      <addr use="HP">
        <streetAddressLine>123 Test St</streetAddressLine>
        <city>Testville</city>
        <state>AK</state>
        <postalCode>99501</postalCode>
      </addr>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>
      <!-- Medications Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.1.1"/>
          <entry>
            <substanceAdministration classCode="SBADM" moodCode="INT">
              <id root="med-1" extension="MED001"/>
              <statusCode code="active"/>
              <effectiveTime xsi:type="IVL_TS">
                <low value="20240601"/>
                <high value="20251231"/>
              </effectiveTime>
              <routeCode displayName="Oral"/>
              <doseQuantity value="500" unit="mg"/>
              <consumable>
                <manufacturedProduct>
                  <manufacturedMaterial>
                    <code nullFlavor="OTH">
                      <originalText>Metformin HCL 500mg</originalText>
                      <translation code="6809" codeSystem="2.16.840.1.113883.6.314" displayName="metformin"/>
                    </code>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>
        </section>
      </component>

      <!-- Results Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.3.1"/>
          <entry>
            <organizer classCode="BATTERY" moodCode="EVN">
              <id root="result-1" extension="RES001"/>
              <code displayName="Basic Metabolic Panel"/>
              <effectiveTime value="20250108"/>
              <component>
                <observation>
                  <code code="2345-7" displayName="Glucose"/>
                  <effectiveTime value="20250108"/>
                  <value xsi:type="PQ" value="95" unit="mg/dL"/>
                  <interpretationCode code="N"/>
                  <referenceRange>
                    <observationRange>
                      <value xsi:type="IVL_PQ">
                        <low value="70" unit="mg/dL"/>
                        <high value="100" unit="mg/dL"/>
                      </value>
                    </observationRange>
                  </referenceRange>
                </observation>
              </component>
              <component>
                <observation>
                  <code code="2160-0" displayName="Creatinine"/>
                  <effectiveTime value="20250108"/>
                  <value xsi:type="PQ" value="1.4" unit="mg/dL"/>
                  <interpretationCode code="H"/>
                  <referenceRange>
                    <observationRange>
                      <value xsi:type="IVL_PQ">
                        <low value="0.7" unit="mg/dL"/>
                        <high value="1.3" unit="mg/dL"/>
                      </value>
                    </observationRange>
                  </referenceRange>
                </observation>
              </component>
            </organizer>
          </entry>
        </section>
      </component>

      <!-- Problems Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.5.1"/>
          <entry>
            <act classCode="ACT" moodCode="EVN">
              <id root="prob-1" extension="PROB001"/>
              <statusCode code="active"/>
              <effectiveTime>
                <low value="20200315"/>
              </effectiveTime>
              <entryRelationship typeCode="SUBJ">
                <observation>
                  <value xsi:type="CD" code="44054006" codeSystem="2.16.840.1.113883.6.96" displayName="Diabetes mellitus type 2"/>
                </observation>
              </entryRelationship>
            </act>
          </entry>
        </section>
      </component>

      <!-- Allergies Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.6.1"/>
          <entry>
            <act classCode="ACT" moodCode="EVN">
              <id root="allergy-1" extension="ALG001"/>
              <entryRelationship typeCode="SUBJ">
                <observation>
                  <value xsi:type="CD" code="416098002" displayName="Drug allergy"/>
                  <participant typeCode="CSM">
                    <participantRole>
                      <playingEntity>
                        <code code="7980" codeSystem="2.16.840.1.113883.6.88" displayName="Penicillin"/>
                      </playingEntity>
                    </participantRole>
                  </participant>
                  <entryRelationship typeCode="MFST">
                    <observation>
                      <value xsi:type="CD" code="247472004" displayName="Hives"/>
                    </observation>
                  </entryRelationship>
                </observation>
              </entryRelationship>
            </act>
          </entry>
        </section>
      </component>

      <!-- Vital Signs Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.4.1"/>
          <entry>
            <organizer classCode="CLUSTER" moodCode="EVN">
              <id root="vitals-1" extension="VS001"/>
              <effectiveTime value="20250110"/>
              <component>
                <observation>
                  <code code="8310-5" displayName="Body temperature"/>
                  <value xsi:type="PQ" value="98.6" unit="degF"/>
                  <interpretationCode code="N"/>
                </observation>
              </component>
              <component>
                <observation>
                  <code code="8480-6" displayName="Systolic blood pressure"/>
                  <value xsi:type="PQ" value="130" unit="mm[Hg]"/>
                  <interpretationCode code="H"/>
                </observation>
              </component>
            </organizer>
          </entry>
        </section>
      </component>

      <!-- Immunizations Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.2.1"/>
          <entry>
            <substanceAdministration classCode="SBADM" moodCode="EVN" negationInd="false">
              <id root="imm-1" extension="IMM001"/>
              <effectiveTime value="20240915"/>
              <consumable>
                <manufacturedProduct>
                  <manufacturedMaterial>
                    <code code="141" displayName="Influenza vaccine"/>
                    <lotNumberText>LOT123</lotNumberText>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>
        </section>
      </component>

    </structuredBody>
  </component>
</ClinicalDocument>`;

describe("parseHL7Date", () => {
  it("parses full datetime with timezone", () => {
    expect(parseHL7Date("20250110084233-0800")).toBe("2025-01-10T08:42:33");
  });

  it("parses date only", () => {
    expect(parseHL7Date("20250110")).toBe("2025-01-10");
  });

  it("parses year-month only", () => {
    expect(parseHL7Date("202501")).toBe("2025-01");
  });

  it("parses year only", () => {
    expect(parseHL7Date("2025")).toBe("2025");
  });

  it("returns empty for null/undefined", () => {
    expect(parseHL7Date(null)).toBe("");
    expect(parseHL7Date(undefined)).toBe("");
    expect(parseHL7Date("")).toBe("");
  });
});

describe("parseCCD", () => {
  const parsed = parseCCD(MINIMAL_CCD, "test-file.xml");

  describe("document info", () => {
    it("extracts document metadata", () => {
      expect(parsed.documentInfo.id).toBe("TEST-001");
      expect(parsed.documentInfo.title).toBe("Test Referral Note");
      expect(parsed.documentInfo.sourceFile).toBe("test-file.xml");
    });
  });

  describe("patient info", () => {
    it("extracts patient name", () => {
      expect(parsed.patient.name).toBe("JANE DOE");
    });

    it("extracts patient demographics", () => {
      expect(parsed.patient.gender).toBe("Female");
      expect(parsed.patient.dateOfBirth).toBe("1980-01-15");
    });

    it("extracts address", () => {
      expect(parsed.patient.address?.city).toBe("Testville");
      expect(parsed.patient.address?.state).toBe("AK");
    });
  });

  describe("medications", () => {
    it("parses medication entries", () => {
      expect(parsed.medications).toHaveLength(1);
    });

    it("extracts medication details", () => {
      const med = parsed.medications[0];
      expect(med.name).toBe("Metformin HCL 500mg");
      expect(med.route).toBe("Oral");
      expect(med.dose).toBe("500");
      expect(med.doseUnit).toBe("mg");
      expect(med.status).toBe("active");
    });

    it("extracts medication date range", () => {
      const med = parsed.medications[0];
      expect(med.startDate).toBe("2024-06-01");
      expect(med.endDate).toBe("2025-12-31");
    });
  });

  describe("results", () => {
    it("parses lab result panels", () => {
      expect(parsed.results).toHaveLength(1);
      expect(parsed.results[0].panelName).toBe("Basic Metabolic Panel");
    });

    it("parses lab observations with values and ranges", () => {
      const obs = parsed.results[0].observations;
      expect(obs).toHaveLength(2);

      const glucose = obs.find((o) => o.name === "Glucose");
      expect(glucose?.value).toBe("95");
      expect(glucose?.unit).toBe("mg/dL");
      expect(glucose?.referenceRangeLow).toBe("70");
      expect(glucose?.referenceRangeHigh).toBe("100");
      expect(glucose?.interpretation).toBe("normal");
    });

    it("flags high values", () => {
      const creatinine = parsed.results[0].observations.find(
        (o) => o.name === "Creatinine"
      );
      expect(creatinine?.interpretation).toBe("high");
    });
  });

  describe("problems", () => {
    it("parses problem entries", () => {
      expect(parsed.problems).toHaveLength(1);
      const problem = parsed.problems[0];
      expect(problem.name).toBe("Diabetes mellitus type 2");
      expect(problem.code).toBe("44054006");
      expect(problem.status).toBe("active");
      expect(problem.onsetDate).toBe("2020-03-15");
    });
  });

  describe("allergies", () => {
    it("parses allergy entries", () => {
      expect(parsed.allergies).toHaveLength(1);
      const allergy = parsed.allergies[0];
      expect(allergy.allergen).toBe("Penicillin");
      expect(allergy.type).toBe("Drug allergy");
      expect(allergy.reaction).toBe("Hives");
    });
  });

  describe("vital signs", () => {
    it("parses vital sign entries", () => {
      expect(parsed.vitalSigns).toHaveLength(1);
      const vs = parsed.vitalSigns[0];
      expect(vs.date).toBe("2025-01-10");
      expect(vs.measurements).toHaveLength(2);
    });

    it("extracts measurements with codes and units", () => {
      const temp = parsed.vitalSigns[0].measurements.find(
        (m) => m.name === "Body temperature"
      );
      expect(temp?.value).toBe("98.6");
      expect(temp?.unit).toBe("degF");
      expect(temp?.code).toBe("8310-5");
    });
  });

  describe("immunizations", () => {
    it("parses immunization entries", () => {
      expect(parsed.immunizations).toHaveLength(1);
      const imm = parsed.immunizations[0];
      expect(imm.name).toBe("Influenza vaccine");
      expect(imm.date).toBe("2024-09-15");
      expect(imm.lotNumber).toBe("LOT123");
      expect(imm.status).toBe("completed");
    });
  });
});

describe("parseCCD error handling", () => {
  it("throws on invalid XML", () => {
    expect(() => parseCCD("<not-a-ccd/>")).toThrow("Invalid CCD");
  });

  it("handles empty sections gracefully", () => {
    const emptyCCD = `<?xml version="1.0"?>
    <ClinicalDocument xmlns="urn:hl7-org:v3">
      <id root="test"/>
      <title>Empty</title>
      <effectiveTime value="20250101"/>
      <recordTarget>
        <patientRole>
          <patient>
            <name><given>Test</given><family>User</family></name>
            <administrativeGenderCode code="M"/>
            <birthTime value="19900101"/>
          </patient>
        </patientRole>
      </recordTarget>
      <component>
        <structuredBody/>
      </component>
    </ClinicalDocument>`;

    const result = parseCCD(emptyCCD);
    expect(result.medications).toEqual([]);
    expect(result.results).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.allergies).toEqual([]);
    expect(result.vitalSigns).toEqual([]);
    expect(result.immunizations).toEqual([]);
  });
});
