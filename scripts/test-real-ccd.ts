/**
 * Script to test the CCD parser against real XML files.
 * Run with: bun run scripts/test-real-ccd.ts
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseCCD } from "../src/lib/ccd/parser";

const RECORDS_DIR = "E:/Projects/ai-asst/medical-records";
const folders = [
  "Visit_Care_Summaries",
  "Clinical_Summaries",
  "Transition_of_Care_Documents",
];

let totalFiles = 0;
let successFiles = 0;
let errorFiles = 0;
const errors: Array<{ file: string; error: string }> = [];
const stats = {
  medications: 0,
  results: 0,
  problems: 0,
  allergies: 0,
  vitalSigns: 0,
  immunizations: 0,
};

for (const folder of folders) {
  const dirPath = join(RECORDS_DIR, folder);
  let files: string[];
  try {
    files = readdirSync(dirPath).filter((f) => f.endsWith(".xml"));
  } catch {
    console.log(`Skipping ${folder} (not found)`);
    continue;
  }

  for (const file of files) {
    totalFiles++;
    try {
      const xml = readFileSync(join(dirPath, file), "utf-8");
      const result = parseCCD(xml, file);

      stats.medications += result.medications.length;
      stats.results += result.results.length;
      stats.problems += result.problems.length;
      stats.allergies += result.allergies.length;
      stats.vitalSigns += result.vitalSigns.length;
      stats.immunizations += result.immunizations.length;

      successFiles++;
    } catch (e) {
      errorFiles++;
      errors.push({
        file: `${folder}/${file}`,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

console.log("\n=== CCD Parser Real-World Test ===\n");
console.log(`Total files: ${totalFiles}`);
console.log(`Successful: ${successFiles}`);
console.log(`Errors: ${errorFiles}`);
console.log("\n--- Totals ---");
console.log(`Medications: ${stats.medications}`);
console.log(`Lab Results: ${stats.results}`);
console.log(`Problems: ${stats.problems}`);
console.log(`Allergies: ${stats.allergies}`);
console.log(`Vital Signs: ${stats.vitalSigns}`);
console.log(`Immunizations: ${stats.immunizations}`);

if (errors.length > 0) {
  console.log("\n--- Errors ---");
  for (const err of errors) {
    console.log(`  ${err.file}: ${err.error}`);
  }
}
