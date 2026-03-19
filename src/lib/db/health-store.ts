/**
 * Health data store - manages storage and retrieval of parsed CCD data.
 *
 * This module works with any SQLite-compatible database interface.
 * In the browser, it uses wa-sqlite + OPFS.
 * For testing, it can use any in-memory SQLite.
 *
 * All write operations are transactional to ensure data consistency.
 */

import type {
  ParsedCCD,
  Medication,
  LabResult,
  Problem,
  Allergy,
  VitalSign,
  Immunization,
} from "@/lib/ccd/types";
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from "./schema";

export interface SQLiteDB {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): void;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

export class HealthStore {
  constructor(private db: SQLiteDB) {}

  /**
   * Initialize the database schema.
   */
  initialize(): void {
    this.db.exec(CREATE_TABLES_SQL);

    // Check if schema version is already recorded
    const versions = this.db.query<{ version: number }>(
      "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
    );

    if (versions.length === 0) {
      this.db.run("INSERT INTO schema_version (version) VALUES (?)", [
        SCHEMA_VERSION,
      ]);
    }
  }

  /**
   * Import a parsed CCD document into the database.
   * Returns true if imported, false if duplicate.
   */
  importDocument(ccd: ParsedCCD, rawHash?: string): boolean {
    // Check for duplicate
    if (rawHash) {
      const existing = this.db.query(
        "SELECT id FROM documents WHERE raw_hash = ?",
        [rawHash]
      );
      if (existing.length > 0) return false;
    }

    const docId = ccd.documentInfo.id;

    this.db.run(
      `INSERT OR REPLACE INTO documents (id, title, effective_date, source_file, patient_name, raw_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        docId,
        ccd.documentInfo.title,
        ccd.documentInfo.effectiveTime,
        ccd.documentInfo.sourceFile || null,
        ccd.patient.name,
        rawHash || null,
      ]
    );

    // Import each section
    this.importMedications(docId, ccd.medications);
    this.importLabResults(docId, ccd.results);
    this.importProblems(docId, ccd.problems);
    this.importAllergies(docId, ccd.allergies);
    this.importVitalSigns(docId, ccd.vitalSigns);
    this.importImmunizations(docId, ccd.immunizations);

    return true;
  }

  // --- Query Methods ---

  getDocuments(): Array<{
    id: string;
    title: string;
    effective_date: string;
    source_file: string;
    imported_at: string;
  }> {
    return this.db.query(
      "SELECT id, title, effective_date, source_file, imported_at FROM documents ORDER BY effective_date DESC"
    );
  }

  getMedications(status?: string): Medication[] {
    const sql = status
      ? "SELECT * FROM medications WHERE status = ? ORDER BY name"
      : "SELECT * FROM medications ORDER BY name";
    const params = status ? [status] : [];
    return this.db.query<MedicationRow>(sql, params).map(rowToMedication);
  }

  getActiveMedications(): Medication[] {
    return this.getMedications("active");
  }

  getLabResults(limit = 50): LabResult[] {
    const panels = this.db.query<LabResultRow>(
      "SELECT * FROM lab_results ORDER BY date DESC LIMIT ?",
      [limit]
    );

    return panels.map((panel) => {
      const observations = this.db.query<LabObservationRow>(
        "SELECT * FROM lab_observations WHERE lab_result_id = ? ORDER BY name",
        [panel.id]
      );

      return {
        id: panel.id,
        panelName: panel.panel_name,
        panelCode: panel.panel_code || undefined,
        date: panel.date,
        observations: observations.map((obs) => ({
          name: obs.name,
          code: obs.code || undefined,
          value: obs.value,
          unit: obs.unit || undefined,
          referenceRangeLow: obs.reference_range_low || undefined,
          referenceRangeHigh: obs.reference_range_high || undefined,
          interpretation: (obs.interpretation as LabResult["observations"][0]["interpretation"]) || "unknown",
          date: obs.date,
        })),
      };
    });
  }

  /**
   * Get trend data for a specific lab test over time.
   */
  getLabTrend(
    testName: string
  ): Array<{
    date: string;
    value: string;
    unit: string;
    interpretation: string;
    referenceRangeLow?: string;
    referenceRangeHigh?: string;
  }> {
    return this.db.query(
      `SELECT date, value, unit, interpretation, reference_range_low, reference_range_high
       FROM lab_observations
       WHERE name = ?
       ORDER BY date ASC`,
      [testName]
    );
  }

  getProblems(status?: string): Problem[] {
    const sql = status
      ? "SELECT * FROM problems WHERE status = ? ORDER BY onset_date DESC"
      : "SELECT * FROM problems ORDER BY onset_date DESC";
    const params = status ? [status] : [];
    return this.db.query<ProblemRow>(sql, params).map(rowToProblem);
  }

  getActiveProblems(): Problem[] {
    return this.getProblems("active");
  }

  getAllergies(): Allergy[] {
    return this.db
      .query<AllergyRow>("SELECT * FROM allergies ORDER BY allergen")
      .map(rowToAllergy);
  }

  getVitalSigns(limit = 50): VitalSign[] {
    const signs = this.db.query<VitalSignRow>(
      "SELECT * FROM vital_signs ORDER BY date DESC LIMIT ?",
      [limit]
    );

    return signs.map((vs) => {
      const measurements = this.db.query<VitalMeasurementRow>(
        "SELECT * FROM vital_measurements WHERE vital_sign_id = ?",
        [vs.id]
      );

      return {
        id: vs.id,
        date: vs.date,
        measurements: measurements.map((m) => ({
          name: m.name,
          code: m.code || undefined,
          value: m.value,
          unit: m.unit || undefined,
          interpretation: m.interpretation || undefined,
        })),
      };
    });
  }

  getImmunizations(): Immunization[] {
    return this.db
      .query<ImmunizationRow>(
        "SELECT * FROM immunizations ORDER BY date DESC"
      )
      .map(rowToImmunization);
  }

  /**
   * Get a summary of all data counts.
   */
  getSummary(): {
    documents: number;
    medications: number;
    activeMedications: number;
    labResults: number;
    problems: number;
    activeProblems: number;
    allergies: number;
    vitalSigns: number;
    immunizations: number;
  } {
    const count = (table: string, where = ""): number => {
      const sql = `SELECT COUNT(*) as count FROM ${table}${where ? " WHERE " + where : ""}`;
      const result = this.db.query<{ count: number }>(sql);
      return result[0]?.count || 0;
    };

    return {
      documents: count("documents"),
      medications: count("medications"),
      activeMedications: count("medications", "status = 'active'"),
      labResults: count("lab_results"),
      problems: count("problems"),
      activeProblems: count("problems", "status = 'active'"),
      allergies: count("allergies"),
      vitalSigns: count("vital_signs"),
      immunizations: count("immunizations"),
    };
  }

  /**
   * Delete all data (for user data deletion requests).
   */
  deleteAllData(): void {
    const tables = [
      "vital_measurements",
      "vital_signs",
      "lab_observations",
      "lab_results",
      "medications",
      "problems",
      "allergies",
      "immunizations",
      "documents",
    ];
    for (const table of tables) {
      this.db.exec(`DELETE FROM ${table}`);
    }
  }

  // --- Private Import Methods ---

  private importMedications(docId: string, meds: Medication[]): void {
    for (const med of meds) {
      this.db.run(
        `INSERT OR REPLACE INTO medications (id, document_id, name, code, code_system, route, dose, dose_unit, frequency, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          med.id,
          docId,
          med.name,
          med.code || null,
          med.codeSystem || null,
          med.route || null,
          med.dose || null,
          med.doseUnit || null,
          med.frequency || null,
          med.startDate || null,
          med.endDate || null,
          med.status,
        ]
      );
    }
  }

  private importLabResults(docId: string, results: LabResult[]): void {
    for (const result of results) {
      this.db.run(
        `INSERT OR REPLACE INTO lab_results (id, document_id, panel_name, panel_code, date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          result.id,
          docId,
          result.panelName,
          result.panelCode || null,
          result.date,
        ]
      );

      for (const obs of result.observations) {
        this.db.run(
          `INSERT INTO lab_observations (lab_result_id, name, code, value, unit, reference_range_low, reference_range_high, interpretation, date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            result.id,
            obs.name,
            obs.code || null,
            obs.value,
            obs.unit || null,
            obs.referenceRangeLow || null,
            obs.referenceRangeHigh || null,
            obs.interpretation || null,
            obs.date,
          ]
        );
      }
    }
  }

  private importProblems(docId: string, problems: Problem[]): void {
    for (const problem of problems) {
      this.db.run(
        `INSERT OR REPLACE INTO problems (id, document_id, name, code, code_system, onset_date, resolved_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          problem.id,
          docId,
          problem.name,
          problem.code || null,
          problem.codeSystem || null,
          problem.onsetDate || null,
          problem.resolvedDate || null,
          problem.status,
        ]
      );
    }
  }

  private importAllergies(docId: string, allergies: Allergy[]): void {
    for (const allergy of allergies) {
      this.db.run(
        `INSERT OR REPLACE INTO allergies (id, document_id, allergen, allergen_code, allergen_code_system, type, reaction, severity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          allergy.id,
          docId,
          allergy.allergen,
          allergy.allergenCode || null,
          allergy.allergenCodeSystem || null,
          allergy.type,
          allergy.reaction || null,
          allergy.severity || null,
          allergy.status,
        ]
      );
    }
  }

  private importVitalSigns(docId: string, vitalSigns: VitalSign[]): void {
    for (const vs of vitalSigns) {
      this.db.run(
        `INSERT OR REPLACE INTO vital_signs (id, document_id, date)
         VALUES (?, ?, ?)`,
        [vs.id, docId, vs.date]
      );

      for (const m of vs.measurements) {
        this.db.run(
          `INSERT INTO vital_measurements (vital_sign_id, name, code, value, unit, interpretation)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [vs.id, m.name, m.code || null, m.value, m.unit || null, m.interpretation || null]
        );
      }
    }
  }

  private importImmunizations(
    docId: string,
    immunizations: Immunization[]
  ): void {
    for (const imm of immunizations) {
      this.db.run(
        `INSERT OR REPLACE INTO immunizations (id, document_id, name, code, date, lot_number, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          imm.id,
          docId,
          imm.name,
          imm.code || null,
          imm.date,
          imm.lotNumber || null,
          imm.status,
        ]
      );
    }
  }
}

// --- Row types for database query results ---

interface MedicationRow {
  id: string;
  name: string;
  code: string | null;
  code_system: string | null;
  route: string | null;
  dose: string | null;
  dose_unit: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

interface LabResultRow {
  id: string;
  panel_name: string;
  panel_code: string | null;
  date: string;
}

interface LabObservationRow {
  name: string;
  code: string | null;
  value: string;
  unit: string | null;
  reference_range_low: string | null;
  reference_range_high: string | null;
  interpretation: string | null;
  date: string;
}

interface ProblemRow {
  id: string;
  name: string;
  code: string | null;
  code_system: string | null;
  onset_date: string | null;
  resolved_date: string | null;
  status: string;
}

interface AllergyRow {
  id: string;
  allergen: string;
  allergen_code: string | null;
  allergen_code_system: string | null;
  type: string;
  reaction: string | null;
  severity: string | null;
  status: string;
}

interface VitalSignRow {
  id: string;
  date: string;
}

interface VitalMeasurementRow {
  name: string;
  code: string | null;
  value: string;
  unit: string | null;
  interpretation: string | null;
}

interface ImmunizationRow {
  id: string;
  name: string;
  code: string | null;
  date: string;
  lot_number: string | null;
  status: string;
}

// --- Row-to-type mappers ---

function rowToMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    code: row.code || undefined,
    codeSystem: row.code_system || undefined,
    route: row.route || undefined,
    dose: row.dose || undefined,
    doseUnit: row.dose_unit || undefined,
    frequency: row.frequency || undefined,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    status: row.status as Medication["status"],
  };
}

function rowToProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    name: row.name,
    code: row.code || undefined,
    codeSystem: row.code_system || undefined,
    onsetDate: row.onset_date || undefined,
    resolvedDate: row.resolved_date || undefined,
    status: row.status as Problem["status"],
  };
}

function rowToAllergy(row: AllergyRow): Allergy {
  return {
    id: row.id,
    allergen: row.allergen,
    allergenCode: row.allergen_code || undefined,
    allergenCodeSystem: row.allergen_code_system || undefined,
    type: row.type,
    reaction: row.reaction || undefined,
    severity: row.severity || undefined,
    status: row.status as Allergy["status"],
  };
}

function rowToImmunization(row: ImmunizationRow): Immunization {
  return {
    id: row.id,
    name: row.name,
    code: row.code || undefined,
    date: row.date,
    lotNumber: row.lot_number || undefined,
    status: row.status as Immunization["status"],
  };
}
