// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa, User } from "../../src/types";

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

/** Promessa controllabile a mano: il test decide quando il "server" risponde */
function differita<T>() {
  let ok!: (v: T) => void;
  const p = new Promise<T>((res) => { ok = res; });
  return { p, ok };
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
    store().addTappa(tappa("t1"));
    await vi.advanceTimersByTimeAsync(400 + 2000);
    expect(api.addTappa).toHaveBeenCalledTimes(2);
    expect(api.putTappa).toHaveBeenCalledTimes(1);
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
    expect(store().syncError).toBe("Salvataggio tappa non riuscito: Il nome della tappa è obbligatorio");
    expect(store().inSospeso).toBe(0);
  });

  it("alla chiusura della pagina le versioni in attesa partono con keepalive: POST per le tappe nuove, PUT per le altre", () => {
    useAppStore.setState({ tappe: [tappa("t1")] });
    store().updateTappa("t1", { nome: "Finale" });
    store().addTappa(tappa("t2"));
    window.dispatchEvent(new Event("pagehide"));
    expect(api.putTappa).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", nome: "Finale" }), true);
    expect(api.addTappa).toHaveBeenCalledWith("l1", expect.objectContaining({ id: "t2" }), true);
  });
});
