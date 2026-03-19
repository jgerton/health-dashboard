"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardButton } from "@/components/enrichment/clipboard-button";
import { formatProblemContext } from "@/lib/enrichment";
import type { Problem } from "@/lib/ccd/types";

interface ProblemsViewProps {
  problems: Problem[];
  comfort?: boolean;
}

export function ProblemsView({ problems, comfort = false }: ProblemsViewProps) {
  const active = problems.filter((p) => p.status === "active");
  const inactive = problems.filter((p) => p.status !== "active");

  // Deduplicate by name
  const dedupe = (items: Problem[]): Problem[] => {
    const seen = new Map<string, Problem>();
    for (const item of items) {
      const key = item.name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    }
    return Array.from(seen.values());
  };

  const uniqueActive = dedupe(active);
  const uniqueInactive = dedupe(inactive);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conditions and Problems</CardTitle>
      </CardHeader>
      <CardContent>
        {uniqueActive.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Active ({uniqueActive.length})
            </h3>
            <div className="space-y-2">
              {uniqueActive.map((problem) => (
                <div
                  key={problem.id}
                  className="flex items-start justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <span className="font-medium">{problem.name}</span>
                    {problem.onsetDate && (
                      <span className="text-sm text-gray-500 ml-2">
                        since {formatDate(problem.onsetDate)}
                      </span>
                    )}
                    {!comfort && problem.code && (
                      <span className="text-xs text-gray-400 ml-2">{problem.code}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ClipboardButton context={formatProblemContext(problem)} />
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                      Active
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uniqueInactive.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Resolved / Inactive ({uniqueInactive.length})
            </h3>
            <div className="space-y-2">
              {uniqueInactive.map((problem) => (
                <div
                  key={problem.id}
                  className="flex items-start justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <span className="text-gray-600">{problem.name}</span>
                    {!comfort && problem.code && (
                      <span className="text-xs text-gray-400 ml-2">{problem.code}</span>
                    )}
                    {!comfort && problem.resolvedDate && (
                      <span className="text-xs text-gray-400 ml-2">
                        resolved {formatDate(problem.resolvedDate)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ClipboardButton context={formatProblemContext(problem)} />
                    <Badge variant="secondary">{problem.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {problems.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No conditions found. Import your health records to see conditions.
          </p>
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
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
