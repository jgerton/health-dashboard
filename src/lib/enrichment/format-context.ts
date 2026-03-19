/**
 * Format health records as structured markdown for clipboard.
 */

import type { Medication, LabResult, Problem, VitalSign } from "@/lib/ccd/types";

export function formatLabContext(result: LabResult): string {
  const lines = [`## Lab Result Query`, `Panel: ${result.panelName}`];
  if (result.panelCode) lines.push(`Panel Code: ${result.panelCode}`);
  lines.push(`Date: ${result.date}`, "");

  for (const obs of result.observations) {
    lines.push(`### ${obs.name}`);
    if (obs.code) lines.push(`Code: ${obs.code}`);
    lines.push(`Value: ${obs.value}${obs.unit ? ` ${obs.unit}` : ""}`);
    if (obs.referenceRangeLow || obs.referenceRangeHigh) {
      lines.push(`Reference Range: ${obs.referenceRangeLow || "?"} - ${obs.referenceRangeHigh || "?"}`);
    }
    if (obs.interpretation) lines.push(`Interpretation: ${obs.interpretation}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function formatMedicationContext(medication: Medication): string {
  const lines = [`## Medication Query`, `Name: ${medication.name}`];
  if (medication.dose) lines.push(`Dose: ${medication.dose}${medication.doseUnit ? ` ${medication.doseUnit}` : ""}`);
  if (medication.route) lines.push(`Route: ${medication.route}`);
  if (medication.frequency) lines.push(`Frequency: ${medication.frequency}`);
  lines.push(`Status: ${medication.status}`);
  if (medication.startDate) lines.push(`Start Date: ${medication.startDate}`);
  return lines.join("\n");
}

export function formatMedicationListContext(medications: Medication[]): string {
  const lines = [`## Medication Interaction Check`, `Total medications: ${medications.length}`, ""];
  for (const med of medications) {
    lines.push(`- ${med.name}${med.dose ? ` (${med.dose})` : ""} [${med.status}]`);
  }
  return lines.join("\n");
}

export function formatProblemContext(problem: Problem): string {
  const lines = [`## Condition Query`, `Name: ${problem.name}`, `Status: ${problem.status}`];
  if (problem.onsetDate) lines.push(`Onset Date: ${problem.onsetDate}`);
  if (problem.code) lines.push(`Code: ${problem.code}`);
  return lines.join("\n");
}

export function formatVitalsContext(vitalSigns: VitalSign[]): string {
  const lines = [`## Vital Signs Trend Analysis`, `Readings: ${vitalSigns.length}`, ""];
  for (const vs of vitalSigns) {
    lines.push(`### ${vs.date}`);
    for (const m of vs.measurements) {
      lines.push(`- ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
