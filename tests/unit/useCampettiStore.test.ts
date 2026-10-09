import { describe, it, expect, vi } from "vitest";
import type { Campetto } from "../../src/types/campetto";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

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

  it("mentre il server risponde `inCorso` è true e i campetti di prima restano: la mappa non si svuota a ogni ricerca", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().carica(ROMA);
    const lenta = differita<Campetto[]>();
    api.list.mockReturnValueOnce(lenta.promessa);
    const ricerca = store.getState().carica(DORA);
    expect(store.getState().inCorso).toBe(true);
    expect(store.getState().campetti).toEqual(CAMPETTI_DEMO);
    expect(store.getState().ricerca).toEqual(DORA); // la ricerca è già quella nuova: la pagina sa che cosa sta aspettando
    lenta.risolvi([dora]);
    await ricerca;
    expect(store.getState()).toMatchObject({ campetti: [dora], inCorso: false });
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
