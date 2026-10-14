import { describe, it, expect } from "vitest";
import { fileDaFogli } from "../../src/utils/foglioTappa";
import { leggiFileLega } from "../../src/utils/legaFile";
import { buildMatches } from "../../src/utils/buildMatches";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { BozzaFoglio, Lega, SquadraLetta, Tappa } from "../../src/types";

/* Dalla bozza letta sulla foto al file di lega: il JSON prodotto si controlla con leggiFileLega, la stessa strada di «Importa
 * file», così la prova è che la tappa passa davvero dall'import. Ogni anomalia della bozza diventa un dubbio, mai un errore che
 * blocca l'import (salvo meno di 2 squadre o più di 64), e nessun risultato entra in classifica senza le regole di
 * registraRisultato. */

const roster = (iniziale: string) => [`${iniziale}1 Rossi`, `${iniziale}2 Bianchi`, `${iniziale}3 Verdi`];
const sq = (nome: string, giocatori = roster(nome[0])): SquadraLetta => ({ nome, giocatori });

/** Bozza completa: 6 squadre in 2 gironi da 3, due risultati (il secondo scritto al rovescio rispetto al calendario possibile) */
const bozza = (parziale: Partial<BozzaFoglio> = {}): BozzaFoglio => ({
  nome: "Tappa di Roma", luogo: "Campo Testaccio", data: "2026-06-14",
  squadre: ["Alfa", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"].map((n) => sq(n)),
  gironi: [["Alfa", "Beta", "Gamma"], ["Delta", "Epsilon", "Zeta"]],
  partite: [{ a: "Alfa", b: "Beta", puntiA: 21, puntiB: 15 }, { a: "Zeta", b: "Delta", puntiA: 12, puntiB: 21 }],
  dubbi: [],
  ...parziale,
});

/** Converte e importa come fa la pagina: il file deve essere accettato da leggiFileLega */
function importa(bozze: BozzaFoglio[], etichette = bozze.map((_, i) => `foto${i + 1}.jpg`)): { lega: Lega; dubbi: string[][] } {
  const esito = fileDaFogli(bozze, etichette);
  if (!esito.ok) throw new Error(`conversione rifiutata: ${esito.errore}`);
  const letta = leggiFileLega(esito.testo, "foglio.json");
  if (!letta.ok) throw new Error(`import rifiutato: ${letta.errore}`);
  return { lega: letta.lega, dubbi: esito.dubbi };
}

const idDi = (t: Tappa, nome: string) => {
  const s = t.squadre.find((x) => x.nome === nome);
  if (!s) throw new Error(`squadra ${nome} assente`);
  return s.id;
};

/** La partita tra due squadre (in qualunque orientamento) con i punti di ciascuna */
function partitaTra(t: Tappa, x: string, y: string) {
  const ix = idDi(t, x);
  const iy = idDi(t, y);
  const m = t.partite.find((p) => (p.a === ix && p.b === iy) || (p.a === iy && p.b === ix));
  if (!m) return null;
  if (m.a === ix) return { [x]: m.sa, [y]: m.sb, done: m.done };
  return { [x]: m.sb, [y]: m.sa, done: m.done };
}

const nomiGironi = (t: Tappa) => (t.gironi ?? []).map((g) => g.map((id) => t.squadre.find((s) => s.id === id)?.nome));

describe("fileDaFogli: una bozza completa diventa una tappa sorteggiata con i risultati letti", () => {
  it("gironi con gli id, calendario di buildMatches, risultati copiati nell'orientamento del calendario, nessun dubbio aggiunto", () => {
    const { lega, dubbi } = importa([bozza({ dubbi: ["Partita Alfa-Beta: il 15 potrebbe essere un 16"] })]);
    const t = lega.tappe[0];
    expect(lega.nome).toBe("Tappa di Roma");
    expect(t).toMatchObject({ nome: "Tappa di Roma", luogo: "Campo Testaccio", data: "2026-06-14", nGironi: 2 });
    expect(nomiGironi(t)).toEqual([["Alfa", "Beta", "Gamma"], ["Delta", "Epsilon", "Zeta"]]);
    // Il calendario è quello che il sorteggio avrebbe generato con questi gironi
    const atteso = buildMatches(t.gironi ?? []).map(({ g, a, b }) => ({ g, a, b }));
    expect(t.partite.map(({ g, a, b }) => ({ g, a, b }))).toEqual(atteso);
    expect(partitaTra(t, "Alfa", "Beta")).toEqual({ Alfa: 21, Beta: 15, done: true });
    expect(partitaTra(t, "Zeta", "Delta")).toEqual({ Zeta: 12, Delta: 21, done: true });
    expect(t.partite.filter((m) => m.done)).toHaveLength(2);
    expect(dubbi).toEqual([["Partita Alfa-Beta: il 15 potrebbe essere un 16"]]);
  });

  it("le squadre hanno i giocatori letti, rank vuoto, nessun video, regole e tabellone dal file; id tutti diversi", () => {
    const esito = fileDaFogli([bozza()], ["foto.jpg"]);
    if (!esito.ok) throw new Error(esito.errore);
    const grezza = JSON.parse(esito.testo) as { tappe: Record<string, unknown>[] };
    expect(grezza.tappe[0].regole).toBeUndefined();
    expect(grezza.tappe[0].bracket).toBeUndefined();
    const { lega } = importa([bozza()]);
    const t = lega.tappe[0];
    expect(t.regole).toEqual(DEFAULT_RULES);
    expect(t.video).toEqual([]);
    expect(t.squadre[0]).toMatchObject({ nome: "Alfa", rank: "" });
    expect(t.squadre[0].giocatori.map((g) => g.nome)).toEqual(["A1 Rossi", "A2 Bianchi", "A3 Verdi"]);
    const id = [
      ...t.squadre.map((s) => s.id), ...t.squadre.flatMap((s) => s.giocatori.map((g) => g.id)), ...t.partite.map((m) => m.id),
    ];
    expect(new Set(id).size).toBe(id.length);
  });
});

describe("fileDaFogli: nome, data e squadre", () => {
  it("nome vuoto → «Tappa da foglio N»; una data fuori formato si toglie con il dubbio", () => {
    const { lega, dubbi } = importa([bozza({ nome: "  ", luogo: null, data: "14/06/2026" })]);
    expect(lega.tappe[0]).toMatchObject({ nome: "Tappa da foglio 1", luogo: "", data: "" });
    expect(lega.nome).toBe("Tappa da foglio 1");
    expect(dubbi[0]).toContain("Data non valida sul foglio: 14/06/2026");
  });

  it("una squadra ripetuta resta una sola (la prima), con il dubbio", () => {
    const squadre = [sq("Alfa"), sq("Beta"), sq("alfa ", ["Altro Nome"]), sq("Gamma")];
    const { lega, dubbi } = importa([bozza({ squadre, gironi: null, partite: [] })]);
    expect(lega.tappe[0].squadre.map((s) => s.nome)).toEqual(["Alfa", "Beta", "Gamma"]);
    expect(lega.tappe[0].squadre[0].giocatori.map((g) => g.nome)).toEqual(["A1 Rossi", "A2 Bianchi", "A3 Verdi"]);
    expect(dubbi[0].join(" ")).toContain("«alfa» ripetuta");
  });

  it("5 giocatori → i primi 4 con il dubbio; i nomi vuoti si scartano senza dubbio", () => {
    const squadre = [sq("Alfa", ["Uno", "Due", "Tre", "Quattro", "Cinque"]), sq("Beta", ["Uno", "  ", "Due"])];
    const { lega, dubbi } = importa([bozza({ squadre, gironi: null, partite: [] })]);
    expect(lega.tappe[0].squadre[0].giocatori.map((g) => g.nome)).toEqual(["Uno", "Due", "Tre", "Quattro"]);
    expect(lega.tappe[0].squadre[1].giocatori.map((g) => g.nome)).toEqual(["Uno", "Due"]);
    expect(dubbi[0]).toEqual(["Squadra «Alfa»: letti 5 giocatori, tenuti i primi 4."]);
  });

  it("meno di 2 squadre o più di 64: la foto non si importa", () => {
    const una = fileDaFogli([bozza({ squadre: [sq("Alfa"), sq("  ")], gironi: null, partite: [] })], ["a.jpg"]);
    expect(una).toEqual({ ok: false, errore: "Foto «a.jpg»: Il foglio ha meno di 2 squadre leggibili." });
    const tante = Array.from({ length: 65 }, (_, i) => sq(`Squadra ${i + 1}`, []));
    const troppe = fileDaFogli([bozza({ squadre: tante, gironi: null, partite: [] })], ["b.jpg"]);
    expect(troppe).toEqual({ ok: false, errore: "Foto «b.jpg»: Il foglio ha 65 squadre: una tappa ne ha al massimo 64." });
  });
});

describe("fileDaFogli: gironi non letti", () => {
  it("con le partite: un girone unico con tutte le squadre, risultati registrati e il dubbio", () => {
    const { lega, dubbi } = importa([bozza({ gironi: null })]);
    const t = lega.tappe[0];
    expect(t.nGironi).toBe(1);
    expect(nomiGironi(t)).toEqual([["Alfa", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"]]);
    expect(t.partite).toHaveLength(15);
    expect(partitaTra(t, "Zeta", "Delta")).toEqual({ Zeta: 12, Delta: 21, done: true });
    expect(dubbi[0]).toContain("Gironi non letti: tutte le squadre in un girone unico.");
  });

  it("senza partite: niente sorteggio, 2 gironi da fare con almeno 4 squadre, altrimenti 1", () => {
    const quattro = importa([bozza({ gironi: null, partite: [] })]).lega.tappe[0];
    expect(quattro).toMatchObject({ gironi: null, partite: [], nGironi: 2 });
    const tre = importa([bozza({ squadre: [sq("Alfa"), sq("Beta"), sq("Gamma")], gironi: null, partite: [] })]);
    expect(tre.lega.tappe[0]).toMatchObject({ gironi: null, partite: [], nGironi: 1 });
    expect(tre.dubbi).toEqual([[]]);
  });
});

describe("fileDaFogli: risultati che non rispettano le regole restano da giocare, con il dubbio", () => {
  const conPartita = (puntiA: number | null, puntiB: number | null) =>
    importa([bozza({ partite: [{ a: "Alfa", b: "Beta", puntiA, puntiB }] })]);

  it("parità, negativo, non intero, oltre target + 4: partita aperta e il motivo di registraRisultato", () => {
    for (const [pa, pb] of [[21, 21], [-1, 21], [20.5, 21], [30, 12]]) {
      const { lega, dubbi } = conPartita(pa, pb);
      expect(partitaTra(lega.tappe[0], "Alfa", "Beta")?.done).toBe(false);
      expect(dubbi[0]).toHaveLength(1);
      expect(dubbi[0][0]).toMatch(new RegExp(`^Partita Alfa-Beta ${pa}-${pb} non registrata: `));
    }
    expect(conPartita(21, 21).dubbi[0][0]).toContain("non esistono pareggi");
  });

  it("un punteggio mancante → dubbio; entrambi mancanti → partita da giocare senza dubbio", () => {
    expect(conPartita(null, 15).dubbi[0]).toEqual(["Partita Alfa-Beta non registrata: manca un punteggio."]);
    const nessuno = conPartita(null, null);
    expect(nessuno.dubbi[0]).toEqual([]);
    expect(partitaTra(nessuno.lega.tappe[0], "Alfa", "Beta")?.done).toBe(false);
  });

  it("squadre di gironi diversi, squadra sconosciuta, coppia ripetuta (vale la prima)", () => {
    const { lega, dubbi } = importa([bozza({
      partite: [
        { a: "Alfa", b: "Delta", puntiA: 21, puntiB: 10 },
        { a: "Alfa", b: "Omega", puntiA: 21, puntiB: 10 },
        { a: "Alfa", b: "Beta", puntiA: 21, puntiB: 15 },
        { a: "beta", b: "ALFA", puntiA: 21, puntiB: 19 },
      ],
    })]);
    const t = lega.tappe[0];
    expect(partitaTra(t, "Alfa", "Beta")).toEqual({ Alfa: 21, Beta: 15, done: true });
    expect(t.partite.filter((m) => m.done)).toHaveLength(1);
    expect(dubbi[0]).toEqual([
      "Partita Alfa-Delta non registrata: le due squadre non si incontrano nei gironi.",
      "Partita Alfa-Omega non registrata: la squadra «Omega» non è nell'elenco.",
      "Partita beta-ALFA ripetuta sul foglio: vale la prima.",
    ]);
  });
});

describe("fileDaFogli: gironi ed elenco delle squadre non coincidono", () => {
  it("una squadra solo nei gironi si aggiunge all'elenco (senza giocatori), con il dubbio", () => {
    const { lega, dubbi } = importa([bozza({ gironi: [["Alfa", "Beta", "Gamma"], ["Delta", "Epsilon", "Zeta", "Omega"]] })]);
    const t = lega.tappe[0];
    expect(t.squadre.map((s) => s.nome)).toContain("Omega");
    expect(t.squadre.find((s) => s.nome === "Omega")?.giocatori).toEqual([]);
    expect(nomiGironi(t)[1]).toEqual(["Delta", "Epsilon", "Zeta", "Omega"]);
    expect(dubbi[0]).toEqual(["Squadra «Omega» letta solo nei gironi: aggiunta senza giocatori."]);
  });

  it("una squadra dell'elenco assente dai gironi va nel girone con meno squadre, con il dubbio", () => {
    const { lega, dubbi } = importa([bozza({ gironi: [["Alfa", "Beta", "Gamma"], ["Delta", "Epsilon"]] })]);
    expect(nomiGironi(lega.tappe[0])).toEqual([["Alfa", "Beta", "Gamma"], ["Delta", "Epsilon", "Zeta"]]);
    expect(dubbi[0]).toEqual(["Squadra «Zeta» non era in nessun girone: messa nel girone B."]);
  });

  it("una squadra in due gironi resta nel primo, con il dubbio", () => {
    const { lega, dubbi } = importa([bozza({ gironi: [["Alfa", "Beta", "Gamma"], ["Delta", "Epsilon", "Zeta", "Alfa"]] })]);
    expect(nomiGironi(lega.tappe[0])).toEqual([["Alfa", "Beta", "Gamma"], ["Delta", "Epsilon", "Zeta"]]);
    expect(dubbi[0]).toEqual(["Squadra «Alfa» in più gironi: tenuta nel girone A."]);
  });
});

describe("fileDaFogli: più fogli insieme", () => {
  it("una tappa per foglio nell'ordine, lega con il nome della prima, dubbi con il nome della foto", () => {
    const { lega, dubbi } = importa(
      [bozza({ nome: "Tappa 1", dubbi: ["primo"] }), bozza({ nome: "Tappa 2", data: "ieri" })],
      ["sabato.jpg", "domenica.jpg"],
    );
    expect(lega.nome).toBe("Tappa 1");
    expect(lega.tappe.map((t) => t.nome)).toEqual(["Tappa 1", "Tappa 2"]);
    expect(dubbi).toEqual([["sabato.jpg: primo"], ["domenica.jpg: Data non valida sul foglio: ieri"]]);
  });

  it("il nome di riserva conta i fogli: il secondo senza nome è «Tappa da foglio 2»", () => {
    const { lega } = importa([bozza(), bozza({ nome: null })]);
    expect(lega.tappe[1].nome).toBe("Tappa da foglio 2");
  });
});
