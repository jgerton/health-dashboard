# M4 Plan 3: Health Enrichment CLI Skill

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Claude Code skill that orchestrates health data enrichment: reads clipboard context from the web app, calls medical APIs, synthesizes plain-language explanations via Claude, and outputs .enrichment.json files plus Obsidian notes.

**Architecture:** A new skill at `.agents/skills/health-enrich/` with a SKILL.md file that instructs Claude on the enrichment pipeline. A supporting TypeScript script at `scripts/health-enrich.ts` handles API calls and file output (run via `bun run`). The skill uses the script for API data, then Claude synthesizes the results.

**Tech Stack:** Claude Code skill (markdown), TypeScript (Bun), NotebookLM CLI

**Spec:** `docs/superpowers/specs/2026-03-19-m4-health-enrichment-pipeline-design.md` (Subsystem 3)

**Depends on:** Plans 1 (enrichment types, scrubber) + Plan 2 (medical API clients)

---

### Task 1: Enrichment script

**Files:**
- Create: `scripts/health-enrich.ts`

- [ ] **Step 1: Create the enrichment script**

Create `scripts/health-enrich.ts`:

```typescript
#!/usr/bin/env bun
/**
 * Health enrichment script.
 *
 * Called by the health-enrich skill to fetch medical API data.
 * Accepts JSON input on stdin, calls APIs, outputs JSON results.
 *
 * Usage:
 *   echo '{"query":"BUN","type":"lab"}' | bun run scripts/health-enrich.ts lookup
 *   echo '{"annotations":[...],"insights":[...]}' | bun run scripts/health-enrich.ts write-enrichment
 */

import { getMedicalContext } from "../src/lib/medical-apis/facade";
import type { MedicalContext } from "../src/lib/medical-apis/types";

const command = process.argv[2];

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function lookup() {
  const input = JSON.parse(await readStdin()) as {
    query: string;
    type: "lab" | "medication" | "problem" | "allergy" | "vital";
  };

  const context = await getMedicalContext(input.query, input.type);
  console.log(JSON.stringify(context, null, 2));
}

async function writeEnrichment() {
  const input = JSON.parse(await readStdin()) as {
    annotations: Array<{
      recordId: string;
      recordType: string;
      tags: string[];
      severity: string;
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
  };

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    annotations: input.annotations,
    insights: input.insights,
  };

  // Write to ~/.health-dashboard/enrichments/
  const dir = `${process.env.HOME || process.env.USERPROFILE}/.health-dashboard/enrichments`;
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filePath = `${dir}/${timestamp}.enrichment.json`;
  writeFileSync(filePath, JSON.stringify(output, null, 2));

  console.log(JSON.stringify({ filePath, ...output }));
}

async function writeObsidianNote() {
  const input = JSON.parse(await readStdin()) as {
    title: string;
    subfolder: string;
    content: string;
    tags: string[];
  };

  const vaultPath = "E:/Projects/ai-asst";
  const dir = `${vaultPath}/health/${input.subfolder}`;

  const { mkdirSync, writeFileSync, existsSync } = await import("fs");
  mkdirSync(dir, { recursive: true });

  const date = new Date().toISOString().split("T")[0];
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  let filePath = `${dir}/${date}-${slug}.md`;
  let counter = 2;
  while (existsSync(filePath)) {
    filePath = `${dir}/${date}-${slug}-${counter}.md`;
    counter++;
  }

  const frontmatter = [
    "---",
    `title: "${input.title}"`,
    `date: ${date}`,
    "type: insight",
    "domain: health",
    `tags: [${input.tags.map((t) => `${t}`).join(", ")}]`,
    'notebook: "Health Journal"',
    'source_id: ""',
    "---",
    "",
  ].join("\n");

  writeFileSync(filePath, frontmatter + input.content);
  console.log(JSON.stringify({ filePath }));
}

switch (command) {
  case "lookup":
    await lookup();
    break;
  case "write-enrichment":
    await writeEnrichment();
    break;
  case "write-note":
    await writeObsidianNote();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Usage: bun run scripts/health-enrich.ts <lookup|write-enrichment|write-note>");
    process.exit(1);
}
```

- [ ] **Step 2: Verify script runs**

```bash
cd /e/Projects/health-dashboard && echo '{"query":"BUN","type":"lab"}' | bun run scripts/health-enrich.ts lookup 2>&1 | head -5
```

Expected: JSON output (may have API data or nulls depending on network).

- [ ] **Step 3: Commit**

```bash
git add scripts/health-enrich.ts
git commit -m "feat: add health enrichment CLI script"
```

---

### Task 2: Health-enrich skill

**Files:**
- Create: `.agents/skills/health-enrich/SKILL.md`

- [ ] **Step 1: Create skill file**

Create `.agents/skills/health-enrich/SKILL.md`:

````markdown
---
name: health-enrich
description: Enrich health data with plain-language explanations from medical APIs. Use when clipboard contains structured health context from the health dashboard's "Ask Claude" buttons, or when the user asks to analyze/explain health data like lab results, medications, conditions, or vital sign trends.
---

# Health Enrichment

You are a health literacy assistant. Your job is to explain health data in plain, non-medical language. You use authoritative medical APIs (MedlinePlus, OpenFDA) to ground your explanations in reliable sources.

**Important:** You are NOT a doctor. Always include a disclaimer that this is educational information, not medical advice. Encourage the user to discuss findings with their healthcare provider.

## Modes

### Quick Mode (default)

The clipboard contains a single health record. Steps:

1. Parse the clipboard content (structured markdown with fields like Test, Value, Reference Range, etc.)
2. Identify the record type from the header (## Lab Result Query, ## Medication Query, ## Condition Query, ## Vital Signs Trend Analysis)
3. Call the enrichment script to fetch API data:

```bash
echo '{"query":"<test/drug/condition name>","type":"<lab|medication|problem|vital>"}' | bun run scripts/health-enrich.ts lookup
```

4. Read the API response (MedlinePlus articles, drug labels, adverse events)
5. Synthesize a plain-language explanation that covers:
   - **What this is:** Simple explanation of the test/medication/condition
   - **What the value means:** Is it normal? What does high/low indicate?
   - **What to watch for:** Any concerns or follow-up actions
   - **Sources:** Which APIs provided the information
6. Present to the user for review
7. Ask: "Save this enrichment? (y/n)"
8. If yes, write the enrichment file and Obsidian note (see Output section)

### Session Mode

The clipboard contains multiple records or the user wants a deep dive. Steps:

1. Parse all records from the clipboard
2. Process each record as in Quick Mode
3. After individual records, look for cross-record patterns:
   - Medication interactions (check all medications together)
   - Lab trend analysis (multiple readings of the same test)
   - Condition-medication relationships
4. Present findings interactively, asking between records: "Next record? Follow-up question? Or analyze patterns?"
5. Batch all enrichments into one output file

## Output

When the user approves, write two outputs:

### 1. Enrichment JSON file

```bash
echo '<json>' | bun run scripts/health-enrich.ts write-enrichment
```

The JSON should contain:
- `annotations`: array of per-record enrichments with `recordId`, `recordType`, `tags`, `severity` (info/warning/alert), `title`, `explanation`, `sources`
- `insights`: array of cross-record analyses with `tags`, `title`, `summary`, `detail`, optional `trendData` and `dateRange`

### 2. Obsidian note

```bash
echo '<json>' | bun run scripts/health-enrich.ts write-note
```

The JSON should contain:
- `title`: descriptive title for the note
- `subfolder`: one of `reviews`, `trends`, `interactions`
- `content`: markdown body of the note
- `tags`: array of relevant tags

### 3. NotebookLM sourcing (optional)

If NotebookLM auth is available, source the Obsidian note:

```bash
PYTHONIOENCODING=utf-8 notebooklm source add --notebook 8a36beaf-37d0-4190-8429-bdabefcf7c7e "<note-path>"
```

If auth fails, skip silently. The note is safely in the vault.

## Severity Guidelines

- **info**: Normal values, general explanations, educational content
- **warning**: Values outside reference range, potential interactions, things to monitor
- **alert**: Critical values, dangerous interactions, needs immediate attention

## Disclaimer Template

Always end enrichment output with:

> This information is for educational purposes only and is not medical advice. Always consult your healthcare provider about your specific health situation.

## Example Quick Mode Flow

User runs: `ask` (shell alias reads clipboard)

Clipboard content:
```
## Lab Result Query
Panel: Hemoglobin A1c
Value: 6.8%
Reference Range: 4.0-5.6%
Interpretation: high
Date: 2026-03-01
---
Mode: quick
```

You would:
1. Recognize this as a lab result for HbA1c
2. Run: `echo '{"query":"Hemoglobin A1c","type":"lab"}' | bun run scripts/health-enrich.ts lookup`
3. Get MedlinePlus article about A1c testing
4. Explain: "Your A1c of 6.8% is above the normal range of 4.0-5.6%. A1c measures your average blood sugar over the past 2-3 months. A level of 6.5% or higher typically indicates diabetes. Your level of 6.8% suggests your blood sugar has been elevated. This is something to discuss with your doctor, who may recommend dietary changes, exercise, or medication adjustments."
5. Set severity to "warning" (above reference range)
6. Ask to save
7. Write enrichment file + Obsidian note
````

- [ ] **Step 2: Create Obsidian vault health directories**

```bash
mkdir -p /e/Projects/ai-asst/health/reviews /e/Projects/ai-asst/health/trends /e/Projects/ai-asst/health/interactions
```

- [ ] **Step 3: Create enrichments output directory**

```bash
mkdir -p ~/.health-dashboard/enrichments
```

- [ ] **Step 4: Verify build and tests**

```bash
cd /e/Projects/health-dashboard && bun run build && bunx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/health-enrich/ scripts/health-enrich.ts
git commit -m "feat: add health-enrich skill and CLI script"
```

---

### Task 3: Shell alias setup + CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the Architecture section:

```markdown
### Health Enrichment Skill (`.agents/skills/health-enrich/`)
- CLI skill for plain-language health data explanations
- Quick mode: single record enrichment from clipboard
- Session mode: multi-record deep dive with cross-record analysis
- Uses `scripts/health-enrich.ts` for API calls and file I/O
- Outputs: `.enrichment.json` (import to web app) + Obsidian note (knowledge accumulation)
- Shell alias: `ask` reads clipboard and pipes to Claude
```

Add to Commands section:

```bash
ask                  # Shell alias: enrich health data from clipboard
bun run scripts/health-enrich.ts lookup     # Fetch medical API data
bun run scripts/health-enrich.ts write-enrichment  # Write .enrichment.json
bun run scripts/health-enrich.ts write-note        # Write Obsidian note
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add health enrichment skill and commands to CLAUDE.md"
```
