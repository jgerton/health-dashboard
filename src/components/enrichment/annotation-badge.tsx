"use client";

import { useState } from "react";
import { Info, AlertTriangle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { Annotation } from "@/lib/enrichment/types";

interface AnnotationBadgeProps {
  annotations: Annotation[];
}

function severityIcon(severity: Annotation["severity"]) {
  switch (severity) {
    case "info":
      return <Info className="h-3.5 w-3.5 text-blue-500" />;
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    case "alert":
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
  }
}

function severityBg(severity: Annotation["severity"]) {
  switch (severity) {
    case "info":
      return "bg-blue-50 border-blue-200";
    case "warning":
      return "bg-amber-50 border-amber-200";
    case "alert":
      return "bg-red-50 border-red-200";
  }
}

export function AnnotationBadge({ annotations }: AnnotationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (annotations.length === 0) return null;

  const highestSeverity = annotations.some((a) => a.severity === "alert")
    ? "alert"
    : annotations.some((a) => a.severity === "warning")
      ? "warning"
      : "info";

  return (
    <div className="inline-flex flex-col">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
        title={`${annotations.length} enrichment${annotations.length > 1 ? "s" : ""}`}
      >
        {severityIcon(highestSeverity)}
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-gray-400" />
        ) : (
          <ChevronDown className="h-3 w-3 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className={`p-3 rounded-md border text-sm ${severityBg(annotation.severity)}`}
            >
              <div className="flex items-center gap-1.5 font-medium mb-1">
                {severityIcon(annotation.severity)}
                {annotation.title}
              </div>
              <p className="text-gray-700 text-xs leading-relaxed">
                {annotation.explanation}
              </p>
              {annotation.sources.length > 0 && (
                <p className="text-gray-400 text-xs mt-1">
                  Sources: {annotation.sources.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
