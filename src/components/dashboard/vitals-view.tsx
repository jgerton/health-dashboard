"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VitalSign } from "@/lib/ccd/types";

interface VitalsViewProps {
  vitalSigns: VitalSign[];
  comfort?: boolean;
}

export function VitalsView({ vitalSigns, comfort = false }: VitalsViewProps) {
  const sorted = [...vitalSigns].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vital Signs</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No vital signs found. Import your health records to see vitals.
          </p>
        ) : (
          <div className="space-y-4">
            {sorted.slice(0, 20).map((vs) => (
              <div key={vs.id} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2">
                  <span className="text-sm font-medium text-gray-600">
                    {formatDate(vs.date)}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                  {vs.measurements.map((m, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xs text-gray-500 mb-1">{m.name}</p>
                      <p className="text-lg font-semibold">
                        {m.value}
                        {m.unit && (
                          <span className="text-xs text-gray-400 ml-1">
                            {m.unit}
                          </span>
                        )}
                      </p>
                      {!comfort && m.code && (
                        <span className="text-xs text-gray-400">{m.code}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
