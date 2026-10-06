import { describe, it, expect } from "vitest";
import { normalizza, statGiocatori } from "../../src/utils/statGiocatori";
import { tappaLeaders } from "../../src/utils/tappaLeaders";
import { tappaDiProva, unaGara } from "./tappeDiProva";

/** Una riga con nome, squadra e le statistiche: sia quella di stagione sia quella dei leader di tappa */
type RigaConStat = Record<"nome" | "squadra", string> & Record<"g" | "pt" | "rb" | "as" | "ru" | "st" | "pe" | "fa", number>;

/** Le sole colonne che quasi tutti i test guardano di una riga di stagione */
const colonne = ({ nome, squadra, g, pt }: RigaConStat) => ({ nome, squadra, g, pt });

describe("statGiocatori: chi è lo stesso giocatore", () => {
  it("lo stesso giocatore in tre tappe è una sola riga con i totali", () => {
    // In ogni tappa «Mario Rossi» ha un id diverso (si genera a ogni tappa): conta il nome con la squadra
    const righe = statGiocatori([
      unaGara("t1", "Alfa", "Mario Rossi", { pt: 12, rb: 3, as: 1 }),
      unaGara("t2", "Alfa", "Mario Rossi", { pt: 10, rb: 1, ru: 2 }),
      unaGara("t3", "Alfa", "Mario Rossi", { pt: 8, rb: 3, st: 1 }),
    ]);
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ nome: "Mario Rossi", squadra: "Alfa", g: 3, pt: 30, rb: 7, as: 1, ru: 2, st: 1 });
  });

  it("due omonimi in squadre diverse sono due righe, ognuna con i suoi totali", () => {
    // Il roster non dice se il «Mario Rossi» di Beta è la stessa persona di quello di Alfa: sono due giocatori
    const t1 = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Mario Rossi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12 } }, pb: { "Mario Rossi": { pt: 7 } } },
    ]);
    const righe = statGiocatori([t1, unaGara("t2", "Alfa", "Mario Rossi", { pt: 10 })]);
    expect(righe.map(colonne)).toEqual([
      { nome: "Mario Rossi", squadra: "Alfa", g: 2, pt: 22 },
      { nome: "Mario Rossi", squadra: "Beta", g: 1, pt: 7 },
    ]);
  });

  it("chi cambia squadra compare su due righe (limite dichiarato: il roster di tappa non è collegato all'anagrafe)", () => {
    const righe = statGiocatori([
      unaGara("t1", "Alfa", "Mario Rossi", { pt: 12 }),
      unaGara("t2", "Beta", "Mario Rossi", { pt: 10 }),
    ]);
    expect(righe.map(colonne)).toEqual([
      { nome: "Mario Rossi", squadra: "Alfa", g: 1, pt: 12 },
      { nome: "Mario Rossi", squadra: "Beta", g: 1, pt: 10 },
    ]);
  });
});

describe("normalizza", () => {
  it.each([
    ["toglie gli spazi ai lati e riduce a uno quelli interni", "  Nicolò   Rossi ", "nicolo rossi"],
    ["ignora maiuscole e accenti", "NICOLÒ ROSSI", "nicolo rossi"],
    ["ignora anche l'accento scritto come segno a parte, dopo la lettera", "Nicolo\u0300 Rossi", "nicolo rossi"],
    ["tratta tabulazioni e a capo come spazi", "Mario\tRossi\n", "mario rossi"],
    ["rende l'apostrofo tipografico di chiusura (’) quello semplice", "D\u2019Angelo", "d'angelo"],
    ["rende l'apostrofo tipografico di apertura (‘) quello semplice", "D\u2018Angelo", "d'angelo"],
    ["un testo di soli spazi diventa vuoto", "   ", ""],
  ])("%s", (_descrizione, testo, atteso) => {
    expect(normalizza(testo)).toBe(atteso);
  });
});

describe("statGiocatori: la normalizzazione di nome e squadra", () => {
  it("maiuscole, spazi in più e accenti non contano: «Nicolò  Rossi» e «nicolo rossi» sono lo stesso giocatore", () => {
    const grafie = ["Nicolò  Rossi", "nicolo rossi", "  NICOLÒ ROSSI ", "Nicolo\u0300 Rossi"];
    const righe = statGiocatori(grafie.map((nome, i) => unaGara(`t${i}`, "Alfa", nome, { pt: 10 })));
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ g: 4, pt: 40 });
  });

  it("vale anche per la squadra", () => {
    const righe = statGiocatori([
      unaGara("t1", "Alfa Team", "Mario Rossi", { pt: 12 }),
      unaGara("t2", " alfa   TEAM", "Mario Rossi", { pt: 10 }),
    ]);
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ g: 2, pt: 22 });
  });

  it("gli apostrofi tipografici della tastiera del telefono sono quello semplice: «D’Angelo» e «D'Angelo» sono lo stesso giocatore", () => {
    const grafie = ["D'Angelo", "D\u2019Angelo", "d\u2018ANGELO"];
    const righe = statGiocatori(grafie.map((nome, i) => unaGara(`t${i}`, "Alfa", nome, { pt: 10 })));
    expect(righe.map(colonne)).toEqual([{ nome: "d\u2018ANGELO", squadra: "Alfa", g: 3, pt: 30 }]);
  });

  it("gli spazi in più si riducono a uno ma non si tolgono: «De Rossi» e «DeRossi» sono due giocatori", () => {
    const righe = statGiocatori([
      unaGara("t1", "Alfa", "De  Rossi", { pt: 12 }),
      unaGara("t2", "Alfa", "de rossi", { pt: 10 }),
      unaGara("t3", "Alfa", "DeRossi", { pt: 8 }),
    ]);
    expect(righe.map(colonne)).toEqual([
      { nome: "de rossi", squadra: "Alfa", g: 2, pt: 22 },
      { nome: "DeRossi", squadra: "Alfa", g: 1, pt: 8 },
    ]);
  });

  it("un nome che differisce per una lettera è un altro giocatore", () => {
    const righe = statGiocatori([
      unaGara("t1", "Alfa", "Nicolò Rossi", { pt: 12 }),
      unaGara("t2", "Alfa", "Nicola Rossi", { pt: 10 }),
    ]);
    expect(righe.map((r) => r.nome)).toEqual(["Nicolò Rossi", "Nicola Rossi"]);
  });
});

describe("statGiocatori: il nome mostrato", () => {
  const vecchia = unaGara("t1", "alfa  team", "nicolo rossi", { pt: 10 });
  const recente = unaGara("t2", "Alfa Team", "Nicolò Rossi", { pt: 12 });

  it("è la grafia dell'ultima tappa dell'elenco in cui il giocatore ha un tabellino, per il nome e per la squadra", () => {
    // Nella terza tappa Nicolò è nel roster ma non ha un tabellino (gioca solo Luca): la sua grafia lì non conta
    const senzaTabellino = tappaDiProva("t3", { "ALFA TEAM": ["NICOLÒ ROSSI", "Luca Bianchi"], Avversari: ["Altro"] }, [
      { a: "ALFA TEAM", b: "Avversari", pa: { "Luca Bianchi": { pt: 3 } } },
    ]);
    const righe = statGiocatori([vecchia, recente, senzaTabellino]);
    expect(righe.map(({ nome, squadra }) => ({ nome, squadra }))).toEqual([
      { nome: "Nicolò Rossi", squadra: "Alfa Team" },
      { nome: "Luca Bianchi", squadra: "ALFA TEAM" },
    ]);
  });

  it("conta la posizione nell'elenco, non la grafia più curata", () => {
    const righe = statGiocatori([recente, vecchia]);
    expect(righe.map(({ nome, squadra }) => ({ nome, squadra }))).toEqual([{ nome: "nicolo rossi", squadra: "alfa  team" }]);
  });
});

describe("statGiocatori: quali partite contano", () => {
  it("una partita non giocata non conta, nemmeno con un tabellino provvisorio", () => {
    // «Annulla risultato» rimette la partita da giocare e lascia il tabellino come bozza
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi", "Luca Bianchi"], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12 } } },
      { a: "Alfa", b: "Beta", done: false, sa: 0, sb: 0, pa: { "Mario Rossi": { pt: 30 }, "Luca Bianchi": { pt: 8 } }, pb: { "Anna Verdi": { pt: 5 } } },
    ]);
    // Chi ha solo il tabellino provvisorio (Luca, Anna) non ha una riga
    expect(statGiocatori([t]).map(colonne)).toEqual([{ nome: "Mario Rossi", squadra: "Alfa", g: 1, pt: 12 }]);
  });

  it("una partita giocata in parità conta come le altre: per i giocatori conta solo che sia stata giocata", () => {
    // La classifica la ignora perché non ha un vincitore (standings.ts); i punti dei giocatori non dipendono dal
    // vincitore, e i leader della tappa (tappaLeaders) la contano già così
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", sa: 15, sb: 15, pa: { "Mario Rossi": { pt: 15 } }, pb: { "Anna Verdi": { pt: 15 } } },
    ]);
    expect(statGiocatori([t]).map(colonne)).toEqual([
      { nome: "Mario Rossi", squadra: "Alfa", g: 1, pt: 15 },
      { nome: "Anna Verdi", squadra: "Beta", g: 1, pt: 15 },
    ]);
  });
});

describe("statGiocatori: i dati dei tabellini", () => {
  it("il formato vecchio, un numero, vale come i soli punti, e anche uno 0 è una gara giocata", () => {
    const righe = statGiocatori([unaGara("t1", "Alfa", "Mario Rossi", 12), unaGara("t2", "Alfa", "Mario Rossi", 0)]);
    expect(righe.map(colonne)).toEqual([{ nome: "Mario Rossi", squadra: "Alfa", g: 2, pt: 12 }]);
  });

  it("ignora i tabellini di chi non è nel roster e di chi non ha un nome (un posto vuoto del roster)", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi", "", "   "], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12 }, "": { pt: 9 }, "   ": { pt: 4 }, Sconosciuto: { pt: 3 } } },
    ]);
    expect(statGiocatori([t]).map((r) => r.nome)).toEqual(["Mario Rossi"]);
  });

  it("senza tappe, o senza partite giocate, non ci sono righe", () => {
    expect(statGiocatori([])).toEqual([]);
    expect(statGiocatori([tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Anna Verdi"] }, [])])).toEqual([]);
  });

  it("le righe seguono l'ordine in cui i giocatori compaiono, prima la squadra A di ogni partita", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Anna Verdi"] }, [
      { a: "Beta", b: "Alfa", pa: { "Anna Verdi": { pt: 5 } }, pb: { "Mario Rossi": { pt: 7 } } },
    ]);
    expect(statGiocatori([t]).map((r) => r.nome)).toEqual(["Anna Verdi", "Mario Rossi"]);
  });
});

describe("statGiocatori e tappaLeaders", () => {
  it("per una sola tappa le righe sono quelle dei leader della tappa: le due leggono i tabellini allo stesso modo", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi", "Luca Bianchi"], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12, rb: 3, pe: 2, fa: 1 }, "Luca Bianchi": 9 }, pb: { "Anna Verdi": { as: 4 } } },
      { a: "Alfa", b: "Beta", sa: 15, sb: 15, pa: { "Mario Rossi": { pt: 5, st: 1, ru: 2 } } }, // in parità
      { a: "Alfa", b: "Beta", done: false, pa: { "Mario Rossi": { pt: 40 } } }, // da giocare
    ]);
    // Le righe dei leader hanno anche l'id del giocatore, quelle di stagione la chiave: si confrontano le sole statistiche
    const statistiche = ({ nome, squadra, g, pt, rb, as, ru, st, pe, fa }: RigaConStat) => ({ nome, squadra, g, pt, rb, as, ru, st, pe, fa });
    expect(statGiocatori([t]).map(statistiche)).toEqual(tappaLeaders(t).map(statistiche));
  });
});
