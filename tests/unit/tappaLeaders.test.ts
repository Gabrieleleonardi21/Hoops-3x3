import { describe, it, expect } from "vitest";
import { tappaLeaders } from "../../src/utils/tappaLeaders";
import { DEFAULT_RULES } from "../../src/constants/rules";
import { tappaDiProva } from "./tappeDiProva";
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

describe("tappaLeaders: quali tabellini contano", () => {
  it("una partita non giocata non conta, nemmeno con un tabellino provvisorio", () => {
    // «Annulla risultato» rimette la partita da giocare e lascia il tabellino come bozza
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi", "Luca Bianchi"], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12 } } },
      { a: "Alfa", b: "Beta", done: false, sa: 0, sb: 0, pa: { "Mario Rossi": { pt: 30 }, "Luca Bianchi": { pt: 8 } } },
    ]);
    expect(tappaLeaders(t).map(({ nome, g, pt }) => ({ nome, g, pt }))).toEqual([{ nome: "Mario Rossi", g: 1, pt: 12 }]);
  });

  it("una partita giocata in parità conta: la parità riguarda la classifica, non i punti dei giocatori", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", sa: 15, sb: 15, pa: { "Mario Rossi": { pt: 15 } }, pb: { "Anna Verdi": { pt: 15 } } },
    ]);
    expect(tappaLeaders(t).map(({ nome, g, pt }) => ({ nome, g, pt }))).toEqual([
      { nome: "Mario Rossi", g: 1, pt: 15 },
      { nome: "Anna Verdi", g: 1, pt: 15 },
    ]);
  });

  it("salta i tabellini di chi non è nel roster e di chi non ha un nome (un posto vuoto del roster)", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi", ""], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12 }, "": { pt: 9 }, Sconosciuto: { pt: 3 } } },
    ]);
    expect(tappaLeaders(t).map((r) => r.nome)).toEqual(["Mario Rossi"]);
  });

  it("somma tutte e sette le statistiche, anche palle perse e falli; un valore mancante o non numerico vale 0", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12, rb: 3, as: 2, ru: 1, st: 1, pe: 4, fa: 3 } } },
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 3, rb: NaN } } },
    ]);
    // `pid` è l'id del roster: ogni giocatore di tappa ha il suo, anche se un altro porta lo stesso nome
    expect(tappaLeaders(t)).toEqual([
      { pid: "t1:Alfa:Mario Rossi", nome: "Mario Rossi", squadra: "Alfa", g: 2, pt: 15, rb: 3, as: 2, ru: 1, st: 1, pe: 4, fa: 3 },
    ]);
  });
});
