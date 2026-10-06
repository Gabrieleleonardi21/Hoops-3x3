import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eta } from "../../src/utils/eta";

// Oggi fissato: 15 giugno 2026
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-15T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("eta", () => {
  it("anni compiuti a partire dalla data di nascita", () => {
    expect(eta("2000-06-14")).toBe(26);
    expect(eta("1990-01-01")).toBe(36);
  });

  it("nessuna data o data non valida: null", () => {
    expect(eta("")).toBeNull();
    expect(eta("non è una data")).toBeNull();
  });

  it("FD-10: una data futura non ha un'età (non un numero negativo)", () => {
    expect(eta("2027-01-01")).toBeNull();
    expect(eta("2026-06-16")).toBeNull();
    expect(eta("2126-06-15")).toBeNull();
  });

  it("nato oggi o ieri: 0 anni, non null", () => {
    expect(eta("2026-06-15")).toBe(0);
    expect(eta("2026-06-14")).toBe(0);
  });
});
