"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Insight } from "@/lib/enrichment/types";

interface InsightsSectionProps {
  insights: Insight[];
}

export function InsightsSection({ insights }: InsightsSectionProps) {
  if (insights.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">AI Insights</h2>
      <div className="space-y-3">
        {insights.map((insight) => (
          <Card key={insight.id} className="border-purple-200 bg-purple-50/30 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="font-semibold">{insight.title}</h3>
                  <p className="text-sm text-gray-600">{insight.summary}</p>
                  {insight.dateRange && (
                    <p className="text-xs text-gray-400">
                      {insight.dateRange.start} to {insight.dateRange.end}
                    </p>
                  )}
                  {insight.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {insight.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
