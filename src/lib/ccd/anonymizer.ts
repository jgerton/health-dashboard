/**
 * Data anonymizer for demo/portfolio mode.
 * Generates realistic but fake patient data from real CCD structures.
 */

import type { ParsedCCD } from "./types";

const FAKE_NAMES = [
  "Alex Morgan",
  "Sam Rivera",
  "Jordan Chen",
  "Taylor Brooks",
  "Casey Williams",
];

const FAKE_STREETS = [
  "742 Evergreen Terrace",
  "221B Baker Street",
  "1600 Pennsylvania Ave",
  "350 Fifth Avenue",
  "1 Infinite Loop",
];

const FAKE_CITIES = [
  { city: "Portland", state: "OR", zip: "97201" },
  { city: "Seattle", state: "WA", zip: "98101" },
  { city: "Denver", state: "CO", zip: "80202" },
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Chicago", state: "IL", zip: "60601" },
];

/**
 * Anonymize a parsed CCD by replacing all identifying information
 * while preserving the clinical data structure and relationships.
 */
export function anonymizeCCD(ccd: ParsedCCD, seed = 0): ParsedCCD {
  const nameIndex = seed % FAKE_NAMES.length;
  const cityIndex = seed % FAKE_CITIES.length;
  const streetIndex = seed % FAKE_STREETS.length;
  const location = FAKE_CITIES[cityIndex];

  // Shift all dates by a random offset (1-3 years back)
  const dateOffsetDays = 365 + (seed % 730);

  return {
    ...ccd,
    patient: {
      name: FAKE_NAMES[nameIndex],
      dateOfBirth: shiftDate(ccd.patient.dateOfBirth, dateOffsetDays),
      gender: ccd.patient.gender,
      address: {
        street: FAKE_STREETS[streetIndex],
        city: location.city,
        state: location.state,
        zip: location.zip,
      },
    },
    documentInfo: {
      ...ccd.documentInfo,
      id: `DEMO-${seed.toString().padStart(4, "0")}`,
      sourceFile: `demo-record-${seed}.xml`,
    },
    // Clinical data is kept as-is (medications, labs, etc. are not PHI by themselves)
    // But we randomize IDs to prevent correlation
    medications: ccd.medications.map((m) => ({
      ...m,
      id: `med-${randomId()}`,
    })),
    results: ccd.results.map((r) => ({
      ...r,
      id: `res-${randomId()}`,
      date: shiftDate(r.date, dateOffsetDays),
      observations: r.observations.map((o) => ({
        ...o,
        date: shiftDate(o.date, dateOffsetDays),
      })),
    })),
    problems: ccd.problems.map((p) => ({
      ...p,
      id: `prob-${randomId()}`,
      onsetDate: p.onsetDate ? shiftDate(p.onsetDate, dateOffsetDays) : undefined,
      resolvedDate: p.resolvedDate
        ? shiftDate(p.resolvedDate, dateOffsetDays)
        : undefined,
    })),
    allergies: ccd.allergies.map((a) => ({
      ...a,
      id: `alg-${randomId()}`,
    })),
    vitalSigns: ccd.vitalSigns.map((v) => ({
      ...v,
      id: `vs-${randomId()}`,
      date: shiftDate(v.date, dateOffsetDays),
    })),
    immunizations: ccd.immunizations.map((i) => ({
      ...i,
      id: `imm-${randomId()}`,
      date: shiftDate(i.date, dateOffsetDays),
      lotNumber: i.lotNumber ? `LOT${randomId().substring(0, 6)}` : undefined,
    })),
  };
}

function shiftDate(dateStr: string, offsetDays: number): string {
  if (!dateStr) return dateStr;

  // Handle ISO date strings (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;

  const date = new Date(dateStr);
  date.setDate(date.getDate() - offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  // Preserve time portion if present
  const timePart = dateStr.includes("T") ? dateStr.substring(10) : "";
  return `${year}-${month}-${day}${timePart}`;
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}
