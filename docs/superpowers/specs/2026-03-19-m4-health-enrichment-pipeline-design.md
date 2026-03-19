# Milestone 4: Health Enrichment Pipeline

## Goal

Add an AI-powered enrichment system that explains, contextualizes, and analyzes health data from the health dashboard. Users select data in the web app, enrich it via Claude Code CLI with authoritative medical API data, and import results back into the web app as annotations and insights.

## Context

Milestones 1-3 delivered a CCD/XML parser, encrypted IDB storage, .ics appointment import, follow-up detection, appointments landing page, and comfort mode. The dashboard displays health data but doesn't help users understand it. A caregiver managing a parent's health records needs plain-language explanations of lab results, medication interaction checks, vital sign trend analysis, and medical terminology translation.

The enrichment pipeline bridges the gap between raw clinical data and actionable understanding, while maintaining the local-first, no-server architecture. All PHI stays local. Only scrubbed medical terms go to external APIs.

## Architecture Decisions

- **No server, no browser-side AI calls.** Enrichment runs in Claude Code CLI, keeping API keys and AI processing local.
- **PHI scrubbing before external calls.** Field-level stripping (name, DOB, address, document IDs) before any API request. Clinical values, dates of service, and medical terms pass through.
- **Clipboard handoff from web to CLI.** "Ask Claude" buttons copy structured context to clipboard. User runs a shell alias or skill command. No custom protocol handlers, no file watchers.
- **Enrichment results imported as JSON.** CLI writes `.enrichment.json` files. Web app's FileUpload accepts them alongside .xml and .ics. Same import pattern, third file type.
- **Two enrichment stores in IDB.** `annotations` for per-record explainers (tagged to surface on relevant tabs). `insights` for cross-record analyses (trends, patterns, contextual relationships).
- **NotebookLM as knowledge layers.** Health Reference notebook for curated medical sources (MedlinePlus articles, drug guides). Health Journal notebook for personal enrichment history (queryable over time).
- **Obsidian vault accumulates knowledge.** Enrichment results become notes in `ai-asst/health/` with wikilinks to the broader knowledge graph.

---

## Subsystem 1: PHI Scrubber

### Module: `src/lib/scrub/`

Pure utility functions for stripping patient-identifiable fields before outbound API calls. Used by the CLI skill, not the browser.

### What Gets Stripped

| Field | Action |
|-------|--------|
| Patient name | Removed |
| Date of birth | Removed |
| Address (street, city, state, zip) | Removed |
| Document IDs | Replaced with generic placeholders ("doc-1", "doc-2") |
| Source file names | Removed |

### What Passes Through

| Field | Reason |
|-------|--------|
| Lab test names, values, units, reference ranges, interpretation | Needed for medical API lookups |
| Medication names, doses, routes, frequencies, status | Needed for drug interaction checks |
| Problem/condition names, status, onset dates | Needed for condition explainers |
| Vital sign measurements and dates of service | Needed for trend analysis |
| Allergy names, reactions, severity | Needed for context |
| LOINC codes, ICD codes, RxNorm codes | Medical identifiers, not patient identifiers |
| Doctor names | Provider info, not patient info |

### Interface

```typescript
interface RawHealthRecord {
  type: "lab" | "medication" | "problem" | "allergy" | "vital" | "appointment";
  data: Record<string, unknown>; // full record including PHI fields
  originalId: string; // for linking enrichments back to source records
}

interface ScrubbedRecord {
  type: "lab" | "medication" | "problem" | "allergy" | "vital" | "appointment";
  data: Record<string, unknown>; // PHI fields removed
  originalId: string;
}

function scrubForExport(records: RawHealthRecord[]): ScrubbedRecord[];
```

---

## Subsystem 2: Medical Knowledge Pipeline

### APIs (all free, no registration, no API keys)

| API | Purpose | Input | Output |
|-----|---------|-------|--------|
| NLM Clinical Tables | Lab name to LOINC code | Search term (e.g., "BUN") | LOINC code, long common name |
| MedlinePlus Connect | LOINC/ICD code to plain-language explanation | LOINC or ICD code | Consumer-friendly health topic summary |
| MedlinePlus Health Topics | Keyword to health topic search | Any medical term | Patient-friendly article summaries |
| OpenFDA drug/label | Drug name to prescribing info | Generic drug name | Indications, adverse reactions, interactions, warnings |
| OpenFDA drug/event | Drug name to real-world side effects | Generic drug name | Adverse event counts and frequencies |

### Enrichment Types

1. **Lab explainer** - "What is this test? What does my value mean? Is it concerning?" Pipeline: Clinical Tables (LOINC lookup) then MedlinePlus Connect (explanation) then Claude synthesis.

2. **Medication review** - "What is this drug for? Side effects? Interactions with my other meds?" Uses OpenFDA label + event data. For interaction checking, sends the full scrubbed medication list to Claude with OpenFDA context.

3. **Condition explainer** - "What does this diagnosis mean in plain language?" Uses MedlinePlus Health Topics keyword search.

4. **Trend analysis** - "How has my A1C / blood pressure / weight changed over time?" No API needed. Claude analyzes historical values directly, flags patterns, notes clinically meaningful changes.

5. **Contextual alert** - "New medication alongside existing ones. Any concerns?" Combines OpenFDA interaction data with Claude reasoning about the full medication and condition picture.

### Caching

API results cached locally to avoid redundant calls. If the Health Reference NotebookLM notebook already has a source about "BUN," skip the API call and query the notebook instead.

### NotebookLM Integration

| Notebook | Purpose | Sources |
|----------|---------|---------|
| Health Reference (new) | Curated medical knowledge base | MedlinePlus articles, OpenFDA summaries retrieved during enrichment. Grows as new topics are queried. |
| Health Journal (new) | Personal enrichment history | Obsidian notes from each enrichment session. Queryable: "What did we find about cholesterol last time?" |

Both notebooks under jgerton.ai.assistant@gmail.com alongside existing four.

---

## Subsystem 3: Web-to-CLI Enrichment UX

### Web App: "Ask Claude" Buttons

Added to each data view component:

| View | Per-Record Button | Bulk Button |
|------|------------------|-------------|
| Lab Results | "Explain this result" (per panel row) | "Review all labs from this visit" |
| Medications | "Review this medication" (per med) | "Check all medication interactions" |
| Problems/Conditions | "Explain this condition" (per condition) | None |
| Vitals | None | "Analyze vital trends" |
| Appointments | None | None |

When clicked: packages record(s) as structured markdown, copies to clipboard via `navigator.clipboard.writeText()`, shows toast: "Copied to clipboard. Run `ask` in your terminal."

### Clipboard Format

```markdown
## Lab Result Query
Test: Hemoglobin A1c
LOINC: 4548-4
Value: 6.8%
Reference Range: 4.0-5.6%
Interpretation: high
Date: 2026-03-01
---
Context: Patient has 3 historical A1c readings available
Mode: quick
```

`Mode: quick` for per-record buttons, `Mode: session` for bulk buttons.

### CLI Skill: `health-enrich`

**Quick mode** (default):
1. Reads clipboard content
2. Parses record type and data
3. Scrubs PHI for API calls
4. Calls relevant APIs based on record type
5. Checks Health Reference NotebookLM notebook for existing context
6. Claude synthesizes API data + notebook context into plain-language enrichment
7. Presents enrichment in terminal for review
8. On approval, writes:
   - `.enrichment.json` to `~/.health-dashboard/enrichments/` (timestamped)
   - Obsidian note to `E:/Projects/ai-asst/health/`
   - Sources note to Health Journal notebook
   - Sources new API reference content to Health Reference notebook

**Session mode** (`/health-enrich --session` or triggered by bulk clipboard):
1. Same pipeline but accumulates multiple enrichments
2. Interactive: after each record, asks "Next record? Or follow-up question about this one?"
3. Builds cross-record context ("you asked about metformin, and I notice your A1C is also in this batch")
4. Cross-record analysis happens when related records are present
5. Batches all results into one `.enrichment.json` and one Obsidian note

**Shell alias (Windows/MINGW64):**
```bash
alias ask='powershell.exe -command "Get-Clipboard" | claude -p "Use the health-enrich skill to analyze this health data"'
```

Note: On macOS use `pbpaste` instead of `powershell.exe -command "Get-Clipboard"`. On Linux use `xclip -o`.

---

## Subsystem 4: Enrichment Results Store

### IDB Schema Changes (v3)

Bump `DB_VERSION` from 2 to 3. Add two new object stores:

**`annotations` store:**
- keyPath: `id`
- Indexes: `recordId` (links to source lab/med/problem record), `tags` (multiEntry for tab routing)
- Encrypted with existing master key

```typescript
interface Annotation {
  id: string;
  recordId: string;
  recordType: "lab" | "medication" | "problem" | "allergy" | "vital";
  tags: string[]; // e.g., ["medications", "labs"] for tab-based surfacing
  severity: "info" | "warning" | "alert";
  title: string;
  explanation: string;
  sources: string[]; // which APIs/notebooks contributed
  enrichedAt: string;
}
```

**`insights` store:**
- keyPath: `id`
- Index: `tags` (multiEntry)
- Encrypted with existing master key

```typescript
interface Insight {
  id: string;
  tags: string[]; // for tab routing and landing page display
  title: string;
  summary: string;
  detail: string;
  trendData?: Array<{ date: string; value: number; label: string }>;
  dateRange?: { start: string; end: string };
  enrichedAt: string;
}
```

### Tag Taxonomy

Tags control where enrichments surface in the UI:

| Tag | Surfaces on |
|-----|------------|
| `medications` | Medications tab |
| `labs` | Lab Results tab |
| `conditions` | Conditions tab |
| `allergies` | Allergies tab |
| `vitals` | Vitals tab |
| `interactions` | Medications tab + landing page |
| `trends` | Landing page insights section |
| `general` | Landing page insights section |

An enrichment can have multiple tags to appear in multiple locations. A medication interaction check might tag `["medications", "interactions"]` to show on both the Medications tab and the landing page.

### Enrichment Awareness Categories

Enrichments understand that health data has different temporal characteristics:

- **Events** (surgeries, procedures): permanent facts, relevant for historical context
- **Trending metrics** (A1C, blood pressure, weight): monitored over time, enrichments flag direction and rate of change
- **Temporary states** (post-surgery medications, acute conditions): time-bounded, enrichments note expected duration and what to watch for
- **Constants** (chronic conditions, allergies): stable facts that provide context for other enrichments

The enrichment skill considers these categories when synthesizing explanations. A new medication is checked against both constant medications (daily meds) and the full condition history (including past surgeries and events).

### Enrichment JSON Export Schema

```typescript
interface EnrichmentExport {
  version: 1;
  generatedAt: string;
  annotations: Array<{
    recordId: string;
    recordType: "lab" | "medication" | "problem" | "allergy" | "vital";
    tags: string[];
    severity: "info" | "warning" | "alert";
    title: string;
    explanation: string;
    sources: string[];
  }>;
  insights: Array<{
    tags: string[];
    title: string;
    summary: string;
    detail: string;
    trendData?: Array<{ date: string; value: number; label: string }>;
    dateRange?: { start: string; end: string };
  }>;
}
```

### Web App Rendering

**Annotations** render inline on existing record cards:
- Info icon (blue) = explanation available
- Warning badge (amber) = flagged for attention
- Alert badge (red) = needs review
- Click to expand the full explanation

**Insights** render in two places:
- Landing page: new "Insights" section between follow-ups and past appointments
- Tagged tabs: relevant insights appear at the top of their tagged tab

### FileUpload Extended

Accepts `.enrichment.json` alongside `.xml` and `.ics`. Import parses the JSON, encrypts annotations and insights, stores in their respective IDB stores, and links annotations to source records via `recordId`.

---

## Obsidian Vault Integration

### Vault Structure

```
ai-asst/
  health/
    reviews/      # Per-record enrichments (lab explainers, med reviews)
    trends/       # Cross-record trend analyses
    interactions/ # Medication interaction checks
```

### Note Format

Uses existing vault frontmatter:

```yaml
---
title: "A1C Review - March 2026"
date: 2026-03-19
type: insight
domain: health
tags: [health-enrichment, lab-result, a1c, diabetes-screening]
notebook: "Health Journal"
source_id: ""
---
```

The `health` domain is new, added alongside the existing `dev | content | community | research | ops` taxonomy. Maps to the Health Journal NotebookLM notebook.

Notes are self-contained summaries of each enrichment. Wikilinks connect to related health notes, session notes, and broader vault concepts.

---

## Build Order

| Plan | Scope | Dependencies |
|------|-------|-------------|
| M4 Plan 1 | PHI Scrubber + Enrichment types + IDB v3 + FileUpload import | None |
| M4 Plan 2 | Medical API client + Health Reference/Journal notebooks | None |
| M4 Plan 3 | CLI skill (health-enrich) + Obsidian integration | Plans 1 + 2 |
| M4 Plan 4 | Web app UI (Ask Claude buttons + enrichment display) | Plan 1 |

Plans 1 and 2 are independent. Plan 3 depends on both. Plan 4 depends on Plan 1 only.

## Testing Strategy

### PHI Scrubber Tests
- Strips name, DOB, address from all record types
- Preserves clinical values, dates of service, medical codes
- Replaces document IDs with placeholders
- Round-trip: scrub then verify no PHI leaks

### API Client Tests
- Mock responses for each API endpoint
- LOINC lookup returns correct codes
- MedlinePlus returns consumer-friendly content
- OpenFDA returns drug label and adverse event data
- Handles API errors gracefully (timeout, 404, rate limit)

### Enrichment Import Tests
- Parse valid `.enrichment.json` with annotations and insights
- Encrypt and store in correct IDB stores
- Link annotations to source records via recordId
- Reject malformed JSON with clear error
- Dedup: skip annotations for records that already have the same enrichment

### IDB Migration Tests
- v2 to v3 upgrade creates annotations and insights stores
- Fresh install (v0 to v3) creates all stores
- Existing data preserved during upgrade

## Out of Scope

- Real-time browser-side AI (no API calls from the browser)
- Server-side enrichment processing
- Automated enrichment (user must initiate via "Ask Claude" button)
- Clinical decision support or diagnostic suggestions
- Multi-user enrichment sharing
- Push notifications for new insights
