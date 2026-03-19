# M3 Plan 1: .ics Parser + Appointments Storage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add .ics calendar file parsing and encrypted appointment storage to the health dashboard, enabling import of appointments alongside CCD health records.

**Architecture:** A new `src/lib/ics/` module parses .ics (iCalendar RFC 5545) files into typed `Appointment` objects. Appointments are stored encrypted in a new IDB `appointments` object store (DB version bump from 1 to 2). A `useAppointments` hook provides React state management. The existing `FileUpload` component is extended to accept both .xml and .ics files with auto-detection by extension.

**Tech Stack:** TypeScript, IndexedDB, Web Crypto API (existing), Vitest + jsdom + fake-indexeddb

**Spec:** `docs/superpowers/specs/2026-03-19-milestone3-appointments-comfort-design.md`

---

### Task 1: Appointment types

**Files:**
- Create: `src/lib/ics/types.ts`
- Create: `src/lib/ics/index.ts`

- [ ] **Step 1: Create appointment types**

Create `src/lib/ics/types.ts`:

```typescript
/**
 * Types for parsed iCalendar (.ics) appointment data.
 */

export interface Appointment {
  id: string;
  uid: string;
  title: string;
  dateTime: string;
  endDateTime?: string;
  location?: string;
  doctorName?: string;
  officePhone?: string;
  description?: string;
  status: "upcoming" | "past" | "cancelled";
  sourceFile?: string;
  importedAt: string;
}

export interface IcsParseResult {
  appointments: Appointment[];
  skipped: number;
  errors: string[];
}
```

- [ ] **Step 2: Create barrel export**

Create `src/lib/ics/index.ts`:

```typescript
export { type Appointment, type IcsParseResult } from "./types";
export { parseIcs } from "./parser";
```

Note: This will have a type error until parser.ts is created in Task 2. That's expected.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ics/types.ts src/lib/ics/index.ts
git commit -m "feat: add appointment types for .ics parser"
```

---

### Task 2: .ics parser

**Files:**
- Create: `src/__tests__/lib/ics/parser.test.ts`
- Create: `src/lib/ics/parser.ts`

- [ ] **Step 1: Write failing parser tests**

Create `src/__tests__/lib/ics/parser.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/ics/parser.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the .ics parser**

Create `src/lib/ics/parser.ts`:

```typescript
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
  const match = text.match(/(?:Dr\.|Doctor)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)/);
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
```

- [ ] **Step 4: Run parser tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/ics/parser.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass (61 existing + 10 new = 71).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ics/parser.ts src/lib/ics/index.ts src/__tests__/lib/ics/
git commit -m "feat: add .ics calendar file parser"
```

---

### Task 3: IDB version bump and appointments store

Bump the database version from 1 to 2 and add the `appointments` object store. The `onupgradeneeded` handler must support both fresh installs (v0 -> v2) and upgrades (v1 -> v2).

**Files:**
- Create: `src/__tests__/lib/db/idb-migration-v2.test.ts`
- Modify: `src/lib/db/idb-helpers.ts`

- [ ] **Step 1: Write failing migration tests**

Create `src/__tests__/lib/db/idb-migration-v2.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { openDB, STORES } from "@/lib/db/idb-helpers";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

describe("IDB v2 migration", () => {
  it("creates appointments store on fresh install", async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains(STORES.appointments)).toBe(true);
    db.close();
  });

  it("appointments store has uid index", async () => {
    const db = await openDB();
    const tx = db.transaction(STORES.appointments, "readonly");
    const store = tx.objectStore(STORES.appointments);
    expect(store.indexNames.contains("uid")).toBe(true);
    expect(store.indexNames.contains("dateTime")).toBe(true);
    db.close();
  });

  it("preserves existing stores", async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains(STORES.documents)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.healthData)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.meta)).toBe(true);
    db.close();
  });

  it("upgrades from v1 to v2 without data loss", async () => {
    // Simulate v1 database by opening with old version first
    // fake-indexeddb supports this: open at v1 first, then v2
    const dbV1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("health-dashboard", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("documents")) {
          const docStore = db.createObjectStore("documents", { keyPath: "id" });
          docStore.createIndex("sourceFile", "sourceFile", { unique: false });
          docStore.createIndex("hash", "hash", { unique: true });
        }
        if (!db.objectStoreNames.contains("healthData")) {
          db.createObjectStore("healthData", { keyPath: "documentId" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Write some data to v1
    await new Promise<void>((resolve, reject) => {
      const tx = dbV1.transaction("meta", "readwrite");
      tx.objectStore("meta").put({ key: "test", value: "preserved" });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    dbV1.close();

    // Now open with v2 (via our openDB which uses DB_VERSION=2)
    const db = await openDB();

    // Verify appointments store was added
    expect(db.objectStoreNames.contains("appointments")).toBe(true);

    // Verify old data preserved
    const tx = db.transaction("meta", "readonly");
    const request = tx.objectStore("meta").get("test");
    const result = await new Promise<{ key: string; value: string } | undefined>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    expect(result?.value).toBe("preserved");

    db.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/db/idb-migration-v2.test.ts
```

Expected: FAIL (STORES.appointments does not exist, DB_VERSION is still 1).

- [ ] **Step 3: Update idb-helpers.ts for v2**

In `src/lib/db/idb-helpers.ts`, make these changes:

Change `DB_VERSION` from 1 to 2:
```typescript
const DB_VERSION = 2;
```

Add `appointments` to `STORES`:
```typescript
export const STORES = {
  documents: "documents",
  healthData: "healthData",
  meta: "meta",
  appointments: "appointments",
} as const;
```

Update `onupgradeneeded` to handle version-specific upgrades. Replace the existing `request.onupgradeneeded` handler:

```typescript
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // v0 -> v1: Create original stores
      if (oldVersion < 1) {
        const docStore = db.createObjectStore(STORES.documents, {
          keyPath: "id",
        });
        docStore.createIndex("sourceFile", "sourceFile", { unique: false });
        docStore.createIndex("hash", "hash", { unique: true });

        db.createObjectStore(STORES.healthData, { keyPath: "documentId" });
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }

      // v1 -> v2: Add appointments store
      if (oldVersion < 2) {
        const apptStore = db.createObjectStore(STORES.appointments, {
          keyPath: "id",
        });
        apptStore.createIndex("uid", "uid", { unique: false });
        apptStore.createIndex("dateTime", "dateTime", { unique: false });
      }
    };
```

Note: The `uid` index is `unique: false` because a recurring event could have the same UID with different dates. Dedup logic is handled at the store function level.

- [ ] **Step 4: Run migration tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/db/idb-migration-v2.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass. Existing IDB tests should work because `fake-indexeddb` resets between tests and the new `onupgradeneeded` still creates all stores on fresh install.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/idb-helpers.ts src/__tests__/lib/db/idb-migration-v2.test.ts
git commit -m "feat: bump IDB to v2, add appointments store"
```

---

### Task 4: Encrypted appointment storage

**Files:**
- Create: `src/__tests__/lib/db/encrypted-appointments.test.ts`
- Create: `src/lib/db/encrypted-appointments.ts`
- Modify: `src/lib/db/index.ts` (add exports)

- [ ] **Step 1: Write failing encrypted appointment store tests**

Create `src/__tests__/lib/db/encrypted-appointments.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  storeEncryptedAppointment,
  getAllEncryptedAppointments,
  deleteAppointment,
} from "@/lib/db/encrypted-appointments";
import { generateKey } from "@/lib/crypto/encryption";
import type { Appointment } from "@/lib/ics/types";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

function makeFakeAppointment(uid: string, dateTime: string): Appointment {
  return {
    id: crypto.randomUUID(),
    uid,
    title: `Appointment ${uid}`,
    dateTime,
    location: "Main Street Medical",
    doctorName: "Dr. Smith",
    officePhone: "(555) 123-4567",
    status: "upcoming",
    importedAt: new Date().toISOString(),
  };
}

describe("encrypted-appointments", () => {
  describe("storeEncryptedAppointment", () => {
    it("stores and retrieves an encrypted appointment", async () => {
      const key = await generateKey();
      const appt = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");

      const wasNew = await storeEncryptedAppointment(appt, key);
      expect(wasNew).toBe(true);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(1);
      expect(all[0].uid).toBe("uid-1");
      expect(all[0].title).toBe("Appointment uid-1");
      expect(all[0].doctorName).toBe("Dr. Smith");
    });

    it("deduplicates by uid + dateTime", async () => {
      const key = await generateKey();
      const appt1 = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");
      const appt2 = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");
      appt2.title = "Updated Title";

      await storeEncryptedAppointment(appt1, key);
      const wasNew = await storeEncryptedAppointment(appt2, key);
      expect(wasNew).toBe(false);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe("Appointment uid-1"); // First one kept
    });

    it("allows same uid with different dateTime (recurring)", async () => {
      const key = await generateKey();
      const appt1 = makeFakeAppointment("recurring-uid", "2026-04-01T09:30:00");
      const appt2 = makeFakeAppointment("recurring-uid", "2026-04-08T09:30:00");

      await storeEncryptedAppointment(appt1, key);
      const wasNew = await storeEncryptedAppointment(appt2, key);
      expect(wasNew).toBe(true);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(2);
    });

    it("stores multiple appointments", async () => {
      const key = await generateKey();
      await storeEncryptedAppointment(
        makeFakeAppointment("uid-a", "2026-04-01T09:00:00"), key
      );
      await storeEncryptedAppointment(
        makeFakeAppointment("uid-b", "2026-04-15T14:00:00"), key
      );

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(2);
    });
  });

  describe("getAllEncryptedAppointments", () => {
    it("returns empty array when no appointments", async () => {
      const key = await generateKey();
      const all = await getAllEncryptedAppointments(key);
      expect(all).toEqual([]);
    });

    it("fails to decrypt with wrong key", async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();
      await storeEncryptedAppointment(
        makeFakeAppointment("uid-1", "2026-04-01T09:30:00"), key1
      );
      await expect(getAllEncryptedAppointments(key2)).rejects.toThrow();
    });
  });

  describe("deleteAppointment", () => {
    it("deletes a single appointment by id", async () => {
      const key = await generateKey();
      const appt = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");
      await storeEncryptedAppointment(appt, key);

      await deleteAppointment(appt.id);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toEqual([]);
    });

    it("does not affect other appointments", async () => {
      const key = await generateKey();
      const appt1 = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");
      const appt2 = makeFakeAppointment("uid-2", "2026-04-15T14:00:00");
      await storeEncryptedAppointment(appt1, key);
      await storeEncryptedAppointment(appt2, key);

      await deleteAppointment(appt1.id);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(1);
      expect(all[0].uid).toBe("uid-2");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/db/encrypted-appointments.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement encrypted-appointments.ts**

Create `src/lib/db/encrypted-appointments.ts`:

```typescript
/**
 * Encrypted appointment storage in IndexedDB.
 *
 * Follows the same pattern as encrypted-store.ts: encrypt the full
 * Appointment object as JSON before writing, decrypt on read.
 * Deduplicates by uid + dateTime combination.
 */

import type { Appointment } from "@/lib/ics/types";
import { encrypt, decrypt, type EncryptedData } from "@/lib/crypto/encryption";
import { openDB, STORES, idbGetAll, idbComplete } from "./idb-helpers";

interface EncryptedAppointmentRecord {
  id: string;
  uid: string;
  dateTime: string;
  data: EncryptedData;
}

/**
 * Store an encrypted appointment. Returns false if duplicate (same uid + dateTime).
 */
export async function storeEncryptedAppointment(
  appointment: Appointment,
  masterKey: CryptoKey
): Promise<boolean> {
  const db = await openDB();

  // Check for duplicate by uid + dateTime
  const tx1 = db.transaction(STORES.appointments, "readonly");
  const store = tx1.objectStore(STORES.appointments);
  const existingByUid = await new Promise<EncryptedAppointmentRecord[]>(
    (resolve, reject) => {
      const index = store.index("uid");
      const request = index.getAll(appointment.uid);
      request.onsuccess = () =>
        resolve(request.result as EncryptedAppointmentRecord[]);
      request.onerror = () => reject(request.error);
    }
  );

  const isDuplicate = existingByUid.some(
    (r) => r.dateTime === appointment.dateTime
  );
  if (isDuplicate) {
    db.close();
    return false;
  }

  // Encrypt the full appointment
  const encryptedData = await encrypt(JSON.stringify(appointment), masterKey);

  const record: EncryptedAppointmentRecord = {
    id: appointment.id,
    uid: appointment.uid,
    dateTime: appointment.dateTime,
    data: encryptedData,
  };

  const tx2 = db.transaction(STORES.appointments, "readwrite");
  tx2.objectStore(STORES.appointments).put(record);
  await idbComplete(tx2);

  db.close();
  return true;
}

/**
 * Read and decrypt all appointments from IDB.
 */
export async function getAllEncryptedAppointments(
  masterKey: CryptoKey
): Promise<Appointment[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.appointments, "readonly");
  const records = await idbGetAll<EncryptedAppointmentRecord>(
    tx.objectStore(STORES.appointments)
  );
  db.close();

  const decrypted: Appointment[] = [];
  for (const record of records) {
    const json = await decrypt(record.data, masterKey);
    decrypted.push(JSON.parse(json) as Appointment);
  }
  return decrypted;
}

/**
 * Delete a single appointment by ID.
 */
export async function deleteAppointment(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.appointments, "readwrite");
  tx.objectStore(STORES.appointments).delete(id);
  await idbComplete(tx);
  db.close();
}
```

- [ ] **Step 4: Update db barrel exports**

Add to `src/lib/db/index.ts`:

```typescript
export {
  storeEncryptedAppointment,
  getAllEncryptedAppointments,
  deleteAppointment,
} from "./encrypted-appointments";
```

- [ ] **Step 5: Run encrypted appointment tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/db/encrypted-appointments.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/encrypted-appointments.ts src/lib/db/index.ts src/__tests__/lib/db/encrypted-appointments.test.ts
git commit -m "feat: add encrypted appointment storage"
```

---

### Task 5: useAppointments hook

**Files:**
- Create: `src/lib/hooks/use-appointments.ts`

- [ ] **Step 1: Create the useAppointments hook**

Create `src/lib/hooks/use-appointments.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Appointment, IcsParseResult } from "@/lib/ics/types";
import { parseIcs } from "@/lib/ics/parser";
import {
  storeEncryptedAppointment,
  getAllEncryptedAppointments,
} from "@/lib/db/encrypted-appointments";

export function useAppointments(masterKey: CryptoKey | null) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!masterKey) {
      setAppointments([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const stored = await getAllEncryptedAppointments(masterKey);
      // Recompute status based on current date
      const withStatus = stored.map((appt) => ({
        ...appt,
        status: appt.status === "cancelled"
          ? "cancelled" as const
          : new Date(appt.dateTime) > new Date()
            ? "upcoming" as const
            : "past" as const,
      }));
      setAppointments(withStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load appointments");
    } finally {
      setIsLoading(false);
    }
  }, [masterKey]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const importIcsFiles = useCallback(
    async (
      files: { content: string; name: string }[]
    ): Promise<{ imported: number; duplicates: number; errors: string[] }> => {
      if (!masterKey) throw new Error("Vault is locked");

      let imported = 0;
      let duplicates = 0;
      const errors: string[] = [];

      for (const file of files) {
        let result: IcsParseResult;
        try {
          result = parseIcs(file.content, file.name);
        } catch (e) {
          errors.push(`${file.name}: ${e instanceof Error ? e.message : "Parse error"}`);
          continue;
        }

        errors.push(...result.errors);

        for (const appt of result.appointments) {
          const wasNew = await storeEncryptedAppointment(appt, masterKey);
          if (wasNew) imported++;
          else duplicates++;
        }
      }

      await loadAppointments();
      return { imported, duplicates, errors };
    },
    [loadAppointments, masterKey]
  );

  const upcoming = appointments
    .filter((a) => a.status === "upcoming")
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime));

  const past = appointments
    .filter((a) => a.status === "past")
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));

  const cancelled = appointments.filter((a) => a.status === "cancelled");

  return {
    appointments,
    upcoming,
    past,
    cancelled,
    isLoading,
    error,
    importIcsFiles,
    hasAppointments: appointments.length > 0,
  };
}
```

- [ ] **Step 2: Run all tests to verify no regressions**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/use-appointments.ts
git commit -m "feat: add useAppointments hook with .ics import"
```

---

### Task 6: Update FileUpload to accept .ics files

**Files:**
- Modify: `src/components/import/file-upload.tsx`
- Modify: `src/app/page.tsx` (pass appointment import handler)

- [ ] **Step 1: Read current files**

Read `src/components/import/file-upload.tsx` and `src/app/page.tsx` to understand current structure before modifying.

- [ ] **Step 2: Update FileUpload component**

Modify `src/components/import/file-upload.tsx`:

1. Update the `FileUploadProps` interface to accept an optional `.ics` handler:

```typescript
interface FileUploadProps {
  onImport: (results: ParsedCCD[], rawXmls: string[]) => void;
  onImportIcs?: (files: { content: string; name: string }[]) => void;
}
```

2. Update the `processFiles` function to route by extension:

- Change the `.xml` check to route files by extension instead of rejecting non-XML
- `.xml` files: existing CCD parse flow
- `.ics` files: collect content and call `onImportIcs`
- Other extensions: report error "Unsupported file type"

3. Update the file input `accept` attribute from `.xml` to `.xml,.ics`

4. Update the UI text from "Drop CCD/XML files here" to "Drop health records or calendar files here" and from "Supports CCD, C-CDA, and CCDA XML formats." to "Supports CCD/XML health records and .ics calendar files."

5. In the results display, show appointment count for .ics files (e.g., "3 appointments")

- [ ] **Step 3: Wire into page.tsx**

In `src/app/page.tsx`:

1. Import `useAppointments` from `@/lib/hooks/use-appointments`
2. Add `const { importIcsFiles } = useAppointments(masterKey);` alongside existing `useHealthData`
3. Pass `onImportIcs` to `FileUpload`:

```tsx
<FileUpload
  onImport={handleImport}
  onImportIcs={async (files) => {
    await importIcsFiles(files);
    setTimeout(() => setShowImport(false), 1000);
  }}
/>
```

- [ ] **Step 4: Verify the app builds**

```bash
cd /e/Projects/health-dashboard && bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/import/file-upload.tsx src/app/page.tsx
git commit -m "feat: extend file upload to accept .ics calendar files"
```

---

### Task 7: Update CLAUDE.md and deleteHealthDataOnly

The `deleteHealthDataOnly` function needs to also clear the `appointments` store (health data includes appointments). Update CLAUDE.md with new architecture info.

**Files:**
- Modify: `src/lib/db/encrypted-store.ts` (add appointments to deleteHealthDataOnly)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update deleteHealthDataOnly**

In `src/lib/db/encrypted-store.ts`, modify `deleteHealthDataOnly` to also clear the appointments store:

```typescript
export async function deleteHealthDataOnly(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [STORES.documents, STORES.healthData, STORES.appointments],
    "readwrite"
  );
  tx.objectStore(STORES.documents).clear();
  tx.objectStore(STORES.healthData).clear();
  tx.objectStore(STORES.appointments).clear();
  await idbComplete(tx);
  db.close();
}
```

- [ ] **Step 2: Update CLAUDE.md**

Add to the Architecture section after the Auth & Encryption block:

```markdown
### Appointments (`src/lib/ics/`)
- .ics (iCalendar) file parser for appointment import
- Appointments stored encrypted in IDB `appointments` store
- Dedup by UID + dateTime combination
- Doctor name and phone extracted from event description via pattern matching
- `useAppointments` hook provides React state with upcoming/past/cancelled filtering
```

- [ ] **Step 3: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Build**

```bash
cd /e/Projects/health-dashboard && bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/encrypted-store.ts CLAUDE.md
git commit -m "feat: include appointments in deleteHealthDataOnly, update docs"
```
