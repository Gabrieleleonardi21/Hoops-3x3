// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TappaPage } from "../../src/pages/TappaPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { legheApi } from "../../src/services/legheApi";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { archivioApi } from "../../src/services/archivioApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { PubTappa, RegGiocatore, RegSquadra, Tappa, User } from "../../src/types";

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

// Anche l'archivio: «Riapri» toglie la tappa pubblicata
vi.mock("../../src/services/archivioApi", () => ({
  archivioApi: { list: vi.fn(), get: vi.fn(), pubblica: vi.fn(), rimuovi: vi.fn() },
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
  montaPagina();
}

/** Monta la pagina della tappa con l'anagrafe com'è adesso (per riaprirla dopo averla chiusa) */
function montaPagina() {
  render(
    <MemoryRouter initialEntries={["/lega/tappa/t1"]}>
      <Routes>
        <Route path="/lega/tappa/:id" element={<TappaPage />} />
        <Route path="/lega" element={<p>Elenco delle tappe</p>} />
      </Routes>
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

describe("TappaPage: una squadra collegata a una voce eliminata dall'anagrafe torna modificabile (FS-9)", () => {
  const collegata = (): Tappa => ({
    ...tappa(),
    squadre: [{ id: "s1", nome: "Alfa", regId: "r-eliminata", rank: "40", giocatori: [] }, { id: "s2", nome: "Squadra 2", giocatori: [], rank: "" }],
  });

  it("con la voce in anagrafe il nome resta di sola lettura e c'è il badge «Anagrafe»", () => {
    useAppStore.setState({ tappe: [collegata()] });
    apriPagina({ squadre: [{ ...regAlfa, id: "r-eliminata" }] });
    expect(campiNome()[0].readOnly).toBe(true);
    expect(screen.getByText("Anagrafe")).toBeTruthy();
  });

  it("senza più la voce, né in cache né sul server, all'apertura della pagina il nome si può scrivere e il badge sparisce", async () => {
    anagrafe.listSquadre.mockResolvedValue([]);
    useAppStore.setState({ tappe: [collegata()] });
    apriPagina({ squadre: [] });
    await waitFor(() => expect(campiNome()[0].readOnly).toBe(false));
    expect(campiNome()[0].value).toBe("Alfa");
    expect(screen.queryByText("Anagrafe")).toBeNull();
    expect(store().tappe[0].squadre[0].regId).toBeUndefined();
  });

  it("riscritto il nome, la squadra si collega alla voce nuova", async () => {
    anagrafe.listSquadre.mockResolvedValue([]);
    const trovaSquadra = vi.fn(async () => regAlfa);
    useAppStore.setState({ tappe: [collegata()] });
    apriPagina({ squadre: [], trovaSquadra });
    await waitFor(() => expect(campiNome()[0].readOnly).toBe(false));
    scrivi(0, "Alfa Roma");
    fireEvent.blur(campiNome()[0]); // la ricerca trova la voce nuova «Alfa» e la squadra prende i suoi dati
    await act(async () => {});
    expect(trovaSquadra).toHaveBeenCalledWith("Alfa Roma");
    expect(store().tappe[0].squadre[0]).toMatchObject({ nome: "Alfa", regId: "r1" });
    expect(campiNome()[0].readOnly).toBe(true);
  });

  it("una voce trovata dalla verifica sul server entra in cache: riaprendo la pagina il server non si interroga più", async () => {
    // La squadra è collegata a una voce che il server ha ma la cache no (creata da un altro, o dal Coach)
    useAppStore.setState({ tappe: [{ ...collegata(), squadre: [{ id: "s1", nome: "Alfa", regId: "r1", giocatori: [], rank: "40" }, collegata().squadre[1]] }] });
    anagrafe.listSquadre.mockResolvedValue([regAlfa]);
    apriPagina({ squadre: [] });
    await waitFor(() => expect(useAnagrafeStore.getState().squadre?.map((s) => s.id)).toEqual(["r1"]));
    expect(anagrafe.listSquadre).toHaveBeenCalledTimes(1);
    cleanup();
    montaPagina();
    await act(async () => {});
    expect(anagrafe.listSquadre).toHaveBeenCalledTimes(1); // la voce è in cache: niente verifica
    expect(store().tappe[0].squadre[0].regId).toBe("r1");
    expect(screen.getByText("Anagrafe")).toBeTruthy();
  });

  it("una squadra collegata con la ricerca a una voce che la cache non ha resta collegata quando la pagina si riapre", async () => {
    anagrafe.listSquadre.mockResolvedValue([regAlfa]); // sul server c'è (creata da un altro), la cache vuota non la conosce
    apriPagina({ squadre: [] });                        // la ricerca è quella vera dello store
    scrivi(0, "Alfa");
    fireEvent.blur(campiNome()[0]);
    await waitFor(() => expect(store().tappe[0].squadre[0].regId).toBe("r1"));
    cleanup();                                          // si esce dalla pagina e si rientra, con la stessa cache
    montaPagina();
    await act(async () => {});
    expect(store().tappe[0].squadre[0]).toMatchObject({ nome: "Alfa", regId: "r1" });
    expect(campiNome()[0].readOnly).toBe(true);
    expect(screen.getByText("Anagrafe")).toBeTruthy();
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
      .toContain("Verranno eliminati la squadra «Gamma», il sorteggio e 1 risultato.");
    expect(store().tappe[0].squadre).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(store().tappe[0].squadre.map((s) => s.nome)).toEqual(["Alfa", "Beta"]);
    expect(store().tappe[0].gironi).toBeNull();
  });
});

describe("TappaPage: «Elimina» chiede conferma (FD-2)", () => {
  const elimina = () => screen.getByRole("button", { name: "Elimina" });

  beforeEach(() => {
    useAppStore.setState({ user: ospite, tappe: [conUnRisultato()] });
  });

  it("apre la finestra e dice che cosa si perde, con i numeri veri; finché non si risponde non cambia niente", () => {
    apriPagina({});
    const prima = store().tappe[0];
    fireEvent.click(elimina());
    expect(screen.getByRole("dialog", { name: "Eliminare la tappa?" }).textContent)
      .toContain("Verranno eliminati la tappa «Roma Open» con 3 squadre, il sorteggio e 1 risultato.");
    expect(store().tappe[0]).toBe(prima);
  });

  it("si chiede anche per una tappa appena creata, e il testo dice solo ciò che c'è", () => {
    useAppStore.setState({ tappe: [tappa()] });
    apriPagina({});
    fireEvent.click(elimina());
    expect(screen.getByRole("dialog", { name: "Eliminare la tappa?" }).textContent)
      .toContain("Verrà eliminata la tappa «Roma Open» con 2 squadre.");
  });

  it("«Annulla» non cambia niente: la tappa resta nello store e si resta sulla sua pagina", () => {
    apriPagina({});
    const prima = store().tappe[0];
    fireEvent.click(elimina());
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store().tappe).toEqual([prima]);
    expect(screen.getByRole("heading", { name: "Roma Open" })).toBeTruthy();
    expect(screen.queryByText("Elenco delle tappe")).toBeNull();
  });

  it("«Conferma» elimina la tappa e porta all'elenco delle tappe", () => {
    apriPagina({});
    fireEvent.click(elimina());
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(store().tappe).toEqual([]);
    expect(screen.getByText("Elenco delle tappe")).toBeTruthy();
  });

  it("registrato: il server riceve la DELETE solo dopo «Conferma», non prima e non con «Annulla»", () => {
    vi.mocked(legheApi.removeTappa).mockResolvedValue(undefined);
    useAppStore.setState({ user: registrato });
    apriPagina({});
    fireEvent.click(elimina());
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(legheApi.removeTappa).not.toHaveBeenCalled();
    fireEvent.click(elimina());
    expect(legheApi.removeTappa).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(legheApi.removeTappa).toHaveBeenCalledExactlyOnceWith("t1");
  });
});

describe("TappaPage: «Rimuovi squadra» chiede conferma quando si perde qualcosa", () => {
  /** Tre squadre non sorteggiate: Alfa con tre giocatori, Beta con solo il nome, «Squadra 3» appena aggiunta */
  const conSquadreDiverse = (): Tappa => ({
    ...tappa(),
    squadre: [
      { id: "s1", nome: "Alfa", giocatori: [{ id: "p1", nome: "Mario" }, { id: "p2", nome: "Luigi" }, { id: "p3", nome: "Anna" }], rank: "" },
      { id: "s2", nome: "Beta", giocatori: [], rank: "" },
      { id: "s3", nome: "Squadra 3", giocatori: [], rank: "" },
    ],
  });
  const rimuovi = (squadra: number) => fireEvent.click(screen.getAllByRole("button", { name: "Rimuovi squadra" })[squadra]);
  const nomiNelloStore = () => store().tappe[0].squadre.map((s) => s.nome);

  beforeEach(() => {
    useAppStore.setState({ user: ospite, tappe: [conSquadreDiverse()] });
  });

  it("una squadra appena aggiunta (nome provvisorio, nessun giocatore) si toglie subito, senza finestra", () => {
    apriPagina({});
    rimuovi(2);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(nomiNelloStore()).toEqual(["Alfa", "Beta"]);
  });

  it("un nome scritto si perde: la finestra lo dice; «Annulla» lascia la squadra, «Conferma» la toglie", () => {
    apriPagina({});
    rimuovi(1);
    expect(screen.getByRole("dialog", { name: "Rimuovere la squadra?" }).textContent).toContain("Verrà eliminata la squadra «Beta».");
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(nomiNelloStore()).toEqual(["Alfa", "Beta", "Squadra 3"]);
    rimuovi(1);
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(nomiNelloStore()).toEqual(["Alfa", "Squadra 3"]);
  });

  it("i giocatori con il nome si perdono: la finestra dice quanti", () => {
    apriPagina({});
    rimuovi(0);
    expect(screen.getByRole("dialog", { name: "Rimuovere la squadra?" }).textContent)
      .toContain("Verrà eliminata la squadra «Alfa» con 3 giocatori.");
  });

  it("una squadra vuota ma con dei risultati nella tappa si chiede: si perdono sorteggio e risultati", () => {
    const sorteggiata = conUnRisultato();
    useAppStore.setState({
      tappe: [{ ...sorteggiata, squadre: sorteggiata.squadre.map((s, i) => ({ ...s, nome: `Squadra ${i + 1}` })) }],
    });
    apriPagina({});
    rimuovi(2);
    expect(screen.getByRole("dialog", { name: "Rimuovere la squadra?" }).textContent)
      .toContain("Verranno eliminati la squadra «Squadra 3», il sorteggio e 1 risultato.");
  });
});

describe("TappaPage: copiare il link pubblico di una tappa conclusa (FS-9)", () => {
  const apriCondivisione = () => {
    useAppStore.setState({ tappe: [{ ...conUnRisultato(), conclusa: true }] });
    apriPagina({});
    fireEvent.click(screen.getByRole("button", { name: /Condividi/ }));
  };
  const copia = () => fireEvent.click(screen.getByRole("button", { name: "Copia link" }));
  /** Gli appunti del browser, finti: jsdom non li ha, e in un contesto non sicuro (http) mancano davvero */
  const conAppunti = (writeText: (testo: string) => Promise<void>) =>
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  afterEach(() => { Reflect.deleteProperty(navigator, "clipboard"); });

  it("con gli appunti disponibili copia il link e lo dice", async () => {
    const writeText = vi.fn(async () => {});
    conAppunti(writeText);
    apriCondivisione();
    copia();
    await screen.findByRole("button", { name: "Copiato!" });
    expect(writeText).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/tappa/t1`);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("senza gli appunti (pagina su http in rete locale) compare un messaggio con la via d'uscita, senza errori", async () => {
    apriCondivisione(); // navigator.clipboard non esiste
    copia();
    const messaggio = await screen.findByRole("alert");
    expect(messaggio.textContent).toMatch(/copia/i);
    expect(messaggio.textContent).toMatch(/a mano/);
    expect(screen.queryByRole("button", { name: "Copiato!" })).toBeNull();
    // Il link resta visibile e selezionabile
    expect(screen.getByText(`${window.location.origin}/tappa/t1`)).toBeTruthy();
  });

  it("se il browser rifiuta la copia (permesso negato) il messaggio compare e nessuna promessa resta senza gestore", async () => {
    conAppunti(vi.fn(async () => { throw new DOMException("negato", "NotAllowedError"); }));
    apriCondivisione();
    copia();
    expect((await screen.findByRole("alert")).textContent).toMatch(/a mano/);
    expect(screen.queryByRole("button", { name: "Copiato!" })).toBeNull();
  });

  it("una copia riuscita dopo un rifiuto toglie il messaggio", async () => {
    conAppunti(vi.fn().mockRejectedValueOnce(new DOMException("negato", "NotAllowedError")).mockResolvedValueOnce(undefined));
    apriCondivisione();
    copia();
    await screen.findByRole("alert");
    copia();
    await screen.findByRole("button", { name: "Copiato!" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/** La pubblicazione com'è nell'archivio, per la verifica che parte quando si apre una tappa conclusa */
const pubblicazione = (t: Tappa): PubTappa => ({ tappa: t, lega: "Lega", autore: "Anna", autoreId: "u1", ts: 1 });

describe("TappaPage: «Riapri» chiede conferma quando toglie la tappa dall'archivio", () => {
  const conclusa = (): Tappa => ({ ...conUnRisultato(), conclusa: true });
  const riapri = () => screen.getByRole("button", { name: "Riapri" });

  beforeEach(() => {
    vi.mocked(archivioApi.get).mockResolvedValue(pubblicazione(conclusa()));
    vi.mocked(archivioApi.rimuovi).mockResolvedValue(undefined);
    useAppStore.setState({ tappe: [conclusa()] });
  });

  it("registrato: la finestra dice che la tappa esce dall'Archivio; «Annulla» non cambia niente e non tocca il server", async () => {
    apriPagina({});
    await screen.findByText("Conclusa e pubblicata nell'archivio");
    fireEvent.click(riapri());
    expect(screen.getByRole("dialog", { name: "Riaprire la tappa?" }).textContent)
      .toContain("La tappa uscirà dall'Archivio circuito e il suo link pubblico smetterà di funzionare");
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(store().tappe[0].conclusa).toBe(true);
    expect(archivioApi.rimuovi).not.toHaveBeenCalled();
  });

  it("registrato: «Conferma» toglie la tappa dall'archivio e poi la riapre", async () => {
    apriPagina({});
    await screen.findByText("Conclusa e pubblicata nell'archivio");
    fireEvent.click(riapri());
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    // La tappa si riapre quando il server ha tolto la pubblicazione, non prima
    await waitFor(() => expect(store().tappe[0].conclusa).toBe(false));
    expect(archivioApi.rimuovi).toHaveBeenCalledExactlyOnceWith("t1");
    // La pagina torna a quella di organizzazione, con i suoi comandi
    expect(screen.getByRole("button", { name: "Elimina" })).toBeTruthy();
  });

  it("mentre il server toglie la pubblicazione «Riapri» è disattivato: un secondo clic non manda un'altra richiesta", async () => {
    const risposta = differita<void>();
    vi.mocked(archivioApi.rimuovi).mockReturnValue(risposta.p);
    apriPagina({});
    await screen.findByText("Conclusa e pubblicata nell'archivio");
    fireEvent.click(riapri());
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    await waitFor(() => expect((riapri() as HTMLButtonElement).disabled).toBe(true));
    expect(store().tappe[0].conclusa).toBe(true);
    await act(async () => { risposta.ok(); });
    await waitFor(() => expect(store().tappe[0].conclusa).toBe(false));
    expect(archivioApi.rimuovi).toHaveBeenCalledTimes(1);
  });

  it("se il server non riesce a togliere la pubblicazione la tappa resta conclusa e la pagina dice perché; riprovare funziona", async () => {
    vi.mocked(archivioApi.rimuovi).mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile: controlla la connessione."));
    apriPagina({});
    await screen.findByText("Conclusa e pubblicata nell'archivio");
    fireEvent.click(riapri());
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toBe("Riapertura non riuscita, la tappa resta conclusa: Server non raggiungibile: controlla la connessione.");
    // Né riaperta né fuori dall'archivio: coerente con quello che il server ha ancora
    expect(store().tappe[0].conclusa).toBe(true);
    expect(screen.getByText("Conclusa e pubblicata nell'archivio")).toBeTruthy();
    expect((riapri() as HTMLButtonElement).disabled).toBe(false);
    // Il secondo tentativo riesce: l'avviso non resta
    fireEvent.click(riapri());
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    await waitFor(() => expect(store().tappe[0].conclusa).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("il 404 dell'archivio (la pubblicazione non c'era più) non è un errore: la tappa si riapre", async () => {
    vi.mocked(archivioApi.rimuovi).mockRejectedValue(new ApiError(404, "Tappa non presente in archivio"));
    apriPagina({});
    await screen.findByText("Conclusa e pubblicata nell'archivio");
    fireEvent.click(riapri());
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    await waitFor(() => expect(store().tappe[0].conclusa).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("tappa che non risulta in archivio: «Riapri» non avverte di una perdita che non c'è, e non chiama il server", async () => {
    vi.mocked(archivioApi.get).mockRejectedValue(new ApiError(404, "Tappa non presente in archivio"));
    apriPagina({});
    await screen.findByText("Conclusa, non pubblicata");
    fireEvent.click(riapri());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store().tappe[0].conclusa).toBe(false);
    expect(archivioApi.rimuovi).not.toHaveBeenCalled();
  });

  it("ospite: non ha niente di pubblicato, quindi la tappa si riapre subito, senza finestra e senza chiamare l'archivio", async () => {
    useAppStore.setState({ user: ospite });
    apriPagina({});
    // Una tappa conclusa dell'ospite (arrivata da un file importato) non dice di essere pubblicata: non lo è
    expect(screen.getByText("Conclusa")).toBeTruthy();
    expect(screen.queryByText(/pubblicata/i)).toBeNull();
    fireEvent.click(riapri());
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(store().tappe[0].conclusa).toBe(false));
    expect(archivioApi.get).not.toHaveBeenCalled();
    expect(archivioApi.rimuovi).not.toHaveBeenCalled();
  });
});

describe("TappaPage: l'esito della pubblicazione di una tappa conclusa", () => {
  /** Tutte le partite giocate: la tappa si può concludere */
  const tuttoGiocato = (): Tappa => ({
    ...conUnRisultato(),
    partite: conUnRisultato().partite.map((m) => ({ ...m, sa: 21, sb: 15, done: true })),
  });
  const concludi = () => fireEvent.click(screen.getByRole("button", { name: /Concludi e pubblica la tappa/ }));
  const nonPubblicata = "Conclusa, non pubblicata";
  const pubblicata = "Conclusa e pubblicata nell'archivio";

  beforeEach(() => {
    vi.mocked(archivioApi.pubblica).mockImplementation(async (id) => pubblicazione({ ...tuttoGiocato(), id }));
    useAppStore.setState({ tappe: [tuttoGiocato()] });
  });

  it("pubblicazione riuscita: la pagina dice che la tappa è pubblicata, senza avvisi", async () => {
    apriPagina({});
    concludi();
    await screen.findByText(pubblicata);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(archivioApi.pubblica).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("pubblicazione rifiutata dal server: la pagina NON dice «pubblicata», dice perché e indica «Riapri» e poi «Concludi»", async () => {
    vi.mocked(archivioApi.pubblica).mockRejectedValue(new ApiError(503, "Servizio non disponibile: riprova tra poco."));
    apriPagina({});
    concludi();
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("La pubblicazione nell'Archivio circuito non è riuscita");
    expect(avviso.textContent).toContain("«Riapri» e poi «Concludi»");
    expect(avviso.textContent).toContain("Servizio non disponibile: riprova tra poco.");
    expect(screen.getByText(nonPubblicata)).toBeTruthy();
    expect(screen.queryByText(pubblicata)).toBeNull();
    // La tappa è conclusa: è la pubblicazione che non è riuscita
    expect(store().tappe[0].conclusa).toBe(true);
  });

  it("la tappa non arriva al server: non si pubblica e la pagina dice che il salvataggio è la causa", async () => {
    vi.mocked(legheApi.putTappa).mockRejectedValue(new ApiError(0, "Server non raggiungibile: controlla la connessione."));
    apriPagina({});
    concludi();
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("salvata sul server");
    expect(avviso.textContent).toContain("Server non raggiungibile: controlla la connessione.");
    expect(archivioApi.pubblica).not.toHaveBeenCalled();
    expect(screen.queryByText(pubblicata)).toBeNull();
  });

  it("la via d'uscita indicata funziona: «Riapri» (senza finestra, non c'è niente da perdere) e poi «Concludi»", async () => {
    // Esito certo: il server rifiuta la tappa conclusa (400), quindi la pubblicazione non parte (412)
    vi.mocked(legheApi.putTappa).mockRejectedValueOnce(new ApiError(400, "Dati non validi"));
    apriPagina({});
    concludi();
    await screen.findByRole("alert");
    expect(screen.getByText(nonPubblicata)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Riapri" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(archivioApi.rimuovi).not.toHaveBeenCalled();
    concludi();
    await screen.findByText(pubblicata);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(archivioApi.pubblica).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("PUT dell'archivio senza risposta (rete assente, tempo scaduto): l'esito è ignoto, la pagina non dice «non pubblicata» e «Riapri» ritira la copia", async () => {
    vi.mocked(archivioApi.pubblica).mockRejectedValueOnce(new ApiError(0, "Il server non risponde: controlla la connessione e riprova."));
    vi.mocked(archivioApi.rimuovi).mockResolvedValue(undefined);
    apriPagina({});
    concludi();
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("Il server non risponde");
    expect(avviso.textContent).toContain("«Riapri» e poi «Concludi»");
    expect(screen.getByText("Conclusa")).toBeTruthy();
    expect(screen.queryByText(nonPubblicata)).toBeNull();
    expect(screen.queryByText(pubblicata)).toBeNull();
    // Il server potrebbe aver pubblicato: «Riapri» avverte e poi toglie la copia
    fireEvent.click(screen.getByRole("button", { name: "Riapri" }));
    expect(screen.getByRole("dialog", { name: "Riaprire la tappa?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    await waitFor(() => expect(store().tappe[0].conclusa).toBe(false));
    expect(archivioApi.rimuovi).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("mentre la pubblicazione è in corso «Riapri» è disattivato: riaprire adesso lascerebbe la copia pubblica di una tappa riaperta", async () => {
    const risposta = differita<PubTappa>();
    vi.mocked(archivioApi.pubblica).mockReturnValue(risposta.p);
    apriPagina({});
    concludi();
    await waitFor(() => expect((screen.getByRole("button", { name: "Riapri" }) as HTMLButtonElement).disabled).toBe(true));
    await act(async () => { risposta.ok(pubblicazione(tuttoGiocato())); });
    await screen.findByText(pubblicata);
    expect((screen.getByRole("button", { name: "Riapri" }) as HTMLButtonElement).disabled).toBe(false);
  });

  describe("aprendo una tappa già conclusa (dopo un ricaricamento) la pagina verifica con l'archivio", () => {
    beforeEach(() => { useAppStore.setState({ tappe: [{ ...tuttoGiocato(), conclusa: true }] }); });

    it("c'è: «Conclusa e pubblicata nell'archivio»", async () => {
      vi.mocked(archivioApi.get).mockResolvedValue(pubblicazione(tuttoGiocato()));
      apriPagina({});
      await screen.findByText(pubblicata);
      expect(archivioApi.get).toHaveBeenCalledExactlyOnceWith("t1");
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("non c'è (404): lo dice, con la via d'uscita", async () => {
      vi.mocked(archivioApi.get).mockRejectedValue(new ApiError(404, "Tappa non presente in archivio"));
      apriPagina({});
      await screen.findByText(nonPubblicata);
      const avviso = screen.getByRole("alert");
      expect(avviso.textContent).toContain("non risulta pubblicata");
      expect(avviso.textContent).toContain("«Riapri» e poi «Concludi»");
    });

    it("la verifica non riesce (rete assente): la pagina non afferma niente, né «pubblicata» né «non pubblicata»", async () => {
      vi.mocked(archivioApi.get).mockRejectedValue(new ApiError(0, "Server non raggiungibile"));
      apriPagina({});
      await screen.findByText("Conclusa");
      await act(async () => {}); // lascia finire la verifica
      expect(screen.queryByText(pubblicata)).toBeNull();
      expect(screen.queryByText(nonPubblicata)).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("un video aggiunto a una tappa conclusa che non si ripubblica: la pagina lo dice e la tappa resta pubblicata com'era", async () => {
    useAppStore.setState({ tappe: [{ ...tuttoGiocato(), conclusa: true }] });
    vi.mocked(archivioApi.get).mockResolvedValue(pubblicazione(tuttoGiocato()));
    vi.mocked(archivioApi.pubblica).mockRejectedValue(new ApiError(0, "Server non raggiungibile"));
    apriPagina({});
    await screen.findByText(pubblicata);
    fireEvent.change(screen.getByLabelText("Link video"), { target: { value: "https://youtu.be/abcdefghijk" } });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi" }));
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("La copia pubblica non è aggiornata");
    expect(avviso.textContent).toContain("resta visibile a tutti");
    expect(avviso.textContent).toContain("Server non raggiungibile");
    // La tappa è in archivio e ci resta: il badge non si contraddice con l'avviso («la pubblicazione non è riuscita»)
    expect(screen.getByText(pubblicata)).toBeTruthy();
    expect(avviso.textContent).not.toContain("La pubblicazione nell'Archivio circuito non è riuscita");
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
    expect(screen.getByRole("alert").textContent).toContain("«Elimina bracket e ricomincia»");
    expect(store().tappe[0]).toBe(prima);
  });
});

describe("TappaPage: il timer di gara usa le regole della tappa (FD-7)", () => {
  it("si apre con la durata e il possesso scritti nelle regole, non con 10 minuti e 12 secondi", () => {
    useAppStore.setState({ tappe: [{ ...tappa(), regole: { target: 11, durata: 5, ot: 3, shot: 24 } }] });
    apriPagina({});
    fireEvent.click(screen.getByRole("button", { name: "Timer" }));
    const timer = screen.getByRole("dialog", { name: "Timer di gara" });
    expect(within(timer).getByText("5:00")).toBeTruthy();
    expect(within(timer).getByText("24")).toBeTruthy();
    expect(within(timer).getByRole("button", { name: "Reset 24s" })).toBeTruthy();
  });
});
