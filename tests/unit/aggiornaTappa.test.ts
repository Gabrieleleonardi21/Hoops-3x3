// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useAppStore } from "../../src/stores/useAppStore";
import { useTappa } from "../../src/hooks/useTappa";
import { legheApi } from "../../src/services/legheApi";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { RegSquadra, SquadraTappa, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: store, coda dei salvataggi e hook sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const api = vi.mocked(legheApi);
const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };
const ospite: User = { name: "Ospite", guest: true };

const squadra = (id: string, nome: string): SquadraTappa => ({ id, nome, giocatori: [], rank: "" });
/** Tappa con due squadre ancora con il nome predefinito, come subito dopo la creazione */
const tappa = (): Tappa => ({
  id: "t1", nome: "Tappa", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [squadra("s1", "Squadra 1"), squadra("s2", "Squadra 2")], gironi: null, partite: [], video: [],
});
/** Le squadre della tappa com'è adesso nello store */
const squadre = () => store().tappe[0].squadre;

/** La squadra «Alfa» come la restituisce l'anagrafe */
const regAlfa: RegSquadra = {
  id: "r1", nome: "Alfa", citta: "", anno: "", rank: "40", referente: "", roster: [], logo: "/logos/alfa.svg",
  website: "https://alfa.it", instagram: "", note: "", autore: "Anna", ts: 1,
};

/** Promessa controllabile a mano: il test decide quando il "server" risponde */
function differita<T>() {
  let ok!: (v: T) => void;
  const p = new Promise<T>((res) => { ok = res; });
  return { p, ok };
}

/** Esegue un'azione dell'hook dentro act (aggiorna lo stato di React) */
const fai = (azione: () => unknown) => act(() => { azione(); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  api.putTappa.mockImplementation(async (t) => t);
  useAppStore.setState({
    user: registrato, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [tappa()],
  });
});

afterEach(() => {
  cleanup();           // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();     // svuota la coda, così nessun salvataggio passa al test successivo
  localStorage.clear();
  vi.useRealTimers();
});

describe("updateTappa con una funzione", () => {
  it("la funzione riceve la tappa com'è adesso nello store, comprese le modifiche appena fatte", () => {
    store().updateTappa("t1", { luogo: "Roma" });
    store().updateTappa("t1", (t) => ({ ...t, nome: `${t.nome} · ${t.luogo}` }));
    expect(store().tappe[0]).toMatchObject({ nome: "Tappa · Roma", luogo: "Roma" });
  });

  it("le altre tappe restano come sono", () => {
    const altra = { ...tappa(), id: "t2" };
    useAppStore.setState({ tappe: [tappa(), altra] });
    store().updateTappa("t1", (t) => ({ ...t, nome: "Finale" }));
    expect(store().tappe[1]).toBe(altra);
  });

  it("registrato: la versione calcolata dalla funzione entra nella coda e viene salvata come ogni altra modifica", async () => {
    store().updateTappa("t1", (t) => ({ ...t, nome: "Finale" }));
    expect(store().inSospeso).toBe(1);
    await vi.advanceTimersByTimeAsync(400);
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    expect(api.putTappa).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", nome: "Finale" }));
  });

  it("ospite: la versione calcolata dalla funzione finisce in localStorage", () => {
    useAppStore.setState({ user: ospite });
    store().updateTappa("t1", (t) => ({ ...t, nome: "Finale" }));
    const salvata = JSON.parse(localStorage.getItem("hoop3x3_lega_l1") ?? "null");
    expect(salvata.tappe[0].nome).toBe("Finale");
  });
});

describe("useTappa: le modifiche partono dalla tappa com'è adesso, non da quella vista dal componente", () => {
  it("sonda A: mentre una squadra viene collegata all'anagrafe, ciò che si scrive in un'altra resta", async () => {
    const { result } = renderHook(() => useTappa("t1"));
    fai(() => result.current.renameTeam("s1", "Alfa"));
    // L'utente esce dal campo: la pagina tiene l'`h` di questo momento mentre aspetta il server
    const hAllUscita = result.current;
    const server = differita<RegSquadra>();
    const collegamento = server.p.then((reg) => hAllUscita.applyReg("s1", reg));
    // Mentre il server risponde, l'utente scrive «Beta» nella seconda squadra
    fai(() => result.current.renameTeam("s2", "Beta"));
    await act(async () => {
      server.ok(regAlfa);
      await collegamento;
    });
    expect(squadre()).toMatchObject([
      { id: "s1", nome: "Alfa", regId: "r1", rank: "40", website: "https://alfa.it", logo: "/logos/alfa.svg" },
      { id: "s2", nome: "Beta" },
    ]);
  });
});
