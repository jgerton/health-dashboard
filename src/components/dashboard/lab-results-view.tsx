"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LabResult, LabObservation } from "@/lib/ccd/types";

interface LabResultsViewProps {
  results: LabResult[];
}

function interpretationBadge(interpretation: LabObservation["interpretation"]) {
  switch (interpretation) {
    case "normal":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
          Normal
        </Badge>
      );
    case "high":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
          High
        </Badge>
      );
    case "low":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
          Low
        </Badge>
      );
    case "critical":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
          Critical
        </Badge>
      );
    default:
      return null;
  }
}

function valueColor(interpretation: LabObservation["interpretation"]): string {
  switch (interpretation) {
    case "normal":
      return "text-green-700";
    case "high":
      return "text-amber-700";
    case "low":
      return "text-blue-700";
    case "critical":
      return "text-red-700 font-bold";
    default:
      return "";
  }
}

export function LabResultsView({ results }: LabResultsViewProps) {
  // Sort by date descending, take most recent panels
  const sortedResults = [...results].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lab Results</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedResults.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No lab results found. Import your health records to see results.
          </p>
        ) : (
          <div className="space-y-6">
            {sortedResults.slice(0, 20).map((panel) => (
              <div key={panel.id} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
                  <span className="font-medium">{panel.panelName}</span>
                  <span className="text-sm text-gray-500">
                    {formatDate(panel.date)}
                  </span>
                </div>
                <div className="divide-y">
                  {panel.observations.map((obs, i) => (
                    <div
                      key={i}
                      className="px-4 py-2 flex items-center justify-between text-sm"
                    >
                      <span className="flex-1 text-gray-700">{obs.name}</span>
                      <div className="flex items-center gap-3">
                        <span className={`font-mono ${valueColor(obs.interpretation)}`}>
                          {obs.value}
                          {obs.unit && (
                            <span className="text-gray-400 ml-1 text-xs">
                              {obs.unit}
                            </span>
                          )}
                        </span>
                        {obs.referenceRangeLow && obs.referenceRangeHigh && (
                          <span className="text-xs text-gray-400 w-24 text-right">
                            {obs.referenceRangeLow}-{obs.referenceRangeHigh}
                          </span>
                        )}
                        <span className="w-16 text-right">
                          {interpretationBadge(obs.interpretation)}
                        </span>
                      </div>
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
