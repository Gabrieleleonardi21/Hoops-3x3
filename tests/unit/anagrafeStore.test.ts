import { describe, it, expect, vi } from "vitest";
import type { RegGiocatore, RegSquadra } from "../../src/types";

// Si sostituisce solo la rete (anagrafeApi): la logica di cache dello store è quella vera
vi.mock("../../src/services/anagrafeApi", async (importOriginal) => {
  const reale = await importOriginal<typeof import("../../src/services/anagrafeApi")>();
  return {
    ...reale,
    anagrafeApi: {
      listGiocatori: vi.fn(), createGiocatore: vi.fn(), updateGiocatore: vi.fn(), removeGiocatore: vi.fn(),
      listSquadre: vi.fn(), createSquadra: vi.fn(), updateSquadra: vi.fn(), removeSquadra: vi.fn(),
    },
  };
});

function giocatore(id: string, nome: string): RegGiocatore {
  return {
    id, nome, cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "",
    peso: "", ruolo: "", numero: "", squadra: "", esperienza: "", note: "", autore: "Gabriele", ts: 1,
  };
}

function squadra(id: string, nome: string, roster: string[] = []): RegSquadra {
  return {
    id, nome, citta: "", anno: "", rank: "", referente: "", roster, logo: "", website: "", instagram: "",
    note: "", autore: "Gabriele", ts: 1,
  };
}

/** Dati del form di una nuova squadra / di un nuovo giocatore (id, autore e ts li assegna il server) */
const nuovaSquadra = {
  nome: "Wildcats", citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "",
};
const nuovoGiocatore = {
  nome: "Luca", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "",
  peso: "", ruolo: "", numero: "", squadra: "", esperienza: "", note: "",
};

/** Store nuovo a ogni test (la cache è stato di modulo). Sul server finto ci sono Mario e i Ballers. */
async function nuovoStore() {
  vi.resetModules();
  const { anagrafeApi } = await import("../../src/services/anagrafeApi");
  const { useAnagrafeStore } = await import("../../src/stores/useAnagrafeStore");
  const api = vi.mocked(anagrafeApi);
  // Il finto anagrafeApi è lo stesso oggetto per tutti i test: si azzerano chiamate e risposte del test prima
  vi.resetAllMocks();
  api.listGiocatori.mockResolvedValue([giocatore("g1", "Mario")]);
  api.listSquadre.mockResolvedValue([squadra("s1", "Ballers", ["g1"])]);
  return { api, store: useAnagrafeStore };
}

describe("useAnagrafeStore (cache dell'anagrafe)", () => {
  it("il primo load scarica giocatori e squadre dal server", async () => {
    const { store } = await nuovoStore();
    expect(store.getState().giocatori).toBeNull();
    await store.getState().load();
    expect(store.getState().giocatori).toEqual([giocatore("g1", "Mario")]);
    expect(store.getState().squadre).toEqual([squadra("s1", "Ballers", ["g1"])]);
  });

  it("i load successivi usano la cache senza richiamare il server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    await store.getState().load();
    expect(api.listGiocatori).toHaveBeenCalledTimes(1);
    expect(api.listSquadre).toHaveBeenCalledTimes(1);
  });

  it("due load contemporanei condividono la stessa richiesta", async () => {
    const { api, store } = await nuovoStore();
    await Promise.all([store.getState().load(), store.getState().load()]);
    expect(api.listSquadre).toHaveBeenCalledTimes(1);
  });

  it("se il server non risponde mostra liste vuote e il load successivo riprova", async () => {
    const { api, store } = await nuovoStore();
    api.listSquadre.mockRejectedValueOnce(new Error("server spento"));
    await store.getState().load();
    expect(store.getState().giocatori).toEqual([]);
    expect(store.getState().squadre).toEqual([]);
    await store.getState().load();
    expect(store.getState().squadre).toEqual([squadra("s1", "Ballers", ["g1"])]);
  });

  it("saveSquadra restituisce la nuova squadra e la mette in testa alla cache", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.createSquadra.mockResolvedValue(squadra("s2", "Wildcats"));
    const rec = await store.getState().saveSquadra(nuovaSquadra);
    expect(rec).toEqual(squadra("s2", "Wildcats"));
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("saveGiocatore mette il nuovo giocatore in testa alla cache", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.createGiocatore.mockResolvedValue(giocatore("g2", "Luca"));
    await store.getState().saveGiocatore(nuovoGiocatore);
    expect(store.getState().giocatori!.map((g) => g.id)).toEqual(["g2", "g1"]);
  });

  it("removeGiocatore toglie il giocatore dalla cache e dai roster delle squadre", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.removeGiocatore.mockResolvedValue(undefined);
    await store.getState().removeGiocatore("g1");
    expect(store.getState().giocatori).toEqual([]);
    expect(store.getState().squadre![0].roster).toEqual([]);
  });

  it("removeSquadra toglie la squadra dalla cache", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    api.removeSquadra.mockResolvedValue(undefined);
    await store.getState().removeSquadra("s1");
    expect(store.getState().squadre).toEqual([]);
  });

  it("updateSquadra sostituisce la voce in cache con quella restituita dal server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    const dalServer = { ...squadra("s1", "Ballers Roma", ["g1"]), ts: 2 };
    api.updateSquadra.mockResolvedValue(dalServer);
    await store.getState().updateSquadra(squadra("s1", "Ballers Roma", ["g1"]));
    expect(store.getState().squadre).toEqual([dalServer]);
  });

  it("updateGiocatore sostituisce la voce in cache con quella restituita dal server", async () => {
    const { api, store } = await nuovoStore();
    await store.getState().load();
    const dalServer = { ...giocatore("g1", "Mario Jr"), ts: 2 };
    api.updateGiocatore.mockResolvedValue(dalServer);
    await store.getState().updateGiocatore(giocatore("g1", "Mario Jr"));
    expect(store.getState().giocatori).toEqual([dalServer]);
  });

  it("una scrittura prima del caricamento non crea una cache parziale", async () => {
    const { api, store } = await nuovoStore();
    api.createSquadra.mockResolvedValue(squadra("s2", "Wildcats"));
    await store.getState().saveSquadra(nuovaSquadra);
    expect(store.getState().squadre).toBeNull();
    api.listSquadre.mockResolvedValue([squadra("s2", "Wildcats"), squadra("s1", "Ballers", ["g1"])]);
    await store.getState().load();
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("una scrittura arrivata durante il caricamento non convalida la cache: il load successivo riscarica", async () => {
    const { api, store } = await nuovoStore();
    // Il server risponde alla lista squadre solo quando lo decide il test
    let rispondi: (lista: RegSquadra[]) => void = () => {};
    api.listSquadre.mockReturnValueOnce(new Promise<RegSquadra[]>((resolve) => { rispondi = resolve; }));
    const caricamento = store.getState().load();
    api.createSquadra.mockResolvedValue(squadra("s2", "Wildcats"));
    await store.getState().saveSquadra(nuovaSquadra);
    rispondi([squadra("s1", "Ballers", ["g1"])]); // risposta partita prima: non contiene la nuova squadra
    await caricamento;
    api.listSquadre.mockResolvedValue([squadra("s2", "Wildcats"), squadra("s1", "Ballers", ["g1"])]);
    await store.getState().load();
    expect(api.listSquadre).toHaveBeenCalledTimes(2);
    expect(store.getState().squadre!.map((s) => s.id)).toEqual(["s2", "s1"]);
  });
});
