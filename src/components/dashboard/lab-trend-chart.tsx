"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LabObservation } from "@/lib/ccd/types";

interface LabTrendChartProps {
  testName: string;
  observations: LabObservation[];
}

interface ChartPoint {
  date: string;
  value: number;
  displayDate: string;
  interpretation: string;
}

export function LabTrendChart({ testName, observations }: LabTrendChartProps) {
  const { chartData, refLow, refHigh, unit } = useMemo(() => {
    // Sort by date, deduplicate by date
    const sorted = [...observations]
      .filter((o) => o.value && !isNaN(parseFloat(o.value)))
      .sort((a, b) => a.date.localeCompare(b.date));

    const seen = new Set<string>();
    const deduped = sorted.filter((o) => {
      if (seen.has(o.date)) return false;
      seen.add(o.date);
      return true;
    });

    const points: ChartPoint[] = deduped.map((o) => ({
      date: o.date,
      value: parseFloat(o.value),
      displayDate: formatChartDate(o.date),
      interpretation: o.interpretation || "unknown",
    }));

    // Get reference range from first observation that has one
    const withRef = observations.find(
      (o) => o.referenceRangeLow && o.referenceRangeHigh
    );

    return {
      chartData: points,
      refLow: withRef?.referenceRangeLow
        ? parseFloat(withRef.referenceRangeLow)
        : undefined,
      refHigh: withRef?.referenceRangeHigh
        ? parseFloat(withRef.referenceRangeHigh)
        : undefined,
      unit: observations[0]?.unit || "",
    };
  }, [observations]);

  if (chartData.length < 2) {
    return null; // Need at least 2 points for a trend
  }

  // Calculate Y-axis domain with some padding
  const values = chartData.map((d) => d.value);
  const allValues = [...values];
  if (refLow !== undefined) allValues.push(refLow);
  if (refHigh !== undefined) allValues.push(refHigh);
  const yMin = Math.min(...allValues) * 0.9;
  const yMax = Math.max(...allValues) * 1.1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {testName} Trend
          {unit && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({unit})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
              width={50}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as ChartPoint;
                return (
                  <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-medium">{point.displayDate}</p>
                    <p className="text-lg font-bold">
                      {point.value} {unit}
                    </p>
                    {refLow !== undefined && refHigh !== undefined && (
                      <p className="text-xs text-gray-500">
                        Range: {refLow}-{refHigh} {unit}
                      </p>
                    )}
                  </div>
                );
              }}
            />

            {/* Reference range as shaded area */}
            {refLow !== undefined && refHigh !== undefined && (
              <ReferenceArea
                y1={refLow}
                y2={refHigh}
                fill="#22c55e"
                fillOpacity={0.08}
                stroke="none"
              />
            )}

            {/* Reference range lines */}
            {refHigh !== undefined && (
              <ReferenceLine
                y={refHigh}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            {refLow !== undefined && (
              <ReferenceLine
                y={refLow}
                stroke="#3b82f6"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}

            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const interp = (payload as ChartPoint).interpretation;
                const color =
                  interp === "high" || interp === "critical"
                    ? "#f59e0b"
                    : interp === "low"
                      ? "#3b82f6"
                      : "#22c55e";
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center gap-4 justify-center mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
            Low
          </span>
          {refLow !== undefined && refHigh !== undefined && (
            <span className="flex items-center gap-1">
              <span className="w-6 h-3 bg-green-500/10 border border-green-200 inline-block" />
              Reference range
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatChartDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
