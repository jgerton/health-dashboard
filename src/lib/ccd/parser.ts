/**
 * CCD/C-CDA XML Parser
 *
 * Parses HL7 C-CDA (Consolidated Clinical Document Architecture) XML files
 * into structured TypeScript objects. Handles the common patterns found in
 * Cerner/Epic/MyChart patient portal exports.
 *
 * Key design decisions:
 * - Uses fast-xml-parser for XML parsing (no DOM dependency, works in browser + Node)
 * - Gracefully handles nullFlavor attributes (common in real-world CCD files)
 * - Falls back to originalText when coded values are missing
 * - Parses HL7 TS dates (YYYYMMDDHHMMSS±HHMM) to ISO strings
 */

import { XMLParser } from "fast-xml-parser";
import type {
  ParsedCCD,
  DocumentInfo,
  PatientInfo,
  Medication,
  LabResult,
  LabObservation,
  Problem,
  Allergy,
  VitalSign,
  VitalMeasurement,
  Immunization,
} from "./types";

// C-CDA section template IDs
const TEMPLATE_IDS = {
  medications: "2.16.840.1.113883.10.20.22.2.1.1",
  results: "2.16.840.1.113883.10.20.22.2.3.1",
  problems: "2.16.840.1.113883.10.20.22.2.5.1",
  allergies: "2.16.840.1.113883.10.20.22.2.6.1",
  vitalSigns: "2.16.840.1.113883.10.20.22.2.4.1",
  immunizations: "2.16.840.1.113883.10.20.22.2.2.1",
} as const;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => {
    // These elements can appear multiple times
    const arrayElements = [
      "component",
      "entry",
      "entryRelationship",
      "templateId",
      "id",
      "translation",
      "participant",
      "addr",
      "name",
      "telecom",
    ];
    return arrayElements.includes(name);
  },
  // Handle text content mixed with attributes
  textNodeName: "#text",
});

/**
 * Parse a CCD/C-CDA XML string into structured data.
 */
export function parseCCD(xmlString: string, sourceFile?: string): ParsedCCD {
  const parsed = xmlParser.parse(xmlString);
  const doc = parsed.ClinicalDocument;

  if (!doc) {
    throw new Error("Invalid CCD: no ClinicalDocument root element found");
  }

  const documentInfo = parseDocumentInfo(doc, sourceFile);
  const patient = parsePatient(doc);
  const sections = extractSections(doc);

  return {
    documentInfo,
    patient,
    medications: parseMedications(sections.medications),
    results: parseResults(sections.results),
    problems: parseProblems(sections.problems),
    allergies: parseAllergies(sections.allergies),
    vitalSigns: parseVitalSigns(sections.vitalSigns),
    immunizations: parseImmunizations(sections.immunizations),
  };
}

// --- Document & Patient ---

function parseDocumentInfo(
  doc: Record<string, unknown>,
  sourceFile?: string
): DocumentInfo {
  const idNode = asArray(doc.id)?.[0];
  return {
    id: attr(idNode, "extension") || attr(idNode, "root") || "unknown",
    title: textOf(doc.title) || "Unknown Document",
    effectiveTime: parseHL7Date(attr(doc.effectiveTime, "value")),
    sourceFile,
  };
}

function parsePatient(doc: Record<string, unknown>): PatientInfo {
  const recordTarget = doc.recordTarget as Record<string, unknown>;
  const patientRole = recordTarget?.patientRole as Record<string, unknown>;
  const patient = patientRole?.patient as Record<string, unknown>;

  const nameNode = asArray(patient?.name)?.[0] as Record<string, unknown> | undefined;
  const name = nameNode
    ? [textOf(nameNode.given), textOf(nameNode.family)].filter(Boolean).join(" ")
    : "Unknown";

  const addrNode = asArray(patientRole?.addr)?.[0] as Record<string, unknown> | undefined;

  return {
    name,
    dateOfBirth: parseHL7Date(
      attr(
        (patient?.birthTime as Record<string, unknown>) ?? {},
        "value"
      )
    ),
    gender: attr(
      (patient?.administrativeGenderCode as Record<string, unknown>) ?? {},
      "displayName"
    ) || attr(
      (patient?.administrativeGenderCode as Record<string, unknown>) ?? {},
      "code"
    ) || "Unknown",
    address: addrNode
      ? {
          street: textOf(addrNode.streetAddressLine) || "",
          city: textOf(addrNode.city) || "",
          state: textOf(addrNode.state) || "",
          zip: textOf(addrNode.postalCode) || "",
        }
      : undefined,
  };
}

// --- Section Extraction ---

interface SectionMap {
  medications: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
  problems: Record<string, unknown> | null;
  allergies: Record<string, unknown> | null;
  vitalSigns: Record<string, unknown> | null;
  immunizations: Record<string, unknown> | null;
}

function extractSections(doc: Record<string, unknown>): SectionMap {
  const result: SectionMap = {
    medications: null,
    results: null,
    problems: null,
    allergies: null,
    vitalSigns: null,
    immunizations: null,
  };

  // The document body contains components, each with a section
  // doc.component is an array because of isArray config
  const bodyComponent = asArray(doc.component)?.[0] as Record<string, unknown>;
  const structuredBody = bodyComponent?.structuredBody as Record<string, unknown>;
  const components = asArray(structuredBody?.component) || [];

  for (const comp of components) {
    const section = (comp as Record<string, unknown>)?.section as Record<string, unknown>;
    if (!section) continue;

    const templateIds = asArray(section.templateId) || [];
    const roots = templateIds.map((t) => attr(t as Record<string, unknown>, "root"));

    for (const [key, targetRoot] of Object.entries(TEMPLATE_IDS)) {
      if (roots.includes(targetRoot)) {
        result[key as keyof SectionMap] = section;
      }
    }
  }

  return result;
}

// --- Medications ---

function parseMedications(
  section: Record<string, unknown> | null
): Medication[] {
  if (!section) return [];
  const entries = asArray(section.entry) || [];
  return entries.map(parseMedicationEntry).filter(Boolean) as Medication[];
}

function parseMedicationEntry(
  entry: Record<string, unknown>
): Medication | null {
  const sa = entry?.substanceAdministration as Record<string, unknown>;
  if (!sa) return null;

  // Get medication name from consumable
  const consumable = sa.consumable as Record<string, unknown>;
  const mfProduct = consumable?.manufacturedProduct as Record<string, unknown>;
  const mfMaterial = mfProduct?.manufacturedMaterial as Record<string, unknown>;
  const codeNode = mfMaterial?.code as Record<string, unknown>;

  const name = getCodedName(codeNode) || "Unknown Medication";
  const code = getCodeValue(codeNode);

  // Dates
  const effectiveTimes = asArray(sa.effectiveTime) || [];
  const ivlTime = effectiveTimes.find(
    (t) => t?.low || t?.high
  );

  // Dose
  const doseQty = sa.doseQuantity as Record<string, unknown>;

  // Route
  const routeNode = sa.routeCode as Record<string, unknown>;

  // Status: check statusCode or infer from dates
  const statusCode = attr(
    sa.statusCode as Record<string, unknown>,
    "code"
  );

  return {
    id: getEntryId(sa),
    name,
    code: code?.code,
    codeSystem: code?.codeSystem,
    route:
      attr(routeNode, "displayName") ||
      getOriginalText(routeNode),
    dose: attr(doseQty, "value"),
    doseUnit: attr(doseQty, "unit"),
    startDate: parseHL7Date(
      attr(ivlTime?.low as Record<string, unknown>, "value")
    ),
    endDate: parseHL7Date(
      attr(ivlTime?.high as Record<string, unknown>, "value")
    ),
    status: mapStatus(statusCode),
  };
}

// --- Results ---

function parseResults(
  section: Record<string, unknown> | null
): LabResult[] {
  if (!section) return [];
  const entries = asArray(section.entry) || [];
  return entries.map(parseResultEntry).filter(Boolean) as LabResult[];
}

function parseResultEntry(entry: Record<string, unknown>): LabResult | null {
  const organizer = entry?.organizer as Record<string, unknown>;
  if (!organizer) return null;

  const codeNode = organizer.code as Record<string, unknown>;
  const components = asArray(organizer.component) || [];

  const observations: LabObservation[] = components
    .map((comp) => {
      const obs = comp?.observation as Record<string, unknown>;
      if (!obs) return null;

      const obsCode = obs.code as Record<string, unknown>;
      const valueNode = obs.value as Record<string, unknown>;
      const refRange = obs.referenceRange as Record<string, unknown>;
      const obsRange = refRange?.observationRange as Record<string, unknown>;
      const rangeValue = obsRange?.value as Record<string, unknown>;

      const interpCode = attr(
        obs.interpretationCode as Record<string, unknown>,
        "code"
      );

      return {
        name: getCodedName(obsCode) || "Unknown Test",
        code: attr(obsCode, "code") || undefined,
        value: attr(valueNode, "value") || textOf(valueNode) || "",
        unit: attr(valueNode, "unit") || undefined,
        referenceRangeLow: attr(
          rangeValue?.low as Record<string, unknown>,
          "value"
        ) || undefined,
        referenceRangeHigh: attr(
          rangeValue?.high as Record<string, unknown>,
          "value"
        ) || undefined,
        interpretation: mapInterpretation(interpCode),
        date: parseHL7Date(attr(obs.effectiveTime, "value")),
      } satisfies LabObservation;
    })
    .filter(Boolean) as LabObservation[];

  return {
    id: getEntryId(organizer),
    panelName: getCodedName(codeNode) || "Unknown Panel",
    panelCode: attr(codeNode, "code") || undefined,
    date:
      parseHL7Date(attr(organizer.effectiveTime, "value")) ||
      observations[0]?.date ||
      "",
    observations,
  };
}

// --- Problems ---

function parseProblems(
  section: Record<string, unknown> | null
): Problem[] {
  if (!section) return [];
  const entries = asArray(section.entry) || [];
  return entries.map(parseProblemEntry).filter(Boolean) as Problem[];
}

function parseProblemEntry(entry: Record<string, unknown>): Problem | null {
  const act = entry?.act as Record<string, unknown>;
  if (!act) return null;

  // The actual problem is in entryRelationship > observation
  const entryRels = asArray(act.entryRelationship) || [];
  const subjRel = entryRels.find(
    (r) => attr(r, "typeCode") === "SUBJ"
  );
  const obs = subjRel?.observation as Record<string, unknown>;
  if (!obs) return null;

  const valueNode = obs.value as Record<string, unknown>;

  // Dates from the act's effectiveTime
  const effectiveTime = act.effectiveTime as Record<string, unknown>;

  // Status from nested observation or act statusCode
  const actStatus = attr(
    act.statusCode as Record<string, unknown>,
    "code"
  );

  return {
    id: getEntryId(act),
    name:
      attr(valueNode, "displayName") ||
      getOriginalText(valueNode) ||
      "Unknown Problem",
    code: attr(valueNode, "code") || undefined,
    codeSystem: attr(valueNode, "codeSystem") || undefined,
    onsetDate: parseHL7Date(
      attr(effectiveTime?.low as Record<string, unknown>, "value")
    ),
    resolvedDate: parseHL7Date(
      attr(effectiveTime?.high as Record<string, unknown>, "value")
    ),
    status: mapProblemStatus(actStatus),
  };
}

// --- Allergies ---

function parseAllergies(
  section: Record<string, unknown> | null
): Allergy[] {
  if (!section) return [];
  const entries = asArray(section.entry) || [];
  return entries.map(parseAllergyEntry).filter(Boolean) as Allergy[];
}

function parseAllergyEntry(entry: Record<string, unknown>): Allergy | null {
  const act = entry?.act as Record<string, unknown>;
  if (!act) return null;

  const entryRels = asArray(act.entryRelationship) || [];
  const subjRel = entryRels.find(
    (r) => attr(r, "typeCode") === "SUBJ"
  );
  const obs = subjRel?.observation as Record<string, unknown>;
  if (!obs) return null;

  // Allergen is in participant > participantRole > playingEntity > code
  const participants = asArray(obs.participant) || [];
  const csmParticipant = participants.find(
    (p) => attr(p, "typeCode") === "CSM"
  );
  const playingEntity = (
    csmParticipant?.participantRole as Record<string, unknown>
  )?.playingEntity as Record<string, unknown>;
  const allergenCode = playingEntity?.code as Record<string, unknown>;

  // Allergy type from observation value
  const typeNode = obs.value as Record<string, unknown>;

  // Reaction from nested entryRelationship
  const obsEntryRels = asArray(obs.entryRelationship) || [];
  const mfstRel = obsEntryRels.find(
    (r) => attr(r, "typeCode") === "MFST"
  );
  const reactionObs = mfstRel?.observation as Record<string, unknown>;
  const reactionValue = reactionObs?.value as Record<string, unknown>;

  // Status
  const statusEntryRel = obsEntryRels.find((r) => {
    const nestedObs = r?.observation as Record<string, unknown>;
    const nestedCode = nestedObs?.code as Record<string, unknown>;
    return attr(nestedCode, "code") === "33999-4"; // LOINC status
  });
  const statusObs = statusEntryRel?.observation as Record<string, unknown>;
  const statusValue = statusObs?.value as Record<string, unknown>;

  return {
    id: getEntryId(act),
    allergen:
      attr(allergenCode, "displayName") ||
      getOriginalText(allergenCode) ||
      "Unknown Allergen",
    allergenCode: attr(allergenCode, "code") || undefined,
    allergenCodeSystem: attr(allergenCode, "codeSystem") || undefined,
    type:
      attr(typeNode, "displayName") || "Drug allergy",
    reaction:
      attr(reactionValue, "displayName") ||
      getOriginalText(reactionValue) ||
      undefined,
    status: mapAllergyStatus(attr(statusValue, "code")),
  };
}

// --- Vital Signs ---

function parseVitalSigns(
  section: Record<string, unknown> | null
): VitalSign[] {
  if (!section) return [];
  const entries = asArray(section.entry) || [];
  return entries.map(parseVitalSignEntry).filter(Boolean) as VitalSign[];
}

function parseVitalSignEntry(
  entry: Record<string, unknown>
): VitalSign | null {
  const organizer = entry?.organizer as Record<string, unknown>;
  if (!organizer) return null;

  const components = asArray(organizer.component) || [];
  const measurements: VitalMeasurement[] = components
    .map((comp) => {
      const obs = comp?.observation as Record<string, unknown>;
      if (!obs) return null;

      const codeNode = obs.code as Record<string, unknown>;
      const valueNode = obs.value as Record<string, unknown>;

      return {
        name: getCodedName(codeNode) || "Unknown Vital",
        code: attr(codeNode, "code") || undefined,
        value: attr(valueNode, "value") || "",
        unit: attr(valueNode, "unit") || undefined,
        interpretation:
          attr(
            obs.interpretationCode as Record<string, unknown>,
            "code"
          ) || undefined,
      } satisfies VitalMeasurement;
    })
    .filter(Boolean) as VitalMeasurement[];

  return {
    id: getEntryId(organizer),
    date: parseHL7Date(attr(organizer.effectiveTime, "value")),
    measurements,
  };
}

// --- Immunizations ---

function parseImmunizations(
  section: Record<string, unknown> | null
): Immunization[] {
  if (!section) return [];
  const entries = asArray(section.entry) || [];
  return entries.map(parseImmunizationEntry).filter(Boolean) as Immunization[];
}

function parseImmunizationEntry(
  entry: Record<string, unknown>
): Immunization | null {
  const sa = entry?.substanceAdministration as Record<string, unknown>;
  if (!sa) return null;

  const negation = attr(sa, "negationInd");

  const consumable = sa.consumable as Record<string, unknown>;
  const mfProduct = consumable?.manufacturedProduct as Record<string, unknown>;
  const mfMaterial = mfProduct?.manufacturedMaterial as Record<string, unknown>;
  const codeNode = mfMaterial?.code as Record<string, unknown>;

  const lotText = mfMaterial?.lotNumberText;

  return {
    id: getEntryId(sa),
    name: getCodedName(codeNode) || "Unknown Vaccine",
    code: attr(codeNode, "code") || undefined,
    date: parseHL7Date(attr(sa.effectiveTime, "value")),
    lotNumber: textOf(lotText) || undefined,
    status: negation === "true" ? "refused" : "completed",
  };
}

// --- Utility Functions ---

/**
 * Parse HL7 TS date format (YYYYMMDDHHMMSS±HHMM) to ISO string.
 * Handles partial dates (YYYYMMDD, YYYYMM, YYYY).
 */
export function parseHL7Date(value: string | undefined | null): string {
  if (!value) return "";

  // Strip timezone offset for parsing
  const match = value.match(
    /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([+-]\d{4})?$/
  );
  if (!match) return value;

  const [, year, month, day, hour, min, sec] = match;
  const parts = [year];
  if (month) parts.push(month);
  if (day) parts.push(day);

  const datePart = parts.length === 3
    ? `${parts[0]}-${parts[1]}-${parts[2]}`
    : parts.length === 2
      ? `${parts[0]}-${parts[1]}`
      : parts[0];

  if (hour && min) {
    const timePart = sec ? `${hour}:${min}:${sec}` : `${hour}:${min}`;
    return `${datePart}T${timePart}`;
  }

  return datePart;
}

/** Safely get an attribute from a node. */
function attr(
  node: unknown,
  name: string
): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const value = (node as Record<string, unknown>)[`@_${name}`];
  return value != null ? String(value) : undefined;
}

/** Get text content from a node that may be a string or object with #text. */
function textOf(node: unknown): string | undefined {
  if (node == null) return undefined;
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"]);
  }
  return undefined;
}

/** Ensure a value is an array. */
function asArray(value: unknown): Record<string, unknown>[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  return [value] as Record<string, unknown>[];
}

/** Get a human-readable name from a coded element, handling nullFlavor fallbacks. */
function getCodedName(codeNode: Record<string, unknown> | undefined): string | undefined {
  if (!codeNode) return undefined;

  // Prefer displayName
  const displayName = attr(codeNode, "displayName");
  if (displayName) return displayName;

  // Fall back to originalText
  const origText = getOriginalText(codeNode);
  if (origText) return origText;

  // Fall back to translation elements
  const translations = asArray(codeNode.translation) || [];
  for (const t of translations) {
    const dn = attr(t, "displayName");
    if (dn) return dn;
  }

  return undefined;
}

/** Get originalText from a coded element (may be a string or have a reference). */
function getOriginalText(
  node: Record<string, unknown> | undefined
): string | undefined {
  if (!node) return undefined;
  const ot = node.originalText;
  if (!ot) return undefined;
  if (typeof ot === "string") return ot;
  if (typeof ot === "object") {
    // May have a reference sub-element or direct text
    const text = textOf(ot);
    if (text) return text;
    const ref = (ot as Record<string, unknown>).reference as Record<string, unknown>;
    return attr(ref, "value")?.replace(/^#/, "") || undefined;
  }
  return undefined;
}

/** Get a code value and system from a coded element, checking translations. */
function getCodeValue(
  codeNode: Record<string, unknown> | undefined
): { code: string; codeSystem: string } | undefined {
  if (!codeNode) return undefined;

  const code = attr(codeNode, "code");
  const codeSystem = attr(codeNode, "codeSystem");
  if (code && !attr(codeNode, "nullFlavor")) {
    return { code, codeSystem: codeSystem || "" };
  }

  // Check translations
  const translations = asArray(codeNode.translation) || [];
  for (const t of translations) {
    const tCode = attr(t, "code");
    const tSystem = attr(t, "codeSystem");
    if (tCode) return { code: tCode, codeSystem: tSystem || "" };
  }

  return undefined;
}

/** Extract entry ID from id elements. */
function getEntryId(node: Record<string, unknown>): string {
  const ids = asArray(node.id) || [];
  const first = ids[0];
  return (
    attr(first, "extension") ||
    attr(first, "root") ||
    crypto.randomUUID()
  );
}

/** Map HL7 status codes to medication status types. */
function mapStatus(
  code: string | undefined
): "active" | "completed" | "unknown" {
  switch (code) {
    case "active":
      return "active";
    case "completed":
    case "aborted":
      return "completed";
    default:
      return "unknown";
  }
}

/** Map HL7 status codes to problem status types. */
function mapProblemStatus(
  code: string | undefined
): "active" | "inactive" | "resolved" | "unknown" {
  switch (code) {
    case "active":
      return "active";
    case "completed":
      return "resolved";
    case "aborted":
      return "inactive";
    default:
      return "unknown";
  }
}

/** Map SNOMED allergy status codes. */
function mapAllergyStatus(
  code: string | undefined
): "active" | "inactive" | "unknown" {
  switch (code) {
    case "55561003": // Active
      return "active";
    case "73425007": // Inactive
    case "413322009": // Resolved
      return "inactive";
    default:
      return "unknown";
  }
}

/** Map interpretation codes (N=normal, H=high, L=low, etc.) */
function mapInterpretation(
  code: string | undefined
): LabObservation["interpretation"] {
  switch (code) {
    case "N":
      return "normal";
    case "H":
    case "HH":
      return code === "HH" ? "critical" : "high";
    case "L":
    case "LL":
      return code === "LL" ? "critical" : "low";
    default:
      return "unknown";
  }
}
