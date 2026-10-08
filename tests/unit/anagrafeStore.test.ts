import { describe, it, expect, vi } from "vitest";
import type { RegGiocatore, RegSquadra } from "../../src/types";

// Si sostituisce solo la rete (anagrafeApi): la logica di cache dello store è quella vera
vi.mock("../../src/services/anagrafeApi", async (importOriginal) => {
  const reale = await importOriginal<typeof import("../../src/services/anagrafeApi")>();
  return {
    ...reale,
    anagrafeApi: {
      listGiocatori: vi.fn(), createGiocatore: vi.fn(), updateGiocatore: vi.fn(), removeGiocatore: vi.fn(),
      listSquadre: vi.fn(), createSquadra: vi.fn(), updateSquadra: vi.fn(), removeSquadra: vi.fn(),
    },
  };
});

function giocatore(id: string, nome: string): RegGiocatore {
  return {
    id, nome, cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "",
    peso: "", ruolo: "", numero: "", squadra: "", esperienza: "", note: "", autore: "Gabriele", autoreId: "u1", ts: 1,
  };
}

function squadra(id: string, nome: string, roster: string[] = []): RegSquadra {
  return {
    id, nome, citta: "", anno: "", rank: "", referente: "", roster, logo: "", website: "", instagram: "",
    note: "", autore: "Gabriele", autoreId: "u1", ts: 1,
  };
}

/** Dati del form di una nuova squadra / di un nuovo giocatore (id, autore e ts li assegna il server) */
const nuovaSquadra = {
  nome: "Wildcats", citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "",
};
const nuovoGiocatore = {
  nome: "Luca", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "",
  peso: "", ruolo: "", numero: "", squadra: "", esperienza: "", note: "",
};

/** Store nuovo a ogni test (la cache è stato di modulo). Sul server finto ci sono Mario e i Ballers. */
async function nuovoStore() {
  vi.resetModules();
  const { anagrafeApi } = await import("../../src/services/anagrafeApi");
  const { useAnagrafeStore } = await import("../../src/stores/useAnagrafeStore");
  // La classe va presa dopo resetModules, dagli stessi moduli dello store: una importata prima non la riconoscerebbe
  const { ApiError } = await import("../../src/services/api");
  const api = vi.mocked(anagrafeApi);
  // Il finto anagrafeApi è lo stesso oggetto per tutti i test: si azzerano chiamate e risposte del test prima
  vi.resetAllMocks();
  api.listGiocatori.mockResolvedValue([giocatore("g1", "Mario")]);
  api.listSquadre.mockResolvedValue([squadra("s1", "Ballers", ["g1"])]);
  return { api, store: useAnagrafeStore, ApiError };
}

describe("useAnagrafeStore (cache dell'anagrafe)", () => {
  it("il primo load scarica giocatori e squadre dal server", async () => {
    const { store } = await nuovoStore();
    expect(store.getState().giocatori).toBeNull();
    await store.getState().load();
    expect(store.getState().giocatori).toEqual([giocatore("g1", "Mario")]);
    expect(store.getState().squadre).toEqual([squadra("s1", "Ballers", ["g1"])]);
  });

  it("i load successivi usano la cache senza richiamare il server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    await store.getState().load();
    expect(api.listGiocatori).toHaveBeenCalledTimes(1);
    expect(api.listSquadre).toHaveBeenCalledTimes(1);
  });

  it("due load contemporanei condividono la stessa richiesta", async () => {
    const { api, store } = await nuovoStore();
    await Promise.all([store.getState().load(), store.getState().load()]);
    expect(api.listSquadre).toHaveBeenCalledTimes(1);
  });

  it("se il server non risponde le liste restano non caricate e il motivo è in `errore`; il load successivo riprova (FS-4)", async () => {
    const { api, store, ApiError } = await nuovoStore();
    api.listSquadre.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    await store.getState().load();
    // null e non []: un elenco vuoto direbbe che l'anagrafe è vuota, mentre non si sa che cosa c'è
    expect(store.getState().giocatori).toBeNull();
    expect(store.getState().squadre).toBeNull();
    expect(store.getState().errore).toBe("Server non raggiungibile");
    await store.getState().load();
    expect(store.getState().squadre).toEqual([squadra("s1", "Ballers", ["g1"])]);
    expect(store.getState().errore).toBeNull();
  });

  it("un errore che non è del server o della rete dà un messaggio generico, non il testo tecnico", async () => {
    const { api, store } = await nuovoStore();
    api.listGiocatori.mockRejectedValueOnce(new TypeError("x is not iterable"));
    await store.getState().load();
    expect(store.getState().errore).toBe("errore imprevisto");
  });

  it("un nuovo tentativo toglie subito l'errore di prima, così la pagina torna al caricamento", async () => {
    const { api, store, ApiError } = await nuovoStore();
    api.listGiocatori.mockRejectedValueOnce(new ApiError(503, "Servizio non disponibile"));
    await store.getState().load();
    expect(store.getState().errore).not.toBeNull();
    const ripresa = store.getState().load();
    expect(store.getState().errore).toBeNull();
    await ripresa;
  });

  it("con le liste già in memoria un caricamento fallito non le svuota", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    // Una scrittura rende non valida la cache: il load successivo riscarica, e stavolta il server non risponde
    api.createSquadra.mockResolvedValue(squadra("s2", "Wildcats"));
    await store.getState().saveSquadra(nuovaSquadra);
    api.listGiocatori.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    await store.getState().load();
    expect(store.getState().giocatori).toEqual([giocatore("g1", "Mario")]);
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("saveSquadra restituisce la nuova squadra e la mette in testa alla cache", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.createSquadra.mockResolvedValue(squadra("s2", "Wildcats"));
    const rec = await store.getState().saveSquadra(nuovaSquadra);
    expect(rec).toEqual(squadra("s2", "Wildcats"));
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("saveGiocatore mette il nuovo giocatore in testa alla cache", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.createGiocatore.mockResolvedValue(giocatore("g2", "Luca"));
    await store.getState().saveGiocatore(nuovoGiocatore);
    expect(store.getState().giocatori!.map((g) => g.id)).toEqual(["g2", "g1"]);
  });

  it("removeGiocatore toglie il giocatore dalla cache e dai roster delle squadre", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.removeGiocatore.mockResolvedValue(undefined);
    await store.getState().removeGiocatore("g1");
    expect(store.getState().giocatori).toEqual([]);
    expect(store.getState().squadre![0].roster).toEqual([]);
  });

  it("removeSquadra toglie la squadra dalla cache", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.removeSquadra.mockResolvedValue(undefined);
    await store.getState().removeSquadra("s1");
    expect(store.getState().squadre).toEqual([]);
  });

  it("updateSquadra sostituisce la voce in cache con quella restituita dal server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    const dalServer = { ...squadra("s1", "Ballers Roma", ["g1"]), ts: 2 };
    api.updateSquadra.mockResolvedValue(dalServer);
    await store.getState().updateSquadra(squadra("s1", "Ballers Roma", ["g1"]));
    expect(store.getState().squadre).toEqual([dalServer]);
  });

  it("updateGiocatore sostituisce la voce in cache con quella restituita dal server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    const dalServer = { ...giocatore("g1", "Mario Jr"), ts: 2 };
    api.updateGiocatore.mockResolvedValue(dalServer);
    await store.getState().updateGiocatore(giocatore("g1", "Mario Jr"));
    expect(store.getState().giocatori).toEqual([dalServer]);
  });

  it("updateGiocatore manda al server i soli campi compilabili: né id, né autore, né autoreId, né ts", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.updateGiocatore.mockResolvedValue(giocatore("g1", "Mario Jr"));
    await store.getState().updateGiocatore(giocatore("g1", "Mario Jr"));
    const [id, corpo] = api.updateGiocatore.mock.calls[0];
    expect(id).toBe("g1"); // l'id viaggia nel percorso, non nel corpo
    expect(corpo).toMatchObject({ nome: "Mario Jr", cognome: "Rossi" });
    for (const campo of ["id", "autore", "autoreId", "ts"]) expect(corpo, campo).not.toHaveProperty(campo);
  });

  it("updateSquadra manda al server i soli campi compilabili: né id, né autore, né autoreId, né ts", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.updateSquadra.mockResolvedValue(squadra("s1", "Ballers Roma", ["g1"]));
    await store.getState().updateSquadra(squadra("s1", "Ballers Roma", ["g1"]));
    const [id, corpo] = api.updateSquadra.mock.calls[0];
    expect(id).toBe("s1");
    expect(corpo).toMatchObject({ nome: "Ballers Roma", roster: ["g1"] });
    for (const campo of ["id", "autore", "autoreId", "ts"]) expect(corpo, campo).not.toHaveProperty(campo);
  });

  it("la PUT rimanda la versione che la voce ha; se la voce non ce l'ha (server precedente) non la manda (B6)", async () => {
    const { api, store } = await nuovoStore();
    api.listSquadre.mockResolvedValue([{ ...squadra("s1", "Ballers", ["g1"]), versione: 3 }]);
    await store.getState().load();
    api.updateSquadra.mockResolvedValue({ ...squadra("s1", "Ballers Roma", ["g1"]), versione: 4 });
    await store.getState().updateSquadra({ ...squadra("s1", "Ballers Roma", ["g1"]), versione: 3 });
    expect(api.updateSquadra.mock.calls[0][1]).toMatchObject({ versione: 3 });
    expect(store.getState().squadre![0].versione).toBe(4);
    api.updateGiocatore.mockResolvedValue(giocatore("g1", "Mario"));
    await store.getState().updateGiocatore(giocatore("g1", "Mario"));
    expect(JSON.stringify(api.updateGiocatore.mock.calls[0][1])).not.toContain("versione");
  });

  it("409 sulla PUT (modificata da un altro dispositivo): la cache prende la voce del server e l'errore dice di ricontrollare (B6)", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    const dalServer = { ...squadra("s1", "Ballers Milano", ["g1"]), versione: 5 };
    api.updateSquadra.mockRejectedValueOnce(new ApiError(409, "La squadra è stata modificata da un altro dispositivo"));
    api.listSquadre.mockResolvedValueOnce([dalServer]);
    await expect(store.getState().updateSquadra({ ...squadra("s1", "Ballers Roma", ["g1"]), versione: 4 })).rejects.toMatchObject({
      status: 409,
      message: "La squadra «Ballers Roma» è stata modificata da un altro dispositivo: la scheda mostra ora la versione salvata sul server. "
        + "Le modifiche scritte qui non sono state salvate: se servono ancora, riscrivile con «Modifica».",
    });
    expect(store.getState().squadre).toEqual([dalServer]);
    // La cache resta valida: rileggere la voce del server non è una scrittura
    await store.getState().load();
    expect(api.listSquadre).toHaveBeenCalledTimes(2);

    // Lo stesso per un giocatore
    const giocatoreDalServer = { ...giocatore("g1", "Mario Jr"), versione: 2 };
    api.updateGiocatore.mockRejectedValueOnce(new ApiError(409, "modificato"));
    api.listGiocatori.mockResolvedValueOnce([giocatoreDalServer]);
    await expect(store.getState().updateGiocatore(giocatore("g1", "Mario"))).rejects.toMatchObject({
      status: 409, message: expect.stringMatching(/^Il giocatore «Mario Rossi» è stato modificato da un altro dispositivo/),
    });
    expect(store.getState().giocatori).toEqual([giocatoreDalServer]);
  });

  it("un 409 di una voce che sul server non c'è più resta il 409 del server; un altro errore passa com'è", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    api.updateSquadra.mockRejectedValueOnce(new ApiError(409, "Eliminata"));
    api.listSquadre.mockResolvedValueOnce([]);
    await expect(store.getState().updateSquadra(squadra("s1", "Ballers"))).rejects.toMatchObject({ status: 409, message: "Eliminata" });
    api.updateSquadra.mockRejectedValueOnce(new ApiError(403, "Non puoi"));
    await expect(store.getState().updateSquadra(squadra("s1", "Ballers"))).rejects.toMatchObject({ status: 403, message: "Non puoi" });
    expect(api.listSquadre).toHaveBeenCalledTimes(2); // la rilettura solo dopo il 409
  });

  it("una scrittura prima del caricamento non crea una cache parziale", async () => {
    const { api, store } = await nuovoStore();
    api.createSquadra.mockResolvedValue(squadra("s2", "Wildcats"));
    await store.getState().saveSquadra(nuovaSquadra);
    expect(store.getState().squadre).toBeNull();
    api.listSquadre.mockResolvedValue([squadra("s2", "Wildcats"), squadra("s1", "Ballers", ["g1"])]);
    await store.getState().load();
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("trovaSquadra trova in cache senza richiamare il server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    expect(await store.getState().trovaSquadra(" ballers ")).toEqual(squadra("s1", "Ballers", ["g1"]));
    expect(api.listSquadre).toHaveBeenCalledTimes(1);
  });

  it("trovaSquadra ricontrolla sul server un nome assente in cache (registrato da un altro utente)", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.listSquadre.mockResolvedValue([squadra("s2", "Wildcats"), squadra("s1", "Ballers", ["g1"])]);
    expect(await store.getState().trovaSquadra("Wildcats")).toEqual(squadra("s2", "Wildcats"));
    expect(api.listSquadre).toHaveBeenCalledTimes(2);
  });

  it("trovaSquadra mette nella cache la voce trovata sul server: la pagina che si riapre la ritrova e non la crede eliminata", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.listSquadre.mockResolvedValue([squadra("s2", "Wildcats"), squadra("s1", "Ballers", ["g1"])]);
    await store.getState().trovaSquadra("Wildcats");
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
    // Un nuovo load non richiama il server: la cache resta valida
    await store.getState().load();
    expect(api.listSquadre).toHaveBeenCalledTimes(2);
  });

  it("trovaSquadra non mette niente in cache se la voce c'era già, e non crea una cache parziale se non è caricata", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    await store.getState().trovaSquadra("Ballers"); // già in cache
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s1"]);

    const altro = await nuovoStore(); // cache non caricata
    altro.api.listSquadre.mockResolvedValue([squadra("s2", "Wildcats")]);
    expect(await altro.store.getState().trovaSquadra("Wildcats")).toEqual(squadra("s2", "Wildcats"));
    expect(altro.store.getState().squadre).toBeNull();
    expect(api.listSquadre).toHaveBeenCalledTimes(1);
  });

  it("registraInCache mette le voci in testa, aggiorna quelle con lo stesso id e non tocca scritture né caricamento", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load(); // in cache: s1 «Ballers»
    store.getState().registraInCache([squadra("s2", "Wildcats"), squadra("s1", "Ballers Roma", ["g1"])]);
    expect(store.getState().squadre!.map((s) => [s.id, s.nome])).toEqual([["s2", "Wildcats"], ["s1", "Ballers Roma"]]);
    // La cache resta valida: un nuovo load non richiama il server
    await store.getState().load();
    expect(api.listSquadre).toHaveBeenCalledTimes(1);
    expect(store.getState().caricata).toBe(true);
  });

  it("registraInCache non è una scrittura: un caricamento in corso resta valido (scritture e caricata non cambiano)", async () => {
    const { api, store } = await nuovoStore();
    // Il server risponde alla lista squadre solo quando lo decide il test
    let rispondi: (lista: RegSquadra[]) => void = () => {};
    api.listSquadre.mockReturnValueOnce(new Promise<RegSquadra[]>((resolve) => { rispondi = resolve; }));
    const caricamento = store.getState().load();
    store.getState().registraInCache([squadra("s9", "Altra")]); // durante il caricamento
    rispondi([squadra("s1", "Ballers", ["g1"])]);
    await caricamento;
    // Con una scrittura (come aggiorna) la cache non varrebbe: il load successivo riscaricherebbe
    expect(store.getState().caricata).toBe(true);
    await store.getState().load();
    expect(api.listSquadre).toHaveBeenCalledTimes(1);
  });

  it("registraInCache senza niente da registrare, o con la cache non caricata, non cambia lo stato: nessuno viene notificato", async () => {
    const { store } = await nuovoStore();
    const avvisi = vi.fn();
    store.subscribe(avvisi);
    store.getState().registraInCache([squadra("s2", "Wildcats")]); // cache non caricata
    expect(avvisi).not.toHaveBeenCalled();
    await store.getState().load();
    avvisi.mockClear(); // il caricamento ha cambiato lo stato: da qui si conta
    store.getState().registraInCache([]);
    expect(avvisi).not.toHaveBeenCalled();
    store.getState().registraInCache([squadra("s2", "Wildcats")]);
    expect(avvisi).toHaveBeenCalledTimes(1);
  });

  it("registraInCache con la cache non caricata non crea una cache parziale", async () => {
    const { store } = await nuovoStore();
    store.getState().registraInCache([squadra("s2", "Wildcats")]);
    expect(store.getState().squadre).toBeNull();
  });

  it("trovaSquadra con una voce già in cache con un altro nome (rinominata dopo il caricamento) la aggiorna, non la raddoppia", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load(); // in cache: s1 «Ballers»
    api.listSquadre.mockResolvedValue([squadra("s1", "Ballers Roma", ["g1"])]);
    await store.getState().trovaSquadra("Ballers Roma");
    expect(store.getState().squadre!.map((s) => [s.id, s.nome])).toEqual([["s1", "Ballers Roma"]]);
  });

  it("trovaSquadra restituisce undefined se la squadra non esiste nemmeno sul server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    expect(await store.getState().trovaSquadra("Sconosciuti")).toBeUndefined();
    expect(api.listSquadre).toHaveBeenCalledTimes(2);
  });

  it("trovaSquadra non risponde «non trovata» se la lista del server fallisce: l'errore arriva a chi chiama (niente doppioni)", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    api.listSquadre.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    await expect(store.getState().trovaSquadra("Sconosciuti")).rejects.toMatchObject({ status: 0, message: "Server non raggiungibile" });
    // Una squadra in cache si trova anche a server spento: il server non si interroga
    api.listSquadre.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    expect(await store.getState().trovaSquadra("Ballers")).toEqual(squadra("s1", "Ballers", ["g1"]));
  });

  it("una scrittura arrivata durante il caricamento non convalida la cache: il load successivo riscarica", async () => {
    const { api, store } = await nuovoStore();
    // Il server risponde alla lista squadre solo quando lo decide il test
    let rispondi: (lista: RegSquadra[]) => void = () => {};
    api.listSquadre.mockReturnValueOnce(new Promise<RegSquadra[]>((resolve) => { rispondi = resolve; }));
    const caricamento = store.getState().load();
    api.createSquadra.mockResolvedValue(squadra("s2", "Wildcats"));
    await store.getState().saveSquadra(nuovaSquadra);
    rispondi([squadra("s1", "Ballers", ["g1"])]); // risposta partita prima: non contiene la nuova squadra
    await caricamento;
    api.listSquadre.mockResolvedValue([squadra("s2", "Wildcats"), squadra("s1", "Ballers", ["g1"])]);
    await store.getState().load();
    expect(api.listSquadre).toHaveBeenCalledTimes(2);
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
  });
});

/** Una voce com'è per chi non ha un account (forma pubblica del server): stesse chiavi, campi riservati vuoti e autoreId null */
function giocatorePubblico(id: string, nome: string): RegGiocatore {
  return { ...giocatore(id, nome), nascita: "", citta: "", altezza: "", note: "", autore: "", autoreId: null };
}
function squadraPubblica(id: string, nome: string, roster: string[] = []): RegSquadra {
  return { ...squadra(id, nome, roster), referente: "", autore: "", autoreId: null };
}

/** Una promessa che si risolve quando lo decide il test: il server finto che risponde in ritardo */
function differita<T>() {
  let risolvi: (valore: T) => void = () => {};
  let rifiuta: (motivo: unknown) => void = () => {};
  const promessa = new Promise<T>((ok, ko) => { risolvi = ok; rifiuta = ko; });
  return { promessa, risolvi, rifiuta };
}

describe("useAnagrafeStore: svuota (T2.15, la forma dell'anagrafe dipende dal token)", () => {
  it("svuota toglie le liste e la cache non vale più: il load successivo riscarica dal server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    expect(store.getState().caricata).toBe(true);
    store.getState().svuota();
    expect(store.getState().giocatori).toBeNull();
    expect(store.getState().squadre).toBeNull();
    expect(store.getState().caricata).toBe(false);
    await store.getState().load();
    expect(api.listGiocatori).toHaveBeenCalledTimes(2);
    expect(api.listSquadre).toHaveBeenCalledTimes(2);
  });

  it("dopo il login l'anagrafe viene riscaricata, e arriva la forma completa al posto di quella pubblica", async () => {
    const { api, store } = await nuovoStore();
    // Da ospite il server manda la forma pubblica
    api.listGiocatori.mockResolvedValueOnce([giocatorePubblico("g1", "Mario")]);
    api.listSquadre.mockResolvedValueOnce([squadraPubblica("s1", "Ballers", ["g1"])]);
    await store.getState().load();
    expect(store.getState().giocatori![0].nascita).toBe("");
    // Accesso: la cache si svuota; col token il server manda tutto
    store.getState().svuota();
    api.listGiocatori.mockResolvedValueOnce([{ ...giocatore("g1", "Mario"), nascita: "1998-03-15", autoreId: "u1" }]);
    api.listSquadre.mockResolvedValueOnce([{ ...squadra("s1", "Ballers", ["g1"]), referente: "Luigi Bianchi" }]);
    await store.getState().load();
    expect(store.getState().giocatori![0].nascita).toBe("1998-03-15");
    expect(store.getState().squadre![0].referente).toBe("Luigi Bianchi");
  });

  it("svuota toglie anche l'errore di prima: la pagina torna al caricamento e non mostra il «Riprova» della sessione precedente", async () => {
    const { api, store, ApiError } = await nuovoStore();
    api.listGiocatori.mockRejectedValueOnce(new ApiError(503, "Servizio non disponibile"));
    await store.getState().load();
    expect(store.getState().errore).not.toBeNull();
    store.getState().svuota();
    expect(store.getState().errore).toBeNull();
  });

  it("un caricamento partito prima dello svuotamento non riempie la cache con la sua risposta arrivata dopo (forma pubblica di prima del login)", async () => {
    const { api, store } = await nuovoStore();
    // La richiesta parte senza token e il server risponde solo quando lo decide il test
    const giocatoriLenti = differita<RegGiocatore[]>();
    const squadreLente = differita<RegSquadra[]>();
    api.listGiocatori.mockReturnValueOnce(giocatoriLenti.promessa);
    api.listSquadre.mockReturnValueOnce(squadreLente.promessa);
    const vecchio = store.getState().load();
    // Accesso mentre la risposta è ancora in volo
    store.getState().svuota();
    giocatoriLenti.risolvi([giocatorePubblico("g1", "Mario")]);
    squadreLente.risolvi([squadraPubblica("s1", "Ballers", ["g1"])]);
    await vecchio;
    // La risposta di prima è stata scartata: niente liste e cache non valida
    expect(store.getState().giocatori).toBeNull();
    expect(store.getState().squadre).toBeNull();
    expect(store.getState().caricata).toBe(false);
    // Il load successivo non si accoda alla richiesta vecchia: ne fa una nuova, con il token
    api.listGiocatori.mockResolvedValueOnce([{ ...giocatore("g1", "Mario"), nascita: "1998-03-15" }]);
    api.listSquadre.mockResolvedValueOnce([squadra("s1", "Ballers", ["g1"])]);
    await store.getState().load();
    expect(api.listGiocatori).toHaveBeenCalledTimes(2);
    expect(store.getState().giocatori![0].nascita).toBe("1998-03-15");
  });

  it("la risposta di prima del login che arriva dopo il nuovo caricamento non sovrascrive i dati completi", async () => {
    const { api, store } = await nuovoStore();
    const giocatoriLenti = differita<RegGiocatore[]>();
    api.listGiocatori.mockReturnValueOnce(giocatoriLenti.promessa);
    api.listSquadre.mockResolvedValueOnce([squadraPubblica("s1", "Ballers", ["g1"])]);
    const vecchio = store.getState().load();
    store.getState().svuota();
    // Il caricamento dopo l'accesso finisce per primo, con i dati completi
    api.listGiocatori.mockResolvedValueOnce([{ ...giocatore("g1", "Mario"), nascita: "1998-03-15" }]);
    api.listSquadre.mockResolvedValueOnce([squadra("s1", "Ballers", ["g1"])]);
    await store.getState().load();
    expect(store.getState().caricata).toBe(true);
    // Solo adesso arriva la risposta vecchia, in forma pubblica
    giocatoriLenti.risolvi([giocatorePubblico("g1", "Mario")]);
    await vecchio;
    expect(store.getState().giocatori![0].nascita).toBe("1998-03-15");
    expect(store.getState().squadre![0].referente).toBe("");
    expect(store.getState().caricata).toBe(true);
    // E la cache resta valida: nessun'altra richiesta
    await store.getState().load();
    expect(api.listGiocatori).toHaveBeenCalledTimes(2);
  });

  it("un caricamento vecchio che fallisce dopo lo svuotamento non scrive un errore: la sessione nuova non c'entra", async () => {
    const { api, store, ApiError } = await nuovoStore();
    const giocatoriLenti = differita<RegGiocatore[]>();
    api.listGiocatori.mockReturnValueOnce(giocatoriLenti.promessa);
    const vecchio = store.getState().load();
    store.getState().svuota();
    giocatoriLenti.rifiuta(new ApiError(0, "Server non raggiungibile"));
    await vecchio;
    expect(store.getState().errore).toBeNull();
  });

  it("la fine del caricamento vecchio non toglie quello nuovo: due load dopo lo svuotamento condividono ancora la stessa richiesta", async () => {
    const { api, store } = await nuovoStore();
    const giocatoriLenti = differita<RegGiocatore[]>();
    api.listGiocatori.mockReturnValueOnce(giocatoriLenti.promessa);
    const vecchio = store.getState().load();
    store.getState().svuota();
    // Il caricamento nuovo è in corso (lento anche lui) quando il vecchio finisce
    const nuovaRisposta = differita<RegGiocatore[]>();
    api.listGiocatori.mockReturnValueOnce(nuovaRisposta.promessa);
    const nuovo = store.getState().load();
    giocatoriLenti.risolvi([giocatorePubblico("g1", "Mario")]);
    await vecchio;
    // Il vecchio è finito, il nuovo no: un altro load si accoda al nuovo invece di farne un terzo
    const altro = store.getState().load();
    nuovaRisposta.risolvi([giocatore("g1", "Mario")]);
    await Promise.all([nuovo, altro]);
    expect(api.listGiocatori).toHaveBeenCalledTimes(2);
    expect(store.getState().caricata).toBe(true);
  });

  it("trovaSquadra: la voce letta prima dello svuotamento (forma pubblica) non entra nella cache nuova", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    // La lettura sul server parte prima dell'accesso e risponde dopo
    const lenta = differita<RegSquadra[]>();
    api.listSquadre.mockReturnValueOnce(lenta.promessa);
    const ricerca = store.getState().trovaSquadra("Wildcats");
    store.getState().svuota();
    await store.getState().load(); // cache nuova, completa
    lenta.risolvi([squadraPubblica("s2", "Wildcats")]);
    // La squadra si trova lo stesso (serve a chi la cercava), ma non entra in una cache che non è la sua
    expect(await ricerca).toEqual(squadraPubblica("s2", "Wildcats"));
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s1"]);
  });
});
