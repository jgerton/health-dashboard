"use client";

import { ProblemsView } from "./problems-view";
import { AllergiesView } from "./allergies-view";
import { VitalsView } from "./vitals-view";
import type { Problem, Allergy, VitalSign } from "@/lib/ccd/types";

interface HealthSummaryViewProps {
  problems: Problem[];
  allergies: Allergy[];
  vitalSigns: VitalSign[];
  comfort: boolean;
}

export function HealthSummaryView({
  problems,
  allergies,
  vitalSigns,
  comfort,
}: HealthSummaryViewProps) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-4">Conditions</h2>
        <ProblemsView problems={problems} comfort={comfort} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Allergies</h2>
        <AllergiesView allergies={allergies} comfort={comfort} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Vitals</h2>
        <VitalsView vitalSigns={vitalSigns} comfort={comfort} />
      </section>
    </div>
  );
}
