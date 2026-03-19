@AGENTS.md

## Project: Health Dashboard

Personal health records viewer. Local-first architecture with all health data staying in the browser.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **UI:** shadcn/ui + Tailwind CSS
- **Storage:** IndexedDB (browser-local, persistent)
- **Encryption:** Web Crypto API (AES-256-GCM)
- **Testing:** Vitest + jsdom
- **Package Manager:** Bun

## Architecture

### CCD Parser (`src/lib/ccd/`)
- Parses HL7 C-CDA XML files from patient portals (Cerner, Epic, MyChart)
- Uses fast-xml-parser (no DOM dependency, works in browser + Node)
- Handles nullFlavor fallbacks, originalText, and translation elements
- Sections: medications, results, problems, allergies, vital signs, immunizations

### Data Layer (`src/lib/db/`)
- IndexedDB for persistent browser storage (no SQL needed at current data volumes)
- SHA-256 deduplication prevents re-importing the same file
- Encrypted storage adapter encrypts ParsedCCD JSON before writing to IDB
- `useHealthData(masterKey)` hook for React state management with encrypted IDB persistence
- JS-side aggregation across documents (flatMap, filter, sort)
- Shared helpers in `idb-helpers.ts` (openDB, STORES, encoding utilities)

### Charts (`recharts`)
- Lab trend charts with reference range overlays
- Color-coded dots (green/amber/blue) by interpretation

### Appointments (`src/lib/ics/`)
- .ics (iCalendar) file parser for appointment import
- Appointments stored encrypted in IDB `appointments` store
- Dedup by UID + dateTime combination
- Doctor name and phone extracted from event description via pattern matching
- `useAppointments` hook provides React state with upcoming/past/cancelled filtering

### Follow-ups (`src/lib/ccd/follow-ups.ts`)
- Best-effort follow-up detection from CCD data (not clinical NLP)
- Scans problems for future onset dates, lab results for common recheck intervals
- Derived at read time via `extractFollowUps()`, not stored separately
- Surfaced in `AggregatedHealthData.followUps`

### Navigation
- Default view after unlock: Appointments landing (upcoming, follow-ups, past)
- "View Health Records" navigates to tabbed dashboard
- Header toggle switches between appointments and dashboard views

### Comfort Mode (`src/lib/comfort/`)
- ComfortModeProvider persists toggle in IDB `meta` store
- Standard mode: 8 tabs, full information density
- Comfort mode: 4 tabs (Medications, Health Summary, Records, Manage), larger text, hidden codes
- View components accept `comfort?: boolean` prop to control info density
- HealthSummaryView merges conditions + allergies + vitals
- RecordsView merges labs + immunizations + visits

### Enrichments (`src/lib/enrichment/`, `src/lib/db/encrypted-enrichments.ts`)
- Annotations: per-record explainers (lab explanations, medication reviews) tagged to surface on relevant tabs
- Insights: cross-record analyses (trends, patterns) displayed on landing page and tagged tabs
- Encrypted in IDB `annotations` and `insights` stores (v3 migration)
- Imported via `.enrichment.json` files from CLI enrichment skill
- `useEnrichments` hook provides React state with record and tag filtering

### PHI Scrubber (`src/lib/scrub/`)
- Strips patient-identifiable fields before outbound API calls
- Removes: name, DOB, address, document IDs, source filenames
- Preserves: clinical values, dates of service, medical codes, provider names
- Pure function, no side effects

### Medical APIs (`src/lib/medical-apis/`)
- NLM Clinical Tables: LOINC code lookup by lab test name
- MedlinePlus Connect: LOINC/ICD code to plain-language health topic
- MedlinePlus Health Topics: keyword search for consumer health articles
- OpenFDA: drug labels (indications, interactions, warnings) and adverse event reports
- Unified facade routes queries by record type (lab, medication, problem, etc.)
- All APIs are free, no registration, no API keys required
- NotebookLM notebooks: Health Reference (2e4ec1ae-56d7-42d8-b2fb-e8eeaefe8f14), Health Journal (8a36beaf-37d0-4190-8429-bdabefcf7c7e)

### Health Enrichment Skill (`.agents/skills/health-enrich/`)
- CLI skill for plain-language health data explanations
- Quick mode: single record enrichment from clipboard
- Session mode: multi-record deep dive with cross-record analysis
- Uses `scripts/health-enrich.ts` for API calls and file I/O
- Outputs: `.enrichment.json` (import to web app) + Obsidian note (knowledge accumulation)
- Shell alias: `ask` reads clipboard and pipes to Claude

### Auth & Encryption (`src/lib/auth/`, `src/lib/crypto/`)
- Required passphrase setup on first use
- AES-256-GCM master key wrapped with PBKDF2-derived key (600k iterations)
- Master key stored wrapped in IDB `meta` store; passphrase change re-wraps without re-encrypting data
- VaultProvider context gates app behind passphrase screen
- One-time migration encrypts pre-existing unencrypted data
- Encrypted exports (v2 format) with separate export passphrase
- `deleteHealthDataOnly` preserves vault; `deleteAllData` for full factory reset

## Commands

```bash
bun run dev          # Start dev server
bun run build        # Production build
bunx vitest run      # Run tests
bunx vitest          # Watch mode tests
bun run scripts/test-real-ccd.ts  # Test parser against real CCD files
ask                  # Shell alias: enrich health data from clipboard
bun run scripts/health-enrich.ts lookup     # Fetch medical API data
bun run scripts/health-enrich.ts write-enrichment  # Write .enrichment.json
bun run scripts/health-enrich.ts write-note        # Write Obsidian note
```

## Testing

- CCD parser tests use synthetic XML fixtures (no real PHI in tests)
- Encryption tests cover round-trip, unique IV, wrong-key failure, large payloads
- Key manager tests cover vault init/unlock/lock/change passphrase
- Encrypted store tests cover store/retrieve, dedup, deleteHealthDataOnly vs deleteAllData
- Migration tests cover unencrypted-to-encrypted conversion and idempotency
- `fake-indexeddb` provides IDB in jsdom test environment
- Real-world validation: `scripts/test-real-ccd.ts` runs against actual CCD files
- Parser has been validated against 123 real CCD/XML files with 0 errors

## Privacy

- All health data stays in the browser (no server-side storage)
- Encryption at rest with AES-256-GCM
- No third-party analytics on health data
- Anonymizer available for demo/portfolio mode
