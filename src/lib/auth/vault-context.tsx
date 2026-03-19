"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  isVaultInitialized,
  initializeVault,
  unlockVault,
  lockVault as lockVaultKey,
  changePassphrase as changeVaultPassphrase,
  getMasterKey,
} from "@/lib/crypto/key-manager";
import { migrateUnencryptedData } from "@/lib/db/migration";

type VaultState = "loading" | "uninitialized" | "locked" | "unlocked";

interface VaultContextValue {
  state: VaultState;
  masterKey: CryptoKey | null;
  setup: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  changePassphrase: (oldPass: string, newPass: string) => Promise<void>;
  error: string | null;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VaultState>("loading");
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isVaultInitialized().then((initialized) => {
      setState(initialized ? "locked" : "uninitialized");
    });
  }, []);

  const setup = useCallback(async (passphrase: string) => {
    try {
      setError(null);
      const key = await initializeVault(passphrase);
      await migrateUnencryptedData(key);
      setMasterKey(key);
      setState("unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
      throw e;
    }
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    try {
      setError(null);
      const key = await unlockVault(passphrase);
      setMasterKey(key);
      setState("unlocked");
    } catch {
      setError("Incorrect passphrase");
      throw new Error("Incorrect passphrase");
    }
  }, []);

  const lock = useCallback(() => {
    lockVaultKey();
    setMasterKey(null);
    setState("locked");
    setError(null);
  }, []);

  const changePass = useCallback(
    async (oldPass: string, newPass: string) => {
      try {
        setError(null);
        await changeVaultPassphrase(oldPass, newPass);
      } catch {
        setError("Passphrase change failed. Check your current passphrase.");
        throw new Error("Passphrase change failed");
      }
    },
    []
  );

  return (
    <VaultContext.Provider
      value={{
        state,
        masterKey,
        setup,
        unlock,
        lock,
        changePassphrase: changePass,
        error,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return ctx;
}
