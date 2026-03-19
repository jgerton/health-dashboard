/**
 * Types for parsed CCD/C-CDA medical record data.
 * Covers the 6 primary sections: medications, results, problems, allergies, vital signs, immunizations.
 */

export interface ParsedCCD {
  patient: PatientInfo;
  medications: Medication[];
  results: LabResult[];
  problems: Problem[];
  allergies: Allergy[];
  vitalSigns: VitalSign[];
  immunizations: Immunization[];
  documentInfo: DocumentInfo;
}

export interface DocumentInfo {
  id: string;
  title: string;
  effectiveTime: string;
  sourceFile?: string;
}

export interface PatientInfo {
  name: string;
  dateOfBirth: string;
  gender: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface Medication {
  id: string;
  name: string;
  code?: string;
  codeSystem?: string;
  route?: string;
  dose?: string;
  doseUnit?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  status: "active" | "completed" | "unknown";
}

export interface LabResult {
  id: string;
  panelName: string;
  panelCode?: string;
  date: string;
  observations: LabObservation[];
}

export interface LabObservation {
  name: string;
  code?: string;
  value: string;
  unit?: string;
  referenceRangeLow?: string;
  referenceRangeHigh?: string;
  interpretation?: "normal" | "high" | "low" | "critical" | "unknown";
  date: string;
}

export interface Problem {
  id: string;
  name: string;
  code?: string;
  codeSystem?: string;
  onsetDate?: string;
  resolvedDate?: string;
  status: "active" | "inactive" | "resolved" | "unknown";
}

export interface Allergy {
  id: string;
  allergen: string;
  allergenCode?: string;
  allergenCodeSystem?: string;
  type: string;
  reaction?: string;
  severity?: string;
  status: "active" | "inactive" | "unknown";
}

export interface VitalSign {
  id: string;
  date: string;
  measurements: VitalMeasurement[];
}

export interface VitalMeasurement {
  name: string;
  code?: string;
  value: string;
  unit?: string;
  interpretation?: string;
}

export interface Immunization {
  id: string;
  name: string;
  code?: string;
  date: string;
  lotNumber?: string;
  status: "completed" | "refused" | "unknown";
}
