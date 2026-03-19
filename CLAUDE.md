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
- `useHealthData` hook for React state management with IDB persistence
- JS-side aggregation across documents (flatMap, filter, sort)

### Charts (`recharts`)
- Lab trend charts with reference range overlays
- Color-coded dots (green/amber/blue) by interpretation

### Encryption (`src/lib/crypto/`)
- AES-256-GCM encryption for data at rest
- PBKDF2 key derivation from passphrase (600k iterations)
- Key export/import for backup and transfer

## Commands

```bash
bun run dev          # Start dev server
bun run build        # Production build
bunx vitest run      # Run tests
bunx vitest          # Watch mode tests
bun run scripts/test-real-ccd.ts  # Test parser against real CCD files
```

## Testing

- CCD parser tests use synthetic XML fixtures (no real PHI in tests)
- Real-world validation: `scripts/test-real-ccd.ts` runs against actual CCD files
- Parser has been validated against 123 real CCD/XML files with 0 errors

## Privacy

- All health data stays in the browser (no server-side storage)
- Encryption at rest with AES-256-GCM
- No third-party analytics on health data
- Anonymizer available for demo/portfolio mode
