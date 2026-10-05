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

  it("trovaSquadra restituisce undefined se la squadra non esiste nemmeno sul server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    expect(await store.getState().trovaSquadra("Sconosciuti")).toBeUndefined();
    api.listSquadre.mockRejectedValueOnce(new Error("server spento"));
    expect(await store.getState().trovaSquadra("Sconosciuti")).toBeUndefined();
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

describe("useAnagrafeStore: creazione senza risposta del server, nessun doppione (Ruling 3)", () => {
  // La voce che il server ha creato con i dati del form, quando la risposta non è arrivata
  const creataDalServer = { ...nuovoGiocatore, id: "g2", autore: "Gabriele", autoreId: "u1", ts: 2 };
  const squadraCreata = { ...nuovaSquadra, id: "s2", autore: "Gabriele", autoreId: "u1", ts: 2 };

  it("giocatore: il nuovo tentativo trova quello creato dal primo e non ne crea un altro", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    api.createGiocatore.mockRejectedValueOnce(new ApiError(0, "Il server non risponde: controlla la connessione e riprova."));
    await expect(store.getState().saveGiocatore(nuovoGiocatore)).rejects.toMatchObject({ status: 0 });
    api.listGiocatori.mockResolvedValue([creataDalServer, giocatore("g1", "Mario")]);
    await store.getState().saveGiocatore(nuovoGiocatore);
    expect(api.createGiocatore).toHaveBeenCalledTimes(1);   // una sola POST
    expect(store.getState().giocatori!.map((g) => g.id)).toEqual(["g2", "g1"]);
  });

  it("squadra: lo stesso; saveSquadra restituisce la squadra trovata", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    api.createSquadra.mockRejectedValueOnce(new ApiError(0, "Il server non risponde: controlla la connessione e riprova."));
    await expect(store.getState().saveSquadra(nuovaSquadra)).rejects.toMatchObject({ status: 0 });
    api.listSquadre.mockResolvedValue([squadraCreata, squadra("s1", "Ballers", ["g1"])]);
    expect(await store.getState().saveSquadra(nuovaSquadra)).toEqual(squadraCreata);
    expect(api.createSquadra).toHaveBeenCalledTimes(1);
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("se nel frattempo la cache si è aggiornata e la voce c'è già, non compare due volte", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    api.createGiocatore.mockRejectedValueOnce(new ApiError(0, "Il server non risponde"));
    await expect(store.getState().saveGiocatore(nuovoGiocatore)).rejects.toBeInstanceOf(ApiError);
    // La pagina ha ricaricato l'anagrafe (per esempio con «Riprova»): c'è già anche il giocatore creato dal primo tentativo
    api.listGiocatori.mockResolvedValue([creataDalServer, giocatore("g1", "Mario")]);
    store.setState({ caricata: false });
    await store.getState().load();
    await store.getState().saveGiocatore(nuovoGiocatore);
    expect(store.getState().giocatori!.map((g) => g.id)).toEqual(["g2", "g1"]);
  });

  it("un giocatore con lo stesso nome ma altri dati non è quello cercato: si crea il nuovo", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    api.createGiocatore.mockRejectedValueOnce(new ApiError(0, "Il server non risponde"));
    await expect(store.getState().saveGiocatore(nuovoGiocatore)).rejects.toBeInstanceOf(ApiError);
    // Un altro Luca Rossi, di un'altra città, comparso nel frattempo
    api.listGiocatori.mockResolvedValue([{ ...creataDalServer, citta: "Napoli" }, giocatore("g1", "Mario")]);
    api.createGiocatore.mockResolvedValue({ ...creataDalServer, id: "g3" });
    await store.getState().saveGiocatore(nuovoGiocatore);
    expect(api.createGiocatore).toHaveBeenCalledTimes(2);
    expect(store.getState().giocatori![0].id).toBe("g3");
  });

  it("gli spazi ai lati, che il server toglie, non impediscono di riconoscere la voce", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    const scritto = { ...nuovoGiocatore, nome: "  Luca ", note: " tiratore " };
    api.createGiocatore.mockRejectedValueOnce(new ApiError(0, "Il server non risponde"));
    await expect(store.getState().saveGiocatore(scritto)).rejects.toBeInstanceOf(ApiError);
    api.listGiocatori.mockResolvedValue([{ ...creataDalServer, nome: "Luca", note: "tiratore" }]);
    await store.getState().saveGiocatore(scritto);
    expect(api.createGiocatore).toHaveBeenCalledTimes(1);
  });

  it("se il server rifiuta i dati (400) il nuovo tentativo non legge l'elenco e crea", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().load();
    api.createSquadra.mockRejectedValueOnce(new ApiError(400, "nome: non può essere vuoto"));
    await expect(store.getState().saveSquadra(nuovaSquadra)).rejects.toMatchObject({ status: 400 });
    api.createSquadra.mockResolvedValue(squadraCreata);
    await store.getState().saveSquadra(nuovaSquadra);
    expect(api.listSquadre).toHaveBeenCalledTimes(1);   // solo il load iniziale
    expect(api.createSquadra).toHaveBeenCalledTimes(2);
  });
});
