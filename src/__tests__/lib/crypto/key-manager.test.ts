import { describe, it, expect, beforeEach } from "vitest";
import {
  initializeVault,
  unlockVault,
  changePassphrase,
  isVaultInitialized,
  lockVault,
  getMasterKey,
} from "@/lib/crypto/key-manager";
import { encrypt, decrypt } from "@/lib/crypto/encryption";

// fake-indexeddb is auto-loaded by setup.ts
// Each test gets a fresh IDB via beforeEach
beforeEach(() => {
  // Clear all IDB databases between tests and reset in-memory key state
  indexedDB = new IDBFactory();
  lockVault();
});

describe("key-manager", () => {
  describe("isVaultInitialized", () => {
    it("returns false when no vault exists", async () => {
      expect(await isVaultInitialized()).toBe(false);
    });

    it("returns true after vault is initialized", async () => {
      await initializeVault("test-passphrase");
      expect(await isVaultInitialized()).toBe(true);
    });
  });

  describe("initializeVault", () => {
    it("creates a vault and returns a usable master key", async () => {
      const masterKey = await initializeVault("my-passphrase");
      expect(masterKey).toBeDefined();
      expect(masterKey.type).toBe("secret");

      // Master key can encrypt/decrypt
      const encrypted = await encrypt("test data", masterKey);
      const decrypted = await decrypt(encrypted, masterKey);
      expect(decrypted).toBe("test data");
    });

    it("throws if vault already initialized", async () => {
      await initializeVault("pass1");
      await expect(initializeVault("pass2")).rejects.toThrow(
        "Vault already initialized"
      );
    });
  });

  describe("unlockVault", () => {
    it("unlocks with correct passphrase and returns master key", async () => {
      const originalKey = await initializeVault("correct-pass");
      lockVault();

      const unlockedKey = await unlockVault("correct-pass");

      // Verify same key by encrypting with original, decrypting with unlocked
      const encrypted = await encrypt("secret", originalKey);
      const decrypted = await decrypt(encrypted, unlockedKey);
      expect(decrypted).toBe("secret");
    });

    it("throws on wrong passphrase", async () => {
      await initializeVault("correct-pass");
      lockVault();
      await expect(unlockVault("wrong-pass")).rejects.toThrow();
    });

    it("throws if vault not initialized", async () => {
      await expect(unlockVault("any-pass")).rejects.toThrow(
        "Vault not initialized"
      );
    });
  });

  describe("changePassphrase", () => {
    it("re-wraps master key with new passphrase", async () => {
      const originalKey = await initializeVault("old-pass");
      await changePassphrase("old-pass", "new-pass");
      lockVault();

      // Old passphrase should fail
      await expect(unlockVault("old-pass")).rejects.toThrow();

      // New passphrase should work and produce same master key
      const newKey = await unlockVault("new-pass");
      const encrypted = await encrypt("data", originalKey);
      const decrypted = await decrypt(encrypted, newKey);
      expect(decrypted).toBe("data");
    });

    it("throws on wrong old passphrase", async () => {
      await initializeVault("real-pass");
      await expect(changePassphrase("wrong-pass", "new-pass")).rejects.toThrow();
    });
  });

  describe("lockVault", () => {
    it("clears the in-memory master key", async () => {
      await initializeVault("pass");
      lockVault();
      // After locking, must unlock again to use
      const key = await unlockVault("pass");
      expect(key).toBeDefined();
    });
  });

  describe("getMasterKey", () => {
    it("returns null before any vault operation", () => {
      expect(getMasterKey()).toBeNull();
    });

    it("returns the master key after initializeVault", async () => {
      await initializeVault("pass");
      expect(getMasterKey()).not.toBeNull();
      expect(getMasterKey()!.type).toBe("secret");
    });

    it("returns null after lockVault", async () => {
      await initializeVault("pass");
      lockVault();
      expect(getMasterKey()).toBeNull();
    });
  });
});
