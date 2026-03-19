"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { openDB, STORES, idbGet, idbComplete } from "@/lib/db/idb-helpers";

interface ComfortModeContextType {
  isComfort: boolean;
  toggleComfort: () => void;
}

const ComfortModeContext = createContext<ComfortModeContextType>({
  isComfort: false,
  toggleComfort: () => {},
});

interface ComfortModeRecord {
  key: "comfort-mode";
  enabled: boolean;
}

/**
 * Read comfort mode from IDB meta store.
 */
export async function getComfortMode(): Promise<boolean> {
  const db = await openDB();
  const tx = db.transaction(STORES.meta, "readonly");
  const record = await idbGet<ComfortModeRecord>(
    tx.objectStore(STORES.meta),
    "comfort-mode"
  );
  db.close();
  return record?.enabled ?? false;
}

/**
 * Write comfort mode to IDB meta store.
 */
export async function setComfortMode(enabled: boolean): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.meta, "readwrite");
  tx.objectStore(STORES.meta).put({
    key: "comfort-mode",
    enabled,
  } satisfies ComfortModeRecord);
  await idbComplete(tx);
  db.close();
}

export function ComfortModeProvider({ children }: { children: ReactNode }) {
  const [isComfort, setIsComfort] = useState(false);

  useEffect(() => {
    getComfortMode().then(setIsComfort);
  }, []);

  const toggleComfort = useCallback(() => {
    const next = !isComfort;
    setIsComfort(next);
    setComfortMode(next);
  }, [isComfort]);

  return (
    <ComfortModeContext.Provider value={{ isComfort, toggleComfort }}>
      {children}
    </ComfortModeContext.Provider>
  );
}

export function useComfort(): ComfortModeContextType {
  return useContext(ComfortModeContext);
}
