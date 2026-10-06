// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StatsCircuito } from "../../src/components/anagrafe/StatsCircuito";
import { AnagrafePage } from "../../src/pages/AnagrafePage";
import { GiocatorePage } from "../../src/pages/GiocatorePage";
import { useAppStore } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { tappaDiProva, unaGara } from "./tappeDiProva";
import type { RegGiocatore, Tappa, User } from "../../src/types";

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  useAppStore.getState().reset();
  // La cache dell'anagrafe è stato di modulo: ogni test riparte da «non ancora caricata»
  useAnagrafeStore.setState({ giocatori: null, squadre: null, errore: null, caricata: false });
});

/** Le righe del corpo della tabella di stagione, come testo delle celle (la prima riga è l'intestazione) */
const righe = () => screen.getAllByRole("row").slice(1).map((riga) => within(riga).getAllByRole("cell").map((c) => c.textContent));

describe("Statistiche stagione: la tabella", () => {
  it("lo stesso giocatore in tre tappe è una riga con i totali e le medie, non tre", () => {
    // Luca gioca solo nella prima tappa; Mario in tutte e tre, con un id diverso a ogni tappa
    const t1 = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Luca Bianchi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12, rb: 3, as: 2 } }, pb: { "Luca Bianchi": { pt: 15 } } },
    ]);
    const t2 = unaGara("t2", "Alfa", "Mario Rossi", { pt: 10, rb: 1, ru: 1 });
    const t3 = unaGara("t3", "Alfa", "Mario Rossi", { pt: 8, rb: 3 });
    render(<StatsCircuito tappe={[t1, t2, t3]} />);
    // #, giocatore, squadra, G, PT, Pt/G, RB, Rb/G, AS, RU, ST: in cima Luca, 15 punti a partita contro 10
    expect(righe()).toEqual([
      ["1", "Luca Bianchi", "Beta", "1", "15", "15.0", "0", "0.0", "0", "0", "0"],
      ["2", "Mario Rossi", "Alfa", "3", "30", "10.0", "7", "2.3", "2", "1", "0"],
    ]);
  });

  it("due omonimi in squadre diverse sono due righe, in ordine di media punti", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Mario Rossi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 8 } }, pb: { "Mario Rossi": { pt: 14 } } },
    ]);
    render(<StatsCircuito tappe={[t]} />);
    expect(righe().map((r) => r.slice(0, 5))).toEqual([
      ["1", "Mario Rossi", "Beta", "1", "14"],
      ["2", "Mario Rossi", "Alfa", "1", "8"],
    ]);
  });

  it("le grafie diverse dello stesso nome sono una riga, scritta come nella tappa più recente", () => {
    render(<StatsCircuito tappe={[
      unaGara("t1", "alfa  team", "nicolo rossi", { pt: 10 }),
      unaGara("t2", "Alfa Team", "Nicolò Rossi", { pt: 12 }),
    ]} />);
    expect(righe().map((r) => r.slice(0, 5))).toEqual([["1", "Nicolò Rossi", "Alfa Team", "2", "22"]]);
  });

  it("una partita non giocata non entra nella tabella, nemmeno con un tabellino provvisorio", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Beta", done: false, sa: 0, sb: 0, pa: { "Mario Rossi": { pt: 30 } } },
    ]);
    render(<StatsCircuito tappe={[t]} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/Nessuna statistica disponibile/)).toBeTruthy();
  });
});

const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };

/** Un giocatore dell'anagrafe */
const registrazione = (id: string, nome: string, cognome: string): RegGiocatore => ({
  id, nome, cognome, soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "", peso: "", ruolo: "", numero: "",
  squadra: "", esperienza: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
});

/** Apre la pagina di un giocatore con queste tappe nella lega attiva. L'anagrafe è già in cache: nessuna richiesta di rete */
function apriProfilo(giocatore: RegGiocatore, tappe: Tappa[]) {
  useAppStore.setState({ user: registrato, tappe });
  useAnagrafeStore.setState({ giocatori: [giocatore], squadre: [], errore: null, caricata: true });
  render(
    <MemoryRouter initialEntries={[`/giocatore/${giocatore.id}`]}>
      <Routes><Route path="/giocatore/:id" element={<GiocatorePage />} /></Routes>
    </MemoryRouter>,
  );
}

/** Il numero grande di un riquadro del profilo («Punti» → «22») */
const riquadro = (etichetta: string) => screen.getByText(etichetta).nextElementSibling?.firstElementChild?.textContent;

/** La riga piccola sotto il numero di un riquadro («Gare» → «2V · 0P») */
const sottoRiquadro = (etichetta: string) => screen.getByText(etichetta).nextElementSibling?.lastElementChild?.textContent;

/** Le righe dello storico tappe del profilo, come testo delle celle: tappa, piazzamento, G, PT, REB, AST */
const storico = () => screen.getAllByRole("row").slice(1).map((riga) => within(riga).getAllByRole("cell").map((c) => c.textContent));

describe("Profilo del giocatore: le statistiche di stagione", () => {
  const mario = registrazione("g1", "Mario", "Rossi");
  // Mario gioca con Alfa nella prima tappa e con Beta nella seconda, dove il roster lo scrive «Rossi Mario». Il roster di
  // tappa non è collegato all'anagrafe: il nome, in un ordine o nell'altro, è l'unico legame
  const dueSquadre = () => [
    tappaDiProva("t1", { Alfa: ["Mario Rossi"], Avversari: ["Anna Verdi"] }, [
      { a: "Alfa", b: "Avversari", pa: { "Mario Rossi": { pt: 12, rb: 3, ru: 1 } }, pb: { "Anna Verdi": { pt: 20 } } },
    ]),
    tappaDiProva("t2", { Beta: ["Rossi Mario"], Avversari: ["Anna Verdi"] }, [
      { a: "Beta", b: "Avversari", pa: { "Rossi Mario": { pt: 10, as: 2, st: 1 } } },
    ]),
  ];

  it("somma le righe dello stesso nome nelle squadre diverse", () => {
    apriProfilo(mario, dueSquadre());
    expect(riquadro("Punti")).toBe("22");
    expect(riquadro("Rimbalzi")).toBe("3");
    expect(riquadro("Assist")).toBe("2");
    expect(riquadro("Rubate")).toBe("1");
    expect(riquadro("Stoppate")).toBe("1");
    expect(riquadro("Gare")).toBe("2");
    // Lo storico resta una riga per tappa
    expect(storico()).toEqual([
      ["Tappa t1", "—", "1", "12", "3", "0"],
      ["Tappa t2", "—", "1", "10", "0", "2"],
    ]);
  });

  it("somma anche due squadre della stessa tappa con lo stesso nome: totali, storico, vittorie e partite", () => {
    // Due «Mario Rossi» nello stesso torneo, uno per squadra, e tutte e due vincono: il profilo non può sapere quale sia il
    // suo, quindi li somma e dice le due squadre
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Mario Rossi"], Gamma: ["Piero Neri"], Delta: ["Luca Bianchi"] }, [
      { a: "Alfa", b: "Gamma", pa: { "Mario Rossi": { pt: 12, rb: 3 } } },
      { a: "Beta", b: "Delta", pa: { "Mario Rossi": { pt: 7 } } },
    ]);
    apriProfilo(mario, [t]);
    expect(riquadro("Punti")).toBe("19");
    expect(riquadro("Gare")).toBe("2");
    // Le due gare sono vinte: nessuna sconfitta
    expect(sottoRiquadro("Gare")).toBe("2V · 0P");
    expect(screen.getByText("2 partite · max 12")).toBeTruthy();
    expect(storico()).toEqual([["Tappa t1", "—", "2", "19", "3", "0"]]);
    expect(screen.getByText(/sommate per nome sulle squadre di tappa: Alfa, Beta\./)).toBeTruthy();
  });

  it("elenca le squadre da cui vengono le statistiche", () => {
    apriProfilo(mario, dueSquadre());
    expect(screen.getByText(/sommate per nome sulle squadre di tappa: Alfa, Beta\./)).toBeTruthy();
  });

  it("una squadra in più tappe compare una volta sola, con la grafia dell'ultima", () => {
    apriProfilo(mario, [unaGara("t1", "alfa", "Mario Rossi", { pt: 12 }), unaGara("t2", "ALFA", "Mario Rossi", { pt: 10 })]);
    expect(riquadro("Punti")).toBe("22");
    expect(screen.getByText(/sommate per nome sulle squadre di tappa: ALFA\./)).toBeTruthy();
  });

  it("il nome si riconosce come nella tabella: maiuscole, spazi e accenti non contano", () => {
    apriProfilo(registrazione("g1", "Nicolò", "Rossi"), [unaGara("t1", "Alfa", "  nicolo   ROSSI ", { pt: 14 })]);
    expect(riquadro("Punti")).toBe("14");
    expect(screen.queryByText(/Nessuna statistica nella lega attiva/)).toBeNull();
    expect(storico()).toEqual([["Tappa t1", "—", "1", "14", "0", "0"]]);
    // Anche le partite singole riconoscono il nome: la gara è vinta (21-15)
    expect(sottoRiquadro("Gare")).toBe("1V · 0P");
  });

  it("una partita non giocata non entra nel profilo, nemmeno con un tabellino provvisorio", () => {
    const t = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Avversari: ["Altro"] }, [
      { a: "Alfa", b: "Avversari", pa: { "Mario Rossi": { pt: 12 } } },
      { a: "Alfa", b: "Avversari", done: false, sa: 0, sb: 0, pa: { "Mario Rossi": { pt: 30 } } },
    ]);
    apriProfilo(mario, [t]);
    expect(riquadro("Punti")).toBe("12");
    expect(riquadro("Gare")).toBe("1");
    // Neanche l'elenco delle partite la conta
    expect(screen.getByText(/^1 partit\w+ · max 12$/)).toBeTruthy();
  });

  it("lo storico dice il piazzamento dalla finale del tabellone: 1° per chi l'ha vinta, 2° per chi l'ha persa", () => {
    // Mario vince la finale con Alfa nella prima tappa e la perde con Beta nella seconda
    const conFinale = (t: Tappa, squadraA: string, squadraB: string, pA: number, pB: number): Tappa => ({
      ...t,
      bracket: [{ id: `${t.id}:f`, label: "Finale", squadraA: `${t.id}:${squadraA}`, squadraB: `${t.id}:${squadraB}`, pA, pB, done: true }],
    });
    const [t1, t2] = dueSquadre();
    apriProfilo(mario, [conFinale(t1, "Alfa", "Avversari", 21, 15), conFinale(t2, "Beta", "Avversari", 12, 21)]);
    expect(storico().map((riga) => riga[1])).toEqual(["1°", "2°"]);
  });

  it("senza statistiche nella lega non c'è nessun elenco di squadre, solo la spiegazione di prima", () => {
    apriProfilo(mario, [unaGara("t1", "Alfa", "Luca Bianchi", { pt: 9 })]);
    expect(riquadro("Punti")).toBe("0");
    expect(screen.queryByText(/squadre di tappa/)).toBeNull();
    expect(screen.getByText(/Nessuna statistica nella lega attiva/)).toBeTruthy();
  });
});

describe("Statistiche stagione: la nota sopra la tabella", () => {
  it("dice come si riconosce un giocatore e il limite: chi cambia squadra compare su due righe", () => {
    useAppStore.setState({ user: registrato, tappe: [] });
    useAnagrafeStore.setState({ giocatori: [], squadre: [], errore: null, caricata: true });
    render(<MemoryRouter><AnagrafePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "Statistiche stagione" }));
    const nota = screen.getByText(/Totali e medie per partita/).textContent;
    expect(nota).toContain("nome e squadra coincidono (maiuscole, spazi e accenti non contano)");
    expect(nota).toContain("chi cambia squadra compare su due righe");
  });
});
