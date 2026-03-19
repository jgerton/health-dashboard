"use client";

import { Pill, TestTube, Heart, AlertTriangle, Syringe, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SummaryData {
  medications: number;
  activeMedications: number;
  labResults: number;
  problems: number;
  activeProblems: number;
  allergies: number;
  vitalSigns: number;
  immunizations: number;
}

interface SummaryCardsProps {
  data: SummaryData;
}

const cards = [
  {
    key: "activeMedications" as const,
    label: "Active Medications",
    icon: Pill,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    key: "activeProblems" as const,
    label: "Active Conditions",
    icon: Heart,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  {
    key: "allergies" as const,
    label: "Allergies",
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    key: "labResults" as const,
    label: "Lab Panels",
    icon: TestTube,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    key: "vitalSigns" as const,
    label: "Vital Sign Records",
    icon: Activity,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    key: "immunizations" as const,
    label: "Immunizations",
    icon: Syringe,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
];

export function SummaryCards({ data }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map(({ key, label, icon: Icon, color, bgColor }) => (
        <Card key={key} className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bgColor}`}>
                <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data[key]}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
