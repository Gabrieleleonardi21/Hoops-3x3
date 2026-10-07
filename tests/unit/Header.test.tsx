// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Header } from "../../src/components/layout/Header";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { ApiError, token } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: store, coda dei salvataggi e logout sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const api = vi.mocked(legheApi);
const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };
const tappa = (id: string): Tappa => ({
  id, nome: "Tappa", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, squadre: [], gironi: null, partite: [], video: [],
});

beforeEach(() => {
  vi.resetAllMocks();
  api.putTappa.mockRejectedValue(new ApiError(0, "Server non raggiungibile")); // rete assente: nessuna modifica arriva
  token.set("jwt-di-prova");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 }))); // revoca del refresh token
  useAppStore.setState({ user: registrato, legaId: "l1", tappe: [tappa("t1")] });
  // Si parte dall'archivio: uscendo, «Esci» riporta alla pagina iniziale
  render(
    <MemoryRouter initialEntries={["/archivio"]}>
      <Header />
      <Routes>
        <Route path="/" element={<p>Pagina iniziale</p>} />
        <Route path="/archivio" element={<p>Archivio</p>} />
      </Routes>
    </MemoryRouter>,
  );
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();
  vi.unstubAllGlobals();
  token.clear();
});

/** Clic su «Esci» (nella pagina ce ne sono due uguali: barra in alto e riga di navigazione per gli schermi piccoli) */
const clicEsci = () => fireEvent.click(screen.getAllByRole("button", { name: "Esci" })[0]);

describe("Header: «Esci» con modifiche non salvate", () => {
  it("chiede conferma dicendo che cosa si perde; con «Annulla» si resta dentro", async () => {
    store().updateTappa("t1", { nome: "Finale" });
    clicEsci();
    const finestra = await screen.findByRole("alertdialog", { name: "Uscire senza salvare?" });
    expect(finestra.textContent).toContain("1 tappa ha modifiche non salvate: uscendo andranno perse.");
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(store().user).toEqual(registrato);
    expect(screen.getByText("Archivio")).toBeTruthy();
  });

  it("con «Conferma» esce e torna alla pagina iniziale", async () => {
    store().updateTappa("t1", { nome: "Finale" });
    clicEsci();
    fireEvent.click(await screen.findByRole("button", { name: "Conferma" }));
    await screen.findByText("Pagina iniziale");
    expect(store().user).toBeNull();
  });

  it("se tutto è salvato esce subito, senza conferma", async () => {
    clicEsci();
    await screen.findByText("Pagina iniziale");
    expect(store().user).toBeNull();
    expect(api.putTappa).not.toHaveBeenCalled();
  });
});

describe("Header: «Esci» dell'ospite con lo spazio del browser esaurito", () => {
  const ospite: User = { name: "Ospite", guest: true };
  /** Clic su «Esci» dell'ospite (in alto è «Esci», nella riga di navigazione «Esci (ospite)») */
  const clicEsciOspite = () => fireEvent.click(screen.getAllByRole("button", { name: /^Esci/ })[0]);

  /** Una modifica che il browser non salva: resta solo in memoria. Poi l'utente chiude l'avviso con la X */
  function modificaNonSalvata() {
    act(() => { useAppStore.setState({ user: ospite, legaId: "l1", leghe: [{ id: "l1", nome: "Estate", ts: 1, nTappe: 1 }] }); });
    const pieno = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    act(() => {
      store().updateTappa("t1", { nome: "Finale" });
      store().clearSyncError();
    });
    pieno.mockRestore();
  }

  it("chiede la stessa conferma dei registrati, anche dopo la X dell'avviso; con «Annulla» si resta", async () => {
    modificaNonSalvata();
    clicEsciOspite();
    const finestra = await screen.findByRole("alertdialog", { name: "Uscire senza salvare?" });
    expect(finestra.textContent).toContain("Le ultime modifiche della lega aperta non sono salvate nel browser");
    expect(finestra.textContent).toContain("uscendo andranno perse");
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(store().user).toEqual(ospite);
    expect(store().tappe[0].nome).toBe("Finale");
  });

  it("con «Conferma» esce", async () => {
    modificaNonSalvata();
    clicEsciOspite();
    fireEvent.click(await screen.findByRole("button", { name: "Conferma" }));
    await screen.findByText("Pagina iniziale");
    expect(store().user).toBeNull();
  });

  it("senza modifiche rimaste in memoria l'ospite esce subito", async () => {
    act(() => { useAppStore.setState({ user: ospite }); });
    clicEsciOspite();
    await screen.findByText("Pagina iniziale");
    expect(store().user).toBeNull();
  });
});

describe("Header: «Esci» con la rete appesa", () => {
  it("se la revoca non riceve risposta, dopo il tempo massimo torna comunque alla pagina iniziale", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // AbortSignal.timeout di Node non segue i timer finti: lo si sostituisce con lo stesso segnale costruito su setTimeout
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      const controllo = new AbortController();
      setTimeout(() => controllo.abort(new DOMException("The operation timed out.", "TimeoutError")), ms);
      return controllo.signal;
    });
    // La revoca del refresh token non riceve mai risposta: come la fetch vera, si interrompe solo sul segnale
    let sblocca = () => {};
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_risolvi, rifiuta) => {
      sblocca = () => rifiuta(new TypeError("Failed to fetch"));
      init.signal?.addEventListener("abort", () => rifiuta(init.signal!.reason));
    })));
    try {
      clicEsci();
      await act(async () => { await vi.advanceTimersByTimeAsync(14_999); });
      expect(screen.queryByText("Pagina iniziale")).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(screen.getByText("Pagina iniziale")).toBeTruthy();
      expect(store().user).toBeNull();
    } finally {
      sblocca();
      timeout.mockRestore();
      vi.useRealTimers();
    }
  });
});
