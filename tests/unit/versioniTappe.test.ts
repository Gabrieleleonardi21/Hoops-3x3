// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import { eliminazioneTappaInConflitto, tappaEliminataAltrove, tappaModificataAltrove } from "../../src/utils/testi";
import type { Tappa, User } from "../../src/types";

/* Versione delle tappe (T2.7): la PUT manda la versione dell'ultima risposta del server, e un 409 si risolve rileggendo la lega.
 * Si sostituisce solo la rete delle leghe: store e coda dei salvataggi sono quelli veri, il server è quello finto qui sotto. */
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const api = vi.mocked(legheApi);
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };
const store = () => useAppStore.getState();

const tappa = (id: string, nome = "Tappa"): Tappa => ({
  id, nome, luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, squadre: [], gironi: null, partite: [], video: [],
});

const MODIFICATA = "La tappa è stata modificata da un altro dispositivo: ricaricala";
const MANCA_VERSIONE = "Manca la versione della tappa (campo versione): ricarica la pagina e riprova";
const NESSUNA_RISPOSTA = "Il server non risponde: controlla la connessione e riprova.";

/** Promessa controllabile a mano: il test decide quando il "server" risponde */
function differita() {
  let ok!: () => void;
  const p = new Promise<void>((res) => { ok = res; });
  return { p, ok };
}

const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Server finto con le regole del backend dopo T2.7 (LegaService): la POST crea la tappa con la versione 0, la PUT senza versione
 *  riceve 400, con una versione diversa da quella salvata 409, altrimenti salva e la versione sale (il server vero la lascia uguale
 *  per una PUT identica: qui non serve). Salva le tappe normalizzate come il server: nome, luogo e data senza spazi ai lati, campi
 *  assenti vuoti. */
function serverFinto() {
  const salvate = new Map<string, Tappa>();
  const normalizzata = (t: Tappa, versione: number): Tappa => ({
    ...copia(t), nome: t.nome.trim(), luogo: (t.luogo ?? "").trim(), data: (t.data ?? "").trim(),
    squadre: t.squadre ?? [], partite: t.partite ?? [], video: t.video ?? [], gironi: t.gironi ?? null, versione,
  });
  const server = {
    salvate,
    /** Una tappa che il server ha già, con questa versione */
    ha(t: Tappa, versione: number) { salvate.set(t.id, { ...copia(t), versione }); },
    /** Un altro dispositivo salva la tappa: la versione sale */
    salvaAltrove(id: string, modifica: Partial<Tappa>) {
      const t = salvate.get(id)!;
      salvate.set(id, { ...t, ...modifica, versione: t.versione! + 1 });
    },
    put: async (t: Tappa) => {
      if (t.versione === undefined || t.versione === null) throw new ApiError(400, MANCA_VERSIONE);
      const attuale = salvate.get(t.id);
      if (!attuale) throw new ApiError(404, `Tappa non trovata: ${t.id}`);
      if (t.versione !== attuale.versione) throw new ApiError(409, MODIFICATA);
      salvate.set(t.id, normalizzata(t, attuale.versione! + 1));
      return copia(salvate.get(t.id)!);
    },
    post: async (_legaId: string, t: Tappa) => {
      if (salvate.has(t.id)) throw new ApiError(409, `Esiste già una tappa con id ${t.id}`);
      salvate.set(t.id, normalizzata(t, 0));
      return copia(salvate.get(t.id)!);
    },
  };
  api.putTappa.mockImplementation(server.put);
  api.addTappa.mockImplementation(server.post);
  api.get.mockImplementation(async (id) => ({ id, nome: "Lega", tappe: [...salvate.values()].map(copia) }));
  api.removeTappa.mockImplementation(async (id) => {
    if (!salvate.delete(id)) throw new ApiError(404, `Tappa non trovata: ${id}`);
  });
  return server;
}

/** La prossima PUT arriva al server, che la salva, ma la risposta si perde (tempo massimo scaduto mentre Render ripartiva) */
function rispostaPersa(server: ReturnType<typeof serverFinto>) {
  api.putTappa.mockImplementationOnce(async (t) => {
    await server.put(t);
    throw new ApiError(0, NESSUNA_RISPOSTA);
  });
}

/** Versioni e nomi delle PUT partite, in ordine */
const putPartite = () => api.putTappa.mock.calls.map(([t]) => [t.nome, t.versione]);

/** Nessun avviso nella barra: né un errore né un conflitto */
function senzaAvvisi() {
  expect(store().syncError).toBeNull();
  expect(store().avvisoConflitti).toBeNull();
}

/** Apre la lega l1 come dopo «Le mie leghe»: le tappe arrivano dal server con la loro versione */
const apri = () => store().selectLega("l1");

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  useAppStore.setState({
    user: registrato, legaId: null, legaName: "", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 0 }], tappe: [],
    syncError: null, inSospeso: 0, erroreSalvataggio: null,
  });
});

afterEach(() => {
  store().reset(); // svuota la coda, così nessun salvataggio passa al test successivo
  vi.useRealTimers();
});

describe("la PUT manda la versione dell'ultima risposta del server", () => {
  it("due PUT di seguito: la seconda parte con la versione della risposta della prima", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    expect(store().tappe[0].versione).toBe(3);
    store().updateTappa("t1", { nome: "Semifinale" });
    await vi.advanceTimersByTimeAsync(400);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
    expect(putPartite()).toEqual([["Semifinale", 3], ["Finale", 4]]);
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", versione: 5 });
    expect(store().tappe[0].versione).toBe(5);
    senzaAvvisi();
  });

  it("una modifica fatta con la PUT in volo resta: la risposta cambia solo la versione, e la modifica parte con quella nuova", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    const prima = differita();
    const seconda = differita();
    api.putTappa
      .mockImplementationOnce(async (t) => { await prima.p; return server.put(t); })
      .mockImplementationOnce(async (t) => { await seconda.p; return server.put(t); });
    store().updateTappa("t1", { nome: "Semifinale" });
    await vi.advanceTimersByTimeAsync(400);              // la PUT di «Semifinale» resta in volo
    store().updateTappa("t1", { luogo: "Testaccio" });   // modifica locale mentre la PUT è in volo
    prima.ok();
    await vi.advanceTimersByTimeAsync(0);                // risposta: versione 4, con il luogo ancora vuoto
    expect(store().tappe[0]).toMatchObject({ nome: "Semifinale", luogo: "Testaccio", versione: 4 });
    expect(putPartite()).toEqual([["Semifinale", 3], ["Semifinale", 4]]);
    expect(api.putTappa.mock.calls[1][0].luogo).toBe("Testaccio");
    seconda.ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.salvate.get("t1")).toMatchObject({ luogo: "Testaccio", versione: 5 });
    expect(store().tappe[0]).toMatchObject({ luogo: "Testaccio", versione: 5 });
  });

  it("la PUT aspetta la POST di creazione e parte con la versione 0 della sua risposta", async () => {
    const server = serverFinto();
    await apri();
    const post = differita();
    api.addTappa.mockImplementationOnce(async (legaId, t) => { await post.p; return server.post(legaId, t); });
    store().addTappa(tappa("t1"));
    await vi.advanceTimersByTimeAsync(400);              // la POST resta in volo
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.putTappa).not.toHaveBeenCalled();         // senza la prima versione il server risponderebbe 400
    post.ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(putPartite()).toEqual([["Finale", 0]]);
    expect(store().tappe[0].versione).toBe(1);
  });

  it("alla chiusura della pagina la PUT con keepalive porta la versione nota, non quella della copia in coda", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    const prima = differita();
    api.putTappa.mockImplementationOnce(async (t) => { await prima.p; return server.put(t); });
    store().updateTappa("t1", { nome: "Semifinale" });
    await vi.advanceTimersByTimeAsync(400);
    store().updateTappa("t1", { nome: "Finale" });       // copia in coda fatta prima della risposta: versione 3
    api.putTappa.mockImplementationOnce(async (t) => { await differita().p; return t; }); // il nuovo invio resta in volo
    prima.ok();
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event("pagehide"));
    expect(api.putTappa).toHaveBeenLastCalledWith(expect.objectContaining({ nome: "Finale", versione: 4 }), true);
  });

  it("una lega importata: le tappe nascono sul server con la versione 0 e la prima PUT la manda", async () => {
    const server = serverFinto();
    api.create.mockImplementation(async (nome, tappe = []) => {
      for (const t of tappe) await server.post("l9", t);
      return { id: "l9", nome, ts: 1, nTappe: tappe.length };
    });
    await store().importLega("Importata", [tappa("t1")]);
    expect(store().tappe[0].versione).toBe(0);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
    expect(putPartite()).toEqual([["Finale", 0]]);
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", versione: 1 });
  });
});

describe("409 sulla PUT: la tappa l'ha cambiata un altro dispositivo", () => {
  it("vale la tappa del server, con la sua versione; l'avviso è visibile e il corpo vecchio non si rimanda", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    server.salvaAltrove("t1", { nome: "Nome dell'altro" });  // versione 4
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(api.get).toHaveBeenCalledTimes(2);                // l'apertura e la rilettura dopo il 409
    expect(store().tappe[0]).toEqual(server.salvate.get("t1"));
    expect(store().tappe[0].versione).toBe(4);
    expect(store().avvisoConflitti).toBe(tappaModificataAltrove("Nome dell'altro"));
    expect(store().inSospeso).toBe(0);
    expect(store().erroreSalvataggio).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).toHaveBeenCalledTimes(1);           // nessun nuovo tentativo con il luogo dell'altra versione
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Nome dell'altro", luogo: "", versione: 4 });
    // La modifica successiva parte dalla tappa del server, con la sua versione
    store().updateTappa("t1", { data: "2026-07-01" });
    await vi.advanceTimersByTimeAsync(400);
    expect(api.putTappa).toHaveBeenLastCalledWith(expect.objectContaining({ nome: "Nome dell'altro", data: "2026-07-01", versione: 4 }));
    expect(server.salvate.get("t1")!.versione).toBe(5);
  });

  it("anche le modifiche fatte durante la rilettura si scartano: erano costruite sulla versione superata", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    server.salvaAltrove("t1", { nome: "Nome dell'altro" });
    const rilettura = differita();
    api.get.mockImplementationOnce(async (id) => {
      await rilettura.p;
      return { id, nome: "Lega", tappe: [...server.salvate.values()].map(copia) };
    });
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);                  // 409, la rilettura resta in corso
    store().updateTappa("t1", { data: "2026-07-01" });
    rilettura.ok();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    expect(store().tappe[0]).toEqual(server.salvate.get("t1"));
  });

  it("con il messaggio generico del server vale lo stesso", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    server.salvaAltrove("t1", { nome: "Nome dell'altro" });
    api.putTappa.mockRejectedValueOnce(new ApiError(409, "I dati sono stati modificati o eliminati da un'altra richiesta: ricarica"));
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(store().tappe[0]).toEqual(server.salvate.get("t1"));
    expect(store().avvisoConflitti).toBe(tappaModificataAltrove("Nome dell'altro"));
  });
});

describe("409 sulla PUT dopo un proprio salvataggio rimasto senza risposta", () => {
  it("la tappa del server è l'ultimo corpo mandato: si prende la sua versione e si rimanda lo stato locale, senza avviso", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // salvata dal server (versione 4), risposta persa
    expect(server.salvate.get("t1")!.versione).toBe(4);
    store().updateTappa("t1", { luogo: "Testaccio" });       // modifica fatta nel frattempo
    await vi.advanceTimersByTimeAsync(400);                  // PUT con la versione 3 → 409 → rilettura → nuovo invio
    expect(putPartite()).toEqual([["Finale", 3], ["Finale", 3], ["Finale", 4]]);
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", luogo: "Testaccio", versione: 5 });
    expect(store().tappe[0]).toMatchObject({ nome: "Finale", luogo: "Testaccio", versione: 5 });
    senzaAvvisi();
    expect(store().inSospeso).toBe(0);
    expect(store().erroreSalvataggio).toBeNull();
  });

  it("vale anche se il nuovo tentativo è automatico, con lo stesso corpo", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400 + 2000);           // il nuovo tentativo dopo 2 secondi riceve 409
    expect(putPartite()).toEqual([["Finale", 3], ["Finale", 3], ["Finale", 4]]);
    senzaAvvisi();
    expect(store().tappe[0]).toMatchObject({ nome: "Finale", versione: 5 });
  });

  it("il confronto è quello del server: spazi ai lati e campi assenti, che il server normalizza, non fanno differenza", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);
    // Corpo con spazi ai lati e senza data né video: il server salva «Finale», «Roma», "" e []
    store().updateTappa("t1", { nome: "  Finale  ", luogo: " Roma ", data: undefined, video: undefined } as Partial<Tappa>);
    await vi.advanceTimersByTimeAsync(400);
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", luogo: "Roma", data: "", video: [], versione: 4 });
    store().updateTappa("t1", { nGironi: 2 });
    await vi.advanceTimersByTimeAsync(400);
    senzaAvvisi();
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", nGironi: 2, versione: 5 });
    expect(store().tappe[0]).toMatchObject({ nGironi: 2, versione: 5 });
  });

  it("anche se il server ha salvato un tentativo precedente e non l'ultimo, il conflitto resta del client", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);                                   // «Finale» salvata, risposta persa
    api.putTappa.mockRejectedValueOnce(new ApiError(0, NESSUNA_RISPOSTA)); // il tentativo dopo non arriva al server
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);                  // anche questo senza risposta
    store().updateTappa("t1", { data: "2026-07-01" });
    await vi.advanceTimersByTimeAsync(400);                  // 409: sul server c'è «Finale», non l'ultimo corpo mandato
    senzaAvvisi();
    expect(server.salvate.get("t1")).toMatchObject({ luogo: "Testaccio", data: "2026-07-01", versione: 5 });
  });

  it("alla chiusura della pagina il salvataggio con keepalive non si legge: se la pagina resta viva il 409 dopo è riconosciuto", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    store().updateTappa("t1", { nome: "Finale" });
    window.dispatchEvent(new Event("pagehide"));             // PUT con keepalive: il server la salva (versione 4)
    await vi.advanceTimersByTimeAsync(0);
    expect(server.salvate.get("t1")!.versione).toBe(4);
    await vi.advanceTimersByTimeAsync(400);                  // la pagina torna (cache del browser): parte la PUT in coda
    senzaAvvisi();
    expect(store().tappe[0]).toMatchObject({ nome: "Finale", versione: 5 });
  });
});

describe("400 «Manca la versione»: pagina aperta prima dell'aggiornamento del server", () => {
  it("si rilegge la lega e si rimanda una volta sola, con la versione del server", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    useAppStore.setState({ legaId: "l1", tappe: [tappa("t1")] }); // tappa caricata dal backend di prima: senza versione
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(putPartite()).toEqual([["Finale", undefined], ["Finale", 3]]);
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", versione: 4 });
    expect(store().tappe[0]).toMatchObject({ nome: "Finale", versione: 4 });
    senzaAvvisi();
  });

  it("se anche il nuovo invio fallisce vale la gestione di sempre, senza un terzo invio", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    useAppStore.setState({ legaId: "l1", tappe: [tappa("t1")] });
    api.putTappa
      .mockRejectedValueOnce(new ApiError(400, MANCA_VERSIONE))
      .mockRejectedValueOnce(new ApiError(400, "Il nome della tappa è obbligatorio"));
    store().updateTappa("t1", { nome: "" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(store().avvisoRifiutate).toBe("Salvataggio di una tappa senza nome non riuscito: Il nome della tappa è obbligatorio");
  });
});

describe("409 sulla DELETE di una tappa: un altro dispositivo l'ha salvata nello stesso istante", () => {
  it("la tappa resta: torna al suo posto, com'è sul server, e compare l'avviso", async () => {
    const server = serverFinto();
    server.ha(tappa("t1", "Prima"), 3);
    server.ha(tappa("t2", "Seconda"), 0);
    await apri();
    server.salvaAltrove("t1", { nome: "Salvata altrove" });
    api.removeTappa.mockRejectedValueOnce(new ApiError(409, MODIFICATA));
    store().removeTappa("t1");
    expect(store().tappe.map((t) => t.id)).toEqual(["t2"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(store().tappe.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(store().tappe[0]).toEqual(server.salvate.get("t1"));
    expect(store().leghe[0].nTappe).toBe(2);
    expect(store().avvisoConflitti).toBe(eliminazioneTappaInConflitto("Salvata altrove"));
    // Si modifica con la versione del server
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(putPartite()).toEqual([["Salvata altrove", 4]]);
    expect(server.salvate.get("t1")!.versione).toBe(5);
  });
});

describe("409 sulla POST: la tappa è già stata creata (T1.6), gestito come prima", () => {
  it("si passa alla PUT con questa copia, che è la più recente, e con la versione della tappa creata, senza avviso", async () => {
    const server = serverFinto();
    await apri();
    api.addTappa.mockImplementationOnce(async (legaId, t) => {
      await server.post(legaId, t);
      throw new ApiError(0, NESSUNA_RISPOSTA);               // creata, ma la risposta si perde
    });
    store().addTappa(tappa("t1"));
    await vi.advanceTimersByTimeAsync(400);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // POST di nuovo → 409 → PUT
    expect(api.addTappa).toHaveBeenCalledTimes(2);
    expect(putPartite()).toEqual([["Finale", 0]]);
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", versione: 1 });
    senzaAvvisi();
    // Da qui la tappa esiste: le modifiche successive vanno con la PUT e la versione nuova
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(api.addTappa).toHaveBeenCalledTimes(2);
    expect(putPartite().at(-1)).toEqual(["Finale", 1]);
  });
});

describe("409 sulla POST: se la tappa del server non è un corpo di questo client vince il server", () => {
  it("un altro dispositivo l'ha cambiata dopo la creazione persa: la tappa del server, con l'avviso, e nessuna PUT", async () => {
    const server = serverFinto();
    await apri();
    api.addTappa.mockImplementationOnce(async (legaId, t) => {
      await server.post(legaId, t);
      throw new ApiError(0, NESSUNA_RISPOSTA);               // creata (versione 0), ma la risposta si perde
    });
    store().addTappa(tappa("t1"));
    await vi.advanceTimersByTimeAsync(400);
    server.salvaAltrove("t1", { nome: "Nome dell'altro" });  // un altro dispositivo, che ha aperto la lega, la cambia
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);                  // POST di nuovo → 409 → la tappa del server non è un nostro corpo
    expect(api.addTappa).toHaveBeenCalledTimes(2);
    expect(store().tappe[0]).toEqual(server.salvate.get("t1"));
    expect(store().avvisoConflitti).toBe(tappaModificataAltrove("Nome dell'altro"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).not.toHaveBeenCalled();
    expect(api.addTappa).toHaveBeenCalledTimes(2);
    // Da qui la tappa esiste: PUT con la versione del server
    store().updateTappa("t1", { data: "2026-07-01" });
    await vi.advanceTimersByTimeAsync(400);
    expect(putPartite()).toEqual([["Nome dell'altro", 1]]);
  });
});

describe("DELETE di una tappa e salvataggi della stessa tappa", () => {
  it("con una PUT in volo la DELETE parte solo quando la PUT è finita", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    const put = differita();
    api.putTappa.mockImplementationOnce(async (t) => { await put.p; return server.put(t); });
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // la PUT resta in volo
    store().removeTappa("t1");
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.removeTappa).not.toHaveBeenCalled();          // arrivando insieme al salvataggio avrebbe un 409
    put.ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.removeTappa).toHaveBeenCalledExactlyOnceWith("t1");
    expect(server.salvate.has("t1")).toBe(false);
    expect(store().tappe).toEqual([]);
    senzaAvvisi();
  });

  it("salvaTutto (prima di «Esci») finisce solo dopo aver mandato la DELETE che aspettava la PUT in volo", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    const put = differita();
    api.putTappa.mockImplementationOnce(async (t) => { await put.p; return server.put(t); });
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
    store().removeTappa("t1");
    const deleteAllaFine = store().salvaTutto().then(() => api.removeTappa.mock.calls.length);
    put.ok();
    expect(await deleteAllaFine).toBe(1);                    // dopo l'uscita il token non c'è più
  });

  it("chiudendo la pagina mentre la DELETE aspetta la PUT in volo, la DELETE parte con keepalive; se la pagina resta, il 404 dopo si tollera", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    const put = differita();
    api.putTappa.mockImplementationOnce(async (t) => { await put.p; return server.put(t); });
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // la PUT resta in volo (Render che riparte)
    store().removeTappa("t1");                               // la DELETE aspetta la PUT
    window.dispatchEvent(new Event("pagehide"));             // l'utente chiude la scheda
    expect(api.removeTappa).toHaveBeenCalledExactlyOnceWith("t1", true);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.salvate.has("t1")).toBe(false);            // senza, la tappa ricomparirebbe alla prossima apertura
    // La pagina resta viva (cache del browser): la PUT finisce con 404 e la DELETE in attesa, partita dopo, riceve 404
    put.ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.removeTappa).toHaveBeenCalledTimes(2);
    senzaAvvisi();
    expect(store().tappe).toEqual([]);
  });

  it("409 dopo un proprio salvataggio rimasto senza risposta: la DELETE si rimanda una volta, senza avviso, e la tappa non torna", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // salvata dal server (versione 4), risposta persa
    // Il server esegue quel salvataggio insieme alla DELETE (ripartenza di Render): la DELETE riceve 409
    api.removeTappa.mockRejectedValueOnce(new ApiError(409, MODIFICATA));
    store().removeTappa("t1");
    await vi.advanceTimersByTimeAsync(0);
    expect(api.removeTappa).toHaveBeenCalledTimes(2);
    expect(server.salvate.has("t1")).toBe(false);
    expect(store().tappe).toEqual([]);
    senzaAvvisi();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).toHaveBeenCalledTimes(1);           // il nuovo tentativo della PUT persa non parte più
  });

  it("una tappa eliminata qui mentre si rilegge la lega dopo un 409: nessun avviso, nessun nuovo invio, poi la DELETE", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    server.salvaAltrove("t1", { nome: "Nome dell'altro" });
    const rilettura = differita();
    api.get.mockImplementationOnce(async (id) => {
      await rilettura.p;
      return { id, nome: "Lega", tappe: [...server.salvate.values()].map(copia) };
    });
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);                  // 409, la rilettura resta in corso
    store().removeTappa("t1");
    expect(api.removeTappa).not.toHaveBeenCalled();          // aspetta la fine della richiesta in volo
    rilettura.ok();
    await vi.advanceTimersByTimeAsync(0);
    senzaAvvisi();
    expect(store().tappe).toEqual([]);
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    expect(api.removeTappa).toHaveBeenCalledExactlyOnceWith("t1");
    expect(server.salvate.has("t1")).toBe(false);
  });
});

describe("conflitti: i casi rischiosi", () => {
  it("un secondo 409 dopo il nuovo invio: vince il server, con l'avviso, e non parte un terzo invio", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // salvata (versione 4), risposta persa
    // Mentre il client rilegge la lega, un altro dispositivo salva la tappa (versione 5)
    api.get.mockImplementationOnce(async (id) => {
      const letta = { id, nome: "Lega", tappe: [...server.salvate.values()].map(copia) };
      server.salvaAltrove("t1", { luogo: "Ostia" });
      return letta;
    });
    store().updateTappa("t1", { data: "2026-07-01" });
    await vi.advanceTimersByTimeAsync(400);                  // 409 → è nostro → nuovo invio con la 4 → 409 → vince il server
    expect(putPartite()).toEqual([["Finale", 3], ["Finale", 3], ["Finale", 4]]);
    expect(store().tappe[0]).toEqual(server.salvate.get("t1"));
    expect(store().avvisoConflitti).toBe(tappaModificataAltrove("Finale"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).toHaveBeenCalledTimes(3);
    expect(server.salvate.get("t1")).toMatchObject({ luogo: "Ostia", data: "", versione: 5 });
  });

  it("rilettura non riuscita per la rete: la coda ritenta, i corpi senza risposta restano e nessun avviso; poi si risolve", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
    api.get.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);                  // 409 → la rilettura non riesce
    senzaAvvisi();
    expect(store().inSospeso).toBe(1);
    expect(store().erroreSalvataggio).toBe("Server non raggiungibile");
    expect(store().tappe[0]).toMatchObject({ nome: "Finale", luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(2000);                 // nuovo tentativo: 409 → rilettura → il corpo salvato è nostro
    expect(putPartite()).toEqual([["Finale", 3], ["Finale", 3], ["Finale", 3], ["Finale", 4]]);
    senzaAvvisi();
    expect(store().inSospeso).toBe(0);
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", luogo: "Testaccio", versione: 5 });
  });

  it("due tappe in conflitto insieme seguono ciascuna la sua strada, e la modifica in attesa di una terza resta", async () => {
    const server = serverFinto();
    server.ha(tappa("t1", "Prima"), 3);
    server.ha(tappa("t2", "Seconda"), 3);
    server.ha(tappa("t3", "Terza"), 3);
    await apri();
    rispostaPersa(server);
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);                  // t1: salvata dal server (versione 4), risposta persa
    server.salvaAltrove("t2", { nome: "Seconda dell'altro" }); // t2: un altro dispositivo la cambia (versione 4)
    store().updateTappa("t1", { data: "2026-07-01" });
    store().updateTappa("t2", { luogo: "Ostia" });
    await vi.advanceTimersByTimeAsync(200);
    store().updateTappa("t3", { luogo: "Fiumicino" });       // t3: ancora in attesa quando arrivano i due 409
    await vi.advanceTimersByTimeAsync(200);                  // t1 e t2: 409 e rilettura
    expect(server.salvate.get("t1")).toMatchObject({ luogo: "Testaccio", data: "2026-07-01", versione: 5 });
    expect(store().tappe[1]).toEqual(server.salvate.get("t2"));
    expect(store().avvisoConflitti).toBe(tappaModificataAltrove("Seconda dell'altro"));
    await vi.advanceTimersByTimeAsync(200);                  // t3 parte quando tocca a lei
    expect(server.salvate.get("t3")).toMatchObject({ luogo: "Fiumicino", versione: 4 });
    expect(store().tappe.map((t) => t.versione)).toEqual([5, 4, 4]);
    expect(store().inSospeso).toBe(0);
  });

  it("409 e poi la tappa non c'è più sul server (eliminata da un altro dispositivo): esce dallo store, con l'avviso", async () => {
    const server = serverFinto();
    server.ha(tappa("t1", "Prima"), 3);
    server.ha(tappa("t2", "Seconda"), 0);
    await apri();
    server.salvaAltrove("t1", { nome: "Nome dell'altro" });
    api.get.mockImplementationOnce(async (id) => {
      server.salvate.delete("t1");                           // e subito dopo la elimina
      return { id, nome: "Lega", tappe: [...server.salvate.values()].map(copia) };
    });
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(store().tappe.map((t) => t.id)).toEqual(["t2"]);
    expect(store().leghe[0].nTappe).toBe(1);
    expect(store().avvisoConflitti).toBe(tappaEliminataAltrove("Prima"));
    expect(store().syncError).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).toHaveBeenCalledTimes(1);           // niente più invii, e niente 404 a ogni modifica
  });
});

describe("corpi senza risposta: niente doppioni, e un tetto", () => {
  it("la stessa copia rimandata più volte senza risposta («Riprova ora») conta una volta: non fa uscire il corpo salvato", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // «Finale» salvata dal server, risposta persa
    api.putTappa.mockRejectedValue(new ApiError(0, NESSUNA_RISPOSTA));
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    for (let i = 0; i < 25; i++) await store().salvaTutto();  // la stessa copia, sempre senza risposta
    api.putTappa.mockImplementation(server.put);
    await store().salvaTutto();                               // 409: sul server c'è il primo corpo
    senzaAvvisi();
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", luogo: "Testaccio", versione: 5 });
  });

  it("si ricordano al massimo gli ultimi 20 corpi: il più vecchio, oltre il tetto, non conta più", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    rispostaPersa(server);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // il primo corpo, salvato dal server
    api.putTappa.mockRejectedValue(new ApiError(0, NESSUNA_RISPOSTA));
    for (let i = 1; i <= 20; i++) {                          // altri 20 corpi diversi, mai arrivati
      store().updateTappa("t1", { luogo: `Campo ${i}` });
      await vi.advanceTimersByTimeAsync(400);
    }
    api.putTappa.mockImplementation(server.put);
    await store().salvaTutto();                               // 409: il corpo salvato è uscito dal conto
    expect(store().avvisoConflitti).toBe(tappaModificataAltrove("Finale"));
  });
});

describe("la versione nota non scende mai", () => {
  it("una lettura della lega partita prima di un salvataggio non riporta indietro né la versione né i dati", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    const lettura = differita();
    api.get.mockImplementationOnce(async (id) => {
      const letta = { id, nome: "Lega", tappe: [...server.salvate.values()].map(copia) }; // letta adesso: versione 3
      await lettura.p;
      return letta;
    });
    const apertura = store().selectLega("l1");               // «Le mie leghe» → la stessa lega: la GET parte
    await vi.advanceTimersByTimeAsync(0);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // la PUT finisce prima della GET: versione 4
    expect(server.salvate.get("t1")!.versione).toBe(4);
    lettura.ok();
    await apertura;                                          // la GET risponde con la versione 3, ormai superata
    expect(store().tappe[0]).toMatchObject({ nome: "Finale", versione: 4 });
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(putPartite().at(-1)).toEqual(["Finale", 4]);
    senzaAvvisi();
    expect(server.salvate.get("t1")).toMatchObject({ nome: "Finale", luogo: "Testaccio", versione: 5 });
  });
});

describe("riaprire la lega aperta mentre un salvataggio è in volo (C1)", () => {
  const risultato = { sa: 21, sb: 15, done: true };
  /** Una tappa con una partita ancora da giocare */
  const conPartita = (id: string): Tappa => ({ ...tappa(id), partite: [{ id: "m1", g: 0, a: "s1", b: "s2", sa: 0, sb: 0, done: false }] });

  /** La GET della prossima apertura legge la lega appena parte e risponde quando il test chiama `ok`: è una lettura partita
   *  prima dei salvataggi che il test fa nel frattempo */
  function letturaLenta(server: ReturnType<typeof serverFinto>) {
    const lettura = differita();
    api.get.mockImplementationOnce(async (id) => {
      const letta = { id, nome: "Lega", tappe: [...server.salvate.values()].map(copia) };
      await lettura.p;
      return letta;
    });
    return lettura;
  }

  it("la GET risponde mentre la PUT del risultato è in volo, la PUT dopo: la modifica successiva porta il risultato", async () => {
    const server = serverFinto();
    server.ha(conPartita("t1"), 3);
    await apri();
    const lettura = letturaLenta(server);
    const put = differita();
    api.putTappa.mockImplementationOnce(async (t) => { await put.p; return server.put(t); });
    const apertura = store().selectLega("l1");               // «Apri» sulla lega aperta: la GET parte
    await vi.advanceTimersByTimeAsync(0);
    store().updateTappaPartita("t1", "m1", risultato);       // il risultato: la PUT parte e resta in volo
    await vi.advanceTimersByTimeAsync(400);
    lettura.ok();
    await apertura;                                          // la GET risponde prima, con la partita da giocare
    expect(store().tappe[0].partite[0]).toMatchObject(risultato);
    put.ok();
    await vi.advanceTimersByTimeAsync(0);                    // poi la PUT: versione 4
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(api.putTappa.mock.calls.at(-1)![0]).toMatchObject({ luogo: "Testaccio", versione: 4, partite: [risultato] });
    expect(server.salvate.get("t1")).toMatchObject({ luogo: "Testaccio", versione: 5, partite: [risultato] });
    senzaAvvisi();
  });

  it("una tappa creata durante la GET, con la POST ancora in volo, resta nello store (H3)", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    const lettura = letturaLenta(server);
    const post = differita();
    api.addTappa.mockImplementationOnce(async (legaId, t) => { await post.p; return server.post(legaId, t); });
    const apertura = store().selectLega("l1");
    await vi.advanceTimersByTimeAsync(0);
    store().addTappa(tappa("t2", "Nuova"));
    await vi.advanceTimersByTimeAsync(400);                  // la POST parte e resta in volo
    lettura.ok();
    await apertura;                                          // la GET non la conosce
    expect(store().tappe.map((t) => t.id)).toEqual(["t1", "t2"]);
    post.ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(store().tappe.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(store().tappe[1].versione).toBe(0);
    expect(server.salvate.has("t2")).toBe(true);
  });

  it("una tappa la cui POST è confermata durante la GET, che non la contiene, resta nello store", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    await apri();
    const lettura = letturaLenta(server);
    const apertura = store().selectLega("l1");
    await vi.advanceTimersByTimeAsync(0);
    store().addTappa(tappa("t2", "Nuova"));
    await vi.advanceTimersByTimeAsync(400);                  // la POST arriva al server dopo la lettura, e risponde
    expect(server.salvate.has("t2")).toBe(true);
    lettura.ok();
    await apertura;
    expect(store().tappe.map((t) => t.id)).toEqual(["t1", "t2"]);
    // Da qui la tappa esiste: la modifica parte con la PUT e la versione della POST
    store().updateTappa("t2", { luogo: "Ostia" });
    await vi.advanceTimersByTimeAsync(400);
    expect(putPartite()).toEqual([["Nuova", 0]]);
    senzaAvvisi();
  });

  it("una tappa eliminata da un altro dispositivo prima della GET esce dallo store riaprendo la lega, come prima", async () => {
    const server = serverFinto();
    server.ha(tappa("t1"), 3);
    server.ha(tappa("t2", "Seconda"), 0);
    await apri();
    server.salvate.delete("t2");                             // l'altro dispositivo la elimina
    await apri();
    expect(store().tappe.map((t) => t.id)).toEqual(["t1"]);
  });
});
