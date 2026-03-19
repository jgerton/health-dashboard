# M4 Plan 4: Ask Claude UI + Enrichment Display

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Ask Claude" clipboard buttons to health data views and render imported enrichments (annotations inline on records, insights on landing page).

**Architecture:** A reusable `ClipboardButton` component formats health record context as structured markdown and copies to clipboard. Each view component gets an "Ask Claude" button. Annotations render as expandable badges on record cards. Insights render in a new section on the appointments landing page.

**Tech Stack:** TypeScript, React, shadcn/ui, Tailwind CSS, Clipboard API

**Spec:** `docs/superpowers/specs/2026-03-19-m4-health-enrichment-pipeline-design.md` (Subsystem 4 - Web App)

**Depends on:** M4 Plan 1 (enrichment types + IDB v3 + useEnrichments hook)

---

### Task 1: ClipboardButton component

**Files:**
- Create: `src/components/enrichment/clipboard-button.tsx`

- [ ] **Step 1: Create ClipboardButton**

Create `src/components/enrichment/clipboard-button.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClipboardButtonProps {
  context: string;
  mode?: "quick" | "session";
  label?: string;
  size?: "sm" | "icon";
}

/**
 * Copies structured health context to clipboard for CLI enrichment.
 * Shows a checkmark briefly after copying.
 */
export function ClipboardButton({
  context,
  mode = "quick",
  label,
  size = "icon",
}: ClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const fullContext = `${context}\n---\nMode: ${mode}`;
    await navigator.clipboard.writeText(fullContext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (size === "sm") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        title="Copy to clipboard for Claude enrichment"
        className="gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span className="text-xs">{copied ? "Copied!" : label || "Ask Claude"}</span>
      </Button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard for Claude enrichment"
      className="text-purple-400 hover:text-purple-600 transition-colors"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/enrichment/clipboard-button.tsx
git commit -m "feat: add ClipboardButton component for Ask Claude"
```

---

### Task 2: Context formatters

**Files:**
- Create: `src/lib/enrichment/format-context.ts`

- [ ] **Step 1: Create context formatters**

Create `src/lib/enrichment/format-context.ts`:

```typescript
/**
 * Format health records as structured markdown for clipboard.
 * Used by ClipboardButton to prepare context for CLI enrichment.
 */

import type { Medication, LabResult, Problem, Allergy, VitalSign } from "@/lib/ccd/types";

export function formatLabContext(result: LabResult): string {
  const lines = [`## Lab Result Query`, `Panel: ${result.panelName}`];
  if (result.panelCode) lines.push(`Panel Code: ${result.panelCode}`);
  lines.push(`Date: ${result.date}`);
  lines.push("");

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
  const lines = [
    `## Medication Query`,
    `Name: ${medication.name}`,
  ];
  if (medication.dose) lines.push(`Dose: ${medication.dose}${medication.doseUnit ? ` ${medication.doseUnit}` : ""}`);
  if (medication.route) lines.push(`Route: ${medication.route}`);
  if (medication.frequency) lines.push(`Frequency: ${medication.frequency}`);
  lines.push(`Status: ${medication.status}`);
  if (medication.startDate) lines.push(`Start Date: ${medication.startDate}`);
  return lines.join("\n");
}

export function formatMedicationListContext(medications: Medication[]): string {
  const lines = [
    `## Medication Interaction Check`,
    `Total medications: ${medications.length}`,
    "",
  ];
  for (const med of medications) {
    lines.push(`- ${med.name}${med.dose ? ` (${med.dose})` : ""} [${med.status}]`);
  }
  return lines.join("\n");
}

export function formatProblemContext(problem: Problem): string {
  const lines = [
    `## Condition Query`,
    `Name: ${problem.name}`,
    `Status: ${problem.status}`,
  ];
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
```

- [ ] **Step 2: Update enrichment barrel**

Add to `src/lib/enrichment/index.ts`:

```typescript
export {
  formatLabContext,
  formatMedicationContext,
  formatMedicationListContext,
  formatProblemContext,
  formatVitalsContext,
} from "./format-context";
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/enrichment/format-context.ts src/lib/enrichment/index.ts
git commit -m "feat: add context formatters for clipboard enrichment"
```

---

### Task 3: Add Ask Claude buttons to view components

**Files:**
- Modify: `src/components/dashboard/lab-results-view.tsx`
- Modify: `src/components/dashboard/medications-view.tsx`
- Modify: `src/components/dashboard/problems-view.tsx`
- Modify: `src/components/dashboard/vitals-view.tsx`

- [ ] **Step 1: Read all view components**

Read all four files.

- [ ] **Step 2: Add Ask Claude to lab results**

In `src/components/dashboard/lab-results-view.tsx`:
1. Import `ClipboardButton` from `@/components/enrichment/clipboard-button`
2. Import `formatLabContext` from `@/lib/enrichment`
3. Add a ClipboardButton in each panel header (next to the panel name):

```tsx
<ClipboardButton
  context={formatLabContext(panel)}
  label="Explain"
  size="sm"
/>
```

- [ ] **Step 3: Add Ask Claude to medications**

In `src/components/dashboard/medications-view.tsx`:
1. Import `ClipboardButton` from `@/components/enrichment/clipboard-button`
2. Import `formatMedicationContext, formatMedicationListContext` from `@/lib/enrichment`
3. Add a ClipboardButton icon in each MedicationRow (after the medication info)
4. Add a "Check Interactions" button in the CardHeader:

```tsx
<ClipboardButton
  context={formatMedicationListContext(medications)}
  label="Check Interactions"
  size="sm"
  mode="session"
/>
```

- [ ] **Step 4: Add Ask Claude to problems**

In `src/components/dashboard/problems-view.tsx`:
1. Import `ClipboardButton` and `formatProblemContext`
2. Add a ClipboardButton icon in each problem row

- [ ] **Step 5: Add Ask Claude to vitals**

In `src/components/dashboard/vitals-view.tsx`:
1. Import `ClipboardButton` and `formatVitalsContext`
2. Add a "Analyze Trends" button in the CardHeader:

```tsx
<ClipboardButton
  context={formatVitalsContext(vitalSigns)}
  label="Analyze Trends"
  size="sm"
  mode="session"
/>
```

- [ ] **Step 6: Verify build**

```bash
cd /e/Projects/health-dashboard && bun run build
```

- [ ] **Step 7: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/lab-results-view.tsx src/components/dashboard/medications-view.tsx src/components/dashboard/problems-view.tsx src/components/dashboard/vitals-view.tsx
git commit -m "feat: add Ask Claude buttons to lab, medication, problem, and vital views"
```

---

### Task 4: Annotation display component

**Files:**
- Create: `src/components/enrichment/annotation-badge.tsx`

- [ ] **Step 1: Create AnnotationBadge**

Create `src/components/enrichment/annotation-badge.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Info, AlertTriangle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { Annotation } from "@/lib/enrichment/types";

interface AnnotationBadgeProps {
  annotations: Annotation[];
}

function severityIcon(severity: Annotation["severity"]) {
  switch (severity) {
    case "info":
      return <Info className="h-3.5 w-3.5 text-blue-500" />;
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    case "alert":
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
  }
}

function severityBg(severity: Annotation["severity"]) {
  switch (severity) {
    case "info":
      return "bg-blue-50 border-blue-200";
    case "warning":
      return "bg-amber-50 border-amber-200";
    case "alert":
      return "bg-red-50 border-red-200";
  }
}

export function AnnotationBadge({ annotations }: AnnotationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (annotations.length === 0) return null;

  // Show highest severity icon
  const highestSeverity = annotations.some((a) => a.severity === "alert")
    ? "alert"
    : annotations.some((a) => a.severity === "warning")
      ? "warning"
      : "info";

  return (
    <div className="inline-flex flex-col">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
        title={`${annotations.length} enrichment${annotations.length > 1 ? "s" : ""}`}
      >
        {severityIcon(highestSeverity)}
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-gray-400" />
        ) : (
          <ChevronDown className="h-3 w-3 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className={`p-3 rounded-md border text-sm ${severityBg(annotation.severity)}`}
            >
              <div className="flex items-center gap-1.5 font-medium mb-1">
                {severityIcon(annotation.severity)}
                {annotation.title}
              </div>
              <p className="text-gray-700 text-xs leading-relaxed">
                {annotation.explanation}
              </p>
              {annotation.sources.length > 0 && (
                <p className="text-gray-400 text-xs mt-1">
                  Sources: {annotation.sources.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/enrichment/annotation-badge.tsx
git commit -m "feat: add AnnotationBadge component for inline enrichment display"
```

---

### Task 5: Insights section on landing page

**Files:**
- Create: `src/components/enrichment/insights-section.tsx`
- Modify: `src/components/appointments/appointments-view.tsx`

- [ ] **Step 1: Create InsightsSection**

Create `src/components/enrichment/insights-section.tsx`:

```typescript
"use client";

import { TrendingUp, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Insight } from "@/lib/enrichment/types";

interface InsightsSectionProps {
  insights: Insight[];
}

export function InsightsSection({ insights }: InsightsSectionProps) {
  if (insights.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">AI Insights</h2>
      <div className="space-y-3">
        {insights.map((insight) => (
          <Card key={insight.id} className="border-purple-200 bg-purple-50/30 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="font-semibold">{insight.title}</h3>
                  <p className="text-sm text-gray-600">{insight.summary}</p>
                  {insight.dateRange && (
                    <p className="text-xs text-gray-400">
                      {insight.dateRange.start} to {insight.dateRange.end}
                    </p>
                  )}
                  {insight.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {insight.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into AppointmentsView**

In `src/components/appointments/appointments-view.tsx`:

1. Import `InsightsSection` from `@/components/enrichment/insights-section`
2. Import `Insight` type from `@/lib/enrichment/types`
3. Add `insights?: Insight[]` to `AppointmentsViewProps`
4. Add the insights section between follow-ups and cancelled sections:

```tsx
{/* AI Insights */}
{insights && insights.length > 0 && (
  <InsightsSection insights={insights} />
)}
```

5. Update the `hasAnyContent` check to include insights:
```tsx
const hasAnyContent = upcoming.length > 0 || followUps.length > 0 || past.length > 0 || (insights?.length ?? 0) > 0;
```

- [ ] **Step 3: Pass insights from page.tsx**

In `src/app/page.tsx`, update the `useEnrichments` destructuring to include `insights`:

```typescript
const { importEnrichmentJson, insights } = useEnrichments(masterKey);
```

And pass to AppointmentsView:

```tsx
<AppointmentsView
  upcoming={upcoming}
  past={past}
  cancelled={cancelled}
  followUps={data.followUps}
  insights={insights}
  onViewRecords={() => setCurrentView("dashboard")}
  onImportClick={() => setShowImport(true)}
/>
```

- [ ] **Step 4: Verify build**

```bash
cd /e/Projects/health-dashboard && bun run build
```

- [ ] **Step 5: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/components/enrichment/insights-section.tsx src/components/appointments/appointments-view.tsx src/app/page.tsx
git commit -m "feat: add insights section to appointments landing page"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the Enrichments architecture section:

```markdown
- ClipboardButton copies structured health context to clipboard for CLI enrichment
- AnnotationBadge renders inline severity badges (info/warning/alert) with expandable explanations
- InsightsSection renders cross-record analyses on the appointments landing page
- Context formatters package lab results, medications, problems, and vitals as structured markdown
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Ask Claude UI architecture to CLAUDE.md"
```
