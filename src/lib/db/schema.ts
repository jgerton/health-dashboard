/**
 * SQLite schema for the health dashboard.
 * All health data is stored encrypted (the encryption layer wraps values before INSERT).
 * This schema is used with wa-sqlite + OPFS in the browser.
 */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Imported documents tracking (prevents duplicate imports)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  effective_date TEXT,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  patient_name TEXT,
  raw_hash TEXT UNIQUE  -- SHA-256 hash of the raw XML to detect duplicates
);

-- Medications
CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  name TEXT NOT NULL,
  code TEXT,
  code_system TEXT,
  route TEXT,
  dose TEXT,
  dose_unit TEXT,
  frequency TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);
CREATE INDEX IF NOT EXISTS idx_medications_status ON medications(status);

-- Lab Results (panels)
CREATE TABLE IF NOT EXISTS lab_results (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  panel_name TEXT NOT NULL,
  panel_code TEXT,
  date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lab_results_date ON lab_results(date);

-- Lab Observations (individual test results within panels)
CREATE TABLE IF NOT EXISTS lab_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_result_id TEXT NOT NULL REFERENCES lab_results(id),
  name TEXT NOT NULL,
  code TEXT,
  value TEXT NOT NULL,
  unit TEXT,
  reference_range_low TEXT,
  reference_range_high TEXT,
  interpretation TEXT,
  date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lab_observations_name ON lab_observations(name);
CREATE INDEX IF NOT EXISTS idx_lab_observations_code ON lab_observations(code);

-- Problems / Conditions
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  name TEXT NOT NULL,
  code TEXT,
  code_system TEXT,
  onset_date TEXT,
  resolved_date TEXT,
  status TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);

-- Allergies
CREATE TABLE IF NOT EXISTS allergies (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  allergen TEXT NOT NULL,
  allergen_code TEXT,
  allergen_code_system TEXT,
  type TEXT,
  reaction TEXT,
  severity TEXT,
  status TEXT NOT NULL DEFAULT 'unknown'
);

-- Vital Signs (grouped by encounter)
CREATE TABLE IF NOT EXISTS vital_signs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vital_signs_date ON vital_signs(date);

-- Vital Measurements (individual measurements within a vital sign encounter)
CREATE TABLE IF NOT EXISTS vital_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vital_sign_id TEXT NOT NULL REFERENCES vital_signs(id),
  name TEXT NOT NULL,
  code TEXT,
  value TEXT NOT NULL,
  unit TEXT,
  interpretation TEXT
);

-- Immunizations
CREATE TABLE IF NOT EXISTS immunizations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  name TEXT NOT NULL,
  code TEXT,
  date TEXT NOT NULL,
  lot_number TEXT,
  status TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS idx_immunizations_date ON immunizations(date);
`;
