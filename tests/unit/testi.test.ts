import { describe, it, expect } from "vitest";
import {
  COPIA_LINK_NON_RIUSCITA, PERDITA_RIAPERTURA, SPAZIO_ESAURITO, SPAZIO_ESAURITO_ACCESSO, SPAZIO_ESAURITO_LEGA,
  conteggio, copiaPubblicaNonAggiornata, perditaGiocatore, perditaLega, perditaSquadraAnagrafe, pubblicazioneSenzaSalvataggio, salvataggioRifiutato,
  tappaNonPubblicata,
} from "../../src/utils/testi";
import type { LegaMeta, RegGiocatore, RegSquadra } from "../../src/types";

describe("conteggio: il numero con il nome al singolare o al plurale", () => {
  it("uno è singolare; zero e gli altri sono plurali", () => {
    expect(conteggio(1, "risultato", "risultati")).toBe("1 risultato");
    expect(conteggio(0, "risultato", "risultati")).toBe("0 risultati");
    expect(conteggio(12, "risultato", "risultati")).toBe("12 risultati");
  });
});

describe("salvataggio rifiutato dal server: che cosa è successo e che cosa fare", () => {
  it("nella lega aperta: correggere la tappa, oppure riaprire la lega per tornare alla versione salvata sul server", () => {
    expect(salvataggioRifiutato("Finale", "Dati della tappa non validi", "Estate", true)).toBe(
      "Salvataggio della tappa «Finale» non riuscito: Dati della tappa non validi. Correggi la tappa, oppure riapri la lega «Estate» "
      + "da «Le mie leghe» per tornare alla versione salvata sul server.",
    );
  });

  it("in un'altra lega: la nomina, e dice che quella versione qui non c'è più invece di promettere di salvarla", () => {
    expect(salvataggioRifiutato("Finale", "Dati della tappa non validi.", "Inverno", false)).toBe(
      "Salvataggio della tappa «Finale» della lega «Inverno» non riuscito: Dati della tappa non validi. Quella versione non è più qui: "
      + "aprendo la lega «Inverno» trovi quella salvata sul server.",
    );
  });

  it("tappa nuova, mai arrivata sul server: non promette una versione salvata che non c'è", () => {
    expect(salvataggioRifiutato("Finale", "Dati della tappa non validi", "Estate", true, true)).toBe(
      "Salvataggio della tappa nuova «Finale» non riuscito: Dati della tappa non validi. Non è ancora sul server: correggila, perché "
      + "riaprendo la lega «Estate» sparirebbe.",
    );
    expect(salvataggioRifiutato("Finale", "Dati della tappa non validi", "Inverno", false, true)).toBe(
      "Salvataggio della tappa nuova «Finale» della lega «Inverno» non riuscito: Dati della tappa non validi. Non è mai arrivata sul "
      + "server e quella versione non è più qui: è andata persa.",
    );
    expect(salvataggioRifiutato("", "Il nome della tappa è obbligatorio", "Estate", true, true))
      .toMatch(/^Salvataggio di una tappa nuova senza nome non riuscito: /);
  });

  it("una tappa senza nome (il nome vuoto può essere proprio il dato rifiutato)", () => {
    expect(salvataggioRifiutato("  ", "Il nome della tappa è obbligatorio", "Estate", true))
      .toMatch(/^Salvataggio di una tappa senza nome non riuscito: Il nome della tappa è obbligatorio\. Correggi la tappa/);
    expect(salvataggioRifiutato("", "Il nome della tappa è obbligatorio", "Inverno", false))
      .toMatch(/^Salvataggio di una tappa senza nome della lega «Inverno» non riuscito: /);
  });
});

describe("testi di ciò che si perde eliminando una lega o una voce dell'anagrafe", () => {
  it("lega: dice quante tappe, con squadre e risultati; una lega vuota lo dice senza giri di parole", () => {
    const lega = (nTappe: number): LegaMeta => ({ id: "l1", nome: "Estate", ts: 1, nTappe });
    expect(perditaLega(lega(2))).toBe("Verrà eliminata la lega «Estate» con 2 tappe, squadre e risultati compresi.");
    expect(perditaLega(lega(1))).toBe("Verrà eliminata la lega «Estate» con 1 tappa, squadre e risultati compresi.");
    expect(perditaLega(lega(0))).toBe("Verrà eliminata la lega «Estate», che non ha tappe.");
  });

  it("lega di chi ha un account: dice anche che le tappe pubblicate escono dall'archivio (l'ospite non pubblica niente)", () => {
    const lega = (nTappe: number): LegaMeta => ({ id: "l1", nome: "Estate", ts: 1, nTappe });
    expect(perditaLega(lega(2), true)).toBe(
      "Verrà eliminata la lega «Estate» con 2 tappe, squadre e risultati compresi. "
      + "Le tappe pubblicate usciranno dall'Archivio circuito e i loro link pubblici smetteranno di funzionare.",
    );
    expect(perditaLega(lega(0), true)).toBe("Verrà eliminata la lega «Estate», che non ha tappe.");
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

  it("riapri: la tappa esce dall'Archivio circuito, il suo link smette di funzionare, il resto resta", () => {
    expect(PERDITA_RIAPERTURA).toContain("uscirà dall'Archivio circuito");
    expect(PERDITA_RIAPERTURA).toContain("link pubblico smetterà di funzionare");
    expect(PERDITA_RIAPERTURA).toContain("Sorteggio e risultati restano");
  });

  it("squadra: i giocatori del roster restano registrati (solo se c'è un roster)", () => {
    const s = (roster: string[]) => ({ id: "s1", nome: "Ballers", roster }) as RegSquadra;
    expect(perditaSquadraAnagrafe(s(["g1", "g2"])))
      .toBe("Verrà eliminata la squadra «Ballers» dall'anagrafe condivisa. I giocatori del roster restano registrati.");
    expect(perditaSquadraAnagrafe(s([]))).toBe("Verrà eliminata la squadra «Ballers» dall'anagrafe condivisa.");
  });
});

describe("avvisi per lo spazio del browser esaurito", () => {
  it("i tre testi cominciano allo stesso modo e dicono ciascuno che cosa non si può salvare", () => {
    for (const testo of [SPAZIO_ESAURITO, SPAZIO_ESAURITO_LEGA, SPAZIO_ESAURITO_ACCESSO]) {
      expect(testo.startsWith("Spazio esaurito nel browser: ")).toBe(true);
    }
    expect(SPAZIO_ESAURITO).toContain("le ultime modifiche non sono salvate");
    expect(SPAZIO_ESAURITO_LEGA).toContain("la lega non si può salvare");
    expect(SPAZIO_ESAURITO_ACCESSO).toContain("non si può salvare l'accesso");
    expect(COPIA_LINK_NON_RIUSCITA).not.toMatch(/^Spazio esaurito/);
  });
});

describe("testi della pubblicazione nell'Archivio circuito", () => {
  it("tappa non pubblicata: con un tentativo fallito dice perché; verificata in archivio dice che non risulta; sempre la via d'uscita", () => {
    const uscita = "«Riapri» e poi «Concludi»";
    const fallita = tappaNonPubblicata("Server non raggiungibile");
    expect(fallita).toContain("non è riuscita");
    expect(fallita).toContain("Motivo: Server non raggiungibile");
    expect(fallita).toContain(uscita);
    const verificata = tappaNonPubblicata(null);
    expect(verificata).toContain("non risulta pubblicata");
    expect(verificata).not.toContain("Motivo");
    expect(verificata).toContain(uscita);
  });

  it("copia pubblica non aggiornata: dice che un video tolto resta visibile a tutti, col motivo, e indica «Riapri» e poi «Concludi»", () => {
    const testo = copiaPubblicaNonAggiornata("Server non raggiungibile");
    expect(testo).toContain("La copia pubblica non è aggiornata");
    expect(testo).toContain("resta visibile a tutti");
    expect(testo).toContain("«Riapri» e poi «Concludi»");
    expect(testo).toContain("Motivo: Server non raggiungibile");
  });

  it("salvataggio mancante: dice che si pubblica dopo il salvataggio, col motivo se lo si sa", () => {
    expect(pubblicazioneSenzaSalvataggio("Server non raggiungibile"))
      .toBe("Prima di pubblicare, l'ultima versione della tappa deve essere salvata sul server, ma il salvataggio non è riuscito: Server non raggiungibile");
    expect(pubblicazioneSenzaSalvataggio(null))
      .toBe("Prima di pubblicare, l'ultima versione della tappa deve essere salvata sul server, ma il salvataggio non è riuscito.");
  });
});
