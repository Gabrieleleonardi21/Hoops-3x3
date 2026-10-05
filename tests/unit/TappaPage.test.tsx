// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TappaPage } from "../../src/pages/TappaPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { legheApi } from "../../src/services/legheApi";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { RegGiocatore, RegSquadra, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: pagina, hook, store e coda dei salvataggi sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

// Anche la rete dell'anagrafe, per i casi in cui è lo store vero a caricare e a cercare la squadra; negli altri test l'anagrafe è
// già in cache e la rete non si usa
vi.mock("../../src/services/anagrafeApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/services/anagrafeApi")>()),
  anagrafeApi: {
    listGiocatori: vi.fn(), createGiocatore: vi.fn(), updateGiocatore: vi.fn(), removeGiocatore: vi.fn(),
    listSquadre: vi.fn(), createSquadra: vi.fn(), updateSquadra: vi.fn(), removeSquadra: vi.fn(),
  },
}));

const anagrafe = vi.mocked(anagrafeApi);
const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };
const ospite: User = { name: "Ospite", guest: true };

const tappa = (): Tappa => ({
  id: "t1", nome: "Roma Open", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [
    { id: "s1", nome: "Squadra 1", giocatori: [], rank: "" },
    { id: "s2", nome: "Squadra 2", giocatori: [], rank: "" },
  ],
  gironi: null, partite: [], video: [],
});

/** Tre squadre in un girone già sorteggiato: la prima partita ha il risultato, le altre due no */
const conUnRisultato = (): Tappa => ({
  ...tappa(),
  squadre: [
    { id: "s1", nome: "Alfa", giocatori: [], rank: "" },
    { id: "s2", nome: "Beta", giocatori: [], rank: "" },
    { id: "s3", nome: "Gamma", giocatori: [], rank: "" },
  ],
  gironi: [["s1", "s2", "s3"]],
  partite: [
    { id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 15, done: true },
    { id: "m2", g: 0, a: "s1", b: "s3", sa: 0, sb: 0, done: false },
    { id: "m3", g: 0, a: "s2", b: "s3", sa: 0, sb: 0, done: false },
  ],
});

const regAlfa: RegSquadra = {
  id: "r1", nome: "Alfa", citta: "", anno: "", rank: "40", referente: "", roster: [], logo: "",
  website: "", instagram: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
};

// Le azioni vere dello store dell'anagrafe: alcuni test le sostituiscono con finte, e senza ripristino la finta passerebbe al test dopo
const { load, trovaSquadra, saveSquadra } = useAnagrafeStore.getState();
const azioniVere = { load, trovaSquadra, saveSquadra };

beforeEach(() => {
  vi.resetAllMocks();
  useAnagrafeStore.setState(azioniVere);
  vi.mocked(legheApi.putTappa).mockImplementation(async (t) => t);
  useAppStore.setState({ user: registrato, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [tappa()] });
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset(); // svuota la coda dei salvataggi
});

/** Promessa controllabile a mano: il test decide quando il "server" risponde */
function differita<T>() {
  let ok!: (v: T) => void;
  const p = new Promise<T>((res) => { ok = res; });
  return { p, ok };
}

/** Apre la pagina della tappa. L'anagrafe è già in cache (la pagina non scarica niente): le risposte del server
 *  alla ricerca e alla creazione di una squadra le comanda il test. */
function apriPagina(anagrafe: Partial<ReturnType<typeof useAnagrafeStore.getState>>) {
  useAnagrafeStore.setState({ giocatori: [], squadre: [], caricata: true, ...anagrafe });
  render(
    <MemoryRouter initialEntries={["/lega/tappa/t1"]}>
      <Routes><Route path="/lega/tappa/:id" element={<TappaPage />} /></Routes>
    </MemoryRouter>,
  );
}

/** I campi «Nome squadra» di adesso (ogni volta da capo: dopo il collegamento il campo può essere un altro nodo) */
const campiNome = () => screen.getAllByLabelText("Nome squadra") as HTMLInputElement[];
const scrivi = (n: number, testo: string) => fireEvent.change(campiNome()[n], { target: { value: testo } });

describe("TappaPage: collegare una squadra all'anagrafe", () => {
  it("sonda A: i nomi scritti di seguito restano mentre il server risponde", async () => {
    const ricerca = differita<RegSquadra>();
    apriPagina({ trovaSquadra: vi.fn(() => ricerca.p) });

    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]); // esce dal campo: parte il collegamento, in attesa del server
    scrivi(1, "Beta");              // intanto scrive nella seconda squadra
    await act(async () => { ricerca.ok(regAlfa); await ricerca.p; });

    expect(campiNome().map((c) => c.value)).toEqual(["Alfa", "Beta"]);
    expect(store().tappe[0].squadre).toMatchObject([{ nome: "Alfa", regId: "r1" }, { nome: "Beta" }]);
  });

  it("vale anche quando la squadra non è in anagrafe e viene creata, con la seconda attesa", async () => {
    const creazione = differita<RegSquadra>();
    apriPagina({ trovaSquadra: vi.fn(async () => undefined), saveSquadra: vi.fn(() => creazione.p) });

    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]);
    await act(async () => {});      // la ricerca non trova niente: la pagina chiede di creare la squadra
    scrivi(1, "Beta");
    await act(async () => { creazione.ok(regAlfa); await creazione.p; });

    expect(campiNome().map((c) => c.value)).toEqual(["Alfa", "Beta"]);
    expect(store().tappe[0].squadre).toMatchObject([{ nome: "Alfa", regId: "r1" }, { nome: "Beta" }]);
  });
});

describe("TappaPage: il collegamento all'anagrafe che fallisce si vede (FS-4)", () => {
  const nonRisponde = () => new ApiError(0, "Il server non risponde: controlla la connessione e riprova.");
  const MESSAGGIO = "Squadra «Alfa» non collegata all'anagrafe: Il server non risponde: controlla la connessione e riprova.";

  it("la creazione in anagrafe fallisce: il motivo compare sotto il nome, la squadra resta com'è e nessuna promessa resta senza gestore", async () => {
    apriPagina({ trovaSquadra: vi.fn(async () => undefined), saveSquadra: vi.fn().mockRejectedValue(nonRisponde()) });
    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]);
    expect((await screen.findByRole("alert")).textContent).toContain(MESSAGGIO);
    expect(campiNome()[0].value).toBe("Alfa");
    expect(store().tappe[0].squadre[0].regId).toBeUndefined();
    // Il messaggio sta nella card della squadra, non nelle altre
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("con l'anagrafe non caricata (server giù all'apertura) il collegamento si tenta lo stesso, e riesce se il server è tornato", async () => {
    // All'apertura il caricamento fallisce: le liste restano null e `errore` dice perché. Poi il server torna
    anagrafe.listGiocatori.mockRejectedValue(new ApiError(0, "Server non raggiungibile"));
    anagrafe.listSquadre.mockResolvedValue([]);
    anagrafe.createSquadra.mockResolvedValue(regAlfa);
    apriPagina({ giocatori: null, squadre: null, caricata: false });
    await waitFor(() => expect(useAnagrafeStore.getState().errore).toBe("Server non raggiungibile"));
    expect(useAnagrafeStore.getState().squadre).toBeNull();

    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]);
    await waitFor(() => expect(store().tappe[0].squadre[0].regId).toBe("r1"));
    expect(anagrafe.createSquadra).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("con l'anagrafe non caricata e il server ancora giù il tentativo fallisce e il motivo compare nella card", async () => {
    anagrafe.listGiocatori.mockRejectedValue(nonRisponde());
    anagrafe.listSquadre.mockRejectedValue(nonRisponde());
    anagrafe.createSquadra.mockRejectedValue(nonRisponde());
    apriPagina({ giocatori: null, squadre: null, caricata: false });
    await waitFor(() => expect(useAnagrafeStore.getState().errore).not.toBeNull());

    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]);
    expect((await screen.findByRole("alert")).textContent).toContain(MESSAGGIO);
    expect(store().tappe[0].squadre[0].regId).toBeUndefined();
  });

  it("mentre l'anagrafe si sta ancora caricando il collegamento non parte", async () => {
    const giocatori = differita<RegGiocatore[]>();
    const squadre = differita<RegSquadra[]>();
    anagrafe.listGiocatori.mockReturnValue(giocatori.p);
    anagrafe.listSquadre.mockReturnValue(squadre.p);
    apriPagina({ giocatori: null, squadre: null, caricata: false });

    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]);
    await act(async () => {});
    expect(anagrafe.createSquadra).not.toHaveBeenCalled();
    expect(anagrafe.listSquadre).toHaveBeenCalledTimes(1); // solo il caricamento della pagina
    await act(async () => { giocatori.ok([]); squadre.ok([]); await Promise.all([giocatori.p, squadre.p]); });
  });

  it.each([["un segnaposto", "Squadra 3"], ["vuoto", ""]])(
    "se dopo l'errore il nome diventa %s il messaggio di prima sparisce: niente «Riprova» che non può fare niente",
    async (_caso, nuovoNome) => {
      apriPagina({ trovaSquadra: vi.fn(async () => undefined), saveSquadra: vi.fn().mockRejectedValue(nonRisponde()) });
      scrivi(0, "Alfa");
      fireEvent.blur(campiNome()[0]);
      await screen.findByRole("alert");
      scrivi(0, nuovoNome);
      fireEvent.blur(campiNome()[0]);
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(screen.queryByRole("button", { name: "Riprova" })).toBeNull();
    },
  );

  it("«Riprova» ritenta: riuscito, il messaggio sparisce e la squadra si collega", async () => {
    const saveSquadra = vi.fn().mockRejectedValueOnce(nonRisponde()).mockResolvedValueOnce(regAlfa);
    apriPagina({ trovaSquadra: vi.fn(async () => undefined), saveSquadra });
    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    await act(async () => {});
    expect(screen.queryByRole("alert")).toBeNull();
    expect(saveSquadra).toHaveBeenCalledTimes(2);
    expect(store().tappe[0].squadre[0]).toMatchObject({ nome: "Alfa", regId: "r1" });
  });

  it("un nuovo tentativo toglie il messaggio di prima, anche se poi non riesce di nuovo per un altro motivo", async () => {
    const saveSquadra = vi.fn()
      .mockRejectedValueOnce(nonRisponde())
      .mockRejectedValueOnce(new ApiError(403, "Non puoi creare squadre"));
    apriPagina({ trovaSquadra: vi.fn(async () => undefined), saveSquadra });
    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]);
    await screen.findByText(/Il server non risponde/);
    fireEvent.blur(campiNome()[0]);
    expect((await screen.findByRole("alert")).textContent).toContain("Squadra «Alfa» non collegata all'anagrafe: Non puoi creare squadre");
    expect(screen.queryByText(/Il server non risponde/)).toBeNull();
  });
});

describe("TappaPage: conferma prima di cancellare i risultati (R2)", () => {
  // Da ospite il sorteggio non richiede roster completi: i test guardano solo la conferma
  beforeEach(() => {
    useAppStore.setState({ user: ospite, tappe: [conUnRisultato()] });
  });

  it("un nuovo sorteggio con risultati chiede conferma; «Annulla» li lascia, «Conferma» rifà il sorteggio", () => {
    apriPagina({});
    const prima = store().tappe[0];
    fireEvent.click(screen.getByRole("button", { name: /Sorteggio casuale/ }));
    expect(screen.getByRole("dialog", { name: "Rifare il sorteggio?" }).textContent)
      .toContain("Verranno eliminati il sorteggio e 1 risultato.");
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(store().tappe[0]).toBe(prima);

    fireEvent.click(screen.getByRole("button", { name: /Sorteggio casuale/ }));
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(store().tappe[0].partite).toHaveLength(3);
    expect(store().tappe[0].partite.every((m) => !m.done)).toBe(true);
  });

  it("senza risultati il sorteggio si rifà senza chiedere", () => {
    useAppStore.setState({ tappe: [{ ...conUnRisultato(), partite: conUnRisultato().partite.map((m) => ({ ...m, done: false })) }] });
    apriPagina({});
    const prima = store().tappe[0];
    fireEvent.click(screen.getByRole("button", { name: /Sorteggio per ranking/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store().tappe[0]).not.toBe(prima);
  });

  it("«Rimuovi squadra» con risultati chiede conferma prima di cancellarli", () => {
    apriPagina({});
    fireEvent.click(screen.getAllByRole("button", { name: "Rimuovi squadra" })[2]);
    expect(screen.getByRole("dialog", { name: "Rimuovere la squadra?" }).textContent)
      .toContain("Verranno eliminati il sorteggio e 1 risultato.");
    expect(store().tappe[0].squadre).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(store().tappe[0].squadre.map((s) => s.nome)).toEqual(["Alfa", "Beta"]);
    expect(store().tappe[0].gironi).toBeNull();
  });
});

describe("TappaPage: risultati dei gironi con la fase finale già generata (R6)", () => {
  it("«Correggi» mostra il messaggio e non cambia niente", () => {
    const giocate = conUnRisultato().partite.map((m) => ({ ...m, sa: 21, sb: 15, done: true }));
    const finale = { id: "fin", label: "Finale", squadraA: "s1", squadraB: "s2", pA: 0, pB: 0, done: false };
    useAppStore.setState({ tappe: [{ ...conUnRisultato(), partite: giocate, bracket: [finale] }] });
    apriPagina({});
    const prima = store().tappe[0];
    fireEvent.click(screen.getAllByRole("button", { name: "Correggi" })[0]);
    expect(screen.getByRole("alert").textContent).toMatch(/elimina prima la fase finale/);
    expect(store().tappe[0]).toBe(prima);
  });
});
