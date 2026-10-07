// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App";
import { useAppStore, SESSION_KEY } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { legheApi } from "../../src/services/legheApi";
import { api, ApiError, token } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { RegGiocatore, Tappa, User } from "../../src/types";

// Si sostituisce la rete delle leghe; le chiamate di autenticazione passano dal vero api.ts e arrivano a fetch
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const leghe = vi.mocked(legheApi);
const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const tappa = (id: string): Tappa => ({
  id, nome: "Tappa", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, squadre: [], gironi: null, partite: [], video: [],
});
const MESSAGGIO = "Sessione scaduta: accedi di nuovo";

/** JWT finto (firma non verificata dal client) che scade tra `secondi` secondi */
function jwt(secondi: number): string {
  const payload = btoa(JSON.stringify({ sub: "u1", exp: Math.floor(Date.now() / 1000) + secondi }));
  return `intestazione.${payload}.firma`;
}
const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
const respinto = () => json(401, { message: "Sessione scaduta o token non valido: accedi di nuovo", timestamp: "2026-10-02T10:00:00" });

/** Server finto dietro fetch: una risposta per percorso, che i test cambiano quando serve */
let risposte: Record<string, () => Response | Promise<Response>> = {};
/** Richieste a percorsi senza risposta prevista: api.ts le vedrebbe come rete assente, quindi si contano a parte */
let inattese: string[] = [];
const fetchFinto = vi.fn(async (url: string) => {
  const risposta = risposte[url];
  if (!risposta) {
    inattese.push(url);
    throw new TypeError("Failed to fetch");
  }
  return risposta();
});
/** Quante richieste sono arrivate a quel percorso */
const chiamateA = (url: string) => fetchFinto.mock.calls.filter(([u]) => u === url).length;

/** Apre l'app come dopo un ricaricamento della pagina, con questo utente salvato nel browser */
function avvia(utente: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(utente));
  // Lo stato iniziale dello store per chi è salvato nel browser: il registrato aspetta la verifica e le leghe
  useAppStore.setState({ user: utente, ready: utente.guest });
  render(<App />);
}

/** Registrato con la sessione valida, arrivato alla home dopo la verifica all'avvio */
async function dentro() {
  avvia(registrato);
  await screen.findByText("Si parte dal campetto");
}

const esci = () => screen.queryAllByRole("button", { name: "Esci" });
const formDiAccesso = () => screen.queryByRole("button", { name: /Continua come Ospite/ });

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fetchFinto);
  token.set(jwt(3600));
  risposte = {
    "/api/auth/me": () => json(200, { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER" }),
    "/api/auth/logout": () => new Response(null, { status: 204 }),
  };
  inattese = [];
  leghe.list.mockResolvedValue([]);
  leghe.putTappa.mockImplementation(async (t) => t);
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();
  useAnagrafeStore.getState().svuota(); // la cache dell'anagrafe è stato di modulo: ogni test riparte da «non ancora caricata»
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  // Per ultimo: se fallisce, la pulizia è già fatta e l'errore resta in questo test invece di passare ai successivi
  expect(inattese).toEqual([]);
});

describe("App: sessione che finisce mentre l'utente lavora", () => {
  it("rinnovo respinto: torna al form con «Sessione scaduta: accedi di nuovo», senza ricaricare", async () => {
    window.history.replaceState(null, "", "/leghe"); // l'utente sta lavorando sulle sue leghe
    avvia(registrato);
    await screen.findByLabelText(/Nome della nuova lega/);
    expect(esci().length).toBeGreaterThan(0);
    // Una richiesta qualsiasi trova il JWT respinto e il refresh token non più valido
    risposte["/api/leghe"] = respinto;
    risposte["/api/auth/refresh"] = respinto;
    await act(async () => { await api("/api/leghe").catch(() => {}); });
    expect(await screen.findByText(MESSAGGIO)).toBeTruthy();
    expect(window.location.pathname).toBe("/");
    expect(formDiAccesso()).not.toBeNull();
    expect(esci()).toHaveLength(0);
    expect(store().user).toBeNull();
    expect(token.get()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("il messaggio non resta nella cronologia: resta visibile sul form, ma ricaricando la pagina non ricompare", async () => {
    await dentro();
    risposte["/api/leghe"] = respinto;
    risposte["/api/auth/refresh"] = respinto;
    await act(async () => { await api("/api/leghe").catch(() => {}); });
    expect(await screen.findByText(MESSAGGIO)).toBeTruthy();
    // React Router tiene lo stato della navigazione in history.state.usr: la voce viene sostituita senza
    await waitFor(() => expect(window.history.state?.usr ?? null).toBeNull());
    expect(screen.getByText(MESSAGGIO)).toBeTruthy();
    // Ricaricando la pagina (stessa voce della cronologia) il form compare senza il messaggio
    cleanup();
    render(<App />);
    expect(formDiAccesso()).not.toBeNull();
    expect(screen.queryByText(MESSAGGIO)).toBeNull();
  });

  it("con modifiche che non si possono più salvare il messaggio dice quante tappe le hanno perse", async () => {
    await dentro();
    leghe.putTappa.mockRejectedValue(new ApiError(401, "Sessione scaduta o token non valido: accedi di nuovo"));
    act(() => {
      useAppStore.setState({ legaId: "l1", tappe: [tappa("t1"), tappa("t2")] });
      store().updateTappa("t1", { nome: "Finale" });
      store().updateTappa("t2", { nome: "Semifinale" });
    });
    risposte["/api/leghe"] = respinto;
    risposte["/api/auth/refresh"] = respinto;
    await act(async () => { await api("/api/leghe").catch(() => {}); });
    expect(await screen.findByText(`${MESSAGGIO}. 2 tappe avevano modifiche non salvate.`)).toBeTruthy();
    // Senza conferma: a sessione finita non c'è più modo di salvare
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uscita in un'altra scheda (token cancellato, evento storage): anche questa torna al form con il messaggio", async () => {
    await dentro();
    leghe.putTappa.mockRejectedValue(new ApiError(401, "Sessione scaduta o token non valido: accedi di nuovo"));
    act(() => {
      useAppStore.setState({ legaId: "l1", tappe: [tappa("t1")] });
      store().updateTappa("t1", { nome: "Finale" });
    });
    // L'altra scheda cancella il token dal localStorage condiviso; l'evento storage arriva solo alle altre schede
    const vecchio = token.get();
    token.clear();
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "hoop3x3_token", oldValue: vecchio, newValue: null })); });
    expect(await screen.findByText(`${MESSAGGIO}. 1 tappa aveva modifiche non salvate.`)).toBeTruthy();
    expect(esci()).toHaveLength(0);
    expect(store().user).toBeNull();
  });

  it("un token rinnovato da un'altra scheda non chiude la sessione", async () => {
    await dentro();
    const vecchio = token.get();
    token.set(jwt(1800));
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "hoop3x3_token", oldValue: vecchio, newValue: token.get() })); });
    await act(async () => {});
    expect(store().user).toEqual(registrato);
    expect(screen.queryByText(MESSAGGIO)).toBeNull();
  });
});

describe("App: verifica della sessione all'avvio", () => {
  it("server irraggiungibile: avviso con «Riprova» e la sessione resta; «Riprova» carica le leghe", async () => {
    risposte["/api/auth/me"] = () => { throw new TypeError("Failed to fetch"); };
    avvia(registrato);
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("Server non raggiungibile");
    expect(store().user).toEqual(registrato);
    expect(token.get()).not.toBeNull();
    expect(esci().length).toBeGreaterThan(0);
    expect(leghe.list).not.toHaveBeenCalled();
    // Il server torna raggiungibile
    risposte["/api/auth/me"] = () => json(200, { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER" });
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByText("Si parte dal campetto")).toBeTruthy();
    expect(leghe.list).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Server non raggiungibile/)).toBeNull();
  });

  it("«Esci» mentre la verifica è in volo: la risposta tardiva di /api/auth/me non rimette dentro l'utente", async () => {
    // /api/auth/me lento: risponde solo quando lo decide il test
    let rispondi: (r: Response) => void = () => {};
    risposte["/api/auth/me"] = () => new Promise<Response>((risolvi) => { rispondi = risolvi; });
    avvia(registrato);
    await screen.findByText("Caricamento delle tue leghe…");
    fireEvent.click(esci()[0]);
    await screen.findByRole("button", { name: /Continua come Ospite/ });
    // Il server risponde solo adesso, con la sessione ancora valida
    await act(async () => {
      rispondi(json(200, { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER" }));
      await new Promise((fatto) => setTimeout(fatto, 0));
    });
    expect(store().user).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(esci()).toHaveLength(0);
    expect(leghe.list).not.toHaveBeenCalled();
  });

  it("sessione valida: l'utente restituito dal server sostituisce la copia salvata nel browser", async () => {
    risposte["/api/auth/me"] = () => json(200, { id: "u1", name: "Anna Rossi", email: "anna@example.it", ruolo: "ADMIN" });
    avvia({ ...registrato, name: "Anna" });
    await screen.findByText("Si parte dal campetto");
    const dalServer = { id: "u1", name: "Anna Rossi", email: "anna@example.it", ruolo: "ADMIN", guest: false };
    expect(store().user).toEqual(dalServer);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null")).toEqual(dalServer);
  });

  it("sessione scaduta: torna al form con il messaggio, una volta sola", async () => {
    token.set(jwt(-10));
    risposte["/api/auth/refresh"] = respinto;
    risposte["/api/auth/me"] = respinto;
    avvia(registrato);
    expect(await screen.findByText(MESSAGGIO)).toBeTruthy();
    expect(formDiAccesso()).not.toBeNull();
    expect(token.get()).toBeNull();
    expect(store().user).toBeNull();
    // Rinnovo respinto e verifica all'avvio segnalano la stessa fine: un solo messaggio, nessuna revoca da fare
    expect(screen.getAllByText(MESSAGGIO)).toHaveLength(1);
    expect(chiamateA("/api/auth/logout")).toBe(0);
  });
});

describe("App: rinnovo automatico del JWT", () => {
  it("per un registrato il JWT in scadenza si rinnova dopo 60 secondi senza richieste; all'uscita il controllo si ferma", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await dentro();
    risposte["/api/auth/refresh"] = () => json(200, { token: "jwt-nuovo", user: {} });
    token.set(jwt(100)); // pagina ferma: il JWT è arrivato agli ultimi due minuti
    await act(async () => { vi.advanceTimersByTime(59_999); });
    expect(chiamateA("/api/auth/refresh")).toBe(0);
    await act(async () => { vi.advanceTimersByTime(1); });
    await vi.waitFor(() => expect(token.get()).toBe("jwt-nuovo"));
    expect(chiamateA("/api/auth/refresh")).toBe(1);
    // «Esci»: il controllo periodico si ferma
    fireEvent.click(esci()[0]);
    await screen.findByRole("button", { name: /Continua come Ospite/ });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("per un ospite non parte", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    token.clear();
    avvia({ name: "Ospite", guest: true });
    await screen.findByText("Si parte dal campetto");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("quando la scheda torna visibile con il JWT in scadenza lo rinnova subito", async () => {
    await dentro();
    risposte["/api/auth/refresh"] = () => json(200, { token: "jwt-nuovo", user: {} });
    token.set(jwt(100));
    let visibilita: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibilita });
    try {
      act(() => { document.dispatchEvent(new Event("visibilitychange")); });
      expect(chiamateA("/api/auth/refresh")).toBe(0);
      visibilita = "visible";
      act(() => { document.dispatchEvent(new Event("visibilitychange")); });
      await vi.waitFor(() => expect(token.get()).toBe("jwt-nuovo"));
      expect(chiamateA("/api/auth/refresh")).toBe(1);
    } finally {
      Reflect.deleteProperty(document, "visibilityState"); // torna il getter di jsdom
    }
  });
});

describe("App: anagrafe e sessione cambiata in un'altra scheda (T2.15)", () => {
  const ospite: User = { name: "Ospite", guest: true };
  // La stessa voce com'è per chi non ha un account (forma pubblica) e com'è con un account (forma completa)
  const pubblico: RegGiocatore = {
    id: "g1", nome: "Mario", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "", peso: "",
    ruolo: "Guardia", numero: "7", squadra: "", esperienza: "", note: "", autore: "", autoreId: null, ts: 1,
  };
  const completo: RegGiocatore = { ...pubblico, nascita: "1998-03-15", note: "Tiratore da tre", autore: "Anna", autoreId: "u1" };

  /** Evento che un'altra scheda fa arrivare a questa quando cambia il token nel localStorage condiviso */
  const tokenCambiato = (vecchio: string | null, nuovo: string | null) =>
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "hoop3x3_token", oldValue: vecchio, newValue: nuovo })); });

  /** Mette in cache un'anagrafe già caricata, senza passare dalla rete */
  const anagrafeInCache = (g: RegGiocatore) =>
    useAnagrafeStore.setState({ giocatori: [g], squadre: [], errore: null, caricata: true });

  it("accesso in un'altra scheda (il token compare): la cache dell'anagrafe, in forma pubblica, si svuota", async () => {
    token.clear();
    avvia(ospite);
    await screen.findByText("Si parte dal campetto");
    anagrafeInCache(pubblico);
    // L'altra scheda accede: il token arriva nel localStorage condiviso
    token.set(jwt(3600));
    tokenCambiato(null, token.get());
    expect(useAnagrafeStore.getState().giocatori).toBeNull();
    expect(useAnagrafeStore.getState().caricata).toBe(false);
    // Questa scheda resta quella che era: nessuna uscita, nessun cambio di utente
    expect(store().user).toEqual(ospite);
  });

  it("con l'anagrafe aperta, l'accesso in un'altra scheda la ricarica da sola con i dati completi", async () => {
    token.clear();
    // Senza token il server manda la forma pubblica, con il token quella completa
    risposte["/api/anagrafe/giocatori"] = () => {
      if (token.get()) return json(200, [completo]);
      return json(200, [pubblico]);
    };
    risposte["/api/anagrafe/squadre"] = () => json(200, []);
    window.history.replaceState(null, "", "/anagrafe");
    avvia(ospite);
    await screen.findByText("Mario Rossi");
    expect(screen.queryByText(/1998-03-15/)).toBeNull();
    expect(chiamateA("/api/anagrafe/giocatori")).toBe(1);

    token.set(jwt(3600));
    tokenCambiato(null, token.get());
    expect(await screen.findByText(/1998-03-15/)).toBeTruthy();
    expect(screen.getByText("Tiratore da tre")).toBeTruthy();
    expect(chiamateA("/api/anagrafe/giocatori")).toBe(2);
  });

  it("uscita in un'altra scheda (il token sparisce) mentre questa è ospite: la cache si svuota, e l'ospite resta dov'è", async () => {
    avvia(ospite); // il token c'è: l'ha salvato l'altra scheda, e questa lo usa per le richieste
    await screen.findByText("Si parte dal campetto");
    anagrafeInCache(completo);
    const vecchio = token.get();
    token.clear();
    tokenCambiato(vecchio, null);
    expect(useAnagrafeStore.getState().giocatori).toBeNull();
    expect(useAnagrafeStore.getState().caricata).toBe(false);
    expect(store().user).toEqual(ospite); // la fine della sessione riguarda solo chi è registrato
  });

  it("uscita in un'altra scheda mentre questa è registrata: l'anagrafe con i dati riservati non resta in memoria", async () => {
    await dentro();
    anagrafeInCache(completo);
    const vecchio = token.get();
    token.clear();
    tokenCambiato(vecchio, null);
    expect(await screen.findByText(MESSAGGIO)).toBeTruthy();
    expect(store().user).toBeNull();
    expect(useAnagrafeStore.getState().giocatori).toBeNull();
    expect(useAnagrafeStore.getState().caricata).toBe(false);
  });

  it("un token rinnovato da un'altra scheda non svuota la cache: i dati sono gli stessi", async () => {
    await dentro();
    anagrafeInCache(completo);
    const vecchio = token.get();
    token.set(jwt(1800));
    tokenCambiato(vecchio, token.get());
    await act(async () => {});
    expect(useAnagrafeStore.getState().caricata).toBe(true);
    expect(useAnagrafeStore.getState().giocatori).toEqual([completo]);
  });

  it("un altro dato del localStorage che cambia (la sessione salvata, una lega) non svuota la cache", async () => {
    await dentro();
    anagrafeInCache(completo);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY, oldValue: null, newValue: "{}" })); });
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: null, oldValue: null, newValue: null })); });
    expect(useAnagrafeStore.getState().caricata).toBe(true);
  });
});
