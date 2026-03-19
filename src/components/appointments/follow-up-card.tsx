"use client";

import { AlertTriangle, Calendar, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { FollowUp } from "@/lib/ccd/follow-ups";

interface FollowUpCardProps {
  followUp: FollowUp;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FollowUpCard({ followUp }: FollowUpCardProps) {
  return (
    <Card className="border-amber-200 bg-amber-50/50 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
            <h3 className="font-semibold">{followUp.reason}</h3>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formatDate(followUp.suggestedDate)}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>From your {followUp.source.toLowerCase()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
