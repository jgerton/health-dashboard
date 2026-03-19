"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Immunization } from "@/lib/ccd/types";

interface ImmunizationsViewProps {
  immunizations: Immunization[];
  comfort?: boolean;
}

export function ImmunizationsView({ immunizations, comfort = false }: ImmunizationsViewProps) {
  // Group by vaccine name, show most recent date
  const grouped = new Map<string, Immunization[]>();
  for (const imm of immunizations) {
    const key = imm.name.toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(imm);
  }

  // Sort groups by most recent date
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const aDate = a[1].sort((x, y) => y.date.localeCompare(x.date))[0]?.date || "";
    const bDate = b[1].sort((x, y) => y.date.localeCompare(x.date))[0]?.date || "";
    return bDate.localeCompare(aDate);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Immunizations</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedGroups.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No immunizations found. Import your health records to see immunizations.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedGroups.map(([, imms]) => {
              const sorted = imms.sort((a, b) =>
                b.date.localeCompare(a.date)
              );
              const latest = sorted[0];
              return (
                <div
                  key={latest.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <span className="font-medium">{latest.name}</span>
                    {sorted.length > 1 && (
                      <span className="text-xs text-gray-400 ml-2">
                        ({sorted.length} doses)
                      </span>
                    )}
                    {!comfort && latest.code && (
                      <span className="text-xs text-gray-400 ml-2">{latest.code}</span>
                    )}
                    {!comfort && latest.lotNumber && (
                      <span className="text-xs text-gray-400 ml-2">Lot: {latest.lotNumber}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {formatDate(latest.date)}
                    </span>
                    <Badge
                      className={
                        latest.status === "completed"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-gray-100 text-gray-600"
                      }
                    >
                      {latest.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
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
