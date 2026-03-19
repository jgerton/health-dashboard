import { describe, it, expect, beforeEach } from "vitest";
import {
  getComfortMode,
  setComfortMode,
} from "@/lib/comfort/comfort-context";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

describe("comfort mode persistence", () => {
  it("returns false by default", async () => {
    const result = await getComfortMode();
    expect(result).toBe(false);
  });

  it("persists true to IDB", async () => {
    await setComfortMode(true);
    const result = await getComfortMode();
    expect(result).toBe(true);
  });

  it("persists false after toggling back", async () => {
    await setComfortMode(true);
    await setComfortMode(false);
    const result = await getComfortMode();
    expect(result).toBe(false);
  });
});
