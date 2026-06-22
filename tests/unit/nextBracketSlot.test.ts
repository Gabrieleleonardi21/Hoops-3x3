import { describe, it, expect } from "vitest";
import { nextBracketSlot } from "../../src/utils/buildBracket";
import type { BracketMatch } from "../../src/types";

/** Bracket a 4 squadre: 2 semifinali (squadre note) + 1 finale (TBD). */
function bracket4(): BracketMatch[] {
  return [
    { id: "sf1", label: "Semifinale 1", squadraA: "1A", squadraB: "2B", pA: 0, pB: 0, done: false },
    { id: "sf2", label: "Semifinale 2", squadraA: "2A", squadraB: "1B", pA: 0, pB: 0, done: false },
    { id: "fin", label: "Finale",       squadraA: null, squadraB: null, pA: 0, pB: 0, done: false },
  ];
}

describe("nextBracketSlot (avanzamento vincitore nel bracket)", () => {
  it("manda il vincitore della prima semifinale nello slot A della finale", () => {
    const r = nextBracketSlot(bracket4(), "sf1", "1A");
    expect(r).toEqual({ id: "fin", patch: { squadraA: "1A" } });
  });

  it("riempie lo slot B della finale se lo slot A è già occupato", () => {
    const b = bracket4();
    b[2].squadraA = "1A"; // finale già con lo slot A pieno
    const r = nextBracketSlot(b, "sf2", "1B");
    expect(r).toEqual({ id: "fin", patch: { squadraB: "1B" } });
  });

  it("restituisce null per la finale (nessun round successivo)", () => {
    expect(nextBracketSlot(bracket4(), "fin", "1A")).toBeNull();
  });

  it("restituisce null senza vincitore o con match inesistente", () => {
    expect(nextBracketSlot(bracket4(), "sf1", null)).toBeNull();
    expect(nextBracketSlot(bracket4(), "sconosciuto", "1A")).toBeNull();
  });

  it("salta i match successivi già con entrambe le squadre note", () => {
    // sf2 ha già le squadre: il vincitore di sf1 deve finire nella finale, non in sf2
    const r = nextBracketSlot(bracket4(), "sf1", "2B");
    expect(r?.id).toBe("fin");
  });
});
