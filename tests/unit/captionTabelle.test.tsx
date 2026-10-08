// @vitest-environment jsdom
/** Ogni tabella ha un <caption> (anche solo per i lettori di schermo, classe sr-only) che dice che cosa contiene: è il nome con cui
 *  il lettore di schermo la annuncia. Sono sette, e qui ci sono sei prove: i tabellini, l'analisi del giocatore, le classifiche
 *  (girone e circuito) e le statistiche di stagione; lo storico tappe del profilo è in statisticheStagione.test.tsx, dove c'è
 *  già la pagina del profilo. */
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StatsView } from "../../src/components/partita/StatsView";
import { StatsEditor } from "../../src/components/partita/StatsEditor";
import { GiocatoreAnalisi } from "../../src/components/archivio/GiocatoreAnalisi";
import { StandingsTable } from "../../src/components/leaderboard/StandingsTable";
import { StatsCircuito } from "../../src/components/anagrafe/StatsCircuito";
import { LegaPage } from "../../src/pages/LegaPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { tappaDiProva, unaGara } from "./tappeDiProva";

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  useAppStore.getState().reset();
  localStorage.clear();
});

const giocatori = [{ id: "p1", nome: "Mario Rossi" }];

/** La tabella che il lettore di schermo annuncia con questo nome (il suo <caption>), e il caption è nascosto alla vista */
function tabellaChiamata(nome: string) {
  const tabella = screen.getByRole<HTMLTableElement>("table", { name: nome });
  expect(tabella.caption?.classList.contains("sr-only")).toBe(true);
}

describe("Tabelle con <caption> per i lettori di schermo", () => {
  it("tabellino in sola lettura (StatsView): dice di quale squadra sono le statistiche registrate", () => {
    render(<StatsView teamName="Alfa" players={giocatori} sheet={{ p1: { pt: 12 } }} />);
    tabellaChiamata("Statistiche registrate dei giocatori di Alfa");
  });

  it("tabellino da compilare (StatsEditor): dice di quale squadra sono le statistiche da inserire", () => {
    render(<StatsEditor teamName="Alfa" players={giocatori} sheet={{}} guest={false} onChange={() => {}} />);
    tabellaChiamata("Statistiche da inserire per i giocatori di Alfa");
  });

  it("analisi del giocatore (GiocatoreAnalisi): dice che sono le medie a partita del giocatore nella tappa", () => {
    const tappa = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Luigi Verdi"] }, [
      { a: "Alfa", b: "Beta", pa: { "Mario Rossi": { pt: 12, rb: 3 } }, pb: { "Luigi Verdi": { pt: 9 } } },
    ]);
    render(<GiocatoreAnalisi tappa={tappa} pid="t1:Alfa:Mario Rossi" onClose={() => {}} />);
    tabellaChiamata("Medie a partita di Mario Rossi nella tappa");
  });

  const righe = [{ id: "s1", nome: "Alfa", g: 2, v: 2, p: 0, pf: 42, ps: 30 }];

  it("classifica (StandingsTable): il caption è quello dato dalla pagina, «Classifica» se manca", () => {
    render(<StandingsTable rows={righe} caption="Classifica girone A" />);
    tabellaChiamata("Classifica girone A");
    cleanup();
    render(<StandingsTable rows={righe} />);
    tabellaChiamata("Classifica");
  });

  it("statistiche di stagione (StatsCircuito): dice che sono le statistiche di stagione per giocatore", () => {
    render(<StatsCircuito tappe={[unaGara("t1", "Alfa", "Mario Rossi", { pt: 12 })]} />);
    tabellaChiamata("Statistiche di stagione per giocatore");
  });

  it("classifica circuito (pagina della lega): dice che è la classifica del circuito", () => {
    const tappa = tappaDiProva("t1", { Alfa: ["Mario Rossi"], Beta: ["Luigi Verdi"] }, [{ a: "Alfa", b: "Beta" }]);
    useAppStore.setState({
      user: { name: "Ospite", guest: true }, legaId: "l1", legaName: "Lega",
      leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [tappa],
    });
    render(<MemoryRouter><LegaPage /></MemoryRouter>);
    tabellaChiamata("Classifica circuito");
  });
});
