import { describe, it, expect } from "vitest";
import { analyzePlayer3x3, DRILLS } from "../../src/utils/analyzePlayer3x3";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa } from "../../src/types";

const tappa: Tappa = {
  id: "t", nome: "Test", luogo: "", data: "", nGironi: 1,
  regole: { ...DEFAULT_RULES },
  squadre: [
    { id: "s1", nome: "Alpha", rank: "", giocatori: [{ id: "star", nome: "Stella" }, { id: "low", nome: "Gregario" }, { id: "zero", nome: "Panchina" }] },
    { id: "s2", nome: "Beta", rank: "", giocatori: [{ id: "b1", nome: "Avv" }] },
  ],
  gironi: [["s1", "s2"]],
  partite: [
    { id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 12, done: true,
      pa: { star: { pt: 15, rb: 4, as: 3, fa: 1 }, low: { pt: 6, rb: 1, as: 0, pe: 3, fa: 3 } },
      pb: { b1: { pt: 12, rb: 3, as: 1 } } },
    { id: "m2", g: 0, a: "s1", b: "s2", sa: 21, sb: 10, done: true,
      pa: { star: { pt: 14, rb: 5, as: 2 }, low: { pt: 7, rb: 0, as: 1, pe: 2, fa: 3 } },
      pb: { b1: { pt: 10, rb: 2 } } },
  ],
  video: [],
};

describe("analyzePlayer3x3", () => {
  it("segnala palle perse e falli del giocatore in difficoltà, con esercizi", () => {
    const a = analyzePlayer3x3(tappa, "low")!;
    const aree = a.migliorare.map((m) => m.area);
    expect(aree).toContain("Gestione del possesso");
    expect(aree).toContain("Disciplina nei falli");
    a.migliorare.forEach((m) => expect(m.esercizi.length).toBeGreaterThan(0));
    expect(a.migliorare.length).toBeLessThanOrEqual(3 + 2);
  });

  it("riconosce i punti di forza del migliore e propone comunque un'area di lavoro", () => {
    const a = analyzePlayer3x3(tappa, "star")!;
    expect(a.forti.length).toBeGreaterThan(0);
    expect(a.migliorare.length).toBeGreaterThan(0);
  });

  it("gestisce il giocatore senza statistiche", () => {
    const a = analyzePlayer3x3(tappa, "zero")!;
    expect(a.partite).toBe(0);
    expect(a.migliorare).toHaveLength(0);
  });

  it("ogni area del catalogo ha almeno 3 esercizi", () => {
    Object.values(DRILLS).forEach((d) => expect(d.length).toBeGreaterThanOrEqual(3));
  });
});
