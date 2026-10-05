// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../../src/App";
import { ErrorBoundary } from "../../src/components/ui/ErrorBoundary";
import { useAppStore } from "../../src/stores/useAppStore";
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
