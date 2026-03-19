"use client";

import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/header";
import { FileUpload } from "@/components/import/file-upload";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { MedicationsView } from "@/components/dashboard/medications-view";
import { ProblemsView } from "@/components/dashboard/problems-view";
import { LabResultsView } from "@/components/dashboard/lab-results-view";
import { AllergiesView } from "@/components/dashboard/allergies-view";
import { VitalsView } from "@/components/dashboard/vitals-view";
import { ImmunizationsView } from "@/components/dashboard/immunizations-view";
import { SearchBar } from "@/components/dashboard/search-bar";
import { useHealthData } from "@/lib/hooks/use-health-data";
import type { ParsedCCD } from "@/lib/ccd/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Home() {
  const { data, isLoading, hasData, importDocuments, clearAllData } = useHealthData();
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState("medications");

  const handleImport = useCallback(
    async (results: ParsedCCD[], rawXmls: string[]) => {
      await importDocuments(results, rawXmls);
      setTimeout(() => setShowImport(false), 1000);
    },
    [importDocuments]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading health data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onImportClick={() => setShowImport(true)}
        onClearData={clearAllData}
        patientName={data.patientName}
        hasData={hasData}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-20">
            <h2 className="text-2xl font-bold mb-2">Welcome to Health Dashboard</h2>
            <p className="text-gray-500 mb-8 text-center max-w-md">
              Import your CCD/XML health records to view your medications,
              lab results, conditions, and more. All data stays in your browser.
            </p>
            <FileUpload onImport={handleImport} />
          </div>
        ) : (
          <div className="space-y-6">
            <SearchBar data={data} onNavigate={setActiveTab} />
            <SummaryCards data={data.summary} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="medications">Medications</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
                <TabsTrigger value="labs">Lab Results</TabsTrigger>
                <TabsTrigger value="allergies">Allergies</TabsTrigger>
                <TabsTrigger value="vitals">Vitals</TabsTrigger>
                <TabsTrigger value="immunizations">Immunizations</TabsTrigger>
              </TabsList>

              <TabsContent value="medications" className="mt-4">
                <MedicationsView medications={data.medications} />
              </TabsContent>

              <TabsContent value="conditions" className="mt-4">
                <ProblemsView problems={data.problems} />
              </TabsContent>

              <TabsContent value="labs" className="mt-4">
                <LabResultsView results={data.results} />
              </TabsContent>

              <TabsContent value="allergies" className="mt-4">
                <AllergiesView allergies={data.allergies} />
              </TabsContent>

              <TabsContent value="vitals" className="mt-4">
                <VitalsView vitalSigns={data.vitalSigns} />
              </TabsContent>

              <TabsContent value="immunizations" className="mt-4">
                <ImmunizationsView immunizations={data.immunizations} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Health Records</DialogTitle>
          </DialogHeader>
          <FileUpload onImport={handleImport} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
