import { describe, it, expect } from "vitest";
import {
  sorteggia, registraRisultato, registraRisultatoBracket, generaFasiDirette, concludi,
  aggiungiSquadra, rimuoviSquadra, impostaNumeroGironi,
} from "../../src/domain/tappaOps";
import type { Esito } from "../../src/domain/tappaOps";
import type { Tappa } from "../../src/types";

/** Tappa con 4 squadre e 2 gironi, non ancora sorteggiata (rank: Alfa 40, Beta 30, Gamma 20, Delta 10) */
function tappaNuova(): Tappa {
  return {
    id: "t1", nome: "Roma Open", luogo: "Roma", data: "2026-06-01", nGironi: 2,
    regole: { target: 21, durata: 10, ot: 2, shot: 12 },
    squadre: [
      { id: "a", nome: "Alfa", giocatori: [], rank: 40 },
      { id: "b", nome: "Beta", giocatori: [], rank: 30 },
      { id: "c", nome: "Gamma", giocatori: [], rank: 20 },
      { id: "d", nome: "Delta", giocatori: [], rank: 10 },
    ],
    gironi: null, partite: [], video: [],
  };
}

/** Tappa sorteggiata a mano: girone A = Alfa, Delta · girone B = Beta, Gamma (una partita per girone) */
function tappaSorteggiata(): Tappa {
  return {
    ...tappaNuova(),
    gironi: [["a", "d"], ["b", "c"]],
    partite: [
      { id: "m1", g: 0, a: "a", b: "d", sa: 0, sb: 0, done: false },
      { id: "m2", g: 1, a: "b", b: "c", sa: 0, sb: 0, done: false },
    ],
  };
}

/** Gironi conclusi: Alfa batte Delta 21-15, Gamma batte Beta 21-18 */
function tappaGironiConclusi(): Tappa {
  const t = tappaSorteggiata();
  return {
    ...t,
    partite: [
      { ...t.partite[0], sa: 21, sb: 15, done: true },
      { ...t.partite[1], sa: 18, sb: 21, done: true },
    ],
  };
}

/** Fase diretta già generata e ancora da giocare: SF1 Alfa-Beta, SF2 Delta-Gamma, finale da definire */
function tappaConBracket(): Tappa {
  return {
    ...tappaGironiConclusi(),
    bracket: [
      { id: "sf1", label: "Semifinale 1", squadraA: "a", squadraB: "b", pA: 0, pB: 0, done: false },
      { id: "sf2", label: "Semifinale 2", squadraA: "d", squadraB: "c", pA: 0, pB: 0, done: false },
      { id: "fin", label: "Finale", squadraA: null, squadraB: null, pA: 0, pB: 0, done: false },
    ],
  };
}

/** Estrae la tappa da un esito riuscito (fa fallire il test se l'operazione è stata rifiutata) */
function nuova(esito: Esito): Tappa {
  if (!esito.ok) throw new Error(`operazione rifiutata: ${esito.errore}`);
  return esito.tappa;
}

/** Estrae il messaggio da un esito rifiutato (fa fallire il test se l'operazione è riuscita) */
function errore(esito: Esito): string {
  if (esito.ok) throw new Error("operazione riuscita, ma doveva essere rifiutata");
  return esito.errore;
}

/** Verifica che della vecchia struttura non resti niente: né gironi, né calendario, né tabellone */
function senzaSorteggio(t: Tappa) {
  expect(t.gironi).toBeNull();
  expect(t.partite).toEqual([]);
  expect(t.bracket).toBeUndefined();
}

/** Tappa con `n` squadre, non ancora sorteggiata */
function tappaCon(n: number): Tappa {
  return { ...tappaNuova(), squadre: Array.from({ length: n }, (_, i) => ({ id: `q${i}`, nome: `Squadra ${i + 1}`, giocatori: [], rank: "" })) };
}

describe("sorteggia", () => {
  it("casuale: distribuisce tutte le squadre nei gironi e genera una partita per girone", () => {
    const t = nuova(sorteggia(tappaNuova(), "casuale"));
    expect(t.gironi!.map((g) => g.length)).toEqual([2, 2]);
    expect(t.gironi!.flat().sort()).toEqual(["a", "b", "c", "d"]);
    expect(t.partite).toHaveLength(2);
    expect(t.partite.every((m) => !m.done)).toBe(true);
  });

  it("ranking: teste di serie a serpentina (1ª e 4ª nel girone A, 2ª e 3ª nel B)", () => {
    const t = nuova(sorteggia(tappaNuova(), "ranking"));
    expect(t.gironi).toEqual([["a", "d"], ["b", "c"]]);
    expect(t.partite.map((m) => [m.g, m.a, m.b])).toEqual([[0, "a", "d"], [1, "b", "c"]]);
  });

  it("un nuovo sorteggio azzera i risultati già registrati", () => {
    const t = nuova(sorteggia(tappaGironiConclusi(), "ranking"));
    expect(t.partite.map((m) => [m.sa, m.sb, m.done])).toEqual([[0, 0, false], [0, 0, false]]);
  });

  it("R1 (sonda): dopo un nuovo sorteggio il tabellone del sorteggio precedente non c'è più", () => {
    const t = nuova(sorteggia(tappaConBracket(), "ranking"));
    expect(t.bracket).toBeUndefined();
  });

  it("non modifica la tappa ricevuta", () => {
    const originale = tappaNuova();
    sorteggia(originale, "casuale");
    expect(originale).toEqual(tappaNuova());
  });

  it("rifiuta una tappa con meno di 2 squadre", () => {
    const t = tappaNuova();
    t.squadre = [t.squadre[0]];
    expect(errore(sorteggia(t, "casuale"))).toMatch(/2 squadre/);
  });

  it("R3: con un numero di gironi non valido (tappe di prima) risponde con un messaggio invece di andare in errore", () => {
    expect(errore(sorteggia({ ...tappaNuova(), nGironi: 2.5 }, "casuale"))).toMatch(/Numero di gironi non valido/);
    expect(errore(sorteggia({ ...tappaNuova(), nGironi: 3 }, "ranking"))).toMatch(/da 1 a 2/);
  });
});

describe("registraRisultato (gironi)", () => {
  it("segna punteggio e partita conclusa, senza toccare le altre partite", () => {
    const t = nuova(registraRisultato(tappaSorteggiata(), "m1", { sa: 21, sb: 15 }));
    expect(t.partite[0]).toEqual({ id: "m1", g: 0, a: "a", b: "d", sa: 21, sb: 15, done: true });
    expect(t.partite[1]).toEqual({ id: "m2", g: 1, a: "b", b: "c", sa: 0, sb: 0, done: false });
  });

  it("salva le schede statistiche quando sono fornite", () => {
    const t = nuova(registraRisultato(tappaSorteggiata(), "m1", {
      sa: 21, sb: 15, pa: { p1: { pt: 21 } }, pb: { p2: { pt: 15, rb: 4 } },
    }));
    expect(t.partite[0].pa).toEqual({ p1: { pt: 21 } });
    expect(t.partite[0].pb).toEqual({ p2: { pt: 15, rb: 4 } });
  });

  it("senza schede (Coach AI) conserva quelle già presenti", () => {
    const partenza = tappaSorteggiata();
    partenza.partite[0].pa = { p1: { pt: 12 } };
    const t = nuova(registraRisultato(partenza, "m1", { sa: 21, sb: 15 }));
    expect(t.partite[0].pa).toEqual({ p1: { pt: 12 } });
  });

  it("rifiuta il pareggio", () => {
    expect(errore(registraRisultato(tappaSorteggiata(), "m1", { sa: 20, sb: 20 }))).toMatch(/pareggi/);
  });

  it.each([
    ["mancante", NaN, 15],
    ["negativo", 21, -1],
    ["non intero", 21.5, 15],
  ])("rifiuta un punteggio %s", (_caso, sa, sb) => {
    expect(errore(registraRisultato(tappaSorteggiata(), "m1", { sa, sb }))).toMatch(/entrambi i punteggi/);
  });

  it("accetta fino a 4 punti oltre il target e rifiuta i punteggi più alti", () => {
    expect(registraRisultato(tappaSorteggiata(), "m1", { sa: 25, sb: 23 }).ok).toBe(true);
    expect(errore(registraRisultato(tappaSorteggiata(), "m1", { sa: 26, sb: 24 }))).toMatch(/insolito/);
  });

  it("rifiuta una partita che non esiste", () => {
    expect(registraRisultato(tappaSorteggiata(), "inesistente", { sa: 21, sb: 15 }).ok).toBe(false);
  });

  it("non modifica la tappa ricevuta", () => {
    const originale = tappaSorteggiata();
    registraRisultato(originale, "m1", { sa: 21, sb: 15 });
    expect(originale).toEqual(tappaSorteggiata());
  });
});

describe("registraRisultatoBracket (fase a eliminazione diretta)", () => {
  it("registra la semifinale e porta il vincitore nel primo slot libero della finale", () => {
    const t = nuova(registraRisultatoBracket(tappaConBracket(), "sf1", 21, 17));
    expect(t.bracket![0]).toMatchObject({ id: "sf1", pA: 21, pB: 17, done: true });
    expect(t.bracket![2]).toMatchObject({ id: "fin", squadraA: "a", squadraB: null, done: false });
  });

  it("il vincitore della seconda semifinale completa la finale", () => {
    const dopoSf1 = nuova(registraRisultatoBracket(tappaConBracket(), "sf1", 21, 17));
    const t = nuova(registraRisultatoBracket(dopoSf1, "sf2", 15, 21));
    expect(t.bracket![2]).toMatchObject({ id: "fin", squadraA: "a", squadraB: "c" });
  });

  it("la finale si registra senza far avanzare nessuno", () => {
    const partenza = tappaConBracket();
    const semifinali = [
      { ...partenza.bracket![0], pA: 21, pB: 17, done: true },
      { ...partenza.bracket![1], pA: 15, pB: 21, done: true },
    ];
    partenza.bracket = [...semifinali, { ...partenza.bracket![2], squadraA: "a", squadraB: "c" }];
    const t = nuova(registraRisultatoBracket(partenza, "fin", 19, 21));
    expect(t.bracket![2]).toEqual({ id: "fin", label: "Finale", squadraA: "a", squadraB: "c", pA: 19, pB: 21, done: true });
    expect(t.bracket!.slice(0, 2)).toEqual(semifinali);
  });

  it("rifiuta il pareggio", () => {
    expect(errore(registraRisultatoBracket(tappaConBracket(), "sf1", 21, 21))).toMatch(/pareggi/);
  });

  it("rifiuta un punteggio mancante", () => {
    expect(registraRisultatoBracket(tappaConBracket(), "sf1", NaN, 21).ok).toBe(false);
  });

  it("rifiuta un match con le squadre ancora da definire", () => {
    expect(registraRisultatoBracket(tappaConBracket(), "fin", 21, 15).ok).toBe(false);
  });

  it("rifiuta un match già registrato: il vincitore non avanza due volte", () => {
    const dopoSf1 = nuova(registraRisultatoBracket(tappaConBracket(), "sf1", 21, 17));
    expect(registraRisultatoBracket(dopoSf1, "sf1", 10, 21).ok).toBe(false);
  });

  it("rifiuta un match che non esiste", () => {
    expect(registraRisultatoBracket(tappaConBracket(), "inesistente", 21, 15).ok).toBe(false);
  });

  it("non modifica la tappa ricevuta", () => {
    const originale = tappaConBracket();
    registraRisultatoBracket(originale, "sf1", 21, 17);
    expect(originale).toEqual(tappaConBracket());
  });
});

describe("generaFasiDirette", () => {
  it("incrocia le prime due di ogni girone: 1ªA-2ªB, 2ªA-1ªB, finale da definire", () => {
    const t = nuova(generaFasiDirette(tappaGironiConclusi()));
    expect(t.bracket!.map((m) => [m.label, m.squadraA, m.squadraB, m.done])).toEqual([
      ["Semifinale 1", "a", "b", false],
      ["Semifinale 2", "d", "c", false],
      ["Finale", null, null, false],
    ]);
  });

  it("con una sola qualificata per girone genera direttamente la finale", () => {
    const t = nuova(generaFasiDirette(tappaGironiConclusi(), 1));
    expect(t.bracket!.map((m) => [m.label, m.squadraA, m.squadraB])).toEqual([["Finale", "a", "c"]]);
  });

  it("rifiuta se i gironi non sono sorteggiati", () => {
    expect(generaFasiDirette(tappaNuova()).ok).toBe(false);
  });

  it("rifiuta se mancano partite dei gironi, indicando quante", () => {
    expect(errore(generaFasiDirette(tappaSorteggiata()))).toMatch(/2 partite/);
  });

  it("rifiuta se la fase diretta esiste già", () => {
    expect(errore(generaFasiDirette(tappaConBracket()))).toMatch(/già/);
  });

  it("rifiuta con un solo girone: non c'è incrocio possibile", () => {
    const t = tappaGironiConclusi();
    t.nGironi = 1;
    t.gironi = [["a", "d", "b", "c"]];
    expect(errore(generaFasiDirette(t))).toMatch(/2 gironi/);
  });
});

describe("concludi", () => {
  it("conclude una tappa con tutti i gironi registrati", () => {
    expect(nuova(concludi(tappaGironiConclusi())).conclusa).toBe(true);
  });

  it("rifiuta una tappa non sorteggiata", () => {
    expect(concludi(tappaNuova()).ok).toBe(false);
  });

  it("rifiuta se mancano partite dei gironi, indicando quante", () => {
    expect(errore(concludi(tappaSorteggiata()))).toMatch(/2 partite/);
  });

  it("rifiuta se la fase diretta è stata generata ma non è completa", () => {
    expect(errore(concludi(tappaConBracket()))).toMatch(/3 match/);
  });

  it("conclude quando anche la fase diretta è completa", () => {
    const partenza = tappaConBracket();
    partenza.bracket = [
      { ...partenza.bracket![0], pA: 21, pB: 17, done: true },
      { ...partenza.bracket![1], pA: 15, pB: 21, done: true },
      { ...partenza.bracket![2], squadraA: "a", squadraB: "c", pA: 19, pB: 21, done: true },
    ];
    expect(nuova(concludi(partenza)).conclusa).toBe(true);
  });

  it("non modifica la tappa ricevuta", () => {
    const originale = tappaGironiConclusi();
    concludi(originale);
    expect(originale.conclusa).toBeUndefined();
  });
});

describe("cambi di struttura: squadre e numero di gironi (R1)", () => {
  it("aggiungiSquadra aggiunge «Squadra N» e azzera gironi, calendario e tabellone", () => {
    const t = nuova(aggiungiSquadra(tappaConBracket()));
    expect(t.squadre).toHaveLength(5);
    expect(t.squadre[4]).toMatchObject({ nome: "Squadra 5", giocatori: [], rank: "" });
    senzaSorteggio(t);
  });

  it("aggiungiSquadra rifiuta la 65ª squadra", () => {
    expect(errore(aggiungiSquadra(tappaCon(64)))).toMatch(/da 2 a 64 squadre/);
  });

  it("rimuoviSquadra toglie la squadra e azzera gironi, calendario e tabellone", () => {
    const t = nuova(rimuoviSquadra(tappaConBracket(), "b"));
    expect(t.squadre.map((s) => s.id)).toEqual(["a", "c", "d"]);
    senzaSorteggio(t);
  });

  it("rimuoviSquadra non scende sotto le 2 squadre", () => {
    expect(errore(rimuoviSquadra(tappaCon(2), "q0"))).toMatch(/da 2 a 64 squadre/);
  });

  it("rimuoviSquadra rifiuta una squadra che non c'è", () => {
    expect(errore(rimuoviSquadra(tappaNuova(), "inesistente"))).toMatch(/non trovata/);
  });

  it("impostaNumeroGironi cambia il numero e azzera gironi, calendario e tabellone", () => {
    const t = nuova(impostaNumeroGironi(tappaConBracket(), 1));
    expect(t.nGironi).toBe(1);
    senzaSorteggio(t);
  });

  it("non modificano la tappa ricevuta", () => {
    const originale = tappaConBracket();
    aggiungiSquadra(originale);
    rimuoviSquadra(originale, "b");
    impostaNumeroGironi(originale, 1);
    expect(originale).toEqual(tappaConBracket());
  });
});

describe("numero di gironi: intero tra 1 e metà delle squadre, al massimo 32 (R3)", () => {
  it("sonda: lo stesso numero non cambia niente, sorteggio e risultati restano", () => {
    const partenza = tappaConBracket();
    expect(nuova(impostaNumeroGironi(partenza, 2))).toBe(partenza);
  });

  it.each([
    ["non intero", 2.5],
    ["zero", 0],
    ["oltre metà delle squadre", 3],
    ["mancante", NaN],
  ])("rifiuta un numero %s", (_caso, n) => {
    expect(errore(impostaNumeroGironi(tappaNuova(), n))).toMatch(/Numero di gironi non valido: con 4 squadre deve essere un intero da 1 a 2/);
  });

  it("al massimo 32 gironi, anche con più di 64 squadre (tappe di prima)", () => {
    expect(nuova(impostaNumeroGironi(tappaCon(70), 32)).nGironi).toBe(32);
    expect(errore(impostaNumeroGironi(tappaCon(70), 33))).toMatch(/da 1 a 32/);
  });

  it("togliendo squadre il numero di gironi scende, se serve, a metà delle squadre", () => {
    expect(nuova(rimuoviSquadra(tappaNuova(), "d")).nGironi).toBe(1);
    expect(nuova(rimuoviSquadra({ ...tappaCon(6), nGironi: 2 }, "q0")).nGironi).toBe(2);
  });
});
