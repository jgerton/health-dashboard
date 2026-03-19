# M3 Plan 3: Appointments Landing Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current post-unlock landing with an appointments-first view showing upcoming appointments, follow-up suggestions, and past appointments, with a "View Health Records" button to reach the tabbed dashboard.

**Architecture:** New `src/components/appointments/` directory with three components: `appointments-view.tsx` (main landing), `appointment-card.tsx` (single appointment), and `follow-up-card.tsx` (follow-up suggestion). `page.tsx` gains a `view` state toggling between "appointments" (default) and "dashboard". The header gets a navigation button to switch views.

**Tech Stack:** TypeScript, React, shadcn/ui (Card, Badge, Button), Tailwind CSS, lucide-react icons

**Spec:** `docs/superpowers/specs/2026-03-19-milestone3-appointments-comfort-design.md` (UI Changes > Landing Page section)

**Depends on:** Plan 2 (follow-up detection) must be completed first so `AggregatedHealthData.followUps` is available.

---

### Task 1: AppointmentCard component

**Files:**
- Create: `src/components/appointments/appointment-card.tsx`

- [ ] **Step 1: Create appointment card component**

Create `src/components/appointments/appointment-card.tsx`:

```typescript
"use client";

import { Calendar, MapPin, Phone, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Appointment } from "@/lib/ics/types";

interface AppointmentCardProps {
  appointment: Appointment;
}

function formatDateTime(dateTime: string): { date: string; time: string | null } {
  if (!dateTime.includes("T")) {
    // Date only
    const d = new Date(dateTime + "T00:00:00");
    return {
      date: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: null,
    };
  }

  const d = new Date(dateTime);
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function AppointmentCard({ appointment }: AppointmentCardProps) {
  const { date, time } = formatDateTime(appointment.dateTime);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="font-semibold text-lg">{appointment.title}</h3>

            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-base font-medium">{date}</span>
              {time && <span className="text-base">{time}</span>}
            </div>

            {appointment.doctorName && (
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{appointment.doctorName}</span>
              </div>
            )}

            {appointment.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{appointment.location}</span>
              </div>
            )}

            {appointment.officePhone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                <a
                  href={`tel:${appointment.officePhone.replace(/[^\d+]/g, "")}`}
                  className="text-blue-600 hover:underline"
                >
                  {appointment.officePhone}
                </a>
              </div>
            )}
          </div>

          {appointment.status === "cancelled" && (
            <Badge variant="destructive">Cancelled</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/appointments/appointment-card.tsx
git commit -m "feat: add AppointmentCard component"
```

---

### Task 2: FollowUpCard component

**Files:**
- Create: `src/components/appointments/follow-up-card.tsx`

- [ ] **Step 1: Create follow-up card component**

Create `src/components/appointments/follow-up-card.tsx`:

```typescript
"use client";

import { AlertTriangle, Calendar, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { FollowUp } from "@/lib/ccd/follow-ups";

interface FollowUpCardProps {
  followUp: FollowUp;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FollowUpCard({ followUp }: FollowUpCardProps) {
  return (
    <Card className="border-amber-200 bg-amber-50/50 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
            <h3 className="font-semibold">{followUp.reason}</h3>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formatDate(followUp.suggestedDate)}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>From your {followUp.source.toLowerCase()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/appointments/follow-up-card.tsx
git commit -m "feat: add FollowUpCard component"
```

---

### Task 3: AppointmentsView landing page

**Files:**
- Create: `src/components/appointments/appointments-view.tsx`

- [ ] **Step 1: Create appointments view**

Create `src/components/appointments/appointments-view.tsx`:

```typescript
"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "./appointment-card";
import { FollowUpCard } from "./follow-up-card";
import type { Appointment } from "@/lib/ics/types";
import type { FollowUp } from "@/lib/ccd/follow-ups";

interface AppointmentsViewProps {
  upcoming: Appointment[];
  past: Appointment[];
  cancelled: Appointment[];
  followUps: FollowUp[];
  onViewRecords: () => void;
  onImportClick: () => void;
}

export function AppointmentsView({
  upcoming,
  past,
  cancelled,
  followUps,
  onViewRecords,
  onImportClick,
}: AppointmentsViewProps) {
  const [showPast, setShowPast] = useState(false);
  const hasAnyContent = upcoming.length > 0 || followUps.length > 0 || past.length > 0;

  if (!hasAnyContent) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CalendarDays className="h-16 w-16 text-gray-300 mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-bold mb-2">No upcoming appointments</h2>
        <p className="text-gray-500 mb-8 text-center max-w-md">
          Import a calendar file (.ics) to see your appointments here,
          or import health records (.xml) to detect follow-up needs.
        </p>
        <div className="flex gap-3">
          <Button onClick={onImportClick}>Import Files</Button>
          <Button variant="outline" onClick={onViewRecords}>
            View Health Records
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upcoming Appointments */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Upcoming Appointments</h2>
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <AppointmentCard key={appt.id} appointment={appt} />
            ))}
          </div>
        </section>
      )}

      {/* Follow-up Suggestions */}
      {followUps.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-2">Follow-up Needed</h2>
          <p className="text-sm text-gray-500 mb-4">From your health records</p>
          <div className="space-y-3">
            {followUps.map((fu, i) => (
              <FollowUpCard key={`${fu.documentId}-${i}`} followUp={fu} />
            ))}
          </div>
        </section>
      )}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Cancelled</h2>
          <div className="space-y-3">
            {cancelled.map((appt) => (
              <AppointmentCard key={appt.id} appointment={appt} />
            ))}
          </div>
        </section>
      )}

      {/* Past Appointments */}
      {past.length > 0 && (
        <section>
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-xl font-bold mb-4 hover:text-gray-600 transition-colors"
          >
            Past Appointments ({past.length})
            {showPast ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
          {showPast && (
            <div className="space-y-3">
              {past.map((appt) => (
                <AppointmentCard key={appt.id} appointment={appt} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Navigation */}
      <div className="pt-4 border-t">
        <Button variant="outline" onClick={onViewRecords}>
          View Health Records
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/appointments/appointments-view.tsx
git commit -m "feat: add AppointmentsView landing page"
```

---

### Task 4: Wire into page.tsx and header

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Read current files**

Read `src/app/page.tsx` and `src/components/layout/header.tsx` to understand current structure.

- [ ] **Step 2: Add view toggle to page.tsx**

In `src/app/page.tsx`:

1. Add imports:

```typescript
import { AppointmentsView } from "@/components/appointments/appointments-view";
```

2. Update the `useAppointments` destructuring to include more fields:

```typescript
const { upcoming, past, cancelled, importIcsFiles } = useAppointments(masterKey);
```

3. Add view state:

```typescript
const [currentView, setCurrentView] = useState<"appointments" | "dashboard">("appointments");
```

4. Replace the main content section. The current code has a ternary: `!hasData ? (empty state) : (tabbed dashboard)`. Replace this with a three-way condition:

```tsx
{!hasData && upcoming.length === 0 ? (
  // Empty state: no health data AND no appointments
  <div className="flex flex-col items-center justify-center py-20">
    <h2 className="text-2xl font-bold mb-2">Welcome to Health Dashboard</h2>
    <p className="text-gray-500 mb-8 text-center max-w-md">
      Import your health records (.xml) or calendar files (.ics)
      to get started. All data stays in your browser.
    </p>
    <FileUpload
      onImport={handleImport}
      onImportIcs={async (files) => {
        const result = await importIcsFiles(files);
        setTimeout(() => setShowImport(false), 1000);
        return result;
      }}
    />
  </div>
) : currentView === "appointments" ? (
  // Appointments landing (default view)
  <AppointmentsView
    upcoming={upcoming}
    past={past}
    cancelled={cancelled}
    followUps={data.followUps}
    onViewRecords={() => setCurrentView("dashboard")}
    onImportClick={() => setShowImport(true)}
  />
) : (
  // Tabbed dashboard (existing code, unchanged)
  <div className="space-y-6">
    <SearchBar data={data} onNavigate={setActiveTab} />
    <SummaryCards data={data.summary} />
    {/* ... existing Tabs block stays exactly as-is ... */}
  </div>
)}
```

- [ ] **Step 3: Update Header to support view switching**

In `src/components/layout/header.tsx`:

1. Add props for view navigation:

```typescript
interface HeaderProps {
  onImportClick: () => void;
  onClearData?: () => void;
  onLock?: () => void;
  patientName?: string;
  hasData?: boolean;
  currentView?: "appointments" | "dashboard";
  onViewChange?: (view: "appointments" | "dashboard") => void;
}
```

2. Add a view toggle button in the header's right-side button group (before the Import button):

```tsx
{onViewChange && currentView === "dashboard" && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => onViewChange("appointments")}
  >
    <CalendarDays className="h-4 w-4 mr-2" />
    Appointments
  </Button>
)}
{onViewChange && currentView === "appointments" && hasData && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => onViewChange("dashboard")}
  >
    Records
  </Button>
)}
```

3. Add `CalendarDays` to the lucide-react import.

- [ ] **Step 4: Pass view props from page.tsx to Header**

Update the `<Header>` component in `page.tsx` to include:

```tsx
<Header
  onImportClick={() => setShowImport(true)}
  onClearData={clearAllData}
  onLock={lock}
  patientName={data.patientName}
  hasData={hasData}
  currentView={currentView}
  onViewChange={setCurrentView}
/>
```

- [ ] **Step 5: Verify build**

```bash
cd /e/Projects/health-dashboard && bun run build
```

Expected: Build succeeds.

- [ ] **Step 6: Run all tests**

```bash
cd /e/Projects/health-dashboard && bunx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/layout/header.tsx
git commit -m "feat: wire appointments landing as default view with navigation"
```

---

### Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the Architecture section after the Appointments block:

```markdown
### Follow-ups (`src/lib/ccd/follow-ups.ts`)
- Best-effort follow-up detection from CCD data (not clinical NLP)
- Scans problems for future onset dates, lab results for common recheck intervals
- Derived at read time via `extractFollowUps()`, not stored separately
- Surfaced in `AggregatedHealthData.followUps`

### Navigation
- Default view after unlock: Appointments landing (upcoming, follow-ups, past)
- "View Health Records" navigates to tabbed dashboard
- Header toggle switches between appointments and dashboard views
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add follow-ups and navigation architecture to CLAUDE.md"
```
