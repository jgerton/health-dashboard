# Milestone 3: Appointments View + Comfort Mode

## Goal

Add .ics calendar import, an appointments-first landing page, comfort mode toggle for elder-friendly UX, and follow-up detection from CCD data. Single-user, local-first, no server.

## Context

Milestones 1-2 delivered a CCD parser, IndexedDB persistence, encrypted storage, and a tabbed health dashboard. The current app is functional but oriented toward a tech-savvy user managing their own records.

Milestone 3 adds a caregiver scenario: Jon manages a parent's health data and appointments. The parent can open the app in their browser to see upcoming appointments and, optionally, a simplified view of their health records.

Reminders (e.g., "schedule your annual") live in Google Calendar, managed via Jon's ai-asst GWS CLI tooling. The dashboard focuses on displaying appointments and surfacing follow-up dates found in clinical data.

## Architecture Decisions

- **No server, no multi-user.** Single vault, single user, all data in IndexedDB.
- **Appointments stored in IDB.** New `appointments` object store, encrypted with the existing master key.
- **IDB version bump to 2.** Adds `appointments` store in `onupgradeneeded`.
- **.ics parser is a new module** parallel to the CCD parser. Same pattern: parse file, return typed objects.
- **Comfort mode persisted in IDB `meta` store.** Simple boolean flag, survives page reloads.
- **Follow-ups derived from CCD data, not stored as appointments.** They're suggestions, not confirmed events.
- **File import auto-detects type** by extension (.xml/.ics) rather than requiring separate upload flows.

---

## Data Layer

### Appointment Type

```typescript
interface Appointment {
  id: string;           // Generated UUID
  uid: string;          // VEVENT UID from .ics (for dedup)
  title: string;        // SUMMARY field
  dateTime: string;     // ISO 8601 from DTSTART
  endDateTime?: string; // ISO 8601 from DTEND
  location?: string;    // LOCATION field
  doctorName?: string;  // Parsed from DESCRIPTION or LOCATION
  officePhone?: string; // Parsed from DESCRIPTION
  description?: string; // Full DESCRIPTION text
  status: "upcoming" | "past" | "cancelled";
  sourceFile?: string;  // Original .ics filename
  importedAt: string;   // ISO 8601
}
```

### FollowUp Type

```typescript
interface FollowUp {
  suggestedDate: string; // ISO 8601 or partial date
  reason: string;        // e.g., "Recheck labs", "Annual physical"
  source: string;        // Which section/document it came from
  documentId: string;    // Link to source CCD document
}
```

### IDB Schema Changes

- Bump `DB_VERSION` from 1 to 2 in `idb-helpers.ts`
- Add `appointments` object store with `keyPath: "id"`, index on `uid` (unique) and `dateTime`
- Existing stores unchanged
- `onupgradeneeded` handles both v0->v2 (fresh install) and v1->v2 (existing user) migrations

### Encrypted Storage

- `storeEncryptedAppointment(appointment, masterKey)` - Encrypt and store
- `getAllEncryptedAppointments(masterKey)` - Read and decrypt all
- `deleteAppointment(id)` - Remove single appointment
- Follows the same encrypt-JSON-before-write pattern as `storeEncryptedDocument`
- Dedup by `uid` + `dateTime` combination

### Appointment Status

Appointment `status` is derived at read time based on `dateTime` vs current date. No need to update stored records. `cancelled` status comes from the .ics VEVENT STATUS field.

---

## .ics Parser

### Module: `src/lib/ics/`

**Files:**
- `parser.ts` - Parse .ics content into `Appointment[]`
- `types.ts` - `Appointment` and related types
- `index.ts` - Barrel export

**Parsing approach:**
- .ics is a text format (RFC 5545), no XML. Line-based parsing with `BEGIN:VEVENT` / `END:VEVENT` blocks.
- Extract: SUMMARY, DTSTART, DTEND, LOCATION, DESCRIPTION, UID, STATUS
- Parse DTSTART/DTEND from iCalendar date format (YYYYMMDD or YYYYMMDDTHHMMSS with optional timezone) to ISO 8601
- Doctor name and office phone: best-effort extraction from DESCRIPTION using pattern matching (e.g., "Dr. Smith", phone number regex). These fields are optional.
- No external library needed. The format is simple enough for hand-parsing. If edge cases arise, `ical.js` can be added later.

**Error handling:**
- Invalid .ics files: throw with descriptive message
- Missing required fields (SUMMARY, DTSTART, UID): skip that event, continue parsing others
- Return `{ appointments: Appointment[], skipped: number, errors: string[] }` like the CCD import pattern

---

## Follow-up Detection

### Module: `src/lib/ccd/follow-ups.ts`

Scans parsed CCD data for follow-up indicators. This is best-effort pattern matching, not a clinical NLP system.

**What to scan:**
- Problem entries with future dates in `onsetDate` or notes
- Lab results where the panel date plus a common recheck interval (3mo, 6mo, 12mo) falls in the future
- Any section text containing "follow up", "recheck", "return visit", "schedule" near a date

**Output:** `FollowUp[]` derived from a `ParsedCCD`. Called during import and stored as part of the health data aggregation, not in a separate store.

**How follow-ups surface:** The `useHealthData` hook exposes a `followUps` field in `AggregatedHealthData`. The appointments view reads this and renders them as distinct cards.

---

## UI Changes

### Landing Page (Appointments View)

The default view after unlock. Replaces the current empty-state / tabbed dashboard as the first thing users see.

**Layout:**
- Section: "Upcoming Appointments" - Large cards sorted by date (soonest first)
  - Each card: date/time (large, prominent), title/purpose, doctor name, location, office phone
  - Phone number tappable on mobile
- Section: "Follow-up Needed" - Cards with amber/yellow styling, labeled "From your records"
  - Each card: suggested date, reason, source document
  - Visually distinct from confirmed appointments
- Section: "Past Appointments" - Collapsed by default, expandable
- "View Health Records" button navigates to the tabbed dashboard

**Empty state:** "No upcoming appointments. Import a calendar file (.ics) to get started."

### File Import Changes

The existing `FileUpload` component currently only accepts `.xml` files.

**Changes:**
- Accept both `.xml` and `.ics` files
- Auto-detect type by extension
- .xml files go through CCD parser (existing flow)
- .ics files go through the new .ics parser, then `storeEncryptedAppointment`
- Import summary shows counts for both types if mixed
- Header import button and drag-and-drop both support the new types

### Comfort Mode Toggle

**Toggle location:** Header area, persisted in IDB `meta` store as `{ key: "comfort-mode", enabled: boolean }`.

**ComfortModeProvider context:**
- `isComfort: boolean` - Current mode
- `toggleComfort: () => void` - Switch mode
- Wraps the app alongside VaultProvider

**What changes in comfort mode:**

| Aspect | Standard | Comfort |
|--------|----------|---------|
| Base text size | 14-16px | 18-20px |
| Tab grouping | 8 tabs | 4 tabs |
| Health Summary tab | N/A | Conditions + Allergies + Vitals merged |
| Records tab | N/A | Labs + Immunizations + Visits merged |
| Information density | Full (codes, IDs, date ranges) | Essentials (name, status, date) |
| Card spacing | Standard | More generous whitespace |

**What stays the same in both modes:**
- Appointments landing page (already simplified)
- Search functionality
- Import/export flows
- Lock button and encryption behavior

### Comfort Mode: Tab Grouping

In comfort mode, the 8 tabs collapse to 4:

1. **Medications** - Same as current, but with comfort styling (larger text, hide medication codes/code systems, show only name, dose, status)
2. **Health Summary** - New composite view:
   - "Conditions" section (from ProblemsView, simplified)
   - "Allergies" section (from AllergiesView, simplified)
   - "Vitals" section (from VitalsView, simplified)
   - Each section has a header and renders the existing view component with a `comfort` prop
3. **Records** - New composite view:
   - "Lab Results" section (from LabResultsView)
   - "Immunizations" section (from ImmunizationsView)
   - "Visit History" section (from VisitsView)
4. **Manage** - Same as current DataManagement component

**Implementation:** Existing view components gain an optional `comfort?: boolean` prop. When true, they hide secondary information (codes, code systems, detailed date ranges) and apply comfort CSS classes.

### Navigation Flow

```
[Unlock] -> Appointments Landing
              |
              +-- "View Health Records" --> Tabbed Dashboard
              |                              (8 tabs standard, 4 tabs comfort)
              |
              +-- Import button --> FileUpload dialog (.xml + .ics)
```

### Page Structure

The app remains a single-page app at `/`. No new routes. The appointments view and tabbed dashboard are toggled via React state in `page.tsx`, not URL routing.

---

## Testing Strategy

### .ics Parser Tests (`src/__tests__/lib/ics/`)
- Parse valid .ics with single event
- Parse .ics with multiple events
- Extract doctor name and phone from description
- Handle missing optional fields (location, phone)
- Handle cancelled events (STATUS:CANCELLED)
- Parse various date formats (date-only, datetime, with timezone)
- Reject invalid .ics files
- Skip malformed events, continue parsing valid ones

### Appointments Store Tests (`src/__tests__/lib/db/`)
- Store and retrieve encrypted appointments
- Dedup by UID + dateTime
- Delete single appointment
- Existing encrypted store tests still pass

### Follow-up Extraction Tests (`src/__tests__/lib/ccd/`)
- Extract follow-up from problem with future date
- No follow-ups when no indicators present
- Handle various text patterns ("follow up in 3 months", "recheck", etc.)

### Comfort Mode Tests
- Toggle persists across component remount
- Correct tab count in each mode (8 standard, 4 comfort)
- View components render reduced info when `comfort=true`

### Existing Tests
- All 61 current tests must continue passing
- IDB version migration (v1 -> v2) does not break existing data

---

## Files Overview

### New Files
- `src/lib/ics/parser.ts` - .ics parser
- `src/lib/ics/types.ts` - Appointment type definitions
- `src/lib/ics/index.ts` - Barrel export
- `src/lib/ccd/follow-ups.ts` - Follow-up extraction from CCD data
- `src/lib/db/encrypted-appointments.ts` - Encrypted appointment storage
- `src/lib/comfort/comfort-context.tsx` - ComfortModeProvider + useComfort hook
- `src/lib/comfort/index.ts` - Barrel export
- `src/components/appointments/appointments-view.tsx` - Main appointments landing
- `src/components/appointments/appointment-card.tsx` - Single appointment card
- `src/components/appointments/follow-up-card.tsx` - Follow-up suggestion card
- `src/components/dashboard/health-summary-view.tsx` - Comfort mode composite (conditions + allergies + vitals)
- `src/components/dashboard/records-view.tsx` - Comfort mode composite (labs + immunizations + visits)

### Modified Files
- `src/lib/db/idb-helpers.ts` - DB version bump, add appointments store
- `src/lib/db/index.ts` - Export appointment store functions
- `src/lib/hooks/use-health-data.ts` - Add followUps to aggregated data
- `src/components/import/file-upload.tsx` - Accept .ics, auto-detect type
- `src/app/page.tsx` - Appointments landing as default, toggle to dashboard
- `src/app/providers.tsx` - Add ComfortModeProvider
- `src/components/layout/header.tsx` - Add comfort mode toggle
- `src/components/dashboard/medications-view.tsx` - Add comfort prop
- `src/components/dashboard/problems-view.tsx` - Add comfort prop
- `src/components/dashboard/allergies-view.tsx` - Add comfort prop
- `src/components/dashboard/vitals-view.tsx` - Add comfort prop
- `src/components/dashboard/lab-results-view.tsx` - Add comfort prop
- `src/components/dashboard/immunizations-view.tsx` - Add comfort prop
- `src/components/dashboard/visits-view.tsx` - Add comfort prop
- `CLAUDE.md` - Update architecture docs

## Out of Scope

- Server-side anything (auth, data storage, API routes)
- Multi-user accounts or family member profiles
- Google Calendar API integration (reminders managed externally via GWS CLI)
- Push notifications or browser notification API
- Multi-device sync
- Better Auth integration
