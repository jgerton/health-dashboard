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
