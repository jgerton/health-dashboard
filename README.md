# Health Dashboard

A personal health records viewer built with a local-first architecture. Import your CCD/XML medical records from patient portals (Epic MyChart, Cerner, ANMC) and view them in a unified dashboard. **All data stays in your browser.**

## Features

- **CCD/XML Parser** - Parses C-CDA clinical documents covering medications, lab results, conditions, allergies, vital signs, and immunizations
- **Lab Trend Charts** - Visualize lab values over time with reference range overlays and color-coded interpretation (normal/high/low/critical)
- **Cross-Record Search** - Search across all health record types with instant results
- **Data Persistence** - IndexedDB stores data locally with SHA-256 deduplication
- **Export/Import** - Back up data as JSON, restore on another device
- **PWA Support** - Install as a standalone app, works offline
- **Privacy-First** - No server-side data storage, no third-party analytics

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| Storage | IndexedDB (browser-local) |
| Encryption | Web Crypto API (AES-256-GCM) |
| XML Parsing | fast-xml-parser |
| Testing | Vitest |
| Package Manager | Bun |

## Quick Start

```bash
# Clone and install
git clone https://github.com/jongerton/health-dashboard.git
cd health-dashboard
bun install

# Development
bun run dev

# Tests
bunx vitest run

# Production build
bun run build
```

## Data Sources

The parser handles CCD/C-CDA XML files exported from patient portals:

- **ANMC** (Alaska Native Medical Center) - MyHealth portal
- **Epic MyChart** - most major health systems
- **Cerner** - many hospital networks

Download your records as XML from your patient portal, then drag and drop into the dashboard.

## Architecture

```
src/
  lib/
    ccd/          # C-CDA XML parser (6 sections, ~300 lines)
    crypto/       # AES-256-GCM encryption layer
    db/           # IndexedDB persistence + export/import
    hooks/        # React state management
    pwa/          # Service worker registration
  components/
    dashboard/    # View components (medications, labs, vitals, etc.)
    import/       # File upload with drag-and-drop
    layout/       # Header, navigation
```

**Local-first design:** All health data is parsed and stored entirely in the browser using IndexedDB. The Next.js server serves only static assets. No health data ever leaves the device.

## Parser Validation

The CCD parser has been validated against 123 real C-CDA XML files with zero errors:

| Section | Records Parsed |
|---------|---------------|
| Medications | 1,365 |
| Lab Results | 256 |
| Problems/Conditions | 2,022 |
| Allergies | 123 |
| Vital Signs | 204 |
| Immunizations | 2,921 |

## Privacy

- All health data stays in IndexedDB (your browser, your device)
- AES-256-GCM encryption available for data at rest
- No server-side data storage or processing
- No third-party analytics on health data
- Export produces a local JSON file (not uploaded anywhere)
- Clear Data button permanently deletes all stored records

## License

MIT
