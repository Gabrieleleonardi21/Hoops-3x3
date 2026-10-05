// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../../src/App";
import { ErrorBoundary } from "../../src/components/ui/ErrorBoundary";
import { useAppStore, SESSION_KEY } from "../../src/stores/useAppStore";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa, User } from "../../src/types";

// Si sostituisce solo la rete (leghe): pagine, store e componenti sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const store = () => useAppStore.getState();
const ospite: User = { name: "Ospite", guest: true };

/** Una tappa com'è nel browser di un ospite che anni fa importò un file incompleto: manca l'elenco delle squadre */
const tappaSenzaSquadre = (): Tappa => ({
  id: "t1", nome: "Tappa rotta", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, gironi: null, partite: [], video: [],
} as unknown as Tappa);

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
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
