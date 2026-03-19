"use client";

import { useMemo } from "react";
import { Calendar, FileText, Pill, TestTube, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParsedCCD } from "@/lib/ccd/types";

interface VisitsViewProps {
  documents: ParsedCCD[];
  comfort?: boolean;
}

interface VisitSummary {
  id: string;
  date: string;
  title: string;
  sourceFile?: string;
  medications: number;
  labPanels: number;
  problems: number;
  vitalSets: number;
  immunizations: number;
}

export function VisitsView({ documents, comfort: _comfort = false }: VisitsViewProps) {
  const visits = useMemo(() => {
    const summaries: VisitSummary[] = documents.map((doc) => ({
      id: doc.documentInfo.id,
      date: doc.documentInfo.effectiveTime,
      title: doc.documentInfo.title,
      sourceFile: doc.documentInfo.sourceFile,
      medications: doc.medications.length,
      labPanels: doc.results.length,
      problems: doc.problems.length,
      vitalSets: doc.vitalSigns.length,
      immunizations: doc.immunizations.length,
    }));

    return summaries.sort((a, b) => b.date.localeCompare(a.date));
  }, [documents]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit History</CardTitle>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No visits found. Import your health records to see visit history.
          </p>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
              <div
                key={visit.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    <span className="font-medium">
                      {formatDate(visit.date)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" aria-hidden="true" />
                    {visit.title}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  {visit.medications > 0 && (
                    <span className="flex items-center gap-1">
                      <Pill className="h-3 w-3" aria-hidden="true" />
                      {visit.medications} medications
                    </span>
                  )}
                  {visit.labPanels > 0 && (
                    <span className="flex items-center gap-1">
                      <TestTube className="h-3 w-3" aria-hidden="true" />
                      {visit.labPanels} lab panels
                    </span>
                  )}
                  {visit.vitalSets > 0 && (
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" aria-hidden="true" />
                      {visit.vitalSets} vital sign sets
                    </span>
                  )}
                  {visit.immunizations > 0 && (
                    <span className="flex items-center gap-1">
                      {visit.immunizations} immunizations
                    </span>
                  )}
                </div>

                {visit.sourceFile && (
                  <p className="text-xs text-gray-400 mt-2 truncate">
                    {visit.sourceFile}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "Unknown date";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
