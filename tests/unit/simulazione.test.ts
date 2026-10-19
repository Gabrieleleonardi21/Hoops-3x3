import { describe, it, expect } from "vitest";
import {
  generaPunteggio, generaTabellino, scegliSquadre, simulaTappa, riepilogoSimulazione, type Rng,
} from "../../src/domain/simulazione";
import { sorteggia, generaFasiDirette, registraRisultato } from "../../src/domain/tappaOps";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { GiocatoreRoster, Regole, RegGiocatore, RegSquadra, SquadraTappa, StatSheet, Tappa } from "../../src/types";

/** Generatore pseudo-casuale con seme: stessa sequenza a ogni esecuzione, così i test sono riproducibili (mai Math.random) */
const lcg = (seme: number) => () => (seme = (seme * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

/** Somma dei punti di un tabellino (i formati vecchi sono numeri: sono i soli punti) */
const puntiDi = (foglio: StatSheet) => Object.values(foglio).reduce<number>((s, v) => {
  if (typeof v === "number") return s + v;
  return s + (v.pt ?? 0);
}, 0);

/** Giocatori di una squadra della tappa, con id che non si ripetono tra squadre */
function roster(sq: string, n: number): GiocatoreRoster[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${sq}-g${i + 1}`, nome: `G${i + 1} ${sq}` }));
}

/** Squadra iscritta alla tappa con n giocatori (come la prepara il Coach dall'anagrafe) */
function sqTappa(id: string, nome: string, rank: number, n = 4): SquadraTappa {
  return { id, nome, rank, giocatori: roster(id, n) };
}

/** Tappa di 8 squadre in 2 gironi, sorteggiata per ranking (il sorteggio casuale userebbe Math.random) */
function tappaOtto(nGironi = 2): Tappa {
  const squadre = Array.from({ length: 8 }, (_, i) => sqTappa(`s${i + 1}`, `Squadra ${i + 1}`, 90 - i * 10));
  const base: Tappa = {
    id: "t1", nome: "Demo", luogo: "", data: "", nGironi, regole: { ...DEFAULT_RULES },
    squadre, gironi: null, partite: [], video: [],
  };
  const esito = sorteggia(base, "ranking");
  if (!esito.ok) throw new Error(esito.errore);
  return esito.tappa;
}

/** Tappa con i gironi già giocati: tutte le gare dei gironi registrate con la simulazione, per preparare la fase finale */
function gironiGiocati(): Tappa {
  const esito = simulaTappa(tappaOtto(), { fase: "gironi", tabellini: true, qualificate: 2 }, lcg(3));
  if (!esito.ok) throw new Error(esito.errore);
  return esito.tappa;
}

/** Giocatore dell'anagrafe: solo l'id conta per il dominio, gli altri campi restano vuoti */
function regGiocatore(id: string): RegGiocatore {
  return {
    id, nome: "", cognome: "", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "", peso: "", ruolo: "",
    numero: "", squadra: "", esperienza: "", note: "", autore: "", autoreId: null, ts: 0,
  };
}

/** Anagrafe finta: le prime `conRoster` squadre hanno 4 giocatori registrati, le altre nessuno; a metà città diverse */
function anagrafeFinta(conRoster: number, totale: number): { squadre: RegSquadra[]; giocatori: RegGiocatore[] } {
  const giocatori: RegGiocatore[] = [];
  const squadre: RegSquadra[] = [];
  for (let i = 1; i <= totale; i++) {
    const ids: string[] = [];
    if (i <= conRoster) {
      for (let g = 1; g <= 4; g++) {
        const id = `r${i}-g${g}`;
        ids.push(id);
        giocatori.push(regGiocatore(id));
      }
    }
    // Le prime quattro squadre sono di Roma, le altre di Milano (per il criterio «citta»)
    let citta = "Milano";
    if (i <= 4) citta = "Roma";
    squadre.push({
      id: `r${i}`, nome: `Squadra ${i}`, citta, anno: "", rank: String(100 - i * 10),
      referente: "", roster: ids, logo: "", website: "", instagram: "", note: "", autore: "", autoreId: null, ts: 0,
    });
  }
  return { squadre, giocatori };
}

/** Il punteggio di una gara a 21, così come esce da generaPunteggio */
const gareA21 = (sa: number, sb: number) => sa === 21 || sb === 21;

/** Generatore con seme il cui primo numero è `primo`: forza l'esito della gara (0,97 = supplementare, 0,7 = allo scadere) */
const primoEsito = (primo: number, seme: number): Rng => {
  const seguito = lcg(seme);
  let primoGiro = true;
  return () => {
    if (primoGiro) {
      primoGiro = false;
      return primo;
    }
    return seguito();
  };
};

/** Regole diverse dal default: il punteggio deve restare valido anche con un altro target o un altro supplementare */
const REGOLE_VARIE: [string, Partial<Regole>][] = [
  ["predefinite", {}],
  ["target 11", { target: 11 }],
  ["target 15", { target: 15 }],
  ["supplementare a 6", { ot: 6 }],
  ["supplementare a 0", { ot: 0 }],
  ["supplementare a 1", { ot: 1 }],
  ["target 11 e supplementare a 6", { target: 11, ot: 6 }],
];

describe("generaPunteggio", () => {
  it("mai pareggi, interi, non negativi e con il massimo a target + 4", () => {
    const rng = lcg(1);
    for (let i = 0; i < 1000; i++) {
      const { sa, sb } = generaPunteggio(DEFAULT_RULES, null, null, rng);
      expect(sa).not.toBe(sb);
      expect(Number.isInteger(sa) && Number.isInteger(sb)).toBe(true);
      expect(Math.min(sa, sb)).toBeGreaterThanOrEqual(0);
      expect(Math.max(sa, sb)).toBeLessThanOrEqual(25);
    }
  });

  it("produce gare a 21 e gare allo scadere (il supplementare è nel test sotto, con l'esito forzato)", () => {
    const rng = lcg(2);
    const punteggi = Array.from({ length: 1000 }, () => generaPunteggio(DEFAULT_RULES, null, null, rng));
    expect(punteggi.some((p) => gareA21(p.sa, p.sb))).toBe(true);
    expect(punteggi.some((p) => Math.max(p.sa, p.sb) < 21)).toBe(true);
  });

  it("ai supplementari lo scarto è esattamente ot e il perdente sta tra 14 e 20 (esito forzato)", () => {
    for (let seme = 1; seme <= 200; seme++) {
      const { sa, sb } = generaPunteggio(DEFAULT_RULES, null, null, primoEsito(0.97, seme));
      expect(Math.abs(sa - sb)).toBe(DEFAULT_RULES.ot);
      expect(Math.min(sa, sb)).toBeGreaterThanOrEqual(14);
    }
  });

  it("supplementare con target 15 e ot 6: scarto pari a 6 e massimo a 19 (target + 4)", () => {
    const regole = { ...DEFAULT_RULES, target: 15, ot: 6 };
    for (let seme = 1; seme <= 200; seme++) {
      const { sa, sb } = generaPunteggio(regole, null, null, primoEsito(0.97, seme));
      expect(Math.abs(sa - sb)).toBe(6);
      expect(Math.max(sa, sb)).toBeLessThanOrEqual(19);
    }
  });

  it.each(REGOLE_VARIE)("regole %s: registraRisultato accetta ogni gara simulata, con le regole della tappa", (_, cambi) => {
    const base = { ...tappaOtto(), regole: { ...DEFAULT_RULES, ...cambi } };
    const partita = base.partite[0];
    const rifiutate: string[] = [];
    const rng = lcg(30);
    for (let i = 0; i < 1000; i++) {
      const { sa, sb } = generaPunteggio(base.regole, null, null, rng);
      const esito = registraRisultato(base, partita.id, { sa, sb });
      if (!esito.ok) rifiutate.push(`${sa}-${sb}: ${esito.errore}`);
    }
    expect(rifiutate).toEqual([]);
  });

  it("con ranking nettamente diversi vince la squadra più forte in più del 55% dei casi", () => {
    const rng = lcg(4);
    let vittorieA = 0;
    for (let i = 0; i < 1000; i++) {
      const { sa, sb } = generaPunteggio(DEFAULT_RULES, 220, 90, rng);
      if (sa > sb) vittorieA++;
    }
    expect(vittorieA / 1000).toBeGreaterThan(0.55);
  });
});

describe("generaTabellino", () => {
  const quattro = roster("a", 4);

  it("la somma dei punti è il totale della squadra, e ogni voce è nei limiti", () => {
    const rng = lcg(5);
    const ids = new Set(quattro.map((g) => g.id));
    for (let i = 0; i < 500; i++) {
      const punti = 6 + (i % 16);
      const foglio = generaTabellino(quattro, punti, rng);
      expect(puntiDi(foglio)).toBe(punti);
      for (const [id, linea] of Object.entries(foglio)) {
        expect(ids.has(id)).toBe(true);
        if (typeof linea === "number") throw new Error("il tabellino nuovo ha sempre le sette statistiche");
        expect(linea.rb).toBeGreaterThanOrEqual(0);
        expect(linea.rb).toBeLessThanOrEqual(6);
        expect(linea.as).toBeLessThanOrEqual(3);
        expect(linea.ru).toBeLessThanOrEqual(2);
        expect(linea.st).toBeLessThanOrEqual(1);
        expect(linea.pe).toBeLessThanOrEqual(3);
        expect(linea.fa).toBeLessThanOrEqual(3);
        expect(linea.pt).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("con roster da 3 la somma resta uguale al totale", () => {
    const rng = lcg(6);
    for (let i = 0; i < 200; i++) {
      expect(puntiDi(generaTabellino(roster("b", 3), 12 + (i % 10), rng))).toBe(12 + (i % 10));
    }
  });

  it("roster vuoto: nessun tabellino", () => {
    expect(generaTabellino([], 15, lcg(7))).toEqual({});
  });

  it("zero punti: tutti i punti a 0", () => {
    const foglio = generaTabellino(quattro, 0, lcg(8));
    for (const linea of Object.values(foglio)) {
      if (typeof linea === "number") throw new Error("formato inatteso");
      expect(linea.pt).toBe(0);
    }
  });
});

describe("scegliSquadre", () => {
  it("casuale con lo stesso seme dà lo stesso ordine; con un seme diverso cambia", () => {
    const { squadre, giocatori } = anagrafeFinta(8, 8);
    const criteri = { n: 8, modo: "casuale" as const };
    const nomi = (seme: number) => {
      const esito = scegliSquadre(squadre, giocatori, criteri, lcg(seme));
      if (!esito.ok) throw new Error(esito.errore);
      return esito.squadre.map((s) => s.nome);
    };
    expect(nomi(9)).toEqual(nomi(9));
    expect(nomi(9)).not.toEqual(nomi(10));
  });

  it("ranking: le migliori per punti ranking", () => {
    const { squadre, giocatori } = anagrafeFinta(8, 8);
    const esito = scegliSquadre(squadre, giocatori, { n: 3, modo: "ranking" }, lcg(1));
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.squadre.map((s) => s.nome)).toEqual(["Squadra 1", "Squadra 2", "Squadra 3"]);
  });

  it("citta: solo quelle della città (confronto normalizzato), poi per ranking", () => {
    const { squadre, giocatori } = anagrafeFinta(8, 8);
    const esito = scegliSquadre(squadre, giocatori, { n: 3, modo: "citta", citta: "  MILANO " }, lcg(1));
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.squadre.map((s) => s.nome)).toEqual(["Squadra 5", "Squadra 6", "Squadra 7"]);
  });

  it("citta senza nome: errore, nessuna squadra scelta", () => {
    const { squadre, giocatori } = anagrafeFinta(8, 8);
    const esito = scegliSquadre(squadre, giocatori, { n: 3, modo: "citta" }, lcg(1));
    expect(esito.ok).toBe(false);
  });

  it("le squadre obbligatorie vengono prima, anche se il criterio non le sceglierebbe", () => {
    const { squadre, giocatori } = anagrafeFinta(8, 8);
    const esito = scegliSquadre(squadre, giocatori, { n: 3, modo: "ranking", obbligatorie: ["Squadra 8"] }, lcg(1));
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.squadre.map((s) => s.nome)).toEqual(["Squadra 8", "Squadra 1", "Squadra 2"]);
  });

  it("con 3 squadre ammissibili su 8 richieste l'errore dà il conteggio e non sceglie niente", () => {
    const { squadre, giocatori } = anagrafeFinta(3, 8);
    const esito = scegliSquadre(squadre, giocatori, { n: 8, modo: "casuale" }, lcg(1));
    expect(esito.ok).toBe(false);
    if (esito.ok) throw new Error("doveva fallire");
    expect(esito.errore).toContain("solo 3 squadre");
    expect(esito.errore).toContain("chiedi al massimo 3 squadre");
  });

  it("squadre senza roster escluse: con 5 con roster e 3 senza, 5 squadre sì e 8 no", () => {
    const { squadre, giocatori } = anagrafeFinta(5, 8);
    const ok5 = scegliSquadre(squadre, giocatori, { n: 5, modo: "casuale" }, lcg(1));
    expect(ok5.ok).toBe(true);
    const ko8 = scegliSquadre(squadre, giocatori, { n: 8, modo: "casuale" }, lcg(1));
    expect(ko8.ok).toBe(false);
    if (ko8.ok) throw new Error("doveva fallire");
    expect(ko8.errore).toContain("solo 5 squadre");
  });

  it("un'obbligatoria senza roster o non trovata: errore che la nomina", () => {
    const { squadre, giocatori } = anagrafeFinta(5, 8);
    const senzaRoster = scegliSquadre(squadre, giocatori, { n: 5, modo: "ranking", obbligatorie: ["Squadra 8"] }, lcg(1));
    expect(senzaRoster.ok).toBe(false);
    if (senzaRoster.ok) throw new Error("doveva fallire");
    expect(senzaRoster.errore).toContain("Squadra 8");
    const assente = scegliSquadre(squadre, giocatori, { n: 5, modo: "ranking", obbligatorie: ["Inesistente"] }, lcg(1));
    expect(assente.ok).toBe(false);
  });
});

describe("simulaTappa", () => {
  it("8 squadre in 2 gironi: 12 gare giocate con tabellini, tabellone a 3 match, un campione", () => {
    const esito = simulaTappa(tappaOtto(), { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(11));
    if (!esito.ok) throw new Error(esito.errore);
    const { tappa, rapporto } = esito;
    expect(tappa.partite).toHaveLength(12);
    for (const m of tappa.partite) {
      expect(m.done).toBe(true);
      expect(m.pa && puntiDi(m.pa)).toBe(m.sa);
      expect(m.pb && puntiDi(m.pb)).toBe(m.sb);
    }
    expect(tappa.bracket).toHaveLength(3);
    expect(tappa.bracket?.every((m) => m.done)).toBe(true);
    expect(rapporto.campione).not.toBeNull();
    expect(rapporto.finale).toContain(rapporto.campione ?? "");
    expect(rapporto.gareGironi).toBe(12);
    expect(rapporto.gareTabellone).toBe(3);
    expect(rapporto.classifiche).toHaveLength(2);
    expect(rapporto.classifiche.map((c) => c.righe.length)).toEqual([4, 4]);
  });

  it("fase gironi: nessun tabellone", () => {
    const esito = simulaTappa(tappaOtto(), { fase: "gironi", tabellini: true, qualificate: 2 }, lcg(12));
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.tappa.bracket).toBeUndefined();
    expect(esito.rapporto.gareTabellone).toBe(0);
    expect(esito.rapporto.campione).toBeNull();
  });

  it("tappa con 10 gare su 12 già giocate: le 10 restano identiche, si giocano solo le 2 mancanti", () => {
    const base = tappaOtto();
    const giocate = base.partite.map((m, i) => {
      if (i >= 10) return m;
      return { ...m, sa: 21, sb: 9, done: true, pa: {}, pb: {} };
    });
    const parziale: Tappa = { ...base, partite: giocate };
    const esito = simulaTappa(parziale, { fase: "gironi", tabellini: true, qualificate: 2 }, lcg(13));
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.tappa.partite.slice(0, 10)).toEqual(giocate.slice(0, 10));
    expect(esito.tappa.partite.slice(10).every((m) => m.done)).toBe(true);
    expect(esito.rapporto.gareGironi).toBe(2);
  });

  it("tabellone già generato con le semifinali da giocare: cambiano solo i 3 match", () => {
    const gironi = gironiGiocati();
    const conTabellone = generaFasiDirette(gironi, 2);
    if (!conTabellone.ok) throw new Error(conTabellone.errore);
    const esito = simulaTappa(conTabellone.tappa, { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(14));
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.tappa.partite).toEqual(gironi.partite);
    expect(esito.tappa.bracket?.every((m) => m.done)).toBe(true);
    expect(esito.rapporto.gareTabellone).toBe(3);
  });

  it("fase finale con i gironi ancora da giocare: errore che dice di giocare prima i gironi", () => {
    const esito = simulaTappa(tappaOtto(), { fase: "finale", tabellini: true, qualificate: 2 }, lcg(15));
    expect(esito.ok).toBe(false);
  });

  it("un girone solo: niente tabellone e la nota lo dice", () => {
    const base = tappaOtto(1);
    const esito = simulaTappa(base, { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(16));
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.tappa.bracket).toBeUndefined();
    expect(esito.rapporto.note).toContain("Con un girone solo non c'è fase finale.");
  });

  it("tappa conclusa: errore", () => {
    const esito = simulaTappa({ ...tappaOtto(), conclusa: true }, { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(17));
    expect(esito.ok).toBe(false);
  });

  it("tappa non sorteggiata: errore", () => {
    const esito = simulaTappa({ ...tappaOtto(), gironi: null, partite: [] }, { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(18));
    expect(esito.ok).toBe(false);
  });

  it("niente da giocare: errore che nomina la tappa", () => {
    const giocata = simulaTappa(tappaOtto(), { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(19));
    if (!giocata.ok) throw new Error(giocata.errore);
    const esito = simulaTappa(giocata.tappa, { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(20));
    expect(esito.ok).toBe(false);
    if (esito.ok) throw new Error("doveva fallire");
    expect(esito.errore).toContain("Demo");
    expect(esito.errore).toContain("non ha gare da giocare");
  });

  it("tabellini: false: nessun tabellino, ma i punteggi ci sono", () => {
    const esito = simulaTappa(tappaOtto(), { fase: "gironi", tabellini: false, qualificate: 2 }, lcg(21));
    if (!esito.ok) throw new Error(esito.errore);
    for (const m of esito.tappa.partite) {
      expect(m.pa).toBeUndefined();
      expect(m.pb).toBeUndefined();
      expect(m.done).toBe(true);
    }
  });

  it("stesso seme, stessa tappa; seme diverso, tappa diversa", () => {
    // Si confrontano i risultati e i tabellini: gli id delle gare e il momento di registrazione cambiano a ogni esecuzione
    const base = tappaOtto();
    const proiezione = (seme: number) => {
      const esito = simulaTappa(base, { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(seme));
      if (!esito.ok) throw new Error(esito.errore);
      return {
        gironi: esito.tappa.partite.map((m) => [m.sa, m.sb, m.pa, m.pb]),
        bracket: (esito.tappa.bracket ?? []).map((m) => [m.squadraA, m.squadraB, m.pA, m.pB]),
      };
    };
    expect(proiezione(22)).toEqual(proiezione(22));
    expect(proiezione(22)).not.toEqual(proiezione(23));
  });
});

describe("riepilogoSimulazione", () => {
  it("il testo contiene il campione, le classifiche, la finale e la frase sulla conclusione", () => {
    const esito = simulaTappa(tappaOtto(), { fase: "tutto", tabellini: true, qualificate: 2 }, lcg(24));
    if (!esito.ok) throw new Error(esito.errore);
    const { rapporto } = esito;
    const testo = riepilogoSimulazione("Demo", rapporto, { squadre: ["A", "B"], nuova: true, tabellini: true });
    expect(testo).toContain('Tappa "Demo" creata con 2 squadre dall\'anagrafe (A, B)');
    // 12 gare nei gironi e 3 nel tabellone (semifinali e finale)
    expect(testo).toContain(`${rapporto.gareGironi + rapporto.gareTabellone} gare giocate con i tabellini`);
    expect(testo).toContain(`vince ${rapporto.finale ?? ""}`);
    expect(testo).toContain("1. ");
    expect(testo).toContain("Classifiche dei gironi");
    expect(testo.endsWith("La tappa non è conclusa: per pubblicarla chiedi di concluderla.")).toBe(true);
  });

  it("senza gare dei gironi (solo tabellone) non dice «con i tabellini», che non ci sono", () => {
    const rapporto = { gareGironi: 0, gareTabellone: 3, classifiche: [], campione: "Alfa", finale: "Alfa su Beta 21-17", note: [] };
    const testo = riepilogoSimulazione("Demo", rapporto, { nuova: false, tabellini: true });
    expect(testo).toContain('Tappa "Demo": 3 gare mancanti giocate, fase finale giocata: vince Alfa su Beta 21-17.');
    expect(testo).not.toContain("con i tabellini");
  });

  it("per una tappa esistente conta le gare mancanti", () => {
    const rapporto = { gareGironi: 2, gareTabellone: 0, classifiche: [], campione: null, finale: null, note: [] };
    const testo = riepilogoSimulazione("Demo", rapporto, { nuova: false, tabellini: false });
    expect(testo).toBe(
      'Tappa "Demo": 2 gare mancanti giocate. I punteggi sono numeri di prova generati dall\'app, non risultati veri. '
        + "La tappa non è conclusa: per pubblicarla chiedi di concluderla.",
    );
  });

  it("dice sempre che i punteggi sono numeri di prova, sia per una tappa nuova sia per una esistente", () => {
    const frase = "I punteggi sono numeri di prova generati dall'app, non risultati veri.";
    const rapporto = { gareGironi: 1, gareTabellone: 0, classifiche: [], campione: null, finale: null, note: [] };
    expect(riepilogoSimulazione("Demo", rapporto, { nuova: false, tabellini: false })).toContain(frase);
    expect(riepilogoSimulazione("Demo", rapporto, { squadre: ["A", "B"], nuova: true, tabellini: true })).toContain(frase);
  });
});
