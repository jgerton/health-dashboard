"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { LabTrendChart } from "./lab-trend-chart";
import type { LabResult, LabObservation } from "@/lib/ccd/types";

interface LabResultsViewProps {
  results: LabResult[];
  comfort?: boolean;
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

export function LabResultsView({ results, comfort = false }: LabResultsViewProps) {
  const [trendTest, setTrendTest] = useState<string | null>(null);

  // Sort by date descending
  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.date.localeCompare(a.date)),
    [results]
  );

  // Collect all observations by test name for trend analysis
  const observationsByTest = useMemo(() => {
    const map = new Map<string, LabObservation[]>();
    for (const panel of results) {
      for (const obs of panel.observations) {
        const key = obs.name;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(obs);
      }
    }
    return map;
  }, [results]);

  // Tests that have 2+ data points (can show trends)
  const trendableTests = useMemo(
    () =>
      Array.from(observationsByTest.entries())
        .filter(([, obs]) => obs.length >= 2)
        .map(([name]) => name)
        .sort(),
    [observationsByTest]
  );

  return (
    <div className="space-y-4">
      {/* Trend chart */}
      {trendTest && observationsByTest.has(trendTest) && (
        <LabTrendChart
          testName={trendTest}
          observations={observationsByTest.get(trendTest)!}
        />
      )}

      {/* Trendable tests quick links */}
      {trendableTests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              View Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {trendableTests.map((name) => (
                <Button
                  key={name}
                  variant={trendTest === name ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    setTrendTest(trendTest === name ? null : name)
                  }
                >
                  {name}
                  <span className="text-gray-400 ml-1">
                    ({observationsByTest.get(name)!.length})
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent panels */}
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{panel.panelName}</span>
                      {!comfort && panel.panelCode && (
                        <span className="text-xs text-gray-400">{panel.panelCode}</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(panel.date)}
                    </span>
                  </div>
                  <div className="divide-y">
                    {panel.observations.map((obs, i) => {
                      const hasTrend =
                        (observationsByTest.get(obs.name)?.length || 0) >= 2;
                      return (
                        <div
                          key={i}
                          className={`px-4 py-2 flex items-center justify-between text-sm ${
                            hasTrend
                              ? "cursor-pointer hover:bg-gray-50"
                              : ""
                          }`}
                          onClick={
                            hasTrend
                              ? () => setTrendTest(obs.name)
                              : undefined
                          }
                        >
                          <span className="flex-1 text-gray-700 flex items-center gap-1">
                            {obs.name}
                            {hasTrend && (
                              <TrendingUp className="h-3 w-3 text-gray-400" aria-hidden="true" />
                            )}
                            {!comfort && obs.code && (
                              <span className="text-xs text-gray-400">{obs.code}</span>
                            )}
                          </span>
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-mono ${valueColor(obs.interpretation)}`}
                            >
                              {obs.value}
                              {obs.unit && (
                                <span className="text-gray-400 ml-1 text-xs">
                                  {obs.unit}
                                </span>
                              )}
                            </span>
                            {obs.referenceRangeLow &&
                              obs.referenceRangeHigh && (
                                <span className="text-xs text-gray-400 w-24 text-right">
                                  {obs.referenceRangeLow}-
                                  {obs.referenceRangeHigh}
                                </span>
                              )}
                            <span className="w-16 text-right">
                              {interpretationBadge(obs.interpretation)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
