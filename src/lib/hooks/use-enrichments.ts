"use client";

import { useState, useEffect, useCallback } from "react";
import type { Annotation, Insight, EnrichmentExport } from "@/lib/enrichment/types";
import {
  storeEncryptedAnnotation,
  getAllEncryptedAnnotations,
  storeEncryptedInsight,
  getAllEncryptedInsights,
} from "@/lib/db/encrypted-enrichments";

export function useEnrichments(masterKey: CryptoKey | null) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEnrichments = useCallback(async () => {
    if (!masterKey) {
      setAnnotations([]);
      setInsights([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [storedAnnotations, storedInsights] = await Promise.all([
        getAllEncryptedAnnotations(masterKey),
        getAllEncryptedInsights(masterKey),
      ]);
      setAnnotations(storedAnnotations);
      setInsights(storedInsights);
    } finally {
      setIsLoading(false);
    }
  }, [masterKey]);

  useEffect(() => {
    loadEnrichments();
  }, [loadEnrichments]);

  const importEnrichmentJson = useCallback(
    async (jsonString: string): Promise<{ annotations: number; insights: number }> => {
      if (!masterKey) throw new Error("Vault is locked");

      const parsed = JSON.parse(jsonString) as EnrichmentExport;
      if (parsed.version !== 1) {
        throw new Error(`Unsupported enrichment version: ${parsed.version}`);
      }

      let annotationCount = 0;
      let insightCount = 0;

      for (const annot of parsed.annotations) {
        const full: Annotation = {
          ...annot,
          id: crypto.randomUUID(),
          enrichedAt: parsed.generatedAt,
        };
        const wasNew = await storeEncryptedAnnotation(full, masterKey);
        if (wasNew) annotationCount++;
      }

      for (const ins of parsed.insights) {
        const full: Insight = {
          ...ins,
          id: crypto.randomUUID(),
          enrichedAt: parsed.generatedAt,
        };
        await storeEncryptedInsight(full, masterKey);
        insightCount++;
      }

      await loadEnrichments();
      return { annotations: annotationCount, insights: insightCount };
    },
    [loadEnrichments, masterKey]
  );

  const getAnnotationsForRecordId = useCallback(
    (recordId: string): Annotation[] => {
      return annotations.filter((a) => a.recordId === recordId);
    },
    [annotations]
  );

  const getInsightsByTag = useCallback(
    (tag: string): Insight[] => {
      return insights.filter((i) => i.tags.includes(tag));
    },
    [insights]
  );

  return {
    annotations,
    insights,
    isLoading,
    importEnrichmentJson,
    getAnnotationsForRecordId,
    getInsightsByTag,
    hasEnrichments: annotations.length > 0 || insights.length > 0,
  };
}
