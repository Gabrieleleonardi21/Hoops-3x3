import { describe, it, expect } from "vitest";
import { raggruppaPerLega } from "../../src/utils/archivio";
import type { PubTappaMeta } from "../../src/types";

/** Una voce dell'elenco; `legaId` assente = server di prima della fase 12 (la chiave ricade sul nome della lega) */
const voce = (tappaId: string, lega: string, legaId?: string | null, ts = 1): PubTappaMeta => ({
  tappaId, nome: `Tappa ${tappaId}`, luogo: "", data: "", nSquadre: 0, lega, autore: "Anna", ts, legaId,
});

describe("raggruppaPerLega: le tappe dell'archivio per lega", () => {
  it("le tappe della stessa lega stanno insieme anche se nell'elenco sono separate", () => {
    const a = voce("a", "Estate", "l1");
    const b = voce("b", "Inverno", "l2");
    const c = voce("c", "Estate", "l1");
    expect(raggruppaPerLega([a, b, c])).toEqual([
      { chiave: "l1", lega: "Estate", voci: [a, c] },
      { chiave: "l2", lega: "Inverno", voci: [b] },
    ]);
  });

  it("senza legaId (server di prima, o null) la chiave è il nome della lega", () => {
    const a = voce("a", "Estate");
    const b = voce("b", "Estate", null);
    const c = voce("c", "Inverno");
    expect(raggruppaPerLega([a, b, c])).toEqual([
      { chiave: "Estate", lega: "Estate", voci: [a, b] },
      { chiave: "Inverno", lega: "Inverno", voci: [c] },
    ]);
  });

  it("l'ordine dei gruppi è quello della prima voce di ciascuno, cioè le leghe più recenti prima", () => {
    const voci = [voce("b", "Inverno", "l2"), voce("a", "Estate", "l1"), voce("c", "Inverno", "l2")];
    expect(raggruppaPerLega(voci).map((g) => g.lega)).toEqual(["Inverno", "Estate"]);
  });

  it("dentro un gruppo l'ordine resta quello del server: niente riordino per data o per nome", () => {
    const z = voce("z", "Estate", "l1", 9);
    const y = voce("y", "Inverno", "l2", 5);
    const a = voce("a", "Estate", "l1", 1);
    const gruppi = raggruppaPerLega([z, y, a]);
    expect(gruppi[0].voci).toEqual([z, a]);
  });

  it("il titolo è il nome della lega della voce più recente: una lega rinominata porta il nome di adesso", () => {
    const nuova = voce("n", "Estate 2026", "l1", 9);
    const vecchia = voce("v", "Estate", "l1", 1);
    const [gruppo] = raggruppaPerLega([nuova, vecchia]);
    expect(gruppo.lega).toBe("Estate 2026");
    expect(gruppo.voci).toEqual([nuova, vecchia]);
  });

  it("nessuna voce, nessun gruppo", () => {
    expect(raggruppaPerLega([])).toEqual([]);
  });
});
