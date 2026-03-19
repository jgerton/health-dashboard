"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Medication } from "@/lib/ccd/types";

interface MedicationsViewProps {
  medications: Medication[];
  comfort?: boolean;
}

function statusBadge(status: Medication["status"]) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    case "completed":
      return <Badge variant="secondary">Completed</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

export function MedicationsView({ medications, comfort = false }: MedicationsViewProps) {
  const active = medications.filter((m) => m.status === "active");
  const other = medications.filter((m) => m.status !== "active");

  // Deduplicate by name (keep most recent)
  const dedupe = (meds: Medication[]): Medication[] => {
    const seen = new Map<string, Medication>();
    for (const med of meds) {
      const key = med.name.toLowerCase();
      const existing = seen.get(key);
      if (!existing || (med.startDate && med.startDate > (existing.startDate || ""))) {
        seen.set(key, med);
      }
    }
    return Array.from(seen.values());
  };

  const uniqueActive = dedupe(active);
  const uniqueOther = dedupe(other);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medications</CardTitle>
      </CardHeader>
      <CardContent>
        {uniqueActive.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Active ({uniqueActive.length})
            </h3>
            <div className="space-y-3">
              {uniqueActive.map((med) => (
                <MedicationRow key={med.id} medication={med} comfort={comfort} />
              ))}
            </div>
          </div>
        )}

        {uniqueOther.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Past ({uniqueOther.length})
            </h3>
            <div className="space-y-3">
              {uniqueOther.map((med) => (
                <MedicationRow key={med.id} medication={med} comfort={comfort} />
              ))}
            </div>
          </div>
        )}

        {medications.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No medications found. Import your health records to see medications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MedicationRow({ medication, comfort = false }: { medication: Medication; comfort?: boolean }) {
  return (
    <div className={`flex items-start justify-between px-3 rounded-lg hover:bg-gray-50 ${comfort ? "py-3 text-lg" : "py-2"}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-base">{medication.name}</span>
          {statusBadge(medication.status)}
        </div>
        <div className="flex gap-4 mt-1 text-sm text-gray-500">
          {medication.dose && medication.doseUnit && (
            <span>
              {medication.dose} {medication.doseUnit}
            </span>
          )}
          {!comfort && medication.route && <span>{medication.route}</span>}
          {medication.startDate && (
            <span>Since {formatDate(medication.startDate)}</span>
          )}
        </div>
        {!comfort && medication.code && (
          <span className="text-xs text-gray-400">{medication.code}</span>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
