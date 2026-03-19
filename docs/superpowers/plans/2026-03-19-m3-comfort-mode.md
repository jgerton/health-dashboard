# M3 Plan 4: Comfort Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comfort mode toggle that increases text size, reduces information density, and collapses 8 tabs to 4 for an elder-friendly viewing experience.

**Architecture:** A `ComfortModeProvider` context persists the toggle in IDB `meta` store. Existing view components gain an optional `comfort?: boolean` prop to hide secondary information (codes, code systems, detailed date ranges). Two new composite views (`HealthSummaryView`, `RecordsView`) merge related tabs in comfort mode. The header gains a toggle button.

**Tech Stack:** TypeScript, React Context, IndexedDB (meta store), shadcn/ui, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-19-milestone3-appointments-comfort-design.md` (Comfort Mode Toggle section)

**Depends on:** Plan 3 (appointments landing page) should be completed first so navigation is in place.

---

### Task 1: ComfortModeProvider context (TDD)

**Files:**
- Create: `src/__tests__/lib/comfort/comfort-context.test.ts`
- Create: `src/lib/comfort/comfort-context.tsx`
- Create: `src/lib/comfort/index.ts`

- [ ] **Step 1: Write failing comfort mode tests**

Create `src/__tests__/lib/comfort/comfort-context.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  getComfortMode,
  setComfortMode,
} from "@/lib/comfort/comfort-context";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

describe("comfort mode persistence", () => {
  it("returns false by default", async () => {
    const result = await getComfortMode();
    expect(result).toBe(false);
  });

  it("persists true to IDB", async () => {
    await setComfortMode(true);
    const result = await getComfortMode();
    expect(result).toBe(true);
  });

  it("persists false after toggling back", async () => {
    await setComfortMode(true);
    await setComfortMode(false);
    const result = await getComfortMode();
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/comfort/comfort-context.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement comfort mode context**

Create `src/lib/comfort/comfort-context.tsx`:

```typescript
"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { openDB, STORES, idbGet, idbComplete } from "@/lib/db/idb-helpers";

interface ComfortModeContextType {
  isComfort: boolean;
  toggleComfort: () => void;
}

const ComfortModeContext = createContext<ComfortModeContextType>({
  isComfort: false,
  toggleComfort: () => {},
});

interface ComfortModeRecord {
  key: "comfort-mode";
  enabled: boolean;
}

/**
 * Read comfort mode from IDB meta store.
 */
export async function getComfortMode(): Promise<boolean> {
  const db = await openDB();
  const tx = db.transaction(STORES.meta, "readonly");
  const record = await idbGet<ComfortModeRecord>(
    tx.objectStore(STORES.meta),
    "comfort-mode"
  );
  db.close();
  return record?.enabled ?? false;
}

/**
 * Write comfort mode to IDB meta store.
 */
export async function setComfortMode(enabled: boolean): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.meta, "readwrite");
  tx.objectStore(STORES.meta).put({
    key: "comfort-mode",
    enabled,
  } satisfies ComfortModeRecord);
  await idbComplete(tx);
  db.close();
}

export function ComfortModeProvider({ children }: { children: ReactNode }) {
  const [isComfort, setIsComfort] = useState(false);

  useEffect(() => {
    getComfortMode().then(setIsComfort);
  }, []);

  const toggleComfort = useCallback(() => {
    const next = !isComfort;
    setIsComfort(next);
    setComfortMode(next);
  }, [isComfort]);

  return (
    <ComfortModeContext.Provider value={{ isComfort, toggleComfort }}>
      {children}
    </ComfortModeContext.Provider>
  );
}

export function useComfort(): ComfortModeContextType {
  return useContext(ComfortModeContext);
}
```

- [ ] **Step 4: Create barrel export**

Create `src/lib/comfort/index.ts`:

```typescript
export { ComfortModeProvider, useComfort } from "./comfort-context";
```

- [ ] **Step 5: Run comfort mode tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run src/__tests__/lib/comfort/comfort-context.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/comfort/ src/__tests__/lib/comfort/
git commit -m "feat: add ComfortModeProvider with IDB persistence"
```

---

### Task 2: Wire ComfortModeProvider into app

**Files:**
- Modify: `src/app/providers.tsx`
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Read current files**

Read `src/app/providers.tsx` and `src/components/layout/header.tsx`.

- [ ] **Step 2: Add ComfortModeProvider to providers.tsx**

In `src/app/providers.tsx`, wrap children with ComfortModeProvider:

```typescript
"use client";

import type { ReactNode } from "react";
import { VaultProvider } from "@/lib/auth";
import { ComfortModeProvider } from "@/lib/comfort";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <VaultProvider>
      <ComfortModeProvider>{children}</ComfortModeProvider>
    </VaultProvider>
  );
}
```

- [ ] **Step 3: Add comfort toggle to header**

In `src/components/layout/header.tsx`:

1. Add import:

```typescript
import { useComfort } from "@/lib/comfort";
import { Eye } from "lucide-react";
```

2. Inside the Header component function, add:

```typescript
const { isComfort, toggleComfort } = useComfort();
```

3. Add a toggle button in the header's right-side button group (at the beginning, before any other buttons):

```tsx
<Button
  variant={isComfort ? "default" : "outline"}
  size="sm"
  onClick={toggleComfort}
  title={isComfort ? "Switch to standard view" : "Switch to comfort view"}
>
  <Eye className="h-4 w-4 mr-2" />
  <span className="hidden sm:inline">
    {isComfort ? "Comfort" : "Standard"}
  </span>
</Button>
```

- [ ] **Step 4: Verify build**

```bash
cd /e/Projects/health-dashboard && bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/providers.tsx src/components/layout/header.tsx
git commit -m "feat: wire comfort mode toggle into header and providers"
```

---

### Task 3: Add comfort prop to existing view components

**Files:**
- Modify: `src/components/dashboard/medications-view.tsx`
- Modify: `src/components/dashboard/problems-view.tsx`
- Modify: `src/components/dashboard/allergies-view.tsx`
- Modify: `src/components/dashboard/vitals-view.tsx`
- Modify: `src/components/dashboard/lab-results-view.tsx`
- Modify: `src/components/dashboard/immunizations-view.tsx`
- Modify: `src/components/dashboard/visits-view.tsx`

- [ ] **Step 1: Read all view components**

Read each of the 7 view components to understand their current props and rendering.

- [ ] **Step 2: Add comfort prop to each component**

For each view component, make these changes:

**General pattern for all components:**

1. Add `comfort?: boolean` to the props interface
2. Accept `comfort` in the destructured props (default to `false`)
3. When `comfort` is true, hide secondary information:
   - Hide code/codeSystem fields
   - Hide detailed date ranges (show only primary date)
   - Apply `text-lg` instead of default text size
   - Add more spacing between items

**Specific per-component hiding:**

`medications-view.tsx`:
- Hide: `code`, `codeSystem`, `route` when comfort
- Show only: name, dose, status, startDate
- Add `comfort && "text-lg"` to the row container

`problems-view.tsx`:
- Hide: `code`, `codeSystem`, `resolvedDate` when comfort
- Show only: name, status, onsetDate

`allergies-view.tsx`:
- Hide: `allergenCode`, `allergenCodeSystem` when comfort
- Show only: allergen, type, reaction, severity

`vitals-view.tsx`:
- Hide: `code` on measurements when comfort
- Show only: name, value, unit

`lab-results-view.tsx`:
- Hide: `panelCode`, `code` on observations when comfort
- Show only: panelName, date, observation name/value/unit/interpretation

`immunizations-view.tsx`:
- Hide: `code`, `lotNumber` when comfort
- Show only: name, date, status

`visits-view.tsx`:
- No changes needed (already shows minimal info)
- Add `comfort?: boolean` to props for consistency but no visual change

The implementation pattern for hiding is simple conditional rendering:

```tsx
{!comfort && item.code && (
  <span className="text-xs text-gray-400">{item.code}</span>
)}
```

And for text sizing:

```tsx
<div className={`py-2 ${comfort ? "text-lg py-3" : ""}`}>
```

- [ ] **Step 3: Verify build**

```bash
cd /e/Projects/health-dashboard && bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass (comfort prop is optional, existing tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/medications-view.tsx src/components/dashboard/problems-view.tsx src/components/dashboard/allergies-view.tsx src/components/dashboard/vitals-view.tsx src/components/dashboard/lab-results-view.tsx src/components/dashboard/immunizations-view.tsx src/components/dashboard/visits-view.tsx
git commit -m "feat: add comfort prop to all dashboard view components"
```

---

### Task 4: Comfort mode composite views

**Files:**
- Create: `src/components/dashboard/health-summary-view.tsx`
- Create: `src/components/dashboard/records-view.tsx`

- [ ] **Step 1: Create HealthSummaryView**

Create `src/components/dashboard/health-summary-view.tsx`:

```typescript
"use client";

import { ProblemsView } from "./problems-view";
import { AllergiesView } from "./allergies-view";
import { VitalsView } from "./vitals-view";
import type { Problem, Allergy, VitalSign } from "@/lib/ccd/types";

interface HealthSummaryViewProps {
  problems: Problem[];
  allergies: Allergy[];
  vitalSigns: VitalSign[];
  comfort: boolean;
}

export function HealthSummaryView({
  problems,
  allergies,
  vitalSigns,
  comfort,
}: HealthSummaryViewProps) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-4">Conditions</h2>
        <ProblemsView problems={problems} comfort={comfort} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Allergies</h2>
        <AllergiesView allergies={allergies} comfort={comfort} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Vitals</h2>
        <VitalsView vitalSigns={vitalSigns} comfort={comfort} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create RecordsView**

Create `src/components/dashboard/records-view.tsx`:

```typescript
"use client";

import { LabResultsView } from "./lab-results-view";
import { ImmunizationsView } from "./immunizations-view";
import { VisitsView } from "./visits-view";
import type { LabResult, Immunization, ParsedCCD } from "@/lib/ccd/types";

interface RecordsViewProps {
  results: LabResult[];
  immunizations: Immunization[];
  documents: ParsedCCD[];
  comfort: boolean;
}

export function RecordsView({
  results,
  immunizations,
  documents,
  comfort,
}: RecordsViewProps) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-4">Lab Results</h2>
        <LabResultsView results={results} comfort={comfort} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Immunizations</h2>
        <ImmunizationsView immunizations={immunizations} comfort={comfort} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Visit History</h2>
        <VisitsView documents={documents} comfort={comfort} />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/health-summary-view.tsx src/components/dashboard/records-view.tsx
git commit -m "feat: add HealthSummaryView and RecordsView comfort composites"
```

---

### Task 5: Wire comfort mode into page.tsx tabs

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read current page.tsx**

Read `src/app/page.tsx` to understand current structure after Plan 3 changes.

- [ ] **Step 2: Add comfort imports and hook**

Add imports:

```typescript
import { useComfort } from "@/lib/comfort";
import { HealthSummaryView } from "@/components/dashboard/health-summary-view";
import { RecordsView } from "@/components/dashboard/records-view";
```

Inside the `Home` component, add:

```typescript
const { isComfort } = useComfort();
```

- [ ] **Step 3: Add conditional tab rendering**

Replace the current `<Tabs>` block in the dashboard view with a comfort-aware version:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
  {isComfort ? (
    <>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="medications">Medications</TabsTrigger>
        <TabsTrigger value="health-summary">Health Summary</TabsTrigger>
        <TabsTrigger value="records">Records</TabsTrigger>
        <TabsTrigger value="manage">Manage</TabsTrigger>
      </TabsList>

      <TabsContent value="medications" className="mt-4">
        <MedicationsView medications={data.medications} comfort />
      </TabsContent>

      <TabsContent value="health-summary" className="mt-4">
        <HealthSummaryView
          problems={data.problems}
          allergies={data.allergies}
          vitalSigns={data.vitalSigns}
          comfort
        />
      </TabsContent>

      <TabsContent value="records" className="mt-4">
        <RecordsView
          results={data.results}
          immunizations={data.immunizations}
          documents={rawDocuments}
          comfort
        />
      </TabsContent>

      <TabsContent value="manage" className="mt-4">
        <DataManagement
          masterKey={masterKey!}
          documentCount={data.summary.documents}
          onDataChange={() => window.location.reload()}
        />
      </TabsContent>
    </>
  ) : (
    <>
      <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
        <TabsTrigger value="medications">Medications</TabsTrigger>
        <TabsTrigger value="conditions">Conditions</TabsTrigger>
        <TabsTrigger value="labs">Lab Results</TabsTrigger>
        <TabsTrigger value="allergies">Allergies</TabsTrigger>
        <TabsTrigger value="vitals">Vitals</TabsTrigger>
        <TabsTrigger value="immunizations">Immunizations</TabsTrigger>
        <TabsTrigger value="visits">Visits</TabsTrigger>
        <TabsTrigger value="manage">Manage</TabsTrigger>
      </TabsList>

      <TabsContent value="medications" className="mt-4">
        <MedicationsView medications={data.medications} />
      </TabsContent>

      <TabsContent value="conditions" className="mt-4">
        <ProblemsView problems={data.problems} />
      </TabsContent>

      <TabsContent value="labs" className="mt-4">
        <LabResultsView results={data.results} />
      </TabsContent>

      <TabsContent value="allergies" className="mt-4">
        <AllergiesView allergies={data.allergies} />
      </TabsContent>

      <TabsContent value="vitals" className="mt-4">
        <VitalsView vitalSigns={data.vitalSigns} />
      </TabsContent>

      <TabsContent value="immunizations" className="mt-4">
        <ImmunizationsView immunizations={data.immunizations} />
      </TabsContent>

      <TabsContent value="visits" className="mt-4">
        <VisitsView documents={rawDocuments} />
      </TabsContent>

      <TabsContent value="manage" className="mt-4">
        <DataManagement
          masterKey={masterKey!}
          documentCount={data.summary.documents}
          onDataChange={() => window.location.reload()}
        />
      </TabsContent>
    </>
  )}
</Tabs>
```

Note: When switching from comfort to standard mode, the active tab may not exist in the other mode (e.g., "health-summary" doesn't exist in standard). Add a `useEffect` to reset tab when mode changes:

```typescript
useEffect(() => {
  // Reset to a tab that exists in both modes
  if (isComfort && !["medications", "health-summary", "records", "manage"].includes(activeTab)) {
    setActiveTab("medications");
  }
  if (!isComfort && !["medications", "conditions", "labs", "allergies", "vitals", "immunizations", "visits", "manage"].includes(activeTab)) {
    setActiveTab("medications");
  }
}, [isComfort, activeTab]);
```

- [ ] **Step 4: Verify build**

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
git add src/app/page.tsx
git commit -m "feat: wire comfort mode tabs with 4-tab layout and composite views"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the Architecture section:

```markdown
### Comfort Mode (`src/lib/comfort/`)
- ComfortModeProvider persists toggle in IDB `meta` store
- Standard mode: 8 tabs, full information density
- Comfort mode: 4 tabs (Medications, Health Summary, Records, Manage), larger text, hidden codes
- View components accept `comfort?: boolean` prop to control info density
- HealthSummaryView merges conditions + allergies + vitals
- RecordsView merges labs + immunizations + visits
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add comfort mode architecture to CLAUDE.md"
```
