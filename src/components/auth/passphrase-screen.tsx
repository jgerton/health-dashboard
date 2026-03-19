"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useVault } from "@/lib/auth";

export function PassphraseScreen() {
  const { state, setup, unlock, error } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isSetup = state === "uninitialized";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (isSetup) {
      if (passphrase.length < 8) {
        setLocalError("Passphrase must be at least 8 characters");
        return;
      }
      if (passphrase !== confirmPassphrase) {
        setLocalError("Passphrases do not match");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isSetup) {
        await setup(passphrase);
      } else {
        await unlock(passphrase);
      }
    } catch {
      // Error is set by VaultProvider
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {isSetup ? "Set Up Health Dashboard" : "Unlock Health Dashboard"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4 text-center">
            {isSetup
              ? "Create a passphrase to encrypt your health data. All data stays in your browser, protected by AES-256 encryption."
              : "Enter your passphrase to access your health data."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passphrase">Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={
                  isSetup ? "Create a strong passphrase" : "Enter passphrase"
                }
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            {isSetup && (
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Passphrase</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Confirm passphrase"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {displayError && (
              <Alert variant="destructive">
                <p className="text-sm">{displayError}</p>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !passphrase}
            >
              {isSubmitting
                ? "Processing..."
                : isSetup
                  ? "Create Vault"
                  : "Unlock"}
            </Button>
          </form>

          {isSetup && (
            <p className="text-xs text-gray-400 mt-4 text-center">
              There is no password recovery. If you forget your passphrase,
              your data cannot be decrypted.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
