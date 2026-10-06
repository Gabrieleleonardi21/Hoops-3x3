// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { StatsCircuito } from "../../src/components/anagrafe/StatsCircuito";
import { tappaDiProva, unaGara } from "./tappeDiProva";

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
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
