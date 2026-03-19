"use client";

import { useState, useEffect, useCallback } from "react";
import type { ParsedCCD, Medication, LabResult, Problem, Allergy, VitalSign, Immunization } from "@/lib/ccd/types";
import {
  storeEncryptedDocument,
  getAllEncryptedHealthData,
  deleteHealthDataOnly,
} from "@/lib/db";

export interface HealthDataSummary {
  documents: number;
  medications: number;
  activeMedications: number;
  labResults: number;
  problems: number;
  activeProblems: number;
  allergies: number;
  vitalSigns: number;
  immunizations: number;
}

export interface AggregatedHealthData {
  medications: Medication[];
  results: LabResult[];
  problems: Problem[];
  allergies: Allergy[];
  vitalSigns: VitalSign[];
  immunizations: Immunization[];
  patientName?: string;
  summary: HealthDataSummary;
}

export function useHealthData(masterKey: CryptoKey | null) {
  const [data, setData] = useState<ParsedCCD[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!masterKey) {
      setData([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const stored = await getAllEncryptedHealthData(masterKey);
      setData(stored);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [masterKey]);

  // Load persisted data on mount (and when masterKey changes)
  useEffect(() => {
    loadData();
  }, [loadData]);

  const importDocuments = useCallback(
    async (
      ccds: ParsedCCD[],
      rawXmls: string[]
    ): Promise<{ imported: number; duplicates: number }> => {
      if (!masterKey) throw new Error("Vault is locked");
      let imported = 0;
      let duplicates = 0;

      for (let i = 0; i < ccds.length; i++) {
        const wasNew = await storeEncryptedDocument(ccds[i], rawXmls[i], masterKey);
        if (wasNew) {
          imported++;
        } else {
          duplicates++;
        }
      }

      // Reload all data
      await loadData();
      return { imported, duplicates };
    },
    [loadData, masterKey]
  );

  const clearAllData = useCallback(async () => {
    await deleteHealthDataOnly();
    setData([]);
  }, []);

  // Aggregate data across all documents
  const aggregated: AggregatedHealthData = {
    medications: data.flatMap((d) => d.medications),
    results: data.flatMap((d) => d.results),
    problems: data.flatMap((d) => d.problems),
    allergies: data.flatMap((d) => d.allergies),
    vitalSigns: data.flatMap((d) => d.vitalSigns),
    immunizations: data.flatMap((d) => d.immunizations),
    patientName: data[0]?.patient.name,
    summary: {
      documents: data.length,
      medications: data.reduce((n, d) => n + d.medications.length, 0),
      activeMedications: data.reduce(
        (n, d) => n + d.medications.filter((m) => m.status === "active").length,
        0
      ),
      labResults: data.reduce((n, d) => n + d.results.length, 0),
      problems: data.reduce((n, d) => n + d.problems.length, 0),
      activeProblems: data.reduce(
        (n, d) => n + d.problems.filter((p) => p.status === "active").length,
        0
      ),
      allergies: data.reduce((n, d) => n + d.allergies.length, 0),
      vitalSigns: data.reduce((n, d) => n + d.vitalSigns.length, 0),
      immunizations: data.reduce((n, d) => n + d.immunizations.length, 0),
    },
  };

  return {
    data: aggregated,
    rawDocuments: data,
    isLoading,
    error,
    importDocuments,
    clearAllData,
    hasData: data.length > 0,
  };
}
