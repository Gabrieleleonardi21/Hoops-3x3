import { describe, it, expect, vi } from "vitest";
import type { Campetto } from "../../src/types/campetto";
import { CAMPETTI_DEMO, TS_DEMO } from "../fixtures/campetti";

// Si sostituisce solo la rete (campettiApi): la logica di cache ed epoca dello store è quella vera
vi.mock("../../src/services/campettiApi", async (importOriginal) => {
  const reale = await importOriginal<typeof import("../../src/services/campettiApi")>();
  return { ...reale, campettiApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
});

/** Il centro di Roma con cui la pagina si apre (contratto) e una ricerca per testo */
const ROMA = { lat: 41.9028, lng: 12.4964, raggioKm: 20 };
const DORA = { q: "Dora" };
const [ruffini, giardini, dora] = CAMPETTI_DEMO;

/** Una promessa che si risolve quando lo decide il test: il server finto che risponde in ritardo */
function differita<T>() {
  let risolvi: (valore: T) => void = () => {};
  let rifiuta: (motivo: unknown) => void = () => {};
  const promessa = new Promise<T>((ok, ko) => { risolvi = ok; rifiuta = ko; });
  return { promessa, risolvi, rifiuta };
}

/** Store nuovo a ogni test. Il server finto risponde con i sei campetti di Torino a qualunque ricerca */
async function nuovoStore() {
  vi.resetModules();
  const { campettiApi } = await import("../../src/services/campettiApi");
  const { useCampettiStore } = await import("../../src/stores/useCampettiStore");
  // La classe va presa dagli stessi moduli dello store (dopo resetModules): una importata prima non la riconoscerebbe
  const { ApiError } = await import("../../src/services/api");
  const api = vi.mocked(campettiApi);
  vi.resetAllMocks();
  api.list.mockResolvedValue(CAMPETTI_DEMO);
  return { api, store: useCampettiStore, ApiError };
}

describe("useCampettiStore: la cache dei campetti dell'ultima ricerca", () => {
  it("all'inizio niente è caricato: campetti null, nessuna ricerca, nessun errore, niente in corso", async () => {
    const { store } = await nuovoStore();
    expect(store.getState()).toMatchObject({ campetti: null, ricerca: null, errore: null, inCorso: false });
  });

  it("carica(ricerca) chiede i campetti al server con quella ricerca e li tiene, con la ricerca di cui sono il risultato", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    expect(api.list).toHaveBeenCalledWith(ROMA);
    expect(store.getState()).toMatchObject({ campetti: CAMPETTI_DEMO, ricerca: ROMA, errore: null, inCorso: false });
  });

  it("mentre il server risponde `inCorso` è true e i campetti di prima restano, con la loro ricerca: la mappa non si svuota e l'etichetta non mente", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    const lenta = differita<Campetto[]>();
    api.list.mockReturnValueOnce(lenta.promessa);
    const ricerca = store.getState().carica(DORA);
    expect(store.getState().inCorso).toBe(true);
    expect(store.getState().campetti).toEqual(CAMPETTI_DEMO);
    // `ricerca` è quella dell'elenco mostrato (Roma), non quella in volo: la pagina ci legge «intorno a Roma» e le distanze giuste
    expect(store.getState().ricerca).toEqual(ROMA);
    lenta.risolvi([dora]);
    await ricerca;
    expect(store.getState()).toMatchObject({ campetti: [dora], ricerca: DORA, inCorso: false });
  });

  it("la prima ricerca: `ricerca` resta null finché l'elenco non arriva", async () => {
    const { api, store } = await nuovoStore();
    const lenta = differita<Campetto[]>();
    api.list.mockReturnValueOnce(lenta.promessa);
    const ricerca = store.getState().carica(ROMA);
    expect(store.getState()).toMatchObject({ ricerca: null, inCorso: true });
    lenta.risolvi(CAMPETTI_DEMO);
    await ricerca;
    expect(store.getState().ricerca).toEqual(ROMA);
  });

  it("la stessa ricerca già caricata non richiama il server (tornando sulla pagina si rilegge la cache)", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    await store.getState().carica({ ...ROMA }); // stesso contenuto, altro oggetto
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it("una ricerca diversa richiama il server e sostituisce l'elenco", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    api.list.mockResolvedValueOnce([dora]);
    await store.getState().carica(DORA);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(api.list).toHaveBeenLastCalledWith(DORA);
    expect(store.getState().campetti).toEqual([dora]);
  });

  it("la risposta di una ricerca vecchia che arriva dopo quella nuova non sovrascrive l'elenco (epoca)", async () => {
    const { api, store } = await nuovoStore();
    const vecchia = differita<Campetto[]>();
    api.list.mockReturnValueOnce(vecchia.promessa);
    const primaRicerca = store.getState().carica({ q: "Parco" });
    api.list.mockResolvedValueOnce([dora]);
    await store.getState().carica(DORA); // la nuova finisce per prima
    expect(store.getState().campetti).toEqual([dora]);
    vecchia.risolvi([ruffini, giardini]);
    await primaRicerca;
    expect(store.getState()).toMatchObject({ campetti: [dora], ricerca: DORA, inCorso: false });
  });

  it("una ricerca vecchia che fallisce dopo quella nuova non scrive un errore, e non toglie `inCorso` alla nuova", async () => {
    const { api, store, ApiError } = await nuovoStore();
    const vecchia = differita<Campetto[]>();
    api.list.mockReturnValueOnce(vecchia.promessa);
    const primaRicerca = store.getState().carica({ q: "Parco" });
    const nuova = differita<Campetto[]>();
    api.list.mockReturnValueOnce(nuova.promessa);
    const secondaRicerca = store.getState().carica(DORA);
    vecchia.rifiuta(new ApiError(0, "Server non raggiungibile"));
    await primaRicerca;
    expect(store.getState()).toMatchObject({ errore: null, inCorso: true });
    nuova.risolvi([dora]);
    await secondaRicerca;
    expect(store.getState()).toMatchObject({ campetti: [dora], errore: null, inCorso: false });
  });

  it("se il server non risponde i campetti sono null (non un elenco vuoto) e il motivo è in `errore`", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().carica(ROMA);
    api.list.mockRejectedValueOnce(new ApiError(503, "Servizio non disponibile"));
    await store.getState().carica(DORA);
    // Null e non l'elenco di prima: erano i risultati di un'altra ricerca, mostrarli sotto l'errore direbbe una cosa falsa
    expect(store.getState()).toMatchObject({ campetti: null, ricerca: DORA, errore: "Servizio non disponibile", inCorso: false });
  });

  it("«Riprova» (carica con la stessa ricerca dopo un errore) richiama il server e toglie subito l'errore", async () => {
    const { api, store, ApiError } = await nuovoStore();
    api.list.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    await store.getState().carica(ROMA);
    expect(store.getState().errore).toBe("Server non raggiungibile");
    const ripresa = store.getState().carica(ROMA);
    expect(store.getState().errore).toBeNull();
    await ripresa;
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(store.getState().campetti).toEqual(CAMPETTI_DEMO);
  });

  it("un errore che non è del server o della rete dà il messaggio generico, non il testo tecnico", async () => {
    const { api, store } = await nuovoStore();
    api.list.mockRejectedValueOnce(new TypeError("x is not iterable"));
    await store.getState().carica(ROMA);
    expect(store.getState().errore).toBe("errore imprevisto");
  });
});

/** Ciò che il form manda per Ruffini (i soli campi compilabili), con la versione del campetto */
const { id: _id, tipo: _tipo, autore: _autore, autoreId: _autoreId, ts: _ts, ...inputRuffini } = ruffini;

describe("useCampettiStore: le scritture (T5.5) aggiornano server ed elenco", () => {
  it("save crea il campetto sul server e lo mette in testa all'elenco corrente", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    const nuovo: Campetto = { ...ruffini, id: "nuovo", nome: "Campo nuovo", versione: 0 };
    api.create.mockResolvedValue(nuovo);
    await store.getState().save(inputRuffini);
    expect(api.create).toHaveBeenCalledWith(inputRuffini);
    expect(store.getState().campetti?.map((c) => c.id)).toEqual(["nuovo", ...CAMPETTI_DEMO.map((c) => c.id)]);
  });

  it("save con l'elenco non caricato (o in errore) non crea un elenco parziale: lo porterà la prossima ricerca", async () => {
    const { api, store } = await nuovoStore();
    api.create.mockResolvedValue({ ...ruffini, id: "nuovo" });
    await store.getState().save(inputRuffini);
    expect(store.getState().campetti).toBeNull();
  });

  it("save: il rifiuto del server passa a chi chiama e l'elenco non cambia", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().carica(ROMA);
    api.create.mockRejectedValueOnce(new ApiError(400, "Il campo «nome» è obbligatorio"));
    await expect(store.getState().save(inputRuffini)).rejects.toMatchObject({ status: 400 });
    expect(store.getState().campetti).toEqual(CAMPETTI_DEMO);
  });

  it("update manda id e campi (con la versione) e sostituisce il campetto con quello restituito dal server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    const dalServer: Campetto = { ...ruffini, nome: "Parco Ruffini — Campo 3", versione: 1, ts: TS_DEMO + 1 };
    api.update.mockResolvedValue(dalServer);
    await store.getState().update(ruffini.id, { ...inputRuffini, nome: "Parco Ruffini — Campo 3" });
    expect(api.update).toHaveBeenCalledWith(ruffini.id, { ...inputRuffini, nome: "Parco Ruffini — Campo 3", versione: 0 });
    expect(store.getState().campetti?.[0]).toEqual(dalServer);
    expect(store.getState().campetti).toHaveLength(6);
  });

  it("update con 409 (modificato da un altro dispositivo): ricarica la ricerca corrente dal server e rifiuta con il testo per l'utente", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().carica(ROMA);
    api.update.mockRejectedValueOnce(new ApiError(409, "I dati sono stati modificati o eliminati da un'altra richiesta: ricarica"));
    const dalServer: Campetto = { ...ruffini, nome: "Parco Ruffini — Campo 2 bis", versione: 1 };
    api.list.mockResolvedValueOnce([dalServer, giardini]);
    await expect(store.getState().update(ruffini.id, { ...inputRuffini, nome: "Mio nome" })).rejects.toMatchObject({
      status: 409,
      message: "Il campetto «Mio nome» è stato modificato da un altro dispositivo: l'elenco mostra ora la versione salvata sul server. "
        + "Le modifiche scritte qui non sono state salvate: se servono ancora, riscrivile con «Modifica».",
    });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(api.list).toHaveBeenLastCalledWith(ROMA);
    expect(store.getState()).toMatchObject({ campetti: [dalServer, giardini], ricerca: ROMA, errore: null, inCorso: false });
  });

  it("update con 409 senza una ricerca corrente non ricarica niente, ma rifiuta con lo stesso testo", async () => {
    const { api, store, ApiError } = await nuovoStore();
    api.update.mockRejectedValueOnce(new ApiError(409, "conflitto"));
    await expect(store.getState().update(ruffini.id, inputRuffini)).rejects.toMatchObject({ status: 409, message: /modificato da un altro dispositivo/ });
    expect(api.list).not.toHaveBeenCalled();
  });

  it("update con un altro errore (403, 404, rete) passa com'è, senza ricaricare, e l'elenco non cambia", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().carica(ROMA);
    api.update.mockRejectedValueOnce(new ApiError(403, "Non puoi modificare questo campetto"));
    await expect(store.getState().update(ruffini.id, inputRuffini)).rejects.toMatchObject({ status: 403, message: "Non puoi modificare questo campetto" });
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.getState().campetti).toEqual(CAMPETTI_DEMO);
  });

  it("remove elimina sul server e toglie il campetto dall'elenco; se l'elenco non c'è non fa niente in più", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    api.remove.mockResolvedValue(undefined);
    await store.getState().remove(ruffini.id);
    expect(api.remove).toHaveBeenCalledWith(ruffini.id);
    expect(store.getState().campetti?.map((c) => c.id)).not.toContain(ruffini.id);
    expect(store.getState().campetti).toHaveLength(5);
    store.getState().svuota();
    await store.getState().remove(giardini.id);
    expect(store.getState().campetti).toBeNull();
  });

  it("remove: il rifiuto del server passa a chi chiama e il campetto resta", async () => {
    const { api, store, ApiError } = await nuovoStore();
    await store.getState().carica(ROMA);
    api.remove.mockRejectedValueOnce(new ApiError(404, "Campetto non trovato"));
    await expect(store.getState().remove(ruffini.id)).rejects.toMatchObject({ status: 404 });
    expect(store.getState().campetti).toHaveLength(6);
  });
});

describe("useCampettiStore: svuota (accesso e uscita: autoreId cambia con il token)", () => {
  it("toglie elenco, ricerca ed errore, conta lo svuotamento, e la stessa ricerca richiama il server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    expect(store.getState().svuotata).toBe(0);
    store.getState().svuota();
    expect(store.getState()).toMatchObject({ campetti: null, ricerca: null, errore: null, inCorso: false, svuotata: 1 });
    await store.getState().carica(ROMA);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(store.getState().campetti).toEqual(CAMPETTI_DEMO);
  });

  it("una risposta partita prima dello svuotamento (con il token di prima) si scarta quando arriva", async () => {
    const { api, store } = await nuovoStore();
    const lenta = differita<Campetto[]>();
    api.list.mockReturnValueOnce(lenta.promessa);
    const vecchia = store.getState().carica(ROMA);
    store.getState().svuota();
    lenta.risolvi(CAMPETTI_DEMO);
    await vecchia;
    expect(store.getState().campetti).toBeNull();
    expect(store.getState().inCorso).toBe(false);
  });
});
