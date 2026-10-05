// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import App from "../../src/App";
import { ErrorBoundary } from "../../src/components/ui/ErrorBoundary";
import { GiocatoreForm } from "../../src/components/anagrafe/GiocatoreForm";
import { GiocatoreModal } from "../../src/components/anagrafe/GiocatoreModal";
import { SquadraAnagrafeForm } from "../../src/components/anagrafe/SquadraAnagrafeForm";
import { SquadraAnagrafeModal } from "../../src/components/anagrafe/SquadraAnagrafeModal";
import { AnagrafePage } from "../../src/pages/AnagrafePage";
import { ArchivioPage } from "../../src/pages/ArchivioPage";
import { GiocatorePage } from "../../src/pages/GiocatorePage";
import { LegheListPage } from "../../src/pages/LegheListPage";
import { TappaViewPage } from "../../src/pages/TappaViewPage";
import { useAppStore, SESSION_KEY } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { legheApi } from "../../src/services/legheApi";
import { archivioApi } from "../../src/services/archivioApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { PubTappa, RegGiocatore, RegSquadra, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete (leghe, anagrafe, archivio): pagine, store e componenti sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));
vi.mock("../../src/services/anagrafeApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/services/anagrafeApi")>()),
  anagrafeApi: {
    listGiocatori: vi.fn(), createGiocatore: vi.fn(), updateGiocatore: vi.fn(), removeGiocatore: vi.fn(),
    listSquadre: vi.fn(), createSquadra: vi.fn(), updateSquadra: vi.fn(), removeSquadra: vi.fn(),
  },
}));
vi.mock("../../src/services/archivioApi", () => ({
  archivioApi: { list: vi.fn(), get: vi.fn(), pubblica: vi.fn(), rimuovi: vi.fn() },
}));

const store = () => useAppStore.getState();
const ospite: User = { name: "Ospite", guest: true };
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const leghe = vi.mocked(legheApi);
const anagrafe = vi.mocked(anagrafeApi);
const archivio = vi.mocked(archivioApi);

/** Il server non risponde: l'errore che api.ts dà per rete assente o tempo massimo scaduto */
const rete = () => new ApiError(0, "Server non raggiungibile: controlla la connessione o avvia il backend.");

/** Una tappa com'è nel browser di un ospite che anni fa importò un file incompleto: manca l'elenco delle squadre */
const tappaSenzaSquadre = (): Tappa => ({
  id: "t1", nome: "Tappa rotta", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, gironi: null, partite: [], video: [],
} as unknown as Tappa);

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  // La cache dell'anagrafe è stato di modulo: ogni test riparte da «non ancora caricata»
  useAnagrafeStore.setState({ giocatori: null, squadre: null, errore: null, caricata: false });
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

/* ── FS-6: un errore di disegno non svuota l'applicazione ── */

/** Si rompe nel disegno, come una pagina che trova dati in una forma inattesa */
function Rotto(): never {
  throw new Error("dati inattesi");
}

describe("ErrorBoundary (FS-6)", () => {
  it("una pagina che si rompe nel disegno mostra un messaggio con «Ricarica», non una pagina bianca", () => {
    render(<ErrorBoundary><Rotto /></ErrorBoundary>);
    expect(screen.getByRole("alert").textContent).toContain("Qualcosa è andato storto");
    expect(screen.getByRole("button", { name: "Ricarica" })).toBeTruthy();
  });

  it("«Ricarica» ricarica la pagina", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(<ErrorBoundary><Rotto /></ErrorBoundary>);
    fireEvent.click(screen.getByRole("button", { name: "Ricarica" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("cambiando pagina (resetKey) l'errore di prima si dimentica e la pagina nuova si disegna", () => {
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Rotto /></ErrorBoundary>);
    expect(screen.queryByRole("alert")).not.toBeNull();
    // Stessa pagina: l'errore resta; pagina diversa: il boundary riparte
    rerender(<ErrorBoundary resetKey="/a"><Rotto /></ErrorBoundary>);
    expect(screen.queryByRole("alert")).not.toBeNull();
    rerender(<ErrorBoundary resetKey="/b"><p>Un'altra pagina</p></ErrorBoundary>);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Un'altra pagina")).toBeTruthy();
  });

  it("passando da una pagina buona a una che si rompe compare il messaggio, e ci si ferma lì (nessun ciclo)", () => {
    const { rerender } = render(<ErrorBoundary resetKey="/a"><p>Pagina buona</p></ErrorBoundary>);
    rerender(<ErrorBoundary resetKey="/b"><Rotto /></ErrorBoundary>);
    expect(screen.getByRole("alert").textContent).toContain("Qualcosa è andato storto");
    expect(screen.queryByText("Pagina buona")).toBeNull();
  });

  it("nell'app una pagina rotta lascia visibili intestazione e navigazione, e un'altra pagina si apre", () => {
    // Stato che nessun salvataggio valido produrrebbe: la home cerca le squadre di una tappa che non le ha
    useAppStore.setState({ user: ospite, legaId: "l1", legaName: "Lega", tappe: [tappaSenzaSquadre()], ready: true });
    render(<App />);
    expect(screen.getByRole("alert").textContent).toContain("Qualcosa è andato storto");
    const navigazione = screen.getByRole("navigation", { name: "Principale" });
    expect(navigazione).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Le mie leghe" }));
    expect(screen.queryByText(/Qualcosa è andato storto/)).toBeNull();
    expect(screen.getByRole("heading", { name: /Le mie leghe/ })).toBeTruthy();
  });
});

/* ── Dati vecchi nel browser dell'ospite: messaggio e via d'uscita, mai la pagina bianca ── */

/** Tappa valida, com'è nel browser di un ospite */
const tappaValida = (id: string, nome: string): Tappa => ({
  id, nome, luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, gironi: null, partite: [], video: [],
  squadre: [{ id: "s1", nome: "Uno", giocatori: [], rank: "" }, { id: "s2", nome: "Due", giocatori: [], rank: "" }],
});

/** Il browser di un ospite com'è prima di ricaricare la pagina: sessione, indice delle leghe, lega aperta per ultima e i suoi
 *  dati. `dati` è il testo salvato per la lega "l1" (oppure un oggetto, che si scrive come JSON). */
function browserDellOspite(dati: unknown, opzioni: { aperta?: boolean } = {}) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(ospite));
  localStorage.setItem("hoop3x3_leghe_index", JSON.stringify([
    { id: "l1", nome: "Estate", ts: 1, nTappe: 2 },
    { id: "l2", nome: "Inverno", ts: 1, nTappe: 0 },
  ]));
  let testo = dati;
  if (typeof dati !== "string") testo = JSON.stringify(dati);
  localStorage.setItem("hoop3x3_lega_l1", testo as string);
  localStorage.setItem("hoop3x3_lega_l2", JSON.stringify({ nome: "Inverno", tappe: [] }));
  if (opzioni.aperta !== false) localStorage.setItem("hoop3x3_active_lega_id", "l1");
}

/** Ricarica della pagina: moduli nuovi, che rileggono il browser come all'avvio. Restituisce l'App e lo store nuovi. */
async function ricarica() {
  vi.resetModules();
  const { default: AppNuova } = await import("../../src/App");
  const { useAppStore: storeNuovo } = await import("../../src/stores/useAppStore");
  return { App: AppNuova, store: () => storeNuovo.getState() };
}

describe("Dati vecchi dell'ospite nel browser (Ruling 3, T1.12)", () => {
  it("una lega con una tappa senza squadre: niente pagina bianca, un messaggio dice quale tappa, il resto si usa", async () => {
    browserDellOspite({ nome: "Estate", tappe: [tappaValida("a", "Tappa buona"), tappaSenzaSquadre()] });
    const { App: AppNuova } = await ricarica();
    render(<AppNuova />);
    // La home mostra la tappa valida: l'app si disegna
    expect(screen.getByRole("heading", { name: "Tappa buona" })).toBeTruthy();
    expect(screen.queryByText(/Qualcosa è andato storto/)).toBeNull();
    // Il messaggio dice quale tappa non è stata caricata e perché
    const avviso = screen.getByRole("alert").textContent ?? "";
    expect(avviso).toContain("La lega «Estate» ha una tappa non valida, che non è stata caricata");
    expect(avviso).toContain("«Tappa rotta» (manca il campo «squadre»)");
    // Il resto è usabile: si naviga e si torna alle leghe; l'avviso si chiude a mano
    fireEvent.click(screen.getByRole("link", { name: "Le mie leghe" }));
    expect(screen.getByRole("heading", { name: /Le mie leghe/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Chiudi avviso" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("una tappa con valori fuori limite (nome vuoto, 2,5 gironi, regola a 0) resta: si disegna senza avvisi e il sorteggio risponde con un messaggio", async () => {
    // È ciò che le versioni vecchie lasciavano scrivere: non rompe il disegno, e scartarla farebbe perdere squadre e risultati
    const fuoriLimite = { ...tappaValida("a", ""), nGironi: 2.5, regole: { target: 0, durata: 10, ot: 2, shot: 12 } };
    browserDellOspite({ nome: "Estate", tappe: [fuoriLimite] });
    window.history.replaceState(null, "", "/lega/tappa/a");
    const { App: AppNuova, store } = await ricarica();
    render(<AppNuova />);
    expect(store().tappe).toHaveLength(1);
    expect(store().tappe[0]).toMatchObject({ id: "a", nome: "", nGironi: 2.5 });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Qualcosa è andato storto/)).toBeNull();
    expect(screen.getByText(/2\.5 gironi/)).toBeTruthy();
    // Il sorteggio non parte con un numero di gironi non valido e dice perché; il valore si corregge dal pannello «Modifica»
    fireEvent.click(screen.getByRole("button", { name: /Sorteggio casuale/ }));
    expect(screen.getByRole("alert").textContent).toMatch(/Numero di gironi non valido/);
  });

  it("i dati nel browser non si toccano all'avvio: la tappa scartata sparisce solo al primo salvataggio della lega", async () => {
    const originale = JSON.stringify({ nome: "Estate", tappe: [tappaValida("a", "Tappa buona"), tappaSenzaSquadre()] });
    browserDellOspite(originale);
    const { store } = await ricarica();
    expect(store().tappe.map((t) => t.id)).toEqual(["a"]);
    expect(localStorage.getItem("hoop3x3_lega_l1")).toBe(originale);
    act(() => { store().updateTappa("a", { nome: "Tappa rinominata" }); });
    const salvata = JSON.parse(localStorage.getItem("hoop3x3_lega_l1")!);
    expect(salvata.tappe.map((t: Tappa) => t.nome)).toEqual(["Tappa rinominata"]);
  });

  it("una lega illeggibile non si apre: il messaggio dice la via d'uscita e le altre leghe restano", async () => {
    browserDellOspite("{ non json");
    const { App: AppNuova, store } = await ricarica();
    render(<AppNuova />);
    expect(store().legaId).toBeNull();
    expect(localStorage.getItem("hoop3x3_active_lega_id")).toBeNull(); // non si riprova a ogni ricarica
    expect(screen.getByRole("alert").textContent)
      .toBe("I dati della lega «Estate» non ci sono più nel browser o sono danneggiati: puoi eliminarla dall'elenco delle leghe.");
    // Le due leghe sono ancora nell'elenco, e l'app si usa
    expect(store().leghe.map((m) => m.id)).toEqual(["l1", "l2"]);
    expect(screen.getByText("Apri una lega esistente o creane una nuova.")).toBeTruthy();
  });

  it("un id di lega rimasto senza dati e fuori dall'elenco (eliminata da un'altra scheda) non dà nessun messaggio", async () => {
    browserDellOspite({ nome: "Estate", tappe: [] });
    localStorage.setItem("hoop3x3_active_lega_id", "l-eliminata");
    const { store } = await ricarica();
    expect(store().legaId).toBeNull();
    expect(store().syncError).toBeNull();
  });

  it("un indice delle leghe rovinato non fa uscire la pagina bianca: l'elenco è vuoto", async () => {
    browserDellOspite({ nome: "Estate", tappe: [] });
    for (const indice of ["null", "{\"a\":1}", "[null, 7, {\"nome\":\"senza id\"}]", "non json"]) {
      localStorage.setItem("hoop3x3_leghe_index", indice);
      localStorage.removeItem("hoop3x3_active_lega_id");
      const { store } = await ricarica();
      expect(store().leghe, indice).toEqual([]);
    }
  });

  it("«Continua come Ospite» controlla gli stessi dati: la lega si apre senza le tappe non valide, e un avviso lo dice", async () => {
    browserDellOspite({ nome: "Estate", tappe: [tappaValida("a", "Tappa buona"), tappaSenzaSquadre()] });
    localStorage.removeItem(SESSION_KEY); // pagina appena aperta: nessuna sessione
    const { store } = await ricarica();
    expect(store().user).toBeNull();
    await act(async () => {
      store().setUser(ospite);
      await store().rehydrate();
    });
    expect(store().tappe.map((t) => t.id)).toEqual(["a"]);
    expect(store().syncError).toContain("«Tappa rotta» (manca il campo «squadre»)");
  });
});

/* ── FS-4: anagrafe e archivio non caricati non sono «vuoti» ── */

const giocatore = (id: string, nome: string): RegGiocatore => ({
  id, nome, cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "Italia", altezza: "", peso: "",
  ruolo: "Guardia", numero: "", squadra: "", esperienza: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
});

const squadra = (id: string, nome: string): RegSquadra => ({
  id, nome, citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "",
  autore: "Anna", autoreId: "u1", ts: 1,
});

/** Apre una pagina dell'app a questo percorso, con questo utente */
function apri(percorso: string, utente: User = registrato) {
  useAppStore.setState({ user: utente });
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <Routes>
        <Route path="/anagrafe" element={<AnagrafePage />} />
        <Route path="/giocatore/:id" element={<GiocatorePage />} />
        <Route path="/archivio" element={<ArchivioPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Anagrafe non caricata: l'errore si distingue dal «vuoto» (FS-4)", () => {
  it("server che risponde errore: compare il messaggio con «Riprova», non «Nessun giocatore registrato»", async () => {
    anagrafe.listGiocatori.mockRejectedValue(new ApiError(503, "Servizio non disponibile"));
    anagrafe.listSquadre.mockRejectedValue(new ApiError(503, "Servizio non disponibile"));
    apri("/anagrafe");
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("Non è stato possibile caricare l'anagrafe");
    expect(avviso.textContent).toContain("Servizio non disponibile");
    expect(screen.queryByText(/Nessun giocatore registrato/)).toBeNull();
    expect(screen.queryByText(/Sto aprendo l'anagrafe/)).toBeNull();
    // Senza il numero tra parentesi: non si sa quanti sono, «(0)» direbbe che non ce ne sono
    expect(screen.getByRole("tab", { name: "Giocatori" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Squadre" })).toBeTruthy();
    // Anche l'altra scheda dice lo stesso, non «Nessuna squadra registrata»
    fireEvent.click(screen.getByRole("tab", { name: "Squadre" }));
    expect(screen.getByRole("alert").textContent).toContain("Non è stato possibile caricare l'anagrafe");
    expect(screen.queryByText(/Nessuna squadra registrata/)).toBeNull();
  });

  it("«Riprova» ricarica: tornato il server, compaiono i giocatori", async () => {
    anagrafe.listGiocatori.mockRejectedValueOnce(rete());
    anagrafe.listSquadre.mockResolvedValue([]);
    apri("/anagrafe");
    await screen.findByRole("alert");
    anagrafe.listGiocatori.mockResolvedValue([giocatore("g1", "Mario")]);
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByText("Mario Rossi")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("tab", { name: "Giocatori (1)" })).toBeTruthy();
  });

  it("anagrafe davvero vuota: il messaggio resta quello di prima", async () => {
    anagrafe.listGiocatori.mockResolvedValue([]);
    anagrafe.listSquadre.mockResolvedValue([]);
    apri("/anagrafe");
    expect(await screen.findByText("Nessun giocatore registrato: aggiungi il primo.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("la scheda di un giocatore con l'anagrafe non caricata dice l'errore, non «Sto aprendo la scheda» per sempre", async () => {
    anagrafe.listGiocatori.mockRejectedValueOnce(rete());
    anagrafe.listSquadre.mockResolvedValue([]);
    apri("/giocatore/g1");
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("Non è stato possibile caricare l'anagrafe");
    expect(screen.queryByText(/Sto aprendo la scheda/)).toBeNull();
    expect(screen.queryByText(/Giocatore non trovato/)).toBeNull();
    anagrafe.listGiocatori.mockResolvedValue([giocatore("g1", "Mario")]);
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByRole("heading", { name: "Mario Rossi" })).toBeTruthy();
  });
});

/** Una tappa pubblicata nell'archivio del circuito */
const pubblicata = (): PubTappa => ({ tappa: { ...tappaValida("p1", "Finale di Roma") }, lega: "Estate", autore: "Anna", autoreId: "u1", ts: 1 });

describe("Archivio non caricato: l'errore si distingue dal «vuoto» (FS-4)", () => {
  it("server che risponde errore: compare il messaggio con «Riprova», non «L'archivio è vuoto»", async () => {
    archivio.list.mockRejectedValue(new ApiError(500, "Errore interno del server"));
    apri("/archivio");
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("Non è stato possibile caricare l'archivio del circuito");
    expect(avviso.textContent).toContain("Errore interno del server");
    expect(screen.queryByText(/L'archivio è vuoto/)).toBeNull();
    expect(screen.queryByText(/Sto aprendo l'archivio/)).toBeNull();
  });

  it("«Riprova» ricarica l'elenco", async () => {
    archivio.list.mockRejectedValueOnce(rete());
    apri("/archivio");
    await screen.findByRole("alert");
    archivio.list.mockResolvedValue([pubblicata()]);
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByText("Finale di Roma")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(archivio.list).toHaveBeenCalledTimes(2);
  });

  it("archivio davvero vuoto: il messaggio resta quello di prima", async () => {
    archivio.list.mockResolvedValue([]);
    apri("/archivio");
    expect(await screen.findByText(/L'archivio è vuoto/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Pagina pubblica di una tappa: il server in errore non è «non trovata» (FS-4)", () => {
  const ID = "123e4567-e89b-42d3-a456-426614174000";

  /** Apre la pagina pubblica di questa tappa, senza bisogno di un utente (è raggiungibile da link) */
  function apriPubblica(id: string = ID) {
    render(
      <MemoryRouter initialEntries={[`/tappa/${id}`]}>
        <Routes>
          <Route path="/tappa/:id" element={<TappaViewPage />} />
          <Route path="/archivio" element={<p>Pagina dell'archivio</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("server che risponde errore: compare il motivo con «Riprova», non «Tappa non trovata»", async () => {
    archivio.get.mockRejectedValue(new ApiError(503, "Servizio non disponibile"));
    apriPubblica();
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("Non è stato possibile caricare la tappa");
    expect(avviso.textContent).toContain("Servizio non disponibile");
    expect(screen.queryByText(/Tappa non trovata/)).toBeNull();
    expect(screen.queryByText(/Sto caricando la tappa/)).toBeNull();
  });

  it("senza rete: lo stesso, con il motivo della rete; «Riprova» ricarica e mostra la tappa", async () => {
    archivio.get.mockRejectedValueOnce(rete());
    apriPubblica();
    expect((await screen.findByRole("alert")).textContent).toContain("Server non raggiungibile");
    archivio.get.mockResolvedValue(pubblicata());
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByRole("heading", { name: "Finale di Roma" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(archivio.get).toHaveBeenCalledTimes(2);
    expect(archivio.get).toHaveBeenLastCalledWith(ID);
  });

  it("404: «Tappa non trovata nell'archivio» come prima, con il link all'archivio e senza «Riprova»", async () => {
    archivio.get.mockRejectedValue(new ApiError(404, "Tappa non trovata nell'archivio"));
    apriPubblica();
    expect(await screen.findByText(/Tappa non trovata nell'archivio\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Vai all'archivio" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Riprova" })).toBeNull();
  });

  it("un id che non è un UUID è «non trovata» senza chiamare il server", async () => {
    apriPubblica("non-un-uuid");
    expect(await screen.findByText(/Tappa non trovata nell'archivio\./)).toBeTruthy();
    expect(archivio.get).not.toHaveBeenCalled();
  });

  it("passando dalla cronologia a un id non valido l'errore della tappa di prima non resta", async () => {
    /** Un pulsante che porta a un'altra tappa senza smontare la pagina, come i tasti avanti e indietro del browser */
    function Altra() {
      const navigate = useNavigate();
      return <button onClick={() => navigate("/tappa/non-un-uuid")}>Altra tappa</button>;
    }
    archivio.get.mockRejectedValue(new ApiError(503, "Servizio non disponibile"));
    render(
      <MemoryRouter initialEntries={[`/tappa/${ID}`]}>
        <Altra />
        <Routes>
          <Route path="/tappa/:id" element={<TappaViewPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Altra tappa" }));
    expect(await screen.findByText(/Tappa non trovata nell'archivio\./)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/* ── FS-4 e Ruling 3: creare, aprire ed eliminare una lega con un messaggio per ogni errore ── */

/** Promessa controllabile a mano: il test decide quando il «server» risponde */
function differita<T>() {
  let ok!: (v: T) => void;
  const p = new Promise<T>((res) => { ok = res; });
  return { p, ok };
}

describe("Elenco delle leghe: errori di creazione, apertura ed eliminazione", () => {
  const estate = { id: "l1", nome: "Estate", ts: 1, nTappe: 2 };

  /** Apre l'elenco delle leghe di questo utente; la pagina della lega è un segnaposto per vedere se si naviga */
  function apriLeghe(utente: User, elenco = [estate]) {
    useAppStore.setState({ user: utente, leghe: elenco });
    render(
      <MemoryRouter initialEntries={["/leghe"]}>
        <Routes>
          <Route path="/leghe" element={<LegheListPage />} />
          <Route path="/lega" element={<p>Pagina della lega</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }
  const campoNome = () => screen.getByLabelText(/Nome della nuova lega/) as HTMLInputElement;
  const creaLega = () => screen.getByRole("button", { name: /Crea lega/ }) as HTMLButtonElement;

  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("creazione che fallisce: il messaggio dice perché, il nome resta nel campo e non si cambia pagina", async () => {
    leghe.create.mockRejectedValue(rete());
    apriLeghe(registrato);
    fireEvent.change(campoNome(), { target: { value: "Estate 2026" } });
    fireEvent.click(creaLega());
    expect((await screen.findByRole("alert")).textContent)
      .toBe("Creazione non riuscita: Server non raggiungibile: controlla la connessione o avvia il backend.");
    expect(campoNome().value).toBe("Estate 2026");
    expect(screen.queryByText("Pagina della lega")).toBeNull();
    expect(creaLega().disabled).toBe(false); // si può riprovare
  });

  it("creazione riuscita al nuovo tentativo: si apre la lega e il messaggio di prima non c'è più", async () => {
    leghe.create
      .mockRejectedValueOnce(rete())
      .mockResolvedValueOnce({ id: "l9", nome: "Estate 2026", ts: 2, nTappe: 0 });
    apriLeghe(registrato);
    fireEvent.change(campoNome(), { target: { value: "Estate 2026" } });
    fireEvent.click(creaLega());
    await screen.findByRole("alert");
    fireEvent.click(creaLega());
    expect(await screen.findByText("Pagina della lega")).toBeTruthy();
    expect(store().legaId).toBe("l9");
  });

  it("durante la creazione il pulsante è disattivato e un secondo clic non crea un'altra lega", async () => {
    const risposta = differita<{ id: string; nome: string; ts: number; nTappe: number }>();
    leghe.create.mockReturnValue(risposta.p);
    apriLeghe(registrato);
    fireEvent.change(campoNome(), { target: { value: "Estate 2026" } });
    fireEvent.click(creaLega());
    fireEvent.click(creaLega());
    fireEvent.keyDown(campoNome(), { key: "Enter" });
    expect(creaLega().disabled).toBe(true);
    expect(leghe.create).toHaveBeenCalledTimes(1);
    await act(async () => { risposta.ok({ id: "l9", nome: "Estate 2026", ts: 2, nTappe: 0 }); });
    expect(await screen.findByText("Pagina della lega")).toBeTruthy();
    expect(leghe.create).toHaveBeenCalledTimes(1);
  });

  it("apertura senza rete: «Apri» dice perché non si apre e resta sull'elenco", async () => {
    leghe.get.mockRejectedValue(rete());
    apriLeghe(registrato);
    fireEvent.click(screen.getByRole("button", { name: /Apri/ }));
    expect((await screen.findByRole("alert")).textContent)
      .toBe("Apertura non riuscita: Server non raggiungibile: controlla la connessione o avvia il backend.");
    expect(screen.queryByText("Pagina della lega")).toBeNull();
    expect(store().legaId).toBeNull();
  });

  it("eliminazione che il server rifiuta: il messaggio dice perché e la lega resta nell'elenco", async () => {
    leghe.remove.mockRejectedValue(new ApiError(403, "Non puoi modificare questa lega"));
    apriLeghe(registrato);
    fireEvent.click(screen.getByRole("button", { name: "Elimina lega Estate" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Eliminazione non riuscita: Non puoi modificare questa lega");
    expect(screen.getByText("Estate")).toBeTruthy();
    expect(store().leghe).toEqual([estate]);
  });

  it("ospite con una lega illeggibile: «Apri» dice perché, e eliminarla è la via d'uscita", async () => {
    // L'indice la elenca ma i suoi dati nel browser non ci sono più
    apriLeghe(ospite);
    fireEvent.click(screen.getByRole("button", { name: /Apri/ }));
    expect((await screen.findByRole("alert")).textContent)
      .toBe("Apertura non riuscita: I dati della lega «Estate» non ci sono più nel browser o sono danneggiati: puoi eliminarla dall'elenco delle leghe.");
    expect(screen.queryByText("Pagina della lega")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Elimina lega Estate" }));
    await waitFor(() => expect(screen.getByText(/Nessuna lega ancora/)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/* ── FS-4: form e modali dell'anagrafe: i dati restano se il server rifiuta, pulsanti fermi durante l'invio ── */

describe("Form dell'anagrafe: si svuotano solo a salvataggio riuscito", () => {
  const SALVA = "Salvataggio non riuscito: Il server non risponde: controlla la connessione e riprova.";
  const salva = () => screen.getByRole("button", { name: "Salva nell'anagrafe" }) as HTMLButtonElement;
  const campo = (etichetta: string) => screen.getByLabelText(etichetta) as HTMLInputElement;
  const scrivi = (etichetta: string, valore: string) => fireEvent.change(campo(etichetta), { target: { value: valore } });
  const nonRisponde = () => new ApiError(0, "Il server non risponde: controlla la connessione e riprova.");

  it("giocatore, salvataggio fallito: i dati digitati restano, il messaggio dice perché e si può riprovare", async () => {
    const onSave = vi.fn().mockRejectedValue(nonRisponde());
    render(<GiocatoreForm squadre={[]} onSave={onSave} />);
    scrivi("Nome *", "Mario");
    scrivi("Cognome *", "Rossi");
    scrivi("Note sportive", "tiratore da fuori");
    fireEvent.click(salva());
    expect((await screen.findByRole("alert")).textContent).toBe(SALVA);
    expect(campo("Nome *").value).toBe("Mario");
    expect(campo("Cognome *").value).toBe("Rossi");
    expect(campo("Note sportive").value).toBe("tiratore da fuori");
    expect(salva().disabled).toBe(false);
  });

  it("giocatore, salvataggio riuscito: il form si svuota e il messaggio di un tentativo fallito sparisce", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(nonRisponde()).mockResolvedValueOnce(undefined);
    render(<GiocatoreForm squadre={[]} onSave={onSave} />);
    scrivi("Nome *", "Mario");
    scrivi("Cognome *", "Rossi");
    fireEvent.click(salva());
    await screen.findByRole("alert");
    fireEvent.click(salva());
    await waitFor(() => expect(campo("Nome *").value).toBe(""));
    expect(campo("Cognome *").value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("giocatore, durante l'invio il pulsante è disattivato e un secondo clic non invia di nuovo", async () => {
    const risposta = differita<void>();
    const onSave = vi.fn().mockReturnValue(risposta.p);
    render(<GiocatoreForm squadre={[]} onSave={onSave} />);
    scrivi("Nome *", "Mario");
    scrivi("Cognome *", "Rossi");
    fireEvent.click(salva());
    fireEvent.click(salva());
    expect(salva().disabled).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => { risposta.ok(); });
    expect(salva().disabled).toBe(false);
  });

  it("giocatore, campi obbligatori vuoti: il messaggio c'è, niente viene inviato e il resto resta", () => {
    const onSave = vi.fn();
    render(<GiocatoreForm squadre={[]} onSave={onSave} />);
    scrivi("Nome *", "Mario");
    fireEvent.click(salva());
    expect(screen.getByRole("alert").textContent).toBe("Nome e cognome sono obbligatori.");
    expect(onSave).not.toHaveBeenCalled();
    expect(campo("Nome *").value).toBe("Mario");
  });

  it("squadra, salvataggio fallito: nome, note e roster scelto restano; riuscito: il form si svuota", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(nonRisponde()).mockResolvedValueOnce(undefined);
    render(<SquadraAnagrafeForm giocatori={[giocatore("g1", "Mario")]} onSave={onSave} />);
    scrivi("Nome squadra *", "Ballers");
    scrivi("Note", "campioni di Roma");
    fireEvent.change(screen.getByLabelText("Scegli un giocatore"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi" }));
    fireEvent.click(salva());
    expect((await screen.findByRole("alert")).textContent).toBe(SALVA);
    expect(campo("Nome squadra *").value).toBe("Ballers");
    expect(campo("Note").value).toBe("campioni di Roma");
    expect(screen.getByRole("button", { name: "Rimuovi Mario Rossi" })).toBeTruthy();
    fireEvent.click(salva());
    await waitFor(() => expect(campo("Nome squadra *").value).toBe(""));
    expect(screen.queryByRole("button", { name: "Rimuovi Mario Rossi" })).toBeNull();
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ nome: "Ballers", roster: ["g1"] }));
  });
});

describe("Modali dell'anagrafe: la modifica si chiude solo se il server ha accettato", () => {
  const nonRisponde = () => new ApiError(0, "Il server non risponde: controlla la connessione e riprova.");
  const mario = giocatore("g1", "Mario");
  const ballers = squadra("s1", "Ballers");
  const pulsante = (nome: string) => screen.getByRole("button", { name: nome }) as HTMLButtonElement;
  const campo = (etichetta: string) => screen.getByLabelText(etichetta) as HTMLInputElement;

  /** I gestori della modale: per `T` la voce che si modifica. Per default il server accetta tutto; i test cambiano ciò che serve */
  interface Gestori<T> {
    onClose: Mock<() => void>;
    onRemove: Mock<() => Promise<void>>;
    onUpdate: Mock<(updated: T) => Promise<void>>;
  }
  const gestori = <T,>(): Gestori<T> => ({
    onClose: vi.fn<() => void>(),
    onRemove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onUpdate: vi.fn<(updated: T) => Promise<void>>().mockResolvedValue(undefined),
  });

  const mostraGiocatore = (g: Gestori<RegGiocatore>) => render(
    <MemoryRouter><GiocatoreModal g={mario} user={registrato} {...g} /></MemoryRouter>,
  );
  const mostraSquadra = (g: Gestori<RegSquadra>) => render(
    <SquadraAnagrafeModal s={ballers} giocatori={[]} user={registrato} {...g} />,
  );

  it("giocatore, modifica rifiutata: resta in modifica con i valori digitati e il motivo sotto i pulsanti", async () => {
    const g = gestori<RegGiocatore>();
    g.onUpdate.mockRejectedValue(new ApiError(403, "Non puoi modificare questa scheda giocatore"));
    mostraGiocatore(g);
    fireEvent.click(pulsante("Modifica"));
    fireEvent.change(campo("Nome"), { target: { value: "Luigi" } });
    fireEvent.click(pulsante("Salva modifiche"));
    expect((await screen.findByRole("alert")).textContent).toBe("Modifica non riuscita: Non puoi modificare questa scheda giocatore");
    expect(campo("Nome").value).toBe("Luigi");   // ancora in modifica, il dato scritto non si perde
    expect(pulsante("Salva modifiche").disabled).toBe(false);
    expect(g.onUpdate).toHaveBeenCalledWith({ ...mario, nome: "Luigi" });
  });

  it("giocatore, modifica accettata: si torna alla scheda, senza messaggi", async () => {
    const g = gestori<RegGiocatore>();
    mostraGiocatore(g);
    fireEvent.click(pulsante("Modifica"));
    fireEvent.click(pulsante("Salva modifiche"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Salva modifiche" })).toBeNull());
    expect(pulsante("Modifica")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("giocatore, eliminazione rifiutata: la modale resta aperta e dice perché; riuscita: si chiude", async () => {
    const g = gestori<RegGiocatore>();
    g.onRemove.mockRejectedValueOnce(nonRisponde());
    mostraGiocatore(g);
    fireEvent.click(pulsante("Elimina"));
    expect((await screen.findByRole("alert")).textContent)
      .toBe("Eliminazione non riuscita: Il server non risponde: controlla la connessione e riprova.");
    expect(g.onClose).not.toHaveBeenCalled();
    fireEvent.click(pulsante("Elimina"));
    await waitFor(() => expect(g.onClose).toHaveBeenCalledTimes(1));
    expect(g.onRemove).toHaveBeenCalledTimes(2);
  });

  it("giocatore, durante l'invio i pulsanti sono disattivati e la modale non si chiude (Esc, sfondo, X)", async () => {
    const g = gestori<RegGiocatore>();
    const risposta = differita<void>();
    g.onUpdate.mockReturnValue(risposta.p);
    mostraGiocatore(g);
    fireEvent.click(pulsante("Modifica"));
    fireEvent.click(pulsante("Salva modifiche"));
    fireEvent.click(pulsante("Salva modifiche"));
    expect(g.onUpdate).toHaveBeenCalledTimes(1);
    expect(pulsante("Salva modifiche").disabled).toBe(true);
    expect(pulsante("Annulla").disabled).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(pulsante("Chiudi"));
    expect(g.onClose).not.toHaveBeenCalled();
    await act(async () => { risposta.ok(); });
    // Finito l'invio la modale si chiude di nuovo come sempre
    fireEvent.click(pulsante("Chiudi"));
    expect(g.onClose).toHaveBeenCalledTimes(1);
  });

  it("squadra, modifica rifiutata: resta in modifica con i valori digitati; accettata: si torna alla scheda", async () => {
    const g = gestori<RegSquadra>();
    g.onUpdate.mockRejectedValueOnce(new ApiError(400, "nome: non può essere vuoto"));
    mostraSquadra(g);
    fireEvent.click(pulsante("Modifica"));
    fireEvent.change(campo("Nome squadra"), { target: { value: "Ballers Roma" } });
    fireEvent.click(pulsante("Salva modifiche"));
    expect((await screen.findByRole("alert")).textContent).toBe("Modifica non riuscita: nome: non può essere vuoto");
    expect(campo("Nome squadra").value).toBe("Ballers Roma");
    fireEvent.click(pulsante("Salva modifiche"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Salva modifiche" })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("squadra, eliminazione rifiutata: la modale resta aperta e dice perché", async () => {
    const g = gestori<RegSquadra>();
    g.onRemove.mockRejectedValue(nonRisponde());
    mostraSquadra(g);
    fireEvent.click(pulsante("Elimina"));
    expect((await screen.findByRole("alert")).textContent).toContain("Eliminazione non riuscita");
    expect(g.onClose).not.toHaveBeenCalled();
  });
});

describe("Anagrafe: il server rifiuta, la pagina non mostra il dato come salvato (FS-4)", () => {
  beforeEach(() => {
    anagrafe.listGiocatori.mockResolvedValue([giocatore("g1", "Mario")]);
    anagrafe.listSquadre.mockResolvedValue([squadra("s1", "Ballers")]);
  });
  const nonRisponde = () => new ApiError(0, "Il server non risponde: controlla la connessione e riprova.");
  const scrivi = (etichetta: string, valore: string) =>
    fireEvent.change(screen.getByLabelText(etichetta), { target: { value: valore } });

  it("modifica rifiutata dal server: la scheda mostra ancora il dato di prima e dice perché", async () => {
    anagrafe.updateGiocatore.mockRejectedValue(new ApiError(403, "Non puoi modificare questa scheda giocatore"));
    apri("/anagrafe");
    fireEvent.click(await screen.findByRole("button", { name: "Mario Rossi" }));
    const scheda = within(screen.getByRole("dialog"));
    fireEvent.click(scheda.getByRole("button", { name: "Modifica" }));
    fireEvent.change(scheda.getByLabelText("Nome"), { target: { value: "Luigi" } });
    fireEvent.click(scheda.getByRole("button", { name: "Salva modifiche" }));
    expect((await scheda.findByRole("alert")).textContent).toBe("Modifica non riuscita: Non puoi modificare questa scheda giocatore");
    // Il titolo della scheda è ancora il dato del server, non quello scritto
    expect(scheda.getByText("Mario Rossi")).toBeTruthy();
    expect(scheda.queryByText("Luigi Rossi")).toBeNull();
    expect(useAnagrafeStore.getState().giocatori![0].nome).toBe("Mario");
  });

  it("modifica accettata: la scheda mostra il record che restituisce il server", async () => {
    // Il server ha normalizzato il nome e aggiornato ts: la scheda deve mostrare questo, non ciò che si è scritto
    anagrafe.updateGiocatore.mockResolvedValue({ ...giocatore("g1", "Luigi"), ts: 2 });
    apri("/anagrafe");
    fireEvent.click(await screen.findByRole("button", { name: "Mario Rossi" }));
    const scheda = within(screen.getByRole("dialog"));
    fireEvent.click(scheda.getByRole("button", { name: "Modifica" }));
    fireEvent.change(scheda.getByLabelText("Nome"), { target: { value: "  luigi " } });
    fireEvent.click(scheda.getByRole("button", { name: "Salva modifiche" }));
    expect(await scheda.findByText("Luigi Rossi")).toBeTruthy();
    expect(scheda.queryByRole("button", { name: "Salva modifiche" })).toBeNull();
  });

  it("eliminazione dalla scheda rifiutata: la scheda resta aperta, con il motivo; la voce resta nell'elenco", async () => {
    anagrafe.removeGiocatore.mockRejectedValue(nonRisponde());
    apri("/anagrafe");
    fireEvent.click(await screen.findByRole("button", { name: "Mario Rossi" }));
    const scheda = within(screen.getByRole("dialog"));
    fireEvent.click(scheda.getByRole("button", { name: "Elimina" }));
    expect((await scheda.findByRole("alert")).textContent).toContain("Eliminazione non riuscita");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(useAnagrafeStore.getState().giocatori).toHaveLength(1);
  });

  it("eliminazione dalla card rifiutata: il motivo compare nella pagina e la card resta", async () => {
    anagrafe.removeGiocatore.mockRejectedValue(new ApiError(403, "Non puoi modificare questa scheda giocatore"));
    apri("/anagrafe");
    fireEvent.click(await screen.findByRole("button", { name: "Elimina Mario Rossi" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Eliminazione non riuscita: Non puoi modificare questa scheda giocatore");
    expect(screen.getByRole("button", { name: "Mario Rossi" })).toBeTruthy();
  });

  it("un doppio clic sulla X della card elimina una volta sola: niente seconda DELETE né messaggio di «non trovato»", async () => {
    const risposta = differita<void>();
    anagrafe.removeGiocatore.mockReturnValue(risposta.p);
    apri("/anagrafe");
    const elimina = await screen.findByRole("button", { name: "Elimina Mario Rossi" });
    fireEvent.click(elimina);
    fireEvent.click(elimina);
    expect(anagrafe.removeGiocatore).toHaveBeenCalledTimes(1);
    await act(async () => { risposta.ok(); });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Elimina Mario Rossi" })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("registrazione rifiutata dal server: i dati restano nel form; al nuovo tentativo riuscito il form si chiude", async () => {
    anagrafe.createGiocatore
      .mockRejectedValueOnce(nonRisponde())
      .mockResolvedValueOnce(giocatore("g2", "Luca"));
    apri("/anagrafe");
    await screen.findByRole("button", { name: "Mario Rossi" });
    fireEvent.click(screen.getByRole("button", { name: /Registra giocatore/ }));
    scrivi("Nome *", "Luca");
    scrivi("Cognome *", "Rossi");
    fireEvent.click(screen.getByRole("button", { name: "Salva nell'anagrafe" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Salvataggio non riuscito");
    expect((screen.getByLabelText("Nome *") as HTMLInputElement).value).toBe("Luca");
    fireEvent.click(screen.getByRole("button", { name: "Salva nell'anagrafe" }));
    expect(await screen.findByRole("button", { name: "Luca Rossi" })).toBeTruthy();
    expect(screen.queryByLabelText("Nome *")).toBeNull(); // form chiuso
  });

  it("l'ospite non può registrare: il form lo dice e conserva ciò che ha scritto, senza chiamare il server", async () => {
    apri("/anagrafe", ospite);
    await screen.findByRole("button", { name: "Mario Rossi" });
    fireEvent.click(screen.getByRole("button", { name: /Registra giocatore/ }));
    scrivi("Nome *", "Luca");
    scrivi("Cognome *", "Rossi");
    fireEvent.click(screen.getByRole("button", { name: "Salva nell'anagrafe" }));
    expect((await screen.findByRole("alert")).textContent)
      .toBe("Salvataggio non riuscito: serve un account, perché l'Ospite può solo consultare l'anagrafe.");
    expect((screen.getByLabelText("Nome *") as HTMLInputElement).value).toBe("Luca");
    expect(anagrafe.createGiocatore).not.toHaveBeenCalled();
  });
});
