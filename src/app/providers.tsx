"use client";

import type { ReactNode } from "react";
import { VaultProvider } from "@/lib/auth";

export function Providers({ children }: { children: ReactNode }) {
  return <VaultProvider>{children}</VaultProvider>;
}
