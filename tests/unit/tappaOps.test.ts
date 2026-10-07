import { describe, it, expect, vi, afterEach } from "vitest";
import {
  sorteggia, registraRisultato, registraRisultatoBracket, generaFasiDirette, concludi,
  aggiungiSquadra, rimuoviSquadra, impostaNumeroGironi, perditaRisultati, annullaRisultato, rinominaTappa,
  erroreLimitiTappa, erroreTestiTappa, creaTappa,
  perditaTappa, perditaTabellone, perditaSquadra, eSegnaposto,
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
  afterEach(() => vi.useRealTimers());

  it("segna punteggio e partita conclusa, senza toccare le altre partite", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_781_000_000_000);
    const t = nuova(registraRisultato(tappaSorteggiata(), "m1", { sa: 21, sb: 15 }));
    expect(t.partite[0]).toEqual({ id: "m1", g: 0, a: "a", b: "d", sa: 21, sb: 15, done: true, ts: 1_781_000_000_000 });
    expect(t.partite[1]).toEqual({ id: "m2", g: 1, a: "b", b: "c", sa: 0, sb: 0, done: false });
  });

  it("FD-10: il momento della registrazione (ts) dà l'ordine d'inserimento; correggere il risultato lo aggiorna", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    let t = nuova(registraRisultato(tappaSorteggiata(), "m2", { sa: 21, sb: 10 }));
    vi.setSystemTime(2000);
    t = nuova(registraRisultato(t, "m1", { sa: 21, sb: 15 }));
    expect(t.partite.map((m) => m.ts)).toEqual([2000, 1000]); // m1 è prima nel calendario, ma m2 è stata registrata prima
    vi.setSystemTime(3000);
    t = nuova(registraRisultato(nuova(annullaRisultato(t, "m2")), "m2", { sa: 21, sb: 12 })); // «Correggi» e nuovo salvataggio
    expect(t.partite.map((m) => m.ts)).toEqual([2000, 3000]);
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

describe("annullaRisultato (gironi): «Correggi» dell'interfaccia e annulla_risultato del Coach", () => {
  it("riporta la partita a da giocare, senza toccare le altre", () => {
    const t = nuova(annullaRisultato(tappaGironiConclusi(), "m1"));
    expect(t.partite[0]).toMatchObject({ id: "m1", done: false });
    expect(t.partite[1]).toEqual(tappaGironiConclusi().partite[1]);
  });

  it("rifiuta una partita che non esiste", () => {
    expect(errore(annullaRisultato(tappaGironiConclusi(), "inesistente"))).toMatch(/non trovata/);
  });

  it("non modifica la tappa ricevuta", () => {
    const originale = tappaGironiConclusi();
    annullaRisultato(originale, "m1");
    expect(originale).toEqual(tappaGironiConclusi());
  });
});

describe("risultati dei gironi con la fase finale già generata (R6)", () => {
  it("annullare un risultato è rifiutato: prima va eliminata la fase finale", () => {
    expect(errore(annullaRisultato(tappaConBracket(), "m1"))).toMatch(/elimina prima la fase finale/);
  });

  it("anche correggerlo registrandolo di nuovo è rifiutato", () => {
    expect(errore(registraRisultato(tappaConBracket(), "m1", { sa: 21, sb: 10 }))).toMatch(/elimina prima la fase finale/);
  });

  it("FD-10: il messaggio dice con quale pulsante si elimina il tabellone: «Elimina bracket e ricomincia»", () => {
    expect(errore(annullaRisultato(tappaConBracket(), "m1"))).toContain("«Elimina bracket e ricomincia»");
    expect(errore(registraRisultato(tappaConBracket(), "m1", { sa: 21, sb: 10 }))).toContain("«Elimina bracket e ricomincia»");
  });

  it("il rifiuto non cambia la tappa: i risultati dei gironi e il tabellone restano com'erano", () => {
    const t = tappaConBracket();
    annullaRisultato(t, "m1");
    registraRisultato(t, "m1", { sa: 21, sb: 10 });
    expect(t).toEqual(tappaConBracket());
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

  it("rifiuta un punteggio mancante con il messaggio che l'interfaccia mostra (R4)", () => {
    expect(errore(registraRisultatoBracket(tappaConBracket(), "sf1", NaN, 21))).toBe("Inserisci entrambi i punteggi.");
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

describe("perditaRisultati: che cosa cancellano un nuovo sorteggio o un cambio di struttura (R2)", () => {
  it("senza risultati non c'è niente da confermare, anche a sorteggio fatto", () => {
    expect(perditaRisultati(tappaNuova())).toBeNull();
    expect(perditaRisultati(tappaSorteggiata())).toBeNull();
  });

  it("con risultati dice quanti se ne perdono", () => {
    expect(perditaRisultati(tappaGironiConclusi())).toBe("Verranno eliminati il sorteggio e 2 risultati.");
    const unRisultato = nuova(registraRisultato(tappaSorteggiata(), "m1", { sa: 21, sb: 15 }));
    expect(perditaRisultati(unRisultato)).toBe("Verranno eliminati il sorteggio e 1 risultato.");
  });

  it("conta anche le gare della fase finale, non i turni superati d'ufficio, e la nomina", () => {
    const partenza = tappaConBracket();
    partenza.bracket = [
      { ...partenza.bracket![0], pA: 21, pB: 17, done: true },
      { id: "bye", label: "Turno 1 · Gara 3", squadraA: "c", squadraB: null, pA: 0, pB: 0, done: true, bye: true },
      ...partenza.bracket!.slice(1),
    ];
    expect(perditaRisultati(partenza)).toBe("Verranno eliminati il sorteggio, la fase finale e 3 risultati.");
  });
});

describe("eSegnaposto: il nome provvisorio delle squadre appena aggiunte", () => {
  it("«Squadra N» è un segnaposto (anche con gli spazi ai lati); ogni altro nome è scritto da qualcuno", () => {
    expect(eSegnaposto("Squadra 3")).toBe(true);
    expect(eSegnaposto("  Squadra 12 ")).toBe(true);
    for (const nome of ["", "Squadra", "Squadra 3A", "squadra 3", "Falchi", "Squadra Tre"]) {
      expect(eSegnaposto(nome)).toBe(false);
    }
  });
});

describe("perditaTappa: che cosa cancella «Elimina» (si chiede sempre)", () => {
  it("una tappa non sorteggiata perde il nome e le squadre", () => {
    expect(perditaTappa(tappaNuova())).toBe("Verrà eliminata la tappa «Roma Open» con 4 squadre.");
  });

  it("con il sorteggio ma senza risultati dice anche il sorteggio", () => {
    expect(perditaTappa(tappaSorteggiata())).toBe("Verranno eliminati la tappa «Roma Open» con 4 squadre e il sorteggio.");
  });

  it("con i risultati dice quanti; con la fase finale la nomina", () => {
    expect(perditaTappa(tappaGironiConclusi())).toBe("Verranno eliminati la tappa «Roma Open» con 4 squadre, il sorteggio e 2 risultati.");
    expect(perditaTappa(tappaConBracket()))
      .toBe("Verranno eliminati la tappa «Roma Open» con 4 squadre, il sorteggio, la fase finale e 2 risultati.");
  });

  it("i numeri sono quelli veri: un risultato è «1 risultato»; i turni superati d'ufficio non contano", () => {
    const unRisultato = nuova(registraRisultato(tappaSorteggiata(), "m1", { sa: 21, sb: 15 }));
    expect(perditaTappa(unRisultato)).toBe("Verranno eliminati la tappa «Roma Open» con 4 squadre, il sorteggio e 1 risultato.");
    const conBye = tappaConBracket();
    conBye.bracket = [{ id: "bye", label: "Turno 1 · Gara 3", squadraA: "c", squadraB: null, pA: 0, pB: 0, done: true, bye: true }];
    expect(perditaTappa(conBye)).toBe("Verranno eliminati la tappa «Roma Open» con 4 squadre, il sorteggio, la fase finale e 2 risultati.");
  });

  it("una tappa senza nome (dati vecchi dell'ospite) si nomina senza le virgolette vuote", () => {
    expect(perditaTappa({ ...tappaNuova(), nome: "  " })).toBe("Verrà eliminata la tappa con 4 squadre.");
  });
});

describe("perditaTabellone: che cosa cancella «Elimina bracket e ricomincia» (si chiede sempre)", () => {
  /** Il tabellone con `n` match registrati: la prima semifinale, poi la seconda */
  const conRisultati = (n: number): Tappa => {
    const t = tappaConBracket();
    t.bracket = t.bracket!.map((m, i) => {
      if (i < n) return { ...m, pA: 21, pB: 15, done: true };
      return m;
    });
    return t;
  };

  it("senza risultati nel tabellone cancella solo il tabellone", () => {
    expect(perditaTabellone(conRisultati(0))).toBe("Verrà eliminato il tabellone. I risultati dei gironi restano.");
  });

  it("con dei risultati dice quanti: solo quelli della fase finale, non quelli dei gironi", () => {
    expect(perditaTabellone(conRisultati(1))).toBe("Verranno eliminati il tabellone e 1 risultato. I risultati dei gironi restano.");
    expect(perditaTabellone(conRisultati(2))).toBe("Verranno eliminati il tabellone e 2 risultati. I risultati dei gironi restano.");
  });

  it("i turni superati d'ufficio non sono risultati", () => {
    const t = conRisultati(0);
    t.bracket = [...t.bracket!, { id: "bye", label: "Turno 1 · Gara 3", squadraA: "c", squadraB: null, pA: 0, pB: 0, done: true, bye: true }];
    expect(perditaTabellone(t)).toBe("Verrà eliminato il tabellone. I risultati dei gironi restano.");
  });
});

describe("perditaSquadra: che cosa cancella «Rimuovi squadra» (si chiede solo se si perde qualcosa)", () => {
  /** La tappa con tutte le squadre dal nome provvisorio e senza giocatori, come appena create */
  const appenaCreata = (t: Tappa): Tappa => ({
    ...t, squadre: t.squadre.map((s, i) => ({ ...s, nome: `Squadra ${i + 1}`, giocatori: [] })),
  });
  /** La tappa con la squadra `id` cambiata (le altre restano com'erano) */
  const conSquadra = (t: Tappa, id: string, cambia: Partial<Tappa["squadre"][number]>): Tappa => ({
    ...t,
    squadre: t.squadre.map((s) => {
      if (s.id !== id) return s;
      return { ...s, ...cambia };
    }),
  });
  const giocatori = (...nomi: string[]) => nomi.map((nome, i) => ({ id: `p${i}`, nome }));

  it("una squadra appena aggiunta (nome provvisorio, nessun giocatore) si toglie senza chiedere", () => {
    expect(perditaSquadra(appenaCreata(tappaNuova()), "d")).toBeNull();
  });

  it("anche con il sorteggio fatto, se non ci sono risultati: il sorteggio si rifà senza perdere niente", () => {
    expect(perditaSquadra(appenaCreata(tappaSorteggiata()), "d")).toBeNull();
  });

  it("i giocatori con il nome vuoto o di soli spazi non contano: sono righe del roster ancora da compilare", () => {
    expect(perditaSquadra(conSquadra(appenaCreata(tappaNuova()), "d", { giocatori: giocatori("", "  ") }), "d")).toBeNull();
  });

  it("un nome scritto si perde: la squadra si nomina", () => {
    expect(perditaSquadra(conSquadra(appenaCreata(tappaNuova()), "d", { nome: "Falchi" }), "d"))
      .toBe("Verrà eliminata la squadra «Falchi».");
  });

  it("i giocatori con il nome si perdono: si dice quanti, anche con il nome provvisorio", () => {
    const t = appenaCreata(tappaNuova());
    expect(perditaSquadra(conSquadra(t, "d", { giocatori: giocatori("Mario", "Luigi", "") }), "d"))
      .toBe("Verrà eliminata la squadra «Squadra 4» con 2 giocatori.");
    expect(perditaSquadra(conSquadra(t, "d", { nome: "Falchi", giocatori: giocatori("Mario") }), "d"))
      .toBe("Verrà eliminata la squadra «Falchi» con 1 giocatore.");
  });

  it("senza nome (campo svuotato) ma con giocatori la squadra si nomina senza le virgolette vuote", () => {
    expect(perditaSquadra(conSquadra(appenaCreata(tappaNuova()), "d", { nome: "", giocatori: giocatori("Mario") }), "d"))
      .toBe("Verrà eliminata la squadra con 1 giocatore.");
  });

  it("con dei risultati si chiede sempre, anche per una squadra vuota: si perdono il sorteggio e i risultati", () => {
    expect(perditaSquadra(appenaCreata(tappaGironiConclusi()), "d"))
      .toBe("Verranno eliminati la squadra «Squadra 4», il sorteggio e 2 risultati.");
  });

  it("nome, giocatori, sorteggio, fase finale e risultati: dice tutto, con i numeri veri", () => {
    const t = conSquadra(appenaCreata(tappaConBracket()), "d", { nome: "Falchi", giocatori: giocatori("Mario", "Luigi", "Anna") });
    expect(perditaSquadra(t, "d"))
      .toBe("Verranno eliminati la squadra «Falchi» con 3 giocatori, il sorteggio, la fase finale e 2 risultati.");
  });

  it("con il sorteggio ma senza risultati, se si chiede per il nome, dice anche il sorteggio che si perde", () => {
    expect(perditaSquadra(conSquadra(appenaCreata(tappaSorteggiata()), "d", { nome: "Falchi" }), "d"))
      .toBe("Verranno eliminati la squadra «Falchi» e il sorteggio.");
  });

  it("una squadra che non c'è non fa chiedere niente", () => {
    expect(perditaSquadra(tappaGironiConclusi(), "inesistente")).toBeNull();
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

describe("una tappa conclusa non si modifica (R5)", () => {
  /** La stessa tappa, conclusa e pubblicata */
  const conclusa = (t: Tappa): Tappa => ({ ...t, conclusa: true });

  // Ogni operazione, sulla stessa tappa non conclusa, riuscirebbe: l'unico motivo del rifiuto è la conclusione
  it.each<[string, () => Esito]>([
    ["sorteggia (sonda: sorteggio su una tappa conclusa)", () => sorteggia(conclusa(tappaGironiConclusi()), "casuale")],
    ["registraRisultato", () => registraRisultato(conclusa(tappaSorteggiata()), "m1", { sa: 21, sb: 15 })],
    ["annullaRisultato", () => annullaRisultato(conclusa(tappaGironiConclusi()), "m1")],
    ["registraRisultatoBracket", () => registraRisultatoBracket(conclusa(tappaConBracket()), "sf1", 21, 17)],
    ["generaFasiDirette", () => generaFasiDirette(conclusa(tappaGironiConclusi()))],
    ["concludi", () => concludi(conclusa(tappaGironiConclusi()))],
    ["aggiungiSquadra", () => aggiungiSquadra(conclusa(tappaGironiConclusi()))],
    ["rimuoviSquadra", () => rimuoviSquadra(conclusa(tappaGironiConclusi()), "b")],
    ["impostaNumeroGironi", () => impostaNumeroGironi(conclusa(tappaGironiConclusi()), 1)],
    ["rinominaTappa", () => rinominaTappa(conclusa(tappaGironiConclusi()), "Milano Open")],
  ])("%s è rifiutata", (_operazione, esegui) => {
    expect(errore(esegui())).toBe("La tappa è conclusa: riaprila per modificarla.");
  });
});

describe("rinominaTappa: il nome della tappa non è mai vuoto (R7)", () => {
  it("rifiuta un nome vuoto o di soli spazi", () => {
    expect(errore(rinominaTappa(tappaNuova(), ""))).toMatch(/non può essere vuoto/);
    expect(errore(rinominaTappa(tappaNuova(), "   "))).toMatch(/non può essere vuoto/);
  });

  it("salva il nome senza spazi ai lati; lo stesso nome non cambia niente", () => {
    expect(nuova(rinominaTappa(tappaNuova(), "  Milano Open ")).nome).toBe("Milano Open");
    const partenza = tappaNuova();
    expect(nuova(rinominaTappa(partenza, "Roma Open"))).toBe(partenza);
  });
});

describe("creazione della tappa: stessi limiti per interfaccia e Coach (R8)", () => {
  /** Dati di una tappa nuova con `n` squadre segnaposto */
  const dati = (n: number, nGironi: number) => ({ nome: "Napoli Open", luogo: " Napoli ", data: "2026-07-01", nGironi, squadre: tappaCon(n).squadre });
  /** Nome, luogo e data validi */
  const testi = { nome: "Napoli Open", luogo: "Napoli", data: "2026-07-01" };

  it("da 2 a 64 squadre e un numero di gironi intero tra 1 e metà delle squadre", () => {
    expect(erroreLimitiTappa(2, 1, testi)).toBeNull();
    expect(erroreLimitiTappa(64, 32, testi)).toBeNull();
    expect(erroreLimitiTappa(1, 1, testi)).toMatch(/da 2 a 64 squadre/);
    expect(erroreLimitiTappa(65, 2, testi)).toMatch(/da 2 a 64 squadre/);
    expect(erroreLimitiTappa(8.5, 2, testi)).toMatch(/da 2 a 64 squadre/);
    expect(erroreLimitiTappa(8, 2.5, testi)).toMatch(/Numero di gironi non valido: con 8 squadre deve essere un intero da 1 a 4/);
    expect(erroreLimitiTappa(8, 5, testi)).toMatch(/da 1 a 4/);
  });

  it("nome fino a 120 caratteri, luogo fino a 160 e data vuota o aaaa-mm-gg: gli stessi limiti del server", () => {
    const limiti = (cambia: Partial<typeof testi>) => erroreLimitiTappa(8, 2, { ...testi, ...cambia });
    expect(limiti({ nome: "N".repeat(120) })).toBeNull();
    expect(limiti({ nome: ` ${"N".repeat(120)} ` })).toBeNull(); // contano senza gli spazi ai lati, come li salva creaTappa
    expect(limiti({ nome: "N".repeat(121) })).toBe("Il nome della tappa può avere al massimo 120 caratteri.");
    expect(limiti({ luogo: "L".repeat(160) })).toBeNull();
    expect(limiti({ luogo: "L".repeat(161) })).toBe("Il luogo può avere al massimo 160 caratteri.");
    expect(limiti({ data: "" })).toBeNull();
    expect(limiti({ data: "2026-06-14" })).toBeNull();
    expect(limiti({ data: "14/06/2026" })).toBe("La data deve essere vuota oppure nel formato aaaa-mm-gg (per esempio 2026-06-14).");
    expect(limiti({ data: "2026-6-14" })).toMatch(/aaaa-mm-gg/);
  });

  it("crea una tappa non sorteggiata, con le regole predefinite", () => {
    const t = nuova(creaTappa(dati(8, 2)));
    expect(t).toMatchObject({
      nome: "Napoli Open", luogo: "Napoli", data: "2026-07-01", nGironi: 2,
      regole: { target: 21, durata: 10, ot: 2, shot: 12 }, gironi: null, partite: [], video: [],
    });
    expect(t.squadre).toHaveLength(8);
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rifiuta squadre fuori dai limiti, un numero di gironi non intero e un nome vuoto", () => {
    expect(errore(creaTappa(dati(1, 1)))).toMatch(/da 2 a 64 squadre/);
    expect(errore(creaTappa(dati(65, 2)))).toMatch(/da 2 a 64 squadre/);
    expect(errore(creaTappa(dati(8, 2.5)))).toMatch(/Numero di gironi non valido/);
    expect(errore(creaTappa({ ...dati(8, 2), nome: "  " }))).toMatch(/non può essere vuoto/);
  });

  it("rifiuta una data che il server non accetterebbe: la tappa non si potrebbe mai salvare", () => {
    expect(errore(creaTappa({ ...dati(8, 2), data: "14/06/2026" }))).toMatch(/aaaa-mm-gg/);
  });
});

describe("limiti dei testi di una tappa: gli stessi per la creazione e per l'import di una lega", () => {
  const testi = { nome: "Napoli Open", luogo: "Napoli", data: "2026-07-01" };
  const limiti = (cambia: Partial<typeof testi>) => erroreTestiTappa({ ...testi, ...cambia });

  it("nome fino a 120 caratteri, luogo fino a 160 e data vuota o aaaa-mm-gg, contando senza gli spazi ai lati", () => {
    expect(limiti({})).toBeNull();
    expect(limiti({ nome: ` ${"N".repeat(120)} ` })).toBeNull();
    expect(limiti({ nome: "N".repeat(121) })).toBe("Il nome della tappa può avere al massimo 120 caratteri.");
    expect(limiti({ luogo: "L".repeat(160) })).toBeNull();
    expect(limiti({ luogo: "L".repeat(161) })).toBe("Il luogo può avere al massimo 160 caratteri.");
    expect(limiti({ data: "" })).toBeNull();
    expect(limiti({ data: "14/06/2026" })).toBe("La data deve essere vuota oppure nel formato aaaa-mm-gg (per esempio 2026-06-14).");
  });

  it("non guarda né le squadre né i gironi: sono i limiti di creazione, che restano in erroreLimitiTappa", () => {
    // Una squadra e cinque gironi: la creazione li rifiuta, i soli testi no
    expect(erroreLimitiTappa(1, 5, testi)).toMatch(/da 2 a 64 squadre/);
    expect(erroreTestiTappa(testi)).toBeNull();
  });

  it("la creazione dà gli stessi messaggi, dopo quelli di squadre e gironi", () => {
    for (const cambia of [{ nome: "N".repeat(121) }, { luogo: "L".repeat(161) }, { data: "14/06/2026" }]) {
      expect(erroreLimitiTappa(8, 2, { ...testi, ...cambia })).toBe(limiti(cambia));
    }
    // Con squadre e testi sbagliati insieme il primo messaggio resta quello delle squadre, come prima
    expect(erroreLimitiTappa(1, 1, { ...testi, nome: "N".repeat(121) })).toMatch(/da 2 a 64 squadre/);
    expect(erroreLimitiTappa(8, 5, { ...testi, nome: "N".repeat(121) })).toMatch(/Numero di gironi non valido/);
  });
});
