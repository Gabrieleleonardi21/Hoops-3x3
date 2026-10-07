import { describe, it, expect } from "vitest";
import { analyzePlayer3x3, DRILLS, type PlayerAnalysis } from "../../src/utils/analyzePlayer3x3";
import { DEFAULT_RULES } from "../../src/constants/rules";
import { tappaDiProva } from "./tappeDiProva";
import type { StatLine, Tappa } from "../../src/types";

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
    expect(a.migliorare.length).toBeLessThanOrEqual(3); // mai più di tre aree, comunque vada
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

/* ── Soglie esatte: per ognuna un valore appena sotto, uno esattamente sopra e uno appena dopo ── */

/** Il motivo di un'area proposta solo perché è la più bassa quando nessuna è sotto soglia: non è una carenza */
const MARGINE = "è l'area con più margine";

/** Stessi numeri per i due giocatori: ogni area ha rapporto 1 con la media della tappa, quindi niente da migliorare e nessun
 *  punto di forza. Ogni test cambia solo ciò che vuole provare */
const BASE: StatLine = { pt: 10, rb: 5, as: 5, ru: 4, st: 0, pe: 0, fa: 0 };

/** L'analisi di «Io» in una tappa con un solo altro giocatore, «Altro». Giocano `partite` partite a testa; i totali dati stanno nella
 *  prima e le altre sono vuote, così la media a partita è il totale diviso `partite` */
function analisi(io: StatLine, altro: StatLine = BASE, partite = 1): PlayerAnalysis {
  const nellaPartita = (totali: StatLine, i: number): StatLine => {
    if (i === 0) return totali;
    return {};
  };
  const gare = Array.from({ length: partite }, (_, i) => ({
    a: "Alfa", b: "Beta", pa: { Io: nellaPartita(io, i) }, pb: { Altro: nellaPartita(altro, i) },
  }));
  return analyzePlayer3x3(tappaDiProva("t", { Alfa: ["Io"], Beta: ["Altro"] }, gare), "t:Alfa:Io")!;
}

/** Le aree da migliorare per una carenza vera (non per essere la più bassa) */
const carenze = (a: PlayerAnalysis) => a.migliorare.filter((m) => !m.motivo.startsWith(MARGINE)).map((m) => m.area);

/** Area e statistica che la decide (la difesa somma recuperi e stoppate: qui si cambiano i recuperi, le stoppate sono 0) */
const AREE: [string, keyof StatLine][] = [
  ["Realizzazione", "pt"], ["Rimbalzo", "rb"], ["Creazione di gioco", "as"], ["Difesa", "ru"],
];

describe.each(AREE)("analyzePlayer3x3: %s rispetto alla media della tappa", (area, stat) => {
  // Io e Altro sommano sempre 200: la media della tappa è 100 e il rapporto di Io è il suo valore diviso 100
  const con = (valore: number) => analisi({ ...BASE, [stat]: valore }, { ...BASE, [stat]: 200 - valore });

  it("a 0,79 volte la media è da migliorare, con il suo motivo", () => {
    const a = con(79);
    expect(carenze(a)).toEqual([area]);
    expect(a.migliorare).toHaveLength(1);
  });

  it("a 0,80 esatto non è una carenza: resta solo come area con più margine", () => {
    const a = con(80);
    expect(carenze(a)).toEqual([]);
    expect(a.migliorare.map((m) => m.area)).toEqual([area]);
  });

  it("a 0,81 volte la media nemmeno", () => {
    const a = con(81);
    expect(carenze(a)).toEqual([]);
    expect(a.migliorare.map((m) => m.area)).toEqual([area]);
  });

  it("a 1,29 volte la media non è ancora un punto di forza", () => {
    expect(con(129).forti).toEqual([]);
  });

  it("a 1,30 esatto lo è (la soglia è inclusa)", () => {
    expect(con(130).forti).toEqual([area]);
  });

  it("a 1,31 volte la media lo è", () => {
    expect(con(131).forti).toEqual([area]);
  });
});

describe("analyzePlayer3x3: media della tappa molto bassa", () => {
  it("sotto 0,3 a partita si divide per 0,3, non per la media: chi ha la stessa media bassa degli altri è da migliorare", () => {
    // 2 rimbalzi in 10 partite per tutti e due = 0,2 a partita. 0,2 / 0,3 = 0,67; diviso per la media sarebbe 1
    expect(carenze(analisi({ ...BASE, rb: 2 }, { ...BASE, rb: 2 }, 10))).toEqual(["Rimbalzo"]);
  });

  it("a 0,3 esatto si divide per la media: stessa media degli altri, rapporto 1, nessuna carenza", () => {
    expect(carenze(analisi({ ...BASE, rb: 3 }, { ...BASE, rb: 3 }, 10))).toEqual([]);
  });
});

describe("analyzePlayer3x3: palle perse (da 1 a partita e più degli assist)", () => {
  /** Io senza assist, così la regola «più degli assist» è sempre vera e conta solo la soglia di 1 a partita */
  const conPerse = (totale: number) => analisi({ ...BASE, as: 0, pe: totale }, BASE, 10).migliorare.map((m) => m.area);

  it("a 0,9 a partita non è segnalata", () => {
    expect(conPerse(9)).not.toContain("Gestione del possesso");
  });

  it("a 1,0 esatto lo è (la soglia è inclusa)", () => {
    expect(conPerse(10)).toContain("Gestione del possesso");
  });

  it("a 1,1 a partita lo è", () => {
    expect(conPerse(11)).toContain("Gestione del possesso");
  });

  it("con tante palle perse quanti gli assist non è segnalata: servono strettamente di più", () => {
    // 2 assist e 2 palle perse a partita: la soglia di 1 a partita è superata, ma le perse non sono più degli assist
    expect(analisi({ ...BASE, as: 2, pe: 2 }).migliorare.map((m) => m.area)).not.toContain("Gestione del possesso");
  });

  it("con una palla persa in più degli assist lo è", () => {
    expect(analisi({ ...BASE, as: 2, pe: 3 }).migliorare.map((m) => m.area)).toContain("Gestione del possesso");
  });
});

describe("analyzePlayer3x3: falli (da 2,5 a partita)", () => {
  const conFalli = (totale: number) => analisi({ ...BASE, fa: totale }, BASE, 10).migliorare.map((m) => m.area);

  it("a 2,4 a partita non sono segnalati", () => {
    expect(conFalli(24)).not.toContain("Disciplina nei falli");
  });

  it("a 2,5 esatto lo sono (la soglia è inclusa)", () => {
    expect(conFalli(25)).toContain("Disciplina nei falli");
  });

  it("a 2,6 a partita lo sono", () => {
    expect(conFalli(26)).toContain("Disciplina nei falli");
  });
});

describe("analyzePlayer3x3: al massimo tre aree da migliorare", () => {
  it("con le quattro aree sotto soglia propone le tre peggiori, dalla più bassa", () => {
    // Rapporti con la media (Io e Altro sommano 200): Realizzazione 0,7, Rimbalzo 0,6, Creazione 0,5, Difesa 0,4
    const a = analisi(
      { ...BASE, pt: 70, rb: 60, as: 50, ru: 40 },
      { ...BASE, pt: 130, rb: 140, as: 150, ru: 160 },
    );
    expect(a.migliorare.map((m) => m.area)).toEqual(["Difesa", "Creazione di gioco", "Rimbalzo"]);
  });

  it("palle perse e falli vengono prima e occupano due posti: delle altre aree resta solo la peggiore", () => {
    // Io non ha assist: oltre a palle perse e falli sono sotto soglia tutte e quattro le aree, ma il posto è uno
    const a = analisi({ ...BASE, pt: 70, rb: 60, as: 0, ru: 40, pe: 3, fa: 3 }, { ...BASE, pt: 130, rb: 140, as: 10, ru: 160 });
    expect(a.migliorare.map((m) => m.area)).toEqual(["Gestione del possesso", "Disciplina nei falli", "Creazione di gioco"]);
  });
});
