import { describe, it, expect } from "vitest";
import { buildBracket, nextBracketSlot } from "../../src/utils/buildBracket";
import { buildMatches } from "../../src/utils/buildMatches";
import type { BracketMatch, Partita, SquadraTappa } from "../../src/types";

const sq = (id: string): SquadraTappa => ({ id, nome: id.toUpperCase(), giocatori: [], rank: "" });

/** Gironi "a1,a2,…": in ogni girone vince sempre la squadra con il numero più basso */
function torneo(nGironi: number, perGirone: number) {
  const lettere = "abcdefgh";
  const gironi = Array.from({ length: nGironi }, (_, g) =>
    Array.from({ length: perGirone }, (_, i) => `${lettere[g]}${i + 1}`));
  const partite: Partita[] = buildMatches(gironi).map((m) => {
    const vinceA = m.a < m.b;
    return { ...m, sa: vinceA ? 21 : 10, sb: vinceA ? 10 : 21, done: true };
  });
  return { gironi, partite, squadre: gironi.flat().map(sq) };
}
const girone = (id: string | null) => id?.[0];
const inGara = (b: BracketMatch[]) => b.flatMap((m) => [m.squadraA, m.squadraB]).filter((x): x is string => x !== null);
const primoTurno = (b: BracketMatch[]) => b.slice(0, (b.length + 1) / 2);

describe("buildBracket (fase a eliminazione diretta)", () => {
  it("2 gironi, 2 qualificate: semifinali incrociate (1ªA-2ªB, 1ªB-2ªA) e finale", () => {
    const t = torneo(2, 4);
    const b = buildBracket(t.gironi, t.partite, t.squadre);
    expect(b.map((m) => m.label)).toEqual(["Semifinale 1", "Semifinale 2", "Finale"]);
    const coppie = b.slice(0, 2).map((m) => [m.squadraA, m.squadraB].sort().join("-")).sort();
    expect(coppie).toEqual(["a1-b2", "a2-b1"]);
    expect(b[2]).toMatchObject({ squadraA: null, squadraB: null, done: false });
  });

  it("3 gironi, 2 qualificate: nessuna qualificata resta fuori, le 2 migliori prime passano il turno", () => {
    const t = torneo(3, 4);
    const b = buildBracket(t.gironi, t.partite, t.squadre);
    expect(b).toHaveLength(7); // 4 quarti + 2 semifinali + finale
    expect(new Set(inGara(b))).toEqual(new Set(["a1", "a2", "b1", "b2", "c1", "c2"]));
    const bye = primoTurno(b).filter((m) => m.bye);
    expect(bye).toHaveLength(2);
    bye.forEach((m) => expect(m.done).toBe(true));
    // chi passa d'ufficio è già nella semifinale
    const semifinaliste = b.slice(4, 6).flatMap((m) => [m.squadraA, m.squadraB]).filter(Boolean);
    expect(semifinaliste).toHaveLength(2);
  });

  it("4 gironi, 2 qualificate: 4 quarti con tutte le 8 squadre, mai due dello stesso girone", () => {
    const t = torneo(4, 3);
    const b = buildBracket(t.gironi, t.partite, t.squadre);
    expect(b.map((m) => m.label).slice(0, 4)).toEqual([1, 2, 3, 4].map((n) => `Quarto di finale ${n}`));
    expect(inGara(b)).toHaveLength(8);
    primoTurno(b).forEach((m) => expect(girone(m.squadraA)).not.toBe(girone(m.squadraB)));
    // ogni quarto ha una prima classificata contro una seconda
    primoTurno(b).forEach((m) => expect([m.squadraA?.[1], m.squadraB?.[1]].sort()).toEqual(["1", "2"]));
  });

  it("2 gironi, 4 qualificate: quarti incrociati 1ª-4ª e 2ª-3ª", () => {
    const t = torneo(2, 4);
    const b = buildBracket(t.gironi, t.partite, t.squadre, 4);
    const coppie = primoTurno(b).map((m) => [m.squadraA, m.squadraB].sort().join("-")).sort();
    expect(coppie).toEqual(["a1-b4", "a2-b3", "a3-b2", "a4-b1"]);
  });

  it("3 gironi, 1 qualificata: la migliore prima va in finale, le altre due si giocano l'altro posto", () => {
    const t = torneo(3, 3);
    const b = buildBracket(t.gironi, t.partite, t.squadre, 1);
    expect(b).toHaveLength(3);
    expect(b.filter((m) => m.bye)).toHaveLength(1);
    expect(b[2].label).toBe("Finale");
    expect([b[2].squadraA, b[2].squadraB].filter(Boolean)).toHaveLength(1);
  });

  it("2 gironi, 3 qualificate: 6 squadre in un tabellone da 8, ogni semifinale si può riempire", () => {
    const t = torneo(2, 4);
    const b = buildBracket(t.gironi, t.partite, t.squadre, 3);
    expect(b).toHaveLength(7);
    expect(new Set(inGara(b)).size).toBe(6);
    primoTurno(b).filter((m) => !m.bye).forEach((m) => expect(girone(m.squadraA)).not.toBe(girone(m.squadraB)));
  });

  it("un solo girone: nessun tabellone", () => {
    const t = torneo(1, 4);
    expect(buildBracket(t.gironi, t.partite, t.squadre)).toEqual([]);
  });

  it("gli id dei match sono tutti diversi", () => {
    const t = torneo(4, 3);
    const b = buildBracket(t.gironi, t.partite, t.squadre);
    expect(new Set(b.map((m) => m.id)).size).toBe(b.length);
  });
});

describe("nextBracketSlot (avanzamento per posizione)", () => {
  /** Gioca il match di indice `i`: vince sempre squadraA */
  function gioca(b: BracketMatch[], i: number): BracketMatch[] {
    const m = b[i];
    let out = b.map((x) => (x.id === m.id ? { ...x, pA: 21, pB: 10, done: true } : x));
    const next = nextBracketSlot(out, m.id, m.squadraA);
    if (next) out = out.map((x) => (x.id === next.id ? { ...x, ...next.patch } : x));
    return out;
  }

  it("i vincitori dei quarti 1 e 2 si incontrano in semifinale 1 qualunque sia l'ordine dei risultati", () => {
    const t = torneo(2, 4);
    const base = buildBracket(t.gironi, t.partite, t.squadre, 4);
    const inOrdine = [0, 1, 2, 3].reduce(gioca, base);
    const sparso = [2, 0, 3, 1].reduce(gioca, base);
    const semi = (b: BracketMatch[]) => b.slice(4, 6).map((m) => [m.squadraA, m.squadraB]);
    expect(semi(sparso)).toEqual(semi(inOrdine));
    expect(semi(inOrdine)[0]).toEqual([base[0].squadraA, base[1].squadraA]);
  });

  it("tabellone iniziato con la vecchia logica: non sovrascrive un posto già occupato", () => {
    const vecchio: BracketMatch[] = [
      { id: "sf1", label: "Semifinale 1", squadraA: "1A", squadraB: "2B", pA: 0, pB: 0, done: false },
      { id: "sf2", label: "Semifinale 2", squadraA: "2A", squadraB: "1B", pA: 21, pB: 15, done: true },
      { id: "fin", label: "Finale", squadraA: "2A", squadraB: null, pA: 0, pB: 0, done: false }, // la vecchia logica ha messo 2A nel posto A
    ];
    expect(nextBracketSlot(vecchio, "sf1", "1A")).toEqual({ id: "fin", patch: { squadraB: "1A" } });
  });
});
