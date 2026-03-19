"use client";

import { useState, useEffect, useCallback } from "react";
import type { Appointment, IcsParseResult } from "@/lib/ics/types";
import { parseIcs } from "@/lib/ics/parser";
import {
  storeEncryptedAppointment,
  getAllEncryptedAppointments,
} from "@/lib/db/encrypted-appointments";

export function useAppointments(masterKey: CryptoKey | null) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!masterKey) {
      setAppointments([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const stored = await getAllEncryptedAppointments(masterKey);
      // Recompute status based on current date
      const withStatus = stored.map((appt) => ({
        ...appt,
        status: appt.status === "cancelled"
          ? "cancelled" as const
          : new Date(appt.dateTime) > new Date()
            ? "upcoming" as const
            : "past" as const,
      }));
      setAppointments(withStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load appointments");
    } finally {
      setIsLoading(false);
    }
  }, [masterKey]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const importIcsFiles = useCallback(
    async (
      files: { content: string; name: string }[]
    ): Promise<{ imported: number; duplicates: number; errors: string[] }> => {
      if (!masterKey) throw new Error("Vault is locked");

      let imported = 0;
      let duplicates = 0;
      const errors: string[] = [];

      for (const file of files) {
        let result: IcsParseResult;
        try {
          result = parseIcs(file.content, file.name);
        } catch (e) {
          errors.push(`${file.name}: ${e instanceof Error ? e.message : "Parse error"}`);
          continue;
        }

        errors.push(...result.errors);

        for (const appt of result.appointments) {
          const wasNew = await storeEncryptedAppointment(appt, masterKey);
          if (wasNew) imported++;
          else duplicates++;
        }
      }

      await loadAppointments();
      return { imported, duplicates, errors };
    },
    [loadAppointments, masterKey]
  );

  const upcoming = appointments
    .filter((a) => a.status === "upcoming")
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime));

  const past = appointments
    .filter((a) => a.status === "past")
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));

  const cancelled = appointments.filter((a) => a.status === "cancelled");

  return {
    appointments,
    upcoming,
    past,
    cancelled,
    isLoading,
    error,
    importIcsFiles,
    hasAppointments: appointments.length > 0,
  };
}
