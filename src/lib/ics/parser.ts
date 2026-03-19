/**
 * iCalendar (.ics) file parser.
 *
 * Parses RFC 5545 VCALENDAR files, extracting VEVENT blocks into
 * typed Appointment objects. Handles date-only, datetime, and
 * timezone-prefixed DTSTART/DTEND formats. Extracts doctor name
 * and phone number from DESCRIPTION via pattern matching.
 */

import type { Appointment, IcsParseResult } from "./types";

/**
 * Parse an .ics file into appointments.
 * Throws if the content is not a valid VCALENDAR.
 * Skips individual events that lack required fields (UID, DTSTART, SUMMARY).
 */
export function parseIcs(content: string, sourceFile?: string): IcsParseResult {
  if (!content.includes("BEGIN:VCALENDAR")) {
    throw new Error("Invalid .ics file: no VCALENDAR found");
  }

  const events = extractVEvents(content);
  const appointments: Appointment[] = [];
  let skipped = 0;
  const errors: string[] = [];

  for (const eventBlock of events) {
    const fields = parseEventFields(eventBlock);

    const uid = fields.get("UID");
    const dtstart = fields.get("DTSTART");
    const summary = fields.get("SUMMARY");

    if (!uid || !dtstart || !summary) {
      skipped++;
      errors.push(
        `Skipped event: missing ${[!uid && "UID", !dtstart && "DTSTART", !summary && "SUMMARY"].filter(Boolean).join(", ")}`
      );
      continue;
    }

    const description = fields.get("DESCRIPTION") || "";
    const icsStatus = fields.get("STATUS") || "";

    const appointment: Appointment = {
      id: crypto.randomUUID(),
      uid,
      title: summary,
      dateTime: parseIcsDate(dtstart),
      endDateTime: fields.get("DTEND")
        ? parseIcsDate(fields.get("DTEND")!)
        : undefined,
      location: fields.get("LOCATION"),
      doctorName: extractDoctorName(description),
      officePhone: extractPhone(description),
      description: unescapeIcsText(description) || undefined,
      status: icsStatus.toUpperCase() === "CANCELLED" ? "cancelled" : deriveStatus(dtstart),
      sourceFile,
      importedAt: new Date().toISOString(),
    };

    appointments.push(appointment);
  }

  return { appointments, skipped, errors };
}

/**
 * Extract VEVENT blocks from the calendar content.
 */
function extractVEvents(content: string): string[] {
  const events: string[] = [];
  const lines = content.split(/\r?\n/);
  let inEvent = false;
  let currentEvent: string[] = [];

  for (const line of lines) {
    if (line.trim() === "BEGIN:VEVENT") {
      inEvent = true;
      currentEvent = [];
    } else if (line.trim() === "END:VEVENT") {
      inEvent = false;
      events.push(currentEvent.join("\n"));
    } else if (inEvent) {
      currentEvent.push(line);
    }
  }

  return events;
}

/**
 * Parse VEVENT fields into a key-value map.
 * Handles properties with parameters (e.g., DTSTART;TZID=...:value).
 * Handles folded lines (lines starting with space/tab are continuations).
 */
function parseEventFields(eventBlock: string): Map<string, string> {
  const fields = new Map<string, string>();
  const lines = unfoldLines(eventBlock.split(/\r?\n/));

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    let key = line.substring(0, colonIdx);
    const value = line.substring(colonIdx + 1).trim();

    // Strip parameters (e.g., DTSTART;TZID=America/New_York -> DTSTART)
    const semiIdx = key.indexOf(";");
    if (semiIdx !== -1) {
      key = key.substring(0, semiIdx);
    }

    fields.set(key.trim(), value);
  }

  return fields;
}

/**
 * Unfold continuation lines per RFC 5545.
 * Lines starting with a space or tab are joined to the previous line.
 */
function unfoldLines(lines: string[]): string[] {
  const result: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && result.length > 0) {
      result[result.length - 1] += line.substring(1);
    } else {
      result.push(line);
    }
  }
  return result;
}

/**
 * Parse iCalendar date formats to ISO 8601.
 * Handles: YYYYMMDD, YYYYMMDDTHHMMSS, YYYYMMDDTHHMMSSZ
 */
function parseIcsDate(value: string): string {
  // Strip any trailing Z (UTC indicator) for simplicity
  const clean = value.replace(/Z$/, "");

  if (clean.length === 8) {
    // Date only: YYYYMMDD
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }

  if (clean.length >= 15 && clean.includes("T")) {
    // DateTime: YYYYMMDDTHHMMSS
    const date = clean.slice(0, 8);
    const time = clean.slice(9, 15);
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`;
  }

  return value; // Fallback: return as-is
}

/**
 * Derive appointment status based on date vs now.
 */
function deriveStatus(dtstart: string): "upcoming" | "past" {
  const parsed = parseIcsDate(dtstart);
  const apptDate = new Date(parsed);
  return apptDate > new Date() ? "upcoming" : "past";
}

/**
 * Extract doctor name from description text.
 * Looks for patterns like "Dr. Smith", "Doctor Johnson".
 */
function extractDoctorName(description: string): string | undefined {
  const text = unescapeIcsText(description);
  // Match "Dr." or "Doctor" followed by a name
  const match = text.match(/(?:Dr\.|Doctor) +([A-Z][a-zA-Z'-]+(?:[ \t]+[A-Z][a-zA-Z'-]+)?)/);
  return match ? match[0] : undefined;
}

/**
 * Extract phone number from description text.
 * Matches common US phone formats.
 */
function extractPhone(description: string): string | undefined {
  const text = unescapeIcsText(description);
  const match = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return match ? match[0] : undefined;
}

/**
 * Unescape .ics text values.
 * In .ics format, \n represents newline, \, represents comma, etc.
 */
function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, "\\")
    .replace(/\\;/g, ";");
}
