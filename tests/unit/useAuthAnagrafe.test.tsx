// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useAuth } from "../../src/hooks/useAuth";
import { useAppStore } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { legheApi } from "../../src/services/legheApi";
import * as authService from "../../src/services/authService";
import { ApiError } from "../../src/services/api";
import type { RegGiocatore, RegSquadra, User } from "../../src/types";

// T2.15: la forma dell'anagrafe dipende dal token (senza account il server nasconde i dati personali), quindi la cache si svuota
// quando chi usa l'app cambia. Qui si prova il collegamento con useAuth: il resto (store, hook, interfaccia) è quello vero
vi.mock("../../src/services/authService", () => ({
  register: vi.fn(), login: vi.fn(), me: vi.fn(), logout: vi.fn(),
}));
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));
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

const auth = vi.mocked(authService);
const anagrafe = vi.mocked(anagrafeApi);
const leghe = vi.mocked(legheApi);
const store = () => useAnagrafeStore.getState();

/** salvaTutto vero, da rimettere dopo i test che lo sostituiscono */
const salvaTuttoVero = useAppStore.getState().salvaTutto;

const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const ospite: User = { name: "Ospite", guest: true };

/** La voce com'è per chi non ha un account (forma pubblica) e com'è con un account (forma completa) */
const giocatorePubblico: RegGiocatore = {
  id: "g1", nome: "Mario", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "", peso: "",
  ruolo: "Guardia", numero: "7", squadra: "Ballers", esperienza: "", note: "", autore: "", autoreId: null, ts: 1,
};
const giocatoreCompleto: RegGiocatore = { ...giocatorePubblico, nascita: "1998-03-15", note: "Tiratore", autore: "Anna", autoreId: "u1" };
const squadraPubblica: RegSquadra = {
  id: "s1", nome: "Ballers", citta: "Roma", anno: "", rank: "", referente: "", roster: ["g1"], logo: "", website: "", instagram: "",
  note: "", autore: "", autoreId: null, ts: 1,
};
const squadraCompleta: RegSquadra = { ...squadraPubblica, referente: "Luigi Bianchi", autore: "Anna", autoreId: "u1" };

/** Una promessa che si risolve quando lo decide il test: il server che risponde in ritardo */
function differita<T>() {
  let risolvi: (valore: T) => void = () => {};
  const promessa = new Promise<T>((ok) => { risolvi = ok; });
  return { promessa, risolvi };
}

/** Il server risponde con la forma pubblica (senza token) o con quella completa (con token) a seconda di `conToken` */
let conToken = false;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  conToken = false;
  anagrafe.listGiocatori.mockImplementation(async () => {
    if (conToken) return [giocatoreCompleto];
    return [giocatorePubblico];
  });
  anagrafe.listSquadre.mockImplementation(async () => {
    if (conToken) return [squadraCompleta];
    return [squadraPubblica];
  });
  leghe.list.mockResolvedValue([]);
  // L'accesso e la registrazione salvano il token: da lì il server manda la forma completa
  auth.login.mockImplementation(async () => { conToken = true; return registrato; });
  auth.register.mockImplementation(async () => { conToken = true; return registrato; });
  // Ogni test parte con la cache non caricata
  store().svuota();
});

afterEach(() => {
  cleanup();
  useAppStore.setState({ salvaTutto: salvaTuttoVero });
  useAppStore.getState().reset();
  store().svuota();
  localStorage.clear();
});

describe("useAuth: la cache dell'anagrafe segue chi la guarda (T2.15)", () => {
  it.each([
    ["l'accesso", (h: ReturnType<typeof useAuth>) => h.login("anna@example.it", "password-lunga")],
    ["la registrazione", (h: ReturnType<typeof useAuth>) => h.register("Anna", "anna@example.it", "password-lunga")],
  ])("con %s andato a buon fine la cache vista da ospite (forma pubblica) si svuota e il load successivo riscarica i dati completi", async (_caso, entra) => {
    const { result } = renderHook(() => useAuth());
    await act(() => result.current.enterGuest());
    await store().load();
    expect(store().giocatori![0].nascita).toBe(""); // forma pubblica
    expect(anagrafe.listGiocatori).toHaveBeenCalledTimes(1);

    await act(() => entra(result.current));
    expect(store().giocatori).toBeNull();
    expect(store().squadre).toBeNull();
    expect(store().caricata).toBe(false);

    await store().load();
    expect(anagrafe.listGiocatori).toHaveBeenCalledTimes(2);
    expect(store().giocatori![0].nascita).toBe("1998-03-15");
    expect(store().squadre![0].referente).toBe("Luigi Bianchi");
  });

  it("un caricamento partito prima dell'accesso, con la risposta in ritardo, non riempie la cache con la forma pubblica", async () => {
    const { result } = renderHook(() => useAuth());
    // La richiesta parte senza token e il server risponde solo quando lo decide il test
    const lenta = differita<RegGiocatore[]>();
    anagrafe.listGiocatori.mockReturnValueOnce(lenta.promessa);
    const caricamento = store().load();

    await act(() => result.current.login("anna@example.it", "password-lunga"));
    // Adesso arriva la risposta di prima del login, in forma pubblica
    lenta.risolvi([giocatorePubblico]);
    await caricamento;
    expect(store().giocatori).toBeNull();
    expect(store().caricata).toBe(false);

    // Il load dopo l'accesso fa una richiesta nuova e prende i dati completi
    await store().load();
    expect(store().giocatori![0].nascita).toBe("1998-03-15");
    expect(store().caricata).toBe(true);
  });

  it("uscita del registrato: la cache con i dati riservati non resta in memoria", async () => {
    conToken = true;
    useAppStore.setState({ user: registrato });
    const { result } = renderHook(() => useAuth());
    await store().load();
    expect(store().giocatori![0].nascita).toBe("1998-03-15");

    let esito: Awaited<ReturnType<typeof result.current.logout>> | undefined;
    await act(async () => { esito = await result.current.logout(); });
    expect(esito).toEqual({ uscito: true, nonSalvate: 0 });
    expect(store().giocatori).toBeNull();
    expect(store().squadre).toBeNull();
    expect(store().caricata).toBe(false);
  });

  it("uscita dell'ospite: la cache si svuota", async () => {
    useAppStore.setState({ user: ospite });
    const { result } = renderHook(() => useAuth());
    await store().load();
    expect(store().caricata).toBe(true);

    await act(async () => { await result.current.logout(); });
    expect(store().giocatori).toBeNull();
    expect(store().caricata).toBe(false);
  });

  it("dopo l'uscita il load successivo non rimette dentro i dati riservati: la richiesta di prima non conta", async () => {
    conToken = true;
    useAppStore.setState({ user: registrato });
    const { result } = renderHook(() => useAuth());
    // Un caricamento è in corso, con il token, quando l'utente esce
    const lenta = differita<RegGiocatore[]>();
    anagrafe.listGiocatori.mockReturnValueOnce(lenta.promessa);
    const caricamento = store().load();

    await act(async () => { await result.current.logout(); });
    lenta.risolvi([giocatoreCompleto]);
    await caricamento;
    expect(store().giocatori).toBeNull();
    expect(store().caricata).toBe(false);
  });

  it("uscita annullata (l'utente resta per non perdere le modifiche non salvate): la cache resta com'è", async () => {
    conToken = true;
    useAppStore.setState({ user: registrato, salvaTutto: async () => 2 });
    const { result } = renderHook(() => useAuth());
    await store().load();

    let esito: Awaited<ReturnType<typeof result.current.logout>> | undefined;
    await act(async () => { esito = await result.current.logout(async () => false); });
    expect(esito).toEqual({ uscito: false, nonSalvate: 2 });
    expect(store().caricata).toBe(true);
    expect(store().giocatori![0].nascita).toBe("1998-03-15");
    expect(useAppStore.getState().user).toEqual(registrato);
  });

  it("accesso rifiutato dal server (password sbagliata): chi guardava l'anagrafe da ospite la conserva", async () => {
    const { result } = renderHook(() => useAuth());
    await store().load();
    auth.login.mockRejectedValue(new ApiError(401, "Credenziali non valide"));

    await act(async () => { await result.current.login("anna@example.it", "sbagliata").catch(() => {}); });
    expect(store().caricata).toBe(true);
    expect(store().giocatori![0].nascita).toBe(""); // sempre la forma pubblica: niente è cambiato
    expect(anagrafe.listGiocatori).toHaveBeenCalledTimes(1);
  });
});
