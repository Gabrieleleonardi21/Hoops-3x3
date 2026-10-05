import { describe, it, expect } from "vitest";
import { conteggio, perditaGiocatore, perditaLega, perditaSquadraAnagrafe } from "../../src/utils/testi";
import type { LegaMeta, RegGiocatore, RegSquadra } from "../../src/types";

describe("conteggio: il numero con il nome al singolare o al plurale", () => {
  it("uno è singolare; zero e gli altri sono plurali", () => {
    expect(conteggio(1, "risultato", "risultati")).toBe("1 risultato");
    expect(conteggio(0, "risultato", "risultati")).toBe("0 risultati");
    expect(conteggio(12, "risultato", "risultati")).toBe("12 risultati");
  });
});

describe("testi di ciò che si perde eliminando una lega o una voce dell'anagrafe", () => {
  it("lega: dice quante tappe, con squadre e risultati", () => {
    const lega = (nTappe: number): LegaMeta => ({ id: "l1", nome: "Estate", ts: 1, nTappe });
    expect(perditaLega(lega(2))).toBe("Verrà eliminata la lega «Estate» con 2 tappe, squadre e risultati compresi.");
    expect(perditaLega(lega(1))).toBe("Verrà eliminata la lega «Estate» con 1 tappa, squadre e risultati compresi.");
    expect(perditaLega(lega(0))).toBe("Verrà eliminata la lega «Estate» con 0 tappe, squadre e risultati compresi.");
  });

  it("giocatore: sparisce dall'anagrafe condivisa e dai roster", () => {
    const g = { id: "g1", nome: "Mario", cognome: "Rossi" } as RegGiocatore;
    expect(perditaGiocatore(g)).toBe("Verrà eliminato il giocatore «Mario Rossi» dall'anagrafe condivisa e dai roster delle squadre.");
  });

  it("squadra: i giocatori del roster restano registrati (solo se c'è un roster)", () => {
    const s = (roster: string[]) => ({ id: "s1", nome: "Ballers", roster }) as RegSquadra;
    expect(perditaSquadraAnagrafe(s(["g1", "g2"])))
      .toBe("Verrà eliminata la squadra «Ballers» dall'anagrafe condivisa. I giocatori del roster restano registrati.");
    expect(perditaSquadraAnagrafe(s([]))).toBe("Verrà eliminata la squadra «Ballers» dall'anagrafe condivisa.");
  });
});
