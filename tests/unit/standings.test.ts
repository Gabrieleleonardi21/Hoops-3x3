import { describe, it, expect } from "vitest";
import { standings } from "../../src/utils/standings";
import type { Partita } from "../../src/types";

const nameOf = (id: string) => id.toUpperCase();
const match = (a: string, b: string, sa: number, sb: number): Partita =>
  ({ id: a + b, g: 0, a, b, sa, sb, done: true });

describe("standings (classifica girone)", () => {
  it("conta vittorie, sconfitte e punti fatti/subiti", () => {
    const rows = standings(["a", "b"], [match("a", "b", 21, 15)], nameOf);
    expect(rows[0]).toMatchObject({ id: "a", v: 1, p: 0, pf: 21, ps: 15 });
    expect(rows[1]).toMatchObject({ id: "b", v: 0, p: 1, pf: 15, ps: 21 });
  });

  it("ordina per vittorie, poi punti fatti", () => {
    const rows = standings(
      ["a", "b", "c"],
      [match("a", "b", 21, 10), match("c", "b", 21, 5), match("a", "c", 15, 21)],
      nameOf
    );
    // c: 2 vittorie; a: 1; b: 0
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("ignora le partite non ancora registrate", () => {
    const pending = { ...match("a", "b", 0, 0), done: false };
    const rows = standings(["a", "b"], [pending], nameOf);
    expect(rows.every((r) => r.g === 0)).toBe(true);
  });

  // Scontri diretti: a pari vittorie conta la mini-classifica delle sole partite giocate tra le squadre pari

  // Il girone si prova in due ordini d'ingresso: l'esito non deve dipendere da come le squadre sono elencate
  for (const girone of [["a", "b", "c"], ["c", "b", "a"]]) {
    it(`a pari vittorie decide lo scontro diretto, anche con meno punti fatti (girone ${girone.join(", ")})`, () => {
      // a e b hanno 1 vittoria: a ha battuto b di misura, ma b ha segnato di più (40 contro 21) e ha la differenza migliore
      const rows = standings(girone, [match("a", "b", 21, 19), match("b", "c", 21, 2)], nameOf);
      expect(rows.map((r) => r.v)).toEqual([1, 1, 0]);
      expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    });
  }

  it("tre squadre in cerchio: lo scontro diretto non separa nessuno, decidono i punti fatti e non la differenza", () => {
    // a batte b, b batte c, c batte a: 1 vittoria a testa. Punti fatti c 41, b 33, a 31; per differenza punti sarebbe c, a, b
    const cerchio = [match("a", "b", 21, 12), match("b", "c", 21, 20), match("c", "a", 21, 10)];
    const rows = standings(["a", "b", "c"], cerchio, nameOf);
    expect(rows.map((r) => r.v)).toEqual([1, 1, 1]);
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("se la mini-classifica separa solo in parte, si ricalcola solo tra le squadre ancora pari", () => {
    // Girone a metà (in uno completo da 4 la mini-classifica non può separare solo in parte): a>b, b>c, c>d, quindi
    // a, b e c hanno 1 vittoria. Tra loro a 1, b 1, c 0: c scende dietro; a e b restano pari e si ricalcola solo tra
    // loro, dove a ha battuto b. Con un solo passaggio avrebbero deciso i punti fatti (b 40, a 21) e b sarebbe davanti
    const partite = [match("a", "b", 21, 19), match("b", "c", 21, 5), match("c", "d", 15, 12)];
    expect(standings(["a", "b", "c", "d"], partite, nameOf).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("una partita segnata come giocata ma in parità è ignorata: né vittorie, né punti, né gara giocata", () => {
    // b-c è 15-15: tappaOps rifiuta i pareggi, ma un file importato o un salvataggio vecchio può averla (legaFile non la
    // controlla). Prima dava la vittoria a c, che passava davanti a b. G resta uguale a V + P
    const rows = standings(["a", "b", "c"], [match("a", "b", 21, 10), match("b", "c", 15, 15)], nameOf);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(rows[1]).toMatchObject({ id: "b", g: 1, v: 0, p: 1, pf: 10, ps: 21 });
    expect(rows[2]).toMatchObject({ id: "c", g: 0, v: 0, p: 0, pf: 0, ps: 0 });
  });

  it("una partita non ancora giocata non conta, nemmeno come scontro diretto", () => {
    // a e b hanno 1 vittoria. a-b è da giocare ma ha un punteggio provvisorio (una partita annullata lo tiene come bozza):
    // se contasse, b sarebbe davanti. Non conta: decidono i punti fatti (21 contro 20)
    const daGiocare = { ...match("a", "b", 10, 15), done: false };
    const rows = standings(["a", "b", "c"], [match("a", "c", 21, 5), match("b", "c", 20, 19), daGiocare], nameOf);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(rows.map((r) => r.g)).toEqual([1, 1, 2]);
  });

  it("a parità completa, anche dopo gli scontri diretti, resta l'ordine del girone", () => {
    // cerchio perfetto: 1 vittoria, 31 punti fatti e 31 subiti per tutte e tre
    const cerchio = [match("a", "b", 21, 10), match("b", "c", 21, 10), match("c", "a", 21, 10)];
    for (const girone of [["a", "b", "c"], ["c", "a", "b"]]) {
      expect(standings(girone, cerchio, nameOf).map((r) => r.id)).toEqual(girone);
    }
  });
});
