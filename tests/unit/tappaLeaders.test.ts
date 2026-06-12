import { describe, it, expect } from "vitest";
import { tappaLeaders } from "../../src/utils/tappaLeaders";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa } from "../../src/types";

const tappa: Tappa = {
  id: "t", nome: "Test", luogo: "", data: "", nGironi: 1,
  regole: { ...DEFAULT_RULES },
  squadre: [
    { id: "s1", nome: "Alpha", rank: "", giocatori: [{ id: "p1", nome: "Mario" }, { id: "p2", nome: "Luca" }] },
    { id: "s2", nome: "Beta", rank: "", giocatori: [{ id: "p3", nome: "Anna" }] },
  ],
  gironi: [["s1", "s2"]],
  partite: [
    { id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 18, done: true,
      pa: { p1: { pt: 12, rb: 3 }, p2: { pt: 9 } }, pb: { p3: 18 } }, // p3 in formato legacy (solo punti)
    { id: "m2", g: 0, a: "s1", b: "s2", sa: 10, sb: 21, done: true,
      pa: { p1: { pt: 10, as: 2 } }, pb: { p3: { pt: 21 } } },
  ],
  video: [],
};

describe("tappaLeaders (statistiche aggregate)", () => {
  it("somma le statistiche su tutte le gare giocate", () => {
    const rows = tappaLeaders(tappa);
    const mario = rows.find((r) => r.nome === "Mario")!;
    expect(mario.pt).toBe(22);
    expect(mario.rb).toBe(3);
    expect(mario.as).toBe(2);
    expect(mario.g).toBe(2);
  });

  it("supporta il formato legacy con i soli punti", () => {
    const rows = tappaLeaders(tappa);
    const anna = rows.find((r) => r.nome === "Anna")!;
    expect(anna.pt).toBe(39);
    expect(anna.squadra).toBe("Beta");
  });
});
