/**
 * Encrypted appointment storage in IndexedDB.
 *
 * Follows the same pattern as encrypted-store.ts: encrypt the full
 * Appointment object as JSON before writing, decrypt on read.
 * Deduplicates by uid + dateTime combination.
 */

import type { Appointment } from "@/lib/ics/types";
import { encrypt, decrypt, type EncryptedData } from "@/lib/crypto/encryption";
import { openDB, STORES, idbGetAll, idbComplete } from "./idb-helpers";

interface EncryptedAppointmentRecord {
  id: string;
  uid: string;
  dateTime: string;
  data: EncryptedData;
}

/**
 * Store an encrypted appointment. Returns false if duplicate (same uid + dateTime).
 */
export async function storeEncryptedAppointment(
  appointment: Appointment,
  masterKey: CryptoKey
): Promise<boolean> {
  const db = await openDB();

  // Check for duplicate by uid + dateTime
  const tx1 = db.transaction(STORES.appointments, "readonly");
  const store = tx1.objectStore(STORES.appointments);
  const existingByUid = await new Promise<EncryptedAppointmentRecord[]>(
    (resolve, reject) => {
      const index = store.index("uid");
      const request = index.getAll(appointment.uid);
      request.onsuccess = () =>
        resolve(request.result as EncryptedAppointmentRecord[]);
      request.onerror = () => reject(request.error);
    }
  );

  const isDuplicate = existingByUid.some(
    (r) => r.dateTime === appointment.dateTime
  );
  if (isDuplicate) {
    db.close();
    return false;
  }

  // Encrypt the full appointment
  const encryptedData = await encrypt(JSON.stringify(appointment), masterKey);

  const record: EncryptedAppointmentRecord = {
    id: appointment.id,
    uid: appointment.uid,
    dateTime: appointment.dateTime,
    data: encryptedData,
  };

  const tx2 = db.transaction(STORES.appointments, "readwrite");
  tx2.objectStore(STORES.appointments).put(record);
  await idbComplete(tx2);

  db.close();
  return true;
}

/**
 * Read and decrypt all appointments from IDB.
 */
export async function getAllEncryptedAppointments(
  masterKey: CryptoKey
): Promise<Appointment[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.appointments, "readonly");
  const records = await idbGetAll<EncryptedAppointmentRecord>(
    tx.objectStore(STORES.appointments)
  );
  db.close();

  const decrypted: Appointment[] = [];
  for (const record of records) {
    const json = await decrypt(record.data, masterKey);
    decrypted.push(JSON.parse(json) as Appointment);
  }
  return decrypted;
}

/**
 * Delete a single appointment by ID.
 */
export async function deleteAppointment(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.appointments, "readwrite");
  tx.objectStore(STORES.appointments).delete(id);
  await idbComplete(tx);
  db.close();
}
