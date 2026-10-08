import { describe, it, expect } from "vitest";
import { buildMatches } from "../../src/utils/buildMatches";

describe("buildMatches (calendario all'italiana)", () => {
  it("genera n*(n-1)/2 partite per girone", () => {
    const ms = buildMatches([["a", "b", "c", "d"]]);
    expect(ms).toHaveLength(6);
  });

  it("ogni coppia si incontra esattamente una volta", () => {
    const ms = buildMatches([["a", "b", "c"]]);
    const coppie = ms.map((m) => [m.a, m.b].sort().join("-"));
    expect(new Set(coppie).size).toBe(3);
  });

  it("le partite riportano l'indice del girone e partono non giocate", () => {
    const ms = buildMatches([["a", "b"], ["c", "d"]]);
    expect(ms.filter((m) => m.g === 0)).toHaveLength(1);
    expect(ms.filter((m) => m.g === 1)).toHaveLength(1);
    expect(ms.every((m) => !m.done)).toBe(true);
  });

  // Metodo del cerchio: le partite escono a giornate, in ognuna ogni squadra gioca al più una volta
  it("con 4 squadre ogni giornata di 2 partite coinvolge tutte e 4 le squadre", () => {
    const ms = buildMatches([["a", "b", "c", "d"]]);
    for (let k = 0; k < ms.length; k += 2) {
      const giornata = ms.slice(k, k + 2).flatMap((m) => [m.a, m.b]);
      expect(new Set(giornata).size).toBe(4);
    }
  });

  it("con 5 squadre (una riposa a turno) 10 partite, nessuna squadra in due partite della stessa giornata", () => {
    const ms = buildMatches([["a", "b", "c", "d", "e"]]);
    expect(ms).toHaveLength(10);
    expect(new Set(ms.map((m) => [m.a, m.b].sort().join("-"))).size).toBe(10);
    for (let k = 0; k < ms.length; k += 2) {
      const giornata = ms.slice(k, k + 2).flatMap((m) => [m.a, m.b]);
      expect(new Set(giornata).size).toBe(4);
    }
  });

  it("la prima squadra non gioca più partite di fila", () => {
    const ms = buildMatches([["a", "b", "c", "d"]]);
    for (let k = 1; k < ms.length; k++) {
      const insieme = [ms[k - 1].a, ms[k - 1].b].includes("a") && [ms[k].a, ms[k].b].includes("a");
      expect(insieme).toBe(false);
    }
  });
});
