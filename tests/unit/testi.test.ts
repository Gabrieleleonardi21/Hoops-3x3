import { describe, it, expect } from "vitest";
import {
  COPIA_LINK_NON_RIUSCITA, PERDITA_RIAPERTURA, SPAZIO_ESAURITO, SPAZIO_ESAURITO_ACCESSO, SPAZIO_ESAURITO_LEGA,
  conteggio, copiaPubblicaNonAggiornata, perditaAccount, perditaGiocatore, perditaLega, perditaSquadraAnagrafe, pubblicazioneSenzaSalvataggio, salvataggioRifiutato,
  tappaNonPubblicata, BOZZA_FOGLIO_NON_VALIDA, FILE_NON_SUPPORTATO, FOTO_NON_APRIBILE, FOTO_NON_RIDUCIBILE, FOTO_RISERVATA, FOTO_TROPPO_GRANDE,
  JSON_TROPPO_GRANDE, LETTURA_FALLITA, LETTURA_IN_CORSO, NESSUN_DUBBIO, SCELTA_FILE, TROPPE_FOTO, messaggioDubbi,
} from "../../src/utils/testi";
import type { LegaMeta, RegGiocatore, RegSquadra } from "../../src/types";
import {
  AVVISO_GIOCATORE_RIPETUTO, AVVISO_NUOVA_OMONIMA, AVVISO_SQUADRA_OMONIMA, AVVISO_TAPPA_OMONIMA, AVVISO_VOCE_ELIMINATA, AVVISO_VOCE_OMONIMA,
  TITOLO_SCELTA_SQUADRA,
} from "../../src/utils/testi";

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

describe("perditaAccount: che cosa sparisce e che cosa resta con l'account", () => {
  const resta = "I campetti e le schede dell'anagrafe che hai inserito restano, senza autore. Non si può annullare.";

  it("con più leghe dice quante spariscono, con tappe, pubblicazioni e modifiche non salvate", () => {
    expect(perditaAccount(3, true)).toBe(
      "Le tue 3 leghe, con le loro tappe e le pubblicazioni in archivio, saranno eliminate per sempre, comprese le modifiche non ancora salvate. "
      + resta,
    );
  });

  it("con una sola lega usa il singolare", () => {
    expect(perditaAccount(1, true)).toBe(
      "La tua lega, con le sue tappe e le pubblicazioni in archivio, sarà eliminata per sempre, comprese le modifiche non ancora salvate. "
      + resta,
    );
  });

  it("senza leghe lo dice al posto della prima frase", () => {
    expect(perditaAccount(0, true)).toBe(`Non hai leghe da eliminare. ${resta}`);
  });

  it("se il numero delle leghe non si conosce, non dice che non ce ne sono", () => {
    expect(perditaAccount(null, true)).toBe(
      "Le tue leghe, con le loro tappe e le pubblicazioni in archivio, saranno eliminate per sempre, comprese le modifiche non ancora salvate. "
      + resta,
    );
  });

  it("se l'anagrafe non resta, dice che le schede spariscono con l'account", () => {
    expect(perditaAccount(2, false)).toContain("le schede dell'anagrafe che hai creato spariscono con l'account");
    expect(perditaAccount(2, false)).not.toContain("restano, senza autore. Non");
  });
});

describe("Importa file: i messaggi del JSON e delle foto dei fogli", () => {
  it("formati e limiti nominano il file e dicono che cosa fare", () => {
    expect(FILE_NON_SUPPORTATO("foglio.heic")).toBe(
      "Il file «foglio.heic» non è un JSON di HOOP 3X3 né una foto JPEG, PNG o WebP (una foto HEIC va salvata come JPEG).",
    );
    expect(SCELTA_FILE).toBe(
      "Scegli un file JSON esportato da HOOP 3X3 oppure fino a 10 foto (JPEG, PNG o WebP), non entrambi.",
    );
    expect(TROPPE_FOTO).toBe("Al massimo 10 foto per volta.");
    expect(FOTO_TROPPO_GRANDE("a.jpg")).toBe("La foto «a.jpg» supera 20 MB.");
    expect(JSON_TROPPO_GRANDE).toBe("Il file supera 5 MB.");
    expect(FOTO_NON_RIDUCIBILE("a.jpg")).toBe("La foto «a.jpg» resta troppo grande anche ridotta: ritagliala e riprova.");
    expect(FOTO_NON_APRIBILE("a.jpg")).toBe("La foto «a.jpg» non si apre in questo browser: salvala come JPEG e riprova.");
  });

  it("ospite, lettura in corso, lettura fallita e risposta fuori forma", () => {
    expect(FOTO_RISERVATA).toBe(
      "La lettura delle foto è riservata agli utenti registrati: crea un account gratuito dalla home per usarla.",
    );
    expect(LETTURA_IN_CORSO(2, 3)).toBe("Lettura del foglio 2 di 3…");
    expect(LETTURA_FALLITA("b.jpg", "Lettore dei fogli non raggiungibile")).toBe("Foto «b.jpg»: Lettore dei fogli non raggiungibile");
    expect(BOZZA_FOGLIO_NON_VALIDA).toBe("La lettura del foglio non è nella forma attesa: riprova più tardi.");
    expect(NESSUN_DUBBIO).toBe("Il lettore non ha segnalato dubbi: controlla comunque nomi e punteggi.");
  });
});

describe("messaggioDubbi: il messaggio con cui il Coach si apre dopo l'import dalle foto", () => {
  const CHIUSURA = "Dimmi che cosa correggere: posso rinominare una squadra, sistemare i suoi giocatori, registrare o annullare "
    + "un risultato, sorteggiare i gironi.";

  it("una tappa con i dubbi: tappa, lega, i dubbi uno dopo l'altro e che cosa può fare il Coach", () => {
    expect(messaggioDubbi("Sabato", [{ nome: "Sabato", dubbi: ["Alpha o Alfa?", "Squadra «Beta» ripetuta sul foglio."] }])).toBe(
      "Ho importato dal foglio la tappa «Sabato» nella lega «Sabato». Il lettore non era sicuro di: Alpha o Alfa?; "
      + `Squadra «Beta» ripetuta sul foglio. ${CHIUSURA}`,
    );
  });

  it("senza dubbi lo dice; con più tappe le nomina tutte", () => {
    expect(messaggioDubbi("Lega", [{ nome: "A", dubbi: [] }, { nome: "B", dubbi: [] }])).toBe(
      `Ho importato dai fogli le tappe «A», «B» nella lega «Lega». ${NESSUN_DUBBIO} ${CHIUSURA}`,
    );
  });
});

describe("avvisi sui doppioni: il nome c'è già, ma si può creare lo stesso", () => {
  it("tappa: dice quale tappa è, con data e luogo, o che mancano", () => {
    expect(AVVISO_TAPPA_OMONIMA({ nome: "Roma Open", data: "2026-06-01", luogo: "Roma" })).toBe(
      "Esiste già una tappa «Roma Open» (2026-06-01, Roma). Il nome può ripetersi: le tappe si distinguono per data e luogo.",
    );
    expect(AVVISO_TAPPA_OMONIMA({ nome: "Finale", data: "", luogo: "" })).toBe(
      "Esiste già una tappa «Finale» (senza data, senza luogo). Il nome può ripetersi: le tappe si distinguono per data e luogo.",
    );
  });

  it("squadra e giocatori di una rosa: dicono che cosa cambia nelle statistiche", () => {
    expect(AVVISO_SQUADRA_OMONIMA).toBe(
      "Un'altra squadra di questa tappa si chiama così: il Coach le distingue per girone o città; nelle statistiche contano i collegamenti all'anagrafe.",
    );
    expect(AVVISO_GIOCATORE_RIPETUTO).toBe(
      "Due giocatori con lo stesso nome: nelle statistiche saranno sommati, a meno che la squadra sia collegata all'anagrafe con entrambi registrati.",
    );
  });

  it("scelta tra squadre omonime: il titolo fa il nome, e la squadra nuova dice quale posto prenderà", () => {
    expect(TITOLO_SCELTA_SQUADRA("Roma")).toBe("Più squadre si chiamano «Roma»: quale collegare?");
    expect(AVVISO_NUOVA_OMONIMA(3)).toBe("Sarà la terza squadra con questo nome.");
    expect(AVVISO_NUOVA_OMONIMA(12)).toBe("Sarà la 12ª squadra con questo nome.");
  });

  it("voce dell'anagrafe: «un'altra» per la squadra, «un altro» per il giocatore", () => {
    expect(AVVISO_VOCE_OMONIMA("«Roma» (Torino, di Gabriele)", "squadra")).toBe(
      "Esiste già «Roma» (Torino, di Gabriele). Premi di nuovo Salva per registrarne un'altra.",
    );
    expect(AVVISO_VOCE_OMONIMA("Mario Rossi (senza squadra)", "giocatore")).toBe(
      "Esiste già Mario Rossi (senza squadra). Premi di nuovo Salva per registrarne un altro.",
    );
  });

  it("voce eliminata: la squadra scollegata lo dice e dice come ricollegarla", () => {
    expect(AVVISO_VOCE_ELIMINATA("Alfa")).toBe(
      "La voce dell'anagrafe di «Alfa» non esiste più: squadra scollegata. Riscrivi il nome per ricollegarla.",
    );
  });
});
