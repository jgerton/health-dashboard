import { describe, it, expect } from "vitest";
import {
  generateKey,
  deriveKeyFromPassphrase,
  encrypt,
  decrypt,
  exportKey,
  importKey,
} from "@/lib/crypto/encryption";

describe("encryption", () => {
  describe("generateKey", () => {
    it("generates an AES-256-GCM key", async () => {
      const key = await generateKey();
      expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
      expect(key.usages).toContain("encrypt");
      expect(key.usages).toContain("decrypt");
    });
  });

  describe("encrypt / decrypt", () => {
    it("round-trips plaintext through encryption", async () => {
      const key = await generateKey();
      const plaintext = "Hello, health data!";
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertext for same plaintext (unique IV)", async () => {
      const key = await generateKey();
      const plaintext = "same data";
      const enc1 = await encrypt(plaintext, key);
      const enc2 = await encrypt(plaintext, key);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
      expect(enc1.iv).not.toBe(enc2.iv);
    });

    it("fails to decrypt with wrong key", async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();
      const encrypted = await encrypt("secret", key1);
      await expect(decrypt(encrypted, key2)).rejects.toThrow();
    });

    it("handles large payloads (100KB JSON)", async () => {
      const key = await generateKey();
      const large = JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        data: "x".repeat(100),
      })));
      const encrypted = await encrypt(large, key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(large);
    });
  });

  describe("deriveKeyFromPassphrase", () => {
    it("derives a key from passphrase", async () => {
      const { key, salt } = await deriveKeyFromPassphrase("my-passphrase");
      expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it("same passphrase + salt produces same key", async () => {
      const { key: key1, salt } = await deriveKeyFromPassphrase("test-pass");
      const { key: key2 } = await deriveKeyFromPassphrase("test-pass", salt);

      const exported1 = await exportKey(key1);
      const exported2 = await exportKey(key2);
      expect(exported1).toBe(exported2);
    });

    it("different salts produce different keys", async () => {
      const { key: key1 } = await deriveKeyFromPassphrase("same-pass");
      const { key: key2 } = await deriveKeyFromPassphrase("same-pass");
      // Random salts each time
      const exported1 = await exportKey(key1);
      const exported2 = await exportKey(key2);
      expect(exported1).not.toBe(exported2);
    });
  });

  describe("exportKey / importKey", () => {
    it("round-trips a key through export/import", async () => {
      const original = await generateKey();
      const exported = await exportKey(original);
      const imported = await importKey(exported);

      // Verify by encrypting with original, decrypting with imported
      const encrypted = await encrypt("test", original);
      const decrypted = await decrypt(encrypted, imported);
      expect(decrypted).toBe("test");
    });

    it("exports as base64 string", async () => {
      const key = await generateKey();
      const exported = await exportKey(key);
      expect(typeof exported).toBe("string");
      // AES-256 = 32 bytes = 44 chars in base64
      expect(exported.length).toBe(44);
    });
  });
});
