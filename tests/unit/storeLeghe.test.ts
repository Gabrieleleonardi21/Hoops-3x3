// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { avvisoRifiutate, useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe (legheApi): lo store è quello vero
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const api = vi.mocked(legheApi);
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };
const store = () => useAppStore.getState();
const estate = { id: "l1", nome: "Estate", ts: 1, nTappe: 1 };
const tappa = (id: string): Tappa => ({
  id, nome: "Tappa", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, squadre: [], gironi: null, partite: [], video: [],
});
const rete = () => new ApiError(0, "Server non raggiungibile: controlla la connessione e riprova.");

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  localStorage.clear();
  useAppStore.setState({ user: registrato, legaId: null, leghe: null, erroreLeghe: null, legaName: "", tappe: [] });
});

afterEach(() => {
  store().reset();
  vi.useRealTimers();
  localStorage.clear();
});

describe("store: l'elenco delle leghe che non arriva non è un elenco vuoto (F1)", () => {
  it("se la lista fallisce `leghe` resta null e `erroreLeghe` dice perché; al tentativo dopo l'elenco arriva", async () => {
    api.list.mockRejectedValueOnce(rete());
    await store().rehydrate();
    expect(store().leghe).toBeNull();
    expect(store().erroreLeghe).toBe("Server non raggiungibile: controlla la connessione e riprova.");
    expect(store().ready).toBe(true);
    api.list.mockResolvedValueOnce([estate]);
    await store().rehydrate();
    expect(store().leghe).toEqual([estate]);
    expect(store().erroreLeghe).toBeNull();
  });

  it("se fallisce solo la lettura dell'ultima lega aperta, l'elenco resta e l'avviso va nella barra", async () => {
    localStorage.setItem("hoop3x3_active_lega_id_registrato", "l1");
    api.list.mockResolvedValueOnce([estate]);
    api.get.mockRejectedValueOnce(new ApiError(500, "Errore interno"));
    await store().rehydrate();
    expect(store().leghe).toEqual([estate]);
    expect(store().erroreLeghe).toBeNull();
    expect(store().legaId).toBeNull();
    expect(store().syncError).toBe("Apertura dell'ultima lega non riuscita: Errore interno");
  });

  it("con l'elenco mai arrivato, creare una lega la apre ma non inventa un elenco con lei sola: resta null con «Riprova»", async () => {
    useAppStore.setState({ erroreLeghe: "Server non raggiungibile: controlla la connessione e riprova." });
    api.create.mockResolvedValueOnce({ id: "l2", nome: "Nuova", ts: 2, nTappe: 0 });
    await store().createLega("Nuova");
    expect(store().legaId).toBe("l2");
    expect(store().legaName).toBe("Nuova");
    expect(store().leghe).toBeNull();
    expect(store().erroreLeghe).toBe("Server non raggiungibile: controlla la connessione e riprova.");
    // Al «Riprova» l'elenco arriva intero, con la nuova dentro
    api.list.mockResolvedValueOnce([{ id: "l2", nome: "Nuova", ts: 2, nTappe: 0 }, estate]);
    api.get.mockResolvedValueOnce({ id: "l2", nome: "Nuova", tappe: [] });
    await store().rehydrate();
    expect(store().leghe).toHaveLength(2);
    expect(store().erroreLeghe).toBeNull();
  });

  it("con l'elenco arrivato, la lega creata va in testa; con l'elenco mai arrivato la riga dei rifiuti non va in errore", async () => {
    useAppStore.setState({ leghe: [estate] });
    api.create.mockResolvedValueOnce({ id: "l2", nome: "Nuova", ts: 2, nTappe: 0 });
    await store().createLega("Nuova");
    expect(store().leghe).toEqual([{ id: "l2", nome: "Nuova", ts: 2, nTappe: 0 }, estate]);
    useAppStore.setState({ leghe: null, rifiuti: [{ id: "t1", nome: "Tappa", motivo: "no", legaId: "l9", nuova: false }] });
    expect(avvisoRifiutate(store())).toContain("«senza nome»");
  });
});

describe("store: rinomina della lega rifiutata dal server (F9)", () => {
  beforeEach(() => {
    useAppStore.setState({ legaId: "l1", leghe: [estate], legaName: "Estate", tappe: [] });
  });

  it("su un 400 lo schermo torna al nome che il server ha, nel campo e nell'elenco, con l'avviso nella barra", async () => {
    // Il nome del server è quello letto all'apertura della lega
    api.list.mockResolvedValueOnce([estate]);
    api.get.mockResolvedValueOnce({ id: "l1", nome: "Estate", tappe: [] });
    localStorage.setItem("hoop3x3_active_lega_id_registrato", "l1");
    await store().rehydrate();
    api.rename.mockRejectedValueOnce(new ApiError(400, "Il nome può avere al massimo 120 caratteri"));
    store().setLegaName("Estate 2026");
    expect(store().legaName).toBe("Estate 2026"); // mentre si scrive vale ciò che si scrive
    await vi.advanceTimersByTimeAsync(400);
    expect(api.rename).toHaveBeenCalledWith("l1", "Estate 2026");
    expect(store().legaName).toBe("Estate");
    expect(store().leghe?.[0].nome).toBe("Estate");
    expect(store().syncError).toBe("Rinomina lega non riuscita: Il nome può avere al massimo 120 caratteri");
  });

  it("una rinomina riuscita diventa il nome del server: un rifiuto successivo torna a quella, non al nome di prima", async () => {
    api.list.mockResolvedValueOnce([estate]);
    api.get.mockResolvedValueOnce({ id: "l1", nome: "Estate", tappe: [] });
    localStorage.setItem("hoop3x3_active_lega_id_registrato", "l1");
    await store().rehydrate();
    api.rename.mockResolvedValueOnce({ ...estate, nome: "Autunno" });
    store().setLegaName("Autunno");
    await vi.advanceTimersByTimeAsync(400);
    api.rename.mockRejectedValueOnce(new ApiError(400, "Nome non valido"));
    store().setLegaName("Inverno");
    await vi.advanceTimersByTimeAsync(400);
    expect(store().legaName).toBe("Autunno");
  });

  it("un errore temporaneo (rete, server) lascia il nome scritto: non è un rifiuto", async () => {
    api.rename.mockRejectedValueOnce(rete());
    store().setLegaName("Estate 2026");
    await vi.advanceTimersByTimeAsync(400);
    expect(store().legaName).toBe("Estate 2026");
    expect(store().syncError).toContain("Rinomina lega non riuscita");
  });
});

describe("store: la tappa oltre il tetto della lega rifiutata dal server (B4)", () => {
  it("il 400 della POST con il messaggio del server arriva nella riga dei rifiuti della barra degli avvisi", async () => {
    useAppStore.setState({ legaId: "l1", leghe: [estate], legaName: "Estate", tappe: [] });
    api.addTappa.mockRejectedValueOnce(new ApiError(400, "Una lega può avere al massimo 100 tappe"));
    store().addTappa(tappa("t-101"));
    await vi.advanceTimersByTimeAsync(400);
    expect(avvisoRifiutate(store())).toContain("Una lega può avere al massimo 100 tappe");
    expect(avvisoRifiutate(store())).toContain("«Tappa»");
  });
});
