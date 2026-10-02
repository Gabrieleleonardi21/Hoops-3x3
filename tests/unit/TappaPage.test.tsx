// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TappaPage } from "../../src/pages/TappaPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { legheApi } from "../../src/services/legheApi";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { RegSquadra, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: pagina, hook, store e coda dei salvataggi sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

const tappa = (): Tappa => ({
  id: "t1", nome: "Roma Open", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [
    { id: "s1", nome: "Squadra 1", giocatori: [], rank: "" },
    { id: "s2", nome: "Squadra 2", giocatori: [], rank: "" },
  ],
  gironi: null, partite: [], video: [],
});

const regAlfa: RegSquadra = {
  id: "r1", nome: "Alfa", citta: "", anno: "", rank: "40", referente: "", roster: [], logo: "",
  website: "", instagram: "", note: "", autore: "Anna", ts: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
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
