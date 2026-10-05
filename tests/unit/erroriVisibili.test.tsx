// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "../../src/App";
import { ErrorBoundary } from "../../src/components/ui/ErrorBoundary";
import { AnagrafePage } from "../../src/pages/AnagrafePage";
import { ArchivioPage } from "../../src/pages/ArchivioPage";
import { GiocatorePage } from "../../src/pages/GiocatorePage";
import { LegheListPage } from "../../src/pages/LegheListPage";
import { useAppStore, SESSION_KEY } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { legheApi } from "../../src/services/legheApi";
import { archivioApi } from "../../src/services/archivioApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { PubTappa, RegGiocatore, Tappa, User } from "../../src/types";

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
  // React registra sulla console l'errore preso da un ErrorBoundary: nei test sarebbe solo rumore
  vi.spyOn(console, "error").mockImplementation(() => {});
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
  localStorage.setItem("hoop3x3_lega_l1", typeof dati === "string" ? dati : JSON.stringify(dati));
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

describe("Archivio non caricato: l'errore si distingue dal «vuoto» (FS-4)", () => {
  const pubblicata = (): PubTappa => ({ tappa: { ...tappaValida("p1", "Finale di Roma") }, lega: "Estate", autore: "Anna", autoreId: "u1", ts: 1 });

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
