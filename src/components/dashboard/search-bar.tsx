"use client";

import { useState, useMemo } from "react";
import { Search, Pill, Heart, TestTube, AlertTriangle, Syringe, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AggregatedHealthData } from "@/lib/hooks/use-health-data";

interface SearchBarProps {
  data: AggregatedHealthData;
  onNavigate: (tab: string) => void;
}

interface SearchResult {
  type: "medication" | "condition" | "lab" | "allergy" | "vital" | "immunization";
  name: string;
  detail?: string;
  tab: string;
}

const TYPE_CONFIG = {
  medication: { icon: Pill, color: "text-blue-600", label: "Medication" },
  condition: { icon: Heart, color: "text-red-600", label: "Condition" },
  lab: { icon: TestTube, color: "text-purple-600", label: "Lab" },
  allergy: { icon: AlertTriangle, color: "text-amber-600", label: "Allergy" },
  vital: { icon: Activity, color: "text-green-600", label: "Vital" },
  immunization: { icon: Syringe, color: "text-teal-600", label: "Immunization" },
} as const;

export function SearchBar({ data, onNavigate }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const found: SearchResult[] = [];

    // Search medications
    const seenMeds = new Set<string>();
    for (const med of data.medications) {
      const key = med.name.toLowerCase();
      if (key.includes(q) && !seenMeds.has(key)) {
        seenMeds.add(key);
        found.push({
          type: "medication",
          name: med.name,
          detail: [med.dose, med.doseUnit, med.route].filter(Boolean).join(" ") || undefined,
          tab: "medications",
        });
      }
    }

    // Search conditions
    const seenProbs = new Set<string>();
    for (const prob of data.problems) {
      const key = prob.name.toLowerCase();
      if (key.includes(q) && !seenProbs.has(key)) {
        seenProbs.add(key);
        found.push({
          type: "condition",
          name: prob.name,
          detail: prob.status,
          tab: "conditions",
        });
      }
    }

    // Search lab tests
    const seenLabs = new Set<string>();
    for (const panel of data.results) {
      if (panel.panelName.toLowerCase().includes(q) && !seenLabs.has(panel.panelName.toLowerCase())) {
        seenLabs.add(panel.panelName.toLowerCase());
        found.push({
          type: "lab",
          name: panel.panelName,
          tab: "labs",
        });
      }
      for (const obs of panel.observations) {
        const key = obs.name.toLowerCase();
        if (key.includes(q) && !seenLabs.has(key)) {
          seenLabs.add(key);
          found.push({
            type: "lab",
            name: obs.name,
            detail: `${obs.value} ${obs.unit || ""}`.trim(),
            tab: "labs",
          });
        }
      }
    }

    // Search allergies
    const seenAllergies = new Set<string>();
    for (const allergy of data.allergies) {
      const key = allergy.allergen.toLowerCase();
      if (key.includes(q) && !seenAllergies.has(key)) {
        seenAllergies.add(key);
        found.push({
          type: "allergy",
          name: allergy.allergen,
          detail: allergy.reaction,
          tab: "allergies",
        });
      }
    }

    // Search immunizations
    const seenImm = new Set<string>();
    for (const imm of data.immunizations) {
      const key = imm.name.toLowerCase();
      if (key.includes(q) && !seenImm.has(key)) {
        seenImm.add(key);
        found.push({
          type: "immunization",
          name: imm.name,
          tab: "immunizations",
        });
      }
    }

    return found.slice(0, 10);
  }, [query, data]);

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-6">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
          aria-hidden="true"
        />
        <Input
          placeholder="Search medications, conditions, labs, allergies..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-base"
          aria-label="Search health records"
        />
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
          {results.map((result, i) => {
            const config = TYPE_CONFIG[result.type];
            const Icon = config.icon;
            return (
              <button
                key={i}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                onClick={() => {
                  onNavigate(result.tab);
                  setQuery("");
                }}
              >
                <Icon className={`h-4 w-4 ${config.color} shrink-0`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{result.name}</span>
                  {result.detail && (
                    <span className="text-xs text-gray-500 ml-2">
                      {result.detail}
                    </span>
                  )}
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {config.label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 p-4 text-center text-sm text-gray-500">
          No results for "{query}"
        </div>
      )}
    </div>
  );
}
