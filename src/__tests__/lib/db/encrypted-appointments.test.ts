import { describe, it, expect, beforeEach } from "vitest";
import {
  storeEncryptedAppointment,
  getAllEncryptedAppointments,
  deleteAppointment,
} from "@/lib/db/encrypted-appointments";
import { generateKey } from "@/lib/crypto/encryption";
import type { Appointment } from "@/lib/ics/types";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

function makeFakeAppointment(uid: string, dateTime: string): Appointment {
  return {
    id: crypto.randomUUID(),
    uid,
    title: `Appointment ${uid}`,
    dateTime,
    location: "Main Street Medical",
    doctorName: "Dr. Smith",
    officePhone: "(555) 123-4567",
    status: "upcoming",
    importedAt: new Date().toISOString(),
  };
}

describe("encrypted-appointments", () => {
  describe("storeEncryptedAppointment", () => {
    it("stores and retrieves an encrypted appointment", async () => {
      const key = await generateKey();
      const appt = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");

      const wasNew = await storeEncryptedAppointment(appt, key);
      expect(wasNew).toBe(true);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(1);
      expect(all[0].uid).toBe("uid-1");
      expect(all[0].title).toBe("Appointment uid-1");
      expect(all[0].doctorName).toBe("Dr. Smith");
    });

    it("deduplicates by uid + dateTime", async () => {
      const key = await generateKey();
      const appt1 = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");
      const appt2 = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");
      appt2.title = "Updated Title";

      await storeEncryptedAppointment(appt1, key);
      const wasNew = await storeEncryptedAppointment(appt2, key);
      expect(wasNew).toBe(false);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe("Appointment uid-1"); // First one kept
    });

    it("allows same uid with different dateTime (recurring)", async () => {
      const key = await generateKey();
      const appt1 = makeFakeAppointment("recurring-uid", "2026-04-01T09:30:00");
      const appt2 = makeFakeAppointment("recurring-uid", "2026-04-08T09:30:00");

      await storeEncryptedAppointment(appt1, key);
      const wasNew = await storeEncryptedAppointment(appt2, key);
      expect(wasNew).toBe(true);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(2);
    });

    it("stores multiple appointments", async () => {
      const key = await generateKey();
      await storeEncryptedAppointment(
        makeFakeAppointment("uid-a", "2026-04-01T09:00:00"), key
      );
      await storeEncryptedAppointment(
        makeFakeAppointment("uid-b", "2026-04-15T14:00:00"), key
      );

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(2);
    });
  });

  describe("getAllEncryptedAppointments", () => {
    it("returns empty array when no appointments", async () => {
      const key = await generateKey();
      const all = await getAllEncryptedAppointments(key);
      expect(all).toEqual([]);
    });

    it("fails to decrypt with wrong key", async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();
      await storeEncryptedAppointment(
        makeFakeAppointment("uid-1", "2026-04-01T09:30:00"), key1
      );
      await expect(getAllEncryptedAppointments(key2)).rejects.toThrow();
    });
  });

  describe("deleteAppointment", () => {
    it("deletes a single appointment by id", async () => {
      const key = await generateKey();
      const appt = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");
      await storeEncryptedAppointment(appt, key);

      await deleteAppointment(appt.id);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toEqual([]);
    });

    it("does not affect other appointments", async () => {
      const key = await generateKey();
      const appt1 = makeFakeAppointment("uid-1", "2026-04-01T09:30:00");
      const appt2 = makeFakeAppointment("uid-2", "2026-04-15T14:00:00");
      await storeEncryptedAppointment(appt1, key);
      await storeEncryptedAppointment(appt2, key);

      await deleteAppointment(appt1.id);

      const all = await getAllEncryptedAppointments(key);
      expect(all).toHaveLength(1);
      expect(all[0].uid).toBe("uid-2");
    });
  });
});
