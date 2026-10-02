// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    const finestra = await screen.findByRole("dialog", { name: "Uscire senza salvare?" });
    expect(finestra.textContent).toContain("1 tappa ha modifiche non salvate: uscendo andranno perse.");
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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
