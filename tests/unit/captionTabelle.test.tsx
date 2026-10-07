// @vitest-environment jsdom
/** Ogni tabella ha un <caption> (anche solo per i lettori di schermo, classe sr-only) che dice che cosa contiene: è il nome con cui
 *  il lettore di schermo la annuncia. Qui i tabellini e l'analisi del giocatore; lo storico tappe del profilo è in
 *  statisticheStagione.test.tsx, dove c'è già la pagina del profilo. */
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StatsView } from "../../src/components/partita/StatsView";
import { StatsEditor } from "../../src/components/partita/StatsEditor";
import { GiocatoreAnalisi } from "../../src/components/archivio/GiocatoreAnalisi";
import { tappaDiProva } from "./tappeDiProva";

afterEach(cleanup); // senza le globali di Vitest, Testing Library non smonta da sola

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
});
