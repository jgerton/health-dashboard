"use client";

import type { ReactNode } from "react";
import { VaultProvider } from "@/lib/auth";
import { ComfortModeProvider } from "@/lib/comfort";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <VaultProvider>
      <ComfortModeProvider>{children}</ComfortModeProvider>
    </VaultProvider>
  );
}
