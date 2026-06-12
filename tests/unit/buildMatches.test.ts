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
});
