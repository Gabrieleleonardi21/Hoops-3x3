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
  it("lega: dice quante tappe, con squadre e risultati; una lega vuota lo dice senza giri di parole", () => {
    const lega = (nTappe: number): LegaMeta => ({ id: "l1", nome: "Estate", ts: 1, nTappe });
    expect(perditaLega(lega(2))).toBe("Verrà eliminata la lega «Estate» con 2 tappe, squadre e risultati compresi.");
    expect(perditaLega(lega(1))).toBe("Verrà eliminata la lega «Estate» con 1 tappa, squadre e risultati compresi.");
    expect(perditaLega(lega(0))).toBe("Verrà eliminata la lega «Estate», che non ha tappe.");
  });

  it("giocatore: sparisce dall'anagrafe condivisa e dai roster in cui c'è, contati; se non è in nessun roster non ne parla", () => {
    const g = { id: "g1", nome: "Mario", cognome: "Rossi" } as RegGiocatore;
    const squadra = (id: string, roster: string[]) => ({ id, roster }) as RegSquadra;
    const solo = "Verrà eliminato il giocatore «Mario Rossi» dall'anagrafe condivisa.";
    expect(perditaGiocatore(g)).toBe(solo); // senza l'elenco delle squadre
    expect(perditaGiocatore(g, [squadra("s1", ["g2"]), squadra("s2", [])])).toBe(solo);
    expect(perditaGiocatore(g, [squadra("s1", ["g1", "g2"]), squadra("s2", ["g3"])]))
      .toBe("Verrà eliminato il giocatore «Mario Rossi» dall'anagrafe condivisa e da 1 roster.");
    expect(perditaGiocatore(g, [squadra("s1", ["g1"]), squadra("s2", ["g9", "g1"]), squadra("s3", [])]))
      .toBe("Verrà eliminato il giocatore «Mario Rossi» dall'anagrafe condivisa e da 2 roster.");
  });

  it("squadra: i giocatori del roster restano registrati (solo se c'è un roster)", () => {
    const s = (roster: string[]) => ({ id: "s1", nome: "Ballers", roster }) as RegSquadra;
    expect(perditaSquadraAnagrafe(s(["g1", "g2"])))
      .toBe("Verrà eliminata la squadra «Ballers» dall'anagrafe condivisa. I giocatori del roster restano registrati.");
    expect(perditaSquadraAnagrafe(s([]))).toBe("Verrà eliminata la squadra «Ballers» dall'anagrafe condivisa.");
  });
});
