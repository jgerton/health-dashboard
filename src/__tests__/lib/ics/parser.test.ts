import { describe, it, expect } from "vitest";
import { parseIcs } from "@/lib/ics/parser";

const MINIMAL_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event-001@example.com
DTSTART:20260401T093000
DTEND:20260401T100000
SUMMARY:Annual Physical
LOCATION:Main Street Medical, Suite 200
DESCRIPTION:Dr. Smith\\nOffice: (555) 123-4567\\nAnnual wellness visit
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

const MULTI_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-001@example.com
DTSTART:20260401T093000
SUMMARY:Annual Physical
END:VEVENT
BEGIN:VEVENT
UID:event-002@example.com
DTSTART:20260415T140000
SUMMARY:Blood Work Follow-up
LOCATION:Quest Diagnostics
END:VEVENT
END:VCALENDAR`;

const CANCELLED_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-003@example.com
DTSTART:20260501T100000
SUMMARY:Dermatology Checkup
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

const DATE_ONLY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-004@example.com
DTSTART;VALUE=DATE:20260601
SUMMARY:Lab Work
END:VEVENT
END:VCALENDAR`;

const TIMEZONE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-005@example.com
DTSTART;TZID=America/New_York:20260701T083000
DTEND;TZID=America/New_York:20260701T093000
SUMMARY:Cardiology Appointment
END:VEVENT
END:VCALENDAR`;

describe("parseIcs", () => {
  it("parses a single event with all fields", () => {
    const result = parseIcs(MINIMAL_ICS, "test.ics");
    expect(result.appointments).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);

    const appt = result.appointments[0];
    expect(appt.uid).toBe("event-001@example.com");
    expect(appt.title).toBe("Annual Physical");
    expect(appt.dateTime).toBe("2026-04-01T09:30:00");
    expect(appt.endDateTime).toBe("2026-04-01T10:00:00");
    expect(appt.location).toBe("Main Street Medical, Suite 200");
    expect(appt.sourceFile).toBe("test.ics");
  });

  it("extracts doctor name from description", () => {
    const result = parseIcs(MINIMAL_ICS);
    expect(result.appointments[0].doctorName).toBe("Dr. Smith");
  });

  it("extracts phone number from description", () => {
    const result = parseIcs(MINIMAL_ICS);
    expect(result.appointments[0].officePhone).toBe("(555) 123-4567");
  });

  it("parses multiple events", () => {
    const result = parseIcs(MULTI_EVENT_ICS);
    expect(result.appointments).toHaveLength(2);
    expect(result.appointments[0].title).toBe("Annual Physical");
    expect(result.appointments[1].title).toBe("Blood Work Follow-up");
  });

  it("handles cancelled events", () => {
    const result = parseIcs(CANCELLED_ICS);
    expect(result.appointments).toHaveLength(1);
    expect(result.appointments[0].status).toBe("cancelled");
  });

  it("parses date-only DTSTART (no time)", () => {
    const result = parseIcs(DATE_ONLY_ICS);
    expect(result.appointments[0].dateTime).toBe("2026-06-01");
  });

  it("parses DTSTART with timezone", () => {
    const result = parseIcs(TIMEZONE_ICS);
    expect(result.appointments[0].dateTime).toBe("2026-07-01T08:30:00");
    expect(result.appointments[0].endDateTime).toBe("2026-07-01T09:30:00");
  });

  it("skips events missing required fields", () => {
    const badIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:No UID or date
END:VEVENT
BEGIN:VEVENT
UID:good@example.com
DTSTART:20260801T100000
SUMMARY:Valid Event
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(badIcs);
    expect(result.appointments).toHaveLength(1);
    expect(result.appointments[0].title).toBe("Valid Event");
    expect(result.skipped).toBe(1);
  });

  it("throws on invalid .ics (no VCALENDAR)", () => {
    expect(() => parseIcs("not a calendar file")).toThrow("Invalid .ics");
  });

  it("handles empty calendar with no events", () => {
    const empty = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;
    const result = parseIcs(empty);
    expect(result.appointments).toEqual([]);
    expect(result.skipped).toBe(0);
  });
});
