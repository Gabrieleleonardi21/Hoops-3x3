// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppStore } from "../../src/stores/useAppStore";
import { useAuth } from "../../src/hooks/useAuth";
import { legheApi } from "../../src/services/legheApi";
import type { LegaDettaglio } from "../../src/services/legheApi";
import { ApiError, token } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Partita, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe (legheApi): store e coda dei salvataggi sono quelli veri
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

/** Promessa controllabile a mano: il test decide quando il "server" risponde (ok) o con quale errore (ko) */
function differita<T>() {
  let ok!: (v: T) => void;
  let ko!: (e: unknown) => void;
  const p = new Promise<T>((res, rej) => { ok = res; ko = rej; });
  return { p, ok, ko };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  // Server finto che accetta tutto; i singoli test cambiano le risposte che servono
  api.addTappa.mockImplementation(async (_legaId, t) => t);
  api.putTappa.mockImplementation(async (t) => t);
  api.removeTappa.mockResolvedValue(undefined);
  useAppStore.setState({ user: registrato, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 0 }], tappe: [] });
});

afterEach(() => {
  store().reset(); // svuota la coda, così nessun salvataggio passa al test successivo
  vi.useRealTimers();
});

describe("store: creazione e modifica delle tappe passano dalla coda dei salvataggi", () => {
  it("la PUT non parte finché la POST di creazione non è conclusa", async () => {
    const post = differita<Tappa>();
    api.addTappa.mockReturnValueOnce(post.p);
    store().addTappa(tappa("t1"));
    await vi.advanceTimersByTimeAsync(400);       // parte la POST (lenta)
    expect(api.addTappa).toHaveBeenCalledTimes(1);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.putTappa).not.toHaveBeenCalled();  // una PUT adesso troverebbe la tappa ancora da creare: 404
    post.ok(tappa("t1"));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    expect(api.putTappa.mock.calls[0][0].nome).toBe("Finale");
  });

  it("se la risposta della POST si perde, il 409 del nuovo tentativo fa passare alla PUT", async () => {
    api.addTappa
      .mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile")) // il server l'ha creata, la risposta non è arrivata
      .mockRejectedValueOnce(new ApiError(409, "Esiste già una tappa con id t1"));
    // La versione della tappa creata si legge dalla lega (T2.7): la PUT la deve mandare
    api.get.mockResolvedValue({ id: "l1", nome: "Lega", tappe: [{ ...tappa("t1"), versione: 0 }] });
    store().addTappa(tappa("t1"));
    await vi.advanceTimersByTimeAsync(400 + 2000);
    expect(api.addTappa).toHaveBeenCalledTimes(2);
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    expect(api.putTappa.mock.calls[0][0].versione).toBe(0);
    expect(store().inSospeso).toBe(0);
    expect(store().syncError).toBeNull();
    // Da qui la tappa esiste: le modifiche successive vanno con la PUT
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
    expect(api.addTappa).toHaveBeenCalledTimes(2);
    expect(api.putTappa).toHaveBeenLastCalledWith(expect.objectContaining({ nome: "Finale" }));
  });

  it("una tappa eliminata prima di arrivare al server non genera né POST né DELETE", async () => {
    store().addTappa(tappa("t1"));
    store().removeTappa("t1");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.addTappa).not.toHaveBeenCalled();
    expect(api.removeTappa).not.toHaveBeenCalled();
  });

  it("una tappa eliminata mentre la POST è in volo viene cancellata appena il server la crea", async () => {
    const post = differita<Tappa>();
    api.addTappa.mockReturnValueOnce(post.p);
    store().addTappa(tappa("t1"));
    await vi.advanceTimersByTimeAsync(400);
    store().removeTappa("t1");
    expect(api.removeTappa).not.toHaveBeenCalled(); // arriverebbe prima della creazione: 404 e tappa che resta
    post.ok(tappa("t1"));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.removeTappa).toHaveBeenCalledWith("t1");
  });

  it("un salvataggio fallito lascia l'indicatore acceso finché un nuovo tentativo non riesce", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    api.putTappa
      .mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"))
      .mockRejectedValueOnce(new ApiError(503, "Servizio non disponibile"));
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
    expect(store().inSospeso).toBe(1);
    expect(store().erroreSalvataggio).toBe("Server non raggiungibile");
    await vi.advanceTimersByTimeAsync(2000);      // primo nuovo tentativo: guasto del server, l'avviso resta
    expect(api.putTappa).toHaveBeenCalledTimes(2);
    expect(store().inSospeso).toBe(1);
    expect(store().erroreSalvataggio).not.toBeNull();
    await vi.advanceTimersByTimeAsync(5000);      // secondo nuovo tentativo: riuscito, l'avviso sparisce da solo
    expect(api.putTappa).toHaveBeenCalledTimes(3);
    expect(api.putTappa.mock.calls[2][0].nome).toBe("Finale");
    expect(store().inSospeso).toBe(0);
    expect(store().erroreSalvataggio).toBeNull();
  });

  it("se il server rifiuta i dati non riprova e lo dice nel messaggio d'errore", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    api.putTappa.mockRejectedValue(new ApiError(400, "Il nome della tappa è obbligatorio"));
    store().updateTappa("t1", { nome: "" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    expect(store().avvisoRifiutate).toBe("Salvataggio di una tappa senza nome non riuscito: Il nome della tappa è obbligatorio");
    expect(store().inSospeso).toBe(0);
  });

  it("un errore arrivato dopo un salvataggio rifiutato non lo copre: il rifiuto ha la sua riga", async () => {
    useAppStore.setState({ tappe: [tappa("t1", "Finale")] });
    api.putTappa.mockRejectedValue(new ApiError(400, "Dati della tappa non validi"));
    api.rename.mockRejectedValue(new ApiError(500, "Errore del server"));
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(store().syncError).toBeNull();                    // il rifiuto sta nella sua riga, non tra gli errori da chiudere
    store().setLegaName("Nuovo nome");
    await vi.advanceTimersByTimeAsync(400);
    expect(store().syncError).toBe("Rinomina lega non riuscita: Errore del server");
    expect(store().avvisoRifiutate).toBe("Salvataggio della tappa «Finale» non riuscito: Dati della tappa non validi");
  });

  it("un rifiuto vale finché la tappa c'è: eliminando la sua lega, anche se non è quella aperta, non resta nella barra né in «Esci»", async () => {
    useAppStore.setState({ tappe: [tappa("t1", "Finale")] });
    api.putTappa.mockRejectedValue(new ApiError(400, "Dati della tappa non validi"));
    api.get.mockResolvedValue({ id: "l2", nome: "Inverno", tappe: [] });
    api.remove.mockResolvedValue(undefined);
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    await store().selectLega("l2");                          // un'altra lega: il rifiuto di t1 resta vero
    expect(store().avvisoRifiutate).toContain("«Finale»");
    expect(await store().salvaTutto()).toBe(1);
    await store().deleteLega("l1");
    expect(store().avvisoRifiutate).toBeNull();
    expect(await store().salvaTutto()).toBe(0);
  });

  it("un rifiuto vale finché la tappa c'è: una tappa mai creata sul server, che riaprendo la lega non c'è più, non resta nella barra", async () => {
    api.addTappa.mockRejectedValue(new ApiError(400, "Dati della tappa non validi"));
    api.get.mockResolvedValue({ id: "l1", nome: "Lega", tappe: [] });
    store().addTappa(tappa("t2", "Nuova"));
    await vi.advanceTimersByTimeAsync(400);
    expect(store().avvisoRifiutate).toContain("«Nuova»");
    await store().selectLega("l1");
    expect(store().tappe).toEqual([]);
    expect(store().avvisoRifiutate).toBeNull();
    expect(await store().salvaTutto()).toBe(0);
  });

  it("alla chiusura della pagina le versioni in attesa partono con keepalive: POST per le tappe nuove, PUT per le altre", () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    store().updateTappa("t1", { nome: "Finale" });
    store().addTappa(tappa("t2"));
    window.dispatchEvent(new Event("pagehide"));
    expect(api.putTappa).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", nome: "Finale" }), true);
    expect(api.addTappa).toHaveBeenCalledWith("l1", expect.objectContaining({ id: "t2" }), true);
  });

  it("alla chiusura della pagina ripartono con keepalive anche le versioni con la richiesta ancora in volo", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    // Rete lenta al campetto: PUT e POST partono e non rispondono prima della chiusura, che le interrompe
    api.putTappa.mockReturnValueOnce(differita<Tappa>().p);
    api.addTappa.mockReturnValueOnce(differita<Tappa>().p);
    store().updateTappa("t1", { nome: "Finale" });
    store().addTappa(tappa("t2"));
    await vi.advanceTimersByTimeAsync(400);
    window.dispatchEvent(new Event("pagehide"));
    expect(api.putTappa).toHaveBeenCalledTimes(2);
    expect(api.putTappa).toHaveBeenLastCalledWith(expect.objectContaining({ id: "t1", nome: "Finale" }), true);
    expect(api.addTappa).toHaveBeenCalledTimes(2);
    expect(api.addTappa).toHaveBeenLastCalledWith("l1", expect.objectContaining({ id: "t2" }), true);
  });

  it("con una PUT in volo e una versione più nuova in attesa, alla chiusura riparte solo la più nuova", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    api.putTappa.mockReturnValueOnce(differita<Tappa>().p);
    store().updateTappa("t1", { nome: "Semifinale" });
    await vi.advanceTimersByTimeAsync(400);       // la PUT di «Semifinale» resta in volo
    store().updateTappa("t1", { nome: "Finale" });
    window.dispatchEvent(new Event("pagehide"));
    // La PUT sostituisce tutta la tappa: due invii in parallelo potrebbero arrivare con la versione vecchia per ultima
    expect(api.putTappa).toHaveBeenCalledTimes(2);
    expect(api.putTappa).toHaveBeenLastCalledWith(expect.objectContaining({ nome: "Finale" }), true);
  });
});

describe("riaprire una lega con salvataggi in sospeso", () => {
  const partitaDaGiocare: Partita = { id: "m1", g: 0, a: "s1", b: "s2", sa: 0, sb: 0, done: false };
  /** La tappa come la conosce il server: la partita risulta ancora da giocare */
  const tappaDelServer = (): Tappa => ({ ...tappa("t1"), partite: [{ ...partitaDaGiocare }] });
  const risultato = { sa: 21, sb: 15, done: true };

  /** Registra il risultato mentre la rete è assente: la PUT fallisce e la versione con il risultato resta in coda */
  async function risultatoNonSalvato() {
    useAppStore.setState({ tappe: [tappaDelServer()] });
    api.putTappa.mockRejectedValue(new ApiError(0, "Server non raggiungibile"));
    store().updateTappaPartita("t1", "m1", risultato);
    await vi.advanceTimersByTimeAsync(400);
  }

  it("il risultato non salvato resta sullo schermo e la modifica successiva non lo perde", async () => {
    await risultatoNonSalvato();
    api.get.mockResolvedValue({ id: "l1", nome: "Lega", tappe: [tappaDelServer()] }); // il server ha la versione vecchia
    await store().selectLega("l1");                 // «Le mie leghe» → riapre la stessa lega
    expect(store().tappe[0].partite[0]).toMatchObject(risultato);
    api.putTappa.mockImplementation(async (t) => t); // torna la rete
    store().updateTappa("t1", { luogo: "Testaccio" });
    await vi.advanceTimersByTimeAsync(400);
    expect(api.putTappa).toHaveBeenLastCalledWith(
      expect.objectContaining({ luogo: "Testaccio", partite: [expect.objectContaining(risultato)] }),
    );
  });

  it("anche se un nuovo tentativo salva il risultato mentre il server risponde con la versione vecchia", async () => {
    await risultatoNonSalvato();
    const risposta = differita<LegaDettaglio>();
    api.get.mockReturnValueOnce(risposta.p);
    const apertura = store().selectLega("l1");
    await vi.advanceTimersByTimeAsync(0);           // il salvataggio prima della GET fallisce ancora, poi parte la GET
    expect(api.get).toHaveBeenCalledTimes(1);
    api.putTappa.mockImplementation(async (t) => t);
    await vi.advanceTimersByTimeAsync(5000);        // nuovo tentativo automatico, riuscito, con la GET ancora in corso
    expect(store().inSospeso).toBe(0);
    risposta.ok({ id: "l1", nome: "Lega", tappe: [tappaDelServer()] }); // letta dal server prima della PUT
    await apertura;
    expect(store().tappe[0].partite[0]).toMatchObject(risultato);
  });

  it("una tappa nuova non ancora creata sul server resta nella lega riaperta", async () => {
    api.addTappa.mockRejectedValue(new ApiError(0, "Server non raggiungibile"));
    store().addTappa(tappa("t2", "Tappa nuova"));
    await vi.advanceTimersByTimeAsync(400);
    api.get.mockResolvedValue({ id: "l1", nome: "Lega", tappe: [] }); // il server non la conosce ancora
    await store().selectLega("l1");
    expect(store().tappe.map((t) => t.nome)).toEqual(["Tappa nuova"]);
  });
});

describe("eliminazioni con salvataggi in sospeso: nessun errore per dati eliminati apposta", () => {
  it("una tappa eliminata con la PUT in volo: la DELETE aspetta la PUT, e un 404 della PUT (tappa già sparita) non è un errore", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    const put = differita<Tappa>();
    api.putTappa.mockReturnValueOnce(put.p);
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);       // parte la PUT (lenta)
    store().removeTappa("t1");
    expect(api.removeTappa).not.toHaveBeenCalled(); // insieme al salvataggio avrebbe un 409 (T2.7)
    put.ko(new ApiError(404, "Tappa non trovata: t1"));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.removeTappa).toHaveBeenCalledWith("t1");
    expect(store().syncError).toBeNull();
    expect(store().inSospeso).toBe(0);
  });

  it("eliminando la lega aperta, i salvataggi in attesa delle sue tappe non partono più", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    // Rete assente: la PUT di t1 e la POST di t2 falliscono e aspettano il nuovo tentativo
    api.putTappa.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    api.addTappa.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    store().updateTappa("t1", { nome: "Finale" });
    store().addTappa(tappa("t2"));
    await vi.advanceTimersByTimeAsync(400);
    // Torna la rete e la lega viene eliminata: da qui il server non conosce più né lei né le sue tappe
    api.remove.mockResolvedValue(undefined);
    api.putTappa.mockRejectedValue(new ApiError(404, "Tappa non trovata: t1"));
    api.addTappa.mockRejectedValue(new ApiError(404, "Lega non trovata: l1"));
    await store().deleteLega("l1");
    expect(store().inSospeso).toBe(0);            // niente avviso di tappe non salvate per una lega eliminata
    await vi.advanceTimersByTimeAsync(60_000);
    expect(store().syncError).toBeNull();
    expect(api.putTappa).toHaveBeenCalledTimes(1); // nessun nuovo tentativo dopo l'eliminazione
    expect(api.addTappa).toHaveBeenCalledTimes(1);
  });
});

describe("eliminare la lega aperta mentre un salvataggio riparte", () => {
  it("un nuovo tentativo partito durante la DELETE della lega riceve 404: nessun errore, nemmeno per un momento, e nessuna rilettura", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    api.putTappa.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    store().updateTappa("t1", { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);                  // non riesce: nuovo tentativo fra 2 secondi
    const remove = differita<void>();
    api.remove.mockReturnValueOnce(remove.p);
    api.putTappa.mockRejectedValue(new ApiError(404, "Tappa non trovata: t1")); // il server ha già eliminato la lega
    const eliminazione = store().deleteLega("l1");
    await vi.advanceTimersByTimeAsync(2000);                 // il nuovo tentativo parte con la DELETE ancora in corso
    expect(api.putTappa).toHaveBeenCalledTimes(2);
    expect(store().syncError).toBeNull();
    expect(store().avvisoRifiutate).toBeNull();
    expect(api.get).not.toHaveBeenCalled();                  // la lega se ne sta andando: non si rilegge
    remove.ok(undefined);
    await eliminazione;
    expect(store().syncError).toBeNull();
    expect(store().avvisoRifiutate).toBeNull();
    expect(await store().salvaTutto()).toBe(0);
  });
});

describe("logout: prima salva ciò che è in attesa, poi esce", () => {
  beforeEach(() => {
    token.set("jwt-di-prova");
    // La revoca del refresh token al logout è l'unica chiamata che arriva a fetch
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    token.clear();
  });

  /** Esegue il logout di useAuth dentro act (aggiorna lo stato di React) e ne restituisce l'esito */
  async function esci(conferma?: (nonSalvate: number) => Promise<boolean>) {
    const { result, unmount } = renderHook(() => useAuth());
    let esito: Awaited<ReturnType<typeof result.current.logout>> | undefined;
    await act(async () => { esito = await result.current.logout(conferma); });
    unmount();
    return esito;
  }

  it("la PUT dell'ultima modifica parte prima della cancellazione del token", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    let tokenAllInvio: string | null = "PUT mai partita";
    api.putTappa.mockImplementation(async (t) => { tokenAllInvio = token.get(); return t; });
    store().updateTappa("t1", { nome: "Finale" }); // «Esci» subito, prima dei 400 ms di attesa della coda
    const esito = await esci();
    expect(api.putTappa).toHaveBeenCalledWith(expect.objectContaining({ nome: "Finale" }));
    expect(tokenAllInvio).toBe("jwt-di-prova");
    expect(token.get()).toBeNull();
    expect(store().user).toBeNull();
    expect(esito).toEqual({ uscito: true, nonSalvate: 0 });
  });

  it("una rinomina della lega seguita subito dal logout parte prima della cancellazione del token", async () => {
    let tokenAllInvio: string | null = "PATCH mai partita";
    api.rename.mockImplementation(async (id, nome) => {
      tokenAllInvio = token.get();
      return { id, nome, ts: 1, nTappe: 0 };
    });
    store().setLegaName("Lega estiva"); // «Esci» subito, prima dei 400 ms di attesa della rinomina
    await esci();
    expect(api.rename).toHaveBeenCalledWith("l1", "Lega estiva");
    expect(tokenAllInvio).toBe("jwt-di-prova");
    await vi.advanceTimersByTimeAsync(400);
    expect(api.rename).toHaveBeenCalledTimes(1); // il timer della rinomina non la rimanda una seconda volta
  });

  it("senza conferma (sessione finita) esce lo stesso e dice quante tappe hanno perso le modifiche", async () => {
    useAppStore.setState({ tappe: [tappa("t1"), tappa("t2")] });
    api.putTappa.mockRejectedValue(new ApiError(401, "Sessione scaduta o token non valido: accedi di nuovo"));
    store().updateTappa("t1", { nome: "Finale" });
    store().updateTappa("t2", { nome: "Semifinale" });
    const esito = await esci();
    expect(esito).toEqual({ uscito: true, nonSalvate: 2 });
    expect(store().user).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.putTappa).toHaveBeenCalledTimes(2); // dopo l'uscita la coda non riprova più
  });

  it("con modifiche non salvate chiede conferma: se l'utente resta non esce e la coda continua a riprovare", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    api.putTappa.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    store().updateTappa("t1", { nome: "Finale" });
    const conferma = vi.fn(async () => false);
    const esito = await esci(conferma);
    expect(conferma).toHaveBeenCalledWith(1);
    expect(esito).toEqual({ uscito: false, nonSalvate: 1 });
    expect(store().user).toEqual(registrato);
    expect(token.get()).toBe("jwt-di-prova");
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.putTappa).toHaveBeenCalledTimes(2);
    expect(store().inSospeso).toBe(0);
  });

  it("un salvataggio rifiutato dal server conta tra le modifiche non salvate: «Esci» chiede conferma", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    api.putTappa.mockRejectedValue(new ApiError(400, "Il nome della tappa è obbligatorio"));
    store().updateTappa("t1", { nome: "" });
    await vi.advanceTimersByTimeAsync(400);                  // la coda la dà per smaltita: non ritenta un rifiuto
    const conferma = vi.fn(async () => false);
    const esito = await esci(conferma);
    expect(conferma).toHaveBeenCalledWith(1);
    expect(esito).toEqual({ uscito: false, nonSalvate: 1 });
    expect(store().user).toEqual(registrato);
  });

  it("una tappa rifiutata e poi di nuovo in attesa conta una volta sola", async () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    api.putTappa.mockRejectedValueOnce(new ApiError(400, "Il nome della tappa è obbligatorio"));
    store().updateTappa("t1", { nome: "" });
    await vi.advanceTimersByTimeAsync(400);
    api.putTappa.mockRejectedValue(new ApiError(0, "Server non raggiungibile"));
    store().updateTappa("t1", { nome: "Finale" });           // non arriva: resta in attesa, e il rifiuto di prima vale ancora
    expect(await store().salvaTutto()).toBe(1);
  });

  it("se tutto è già salvato esce senza chiedere conferma", async () => {
    const conferma = vi.fn(async () => false);
    const esito = await esci(conferma);
    expect(conferma).not.toHaveBeenCalled();
    expect(esito).toEqual({ uscito: true, nonSalvate: 0 });
    expect(store().user).toBeNull();
  });
});
