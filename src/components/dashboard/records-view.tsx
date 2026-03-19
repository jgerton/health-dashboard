"use client";

import { LabResultsView } from "./lab-results-view";
import { ImmunizationsView } from "./immunizations-view";
import { VisitsView } from "./visits-view";
import type { LabResult, Immunization, ParsedCCD } from "@/lib/ccd/types";

interface RecordsViewProps {
  results: LabResult[];
  immunizations: Immunization[];
  documents: ParsedCCD[];
  comfort: boolean;
}

export function RecordsView({
  results,
  immunizations,
  documents,
  comfort,
}: RecordsViewProps) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-4">Lab Results</h2>
        <LabResultsView results={results} comfort={comfort} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Immunizations</h2>
        <ImmunizationsView immunizations={immunizations} comfort={comfort} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Visit History</h2>
        <VisitsView documents={documents} comfort={comfort} />
      </section>
    </div>
  );
}
