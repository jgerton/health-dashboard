"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Allergy } from "@/lib/ccd/types";

interface AllergiesViewProps {
  allergies: Allergy[];
}

export function AllergiesView({ allergies }: AllergiesViewProps) {
  // Deduplicate by allergen name
  const unique = new Map<string, Allergy>();
  for (const allergy of allergies) {
    const key = allergy.allergen.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, allergy);
    }
  }
  const deduped = Array.from(unique.values());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allergies</CardTitle>
      </CardHeader>
      <CardContent>
        {deduped.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No allergies found. Import your health records to see allergies.
          </p>
        ) : (
          <div className="space-y-3">
            {deduped.map((allergy) => (
              <div
                key={allergy.id}
                className="flex items-start gap-3 py-3 px-4 rounded-lg bg-amber-50 border border-amber-100"
              >
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base">
                      {allergy.allergen}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {allergy.type}
                    </Badge>
                  </div>
                  {allergy.reaction && (
                    <p className="text-sm text-gray-600 mt-1">
                      Reaction: {allergy.reaction}
                    </p>
                  )}
                </div>
                <Badge
                  className={
                    allergy.status === "active"
                      ? "bg-red-100 text-red-800 hover:bg-red-100"
                      : "bg-gray-100 text-gray-600"
                  }
                >
                  {allergy.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
