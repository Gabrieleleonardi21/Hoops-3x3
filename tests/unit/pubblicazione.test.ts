// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { archivioApi } from "../../src/services/archivioApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa, User } from "../../src/types";

// Si sostituisce solo la rete (leghe e archivio): store e coda dei salvataggi sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));
vi.mock("../../src/services/archivioApi", () => ({
  archivioApi: { list: vi.fn(), get: vi.fn(), pubblica: vi.fn(), rimuovi: vi.fn() },
}));

const api = vi.mocked(legheApi);
const archivio = vi.mocked(archivioApi);
const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

const tappa = (id: string, nome = "Tappa"): Tappa => ({
  id, nome, luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [], gironi: null, partite: [], video: [], conclusa: true,
});

/** Promessa controllabile a mano: il test decide quando il "server" risponde (ok) o con quale errore (ko) */
function differita<T>() {
  let ok!: (v: T) => void;
  let ko!: (e: unknown) => void;
  const p = new Promise<T>((res, rej) => { ok = res; ko = rej; });
  return { p, ok, ko };
}

/** Le richieste al server nell'ordine in cui sono PARTITE e in cui sono FINITE: la pubblicazione deve partire dopo l'ultima
 *  fine di un salvataggio */
let eventi: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  eventi = [];
  api.putTappa.mockImplementation(async (t) => {
    eventi.push(`salva ${t.nome}`);
    return t;
  });
  api.rename.mockImplementation(async (_id, nome) => {
    eventi.push(`rinomina ${nome}`);
    return { id: "l1", nome, ts: 1, nTappe: 1 };
  });
  archivio.pubblica.mockImplementation(async (id) => {
    eventi.push(`pubblica ${id}`);
    return { tappa: tappa(id), lega: "Lega", autore: "Anna", autoreId: "u1", ts: 1 };
  });
  useAppStore.setState({
    user: registrato, legaId: "l1", legaName: "Lega", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }],
    tappe: [tappa("t1"), tappa("t2", "Altra")], inSospeso: 0, erroreSalvataggio: null, syncError: null,
  });
});

afterEach(() => {
  store().reset(); // svuota la coda, così nessun salvataggio passa al test successivo
  vi.useRealTimers();
});

describe("pubblica: prima il salvataggio, poi la pubblicazione", () => {
  it("la modifica ancora in attesa del debounce parte subito, e la pubblicazione solo dopo la sua risposta", async () => {
    const salvataggio = differita<Tappa>();
    api.putTappa.mockImplementationOnce(async (t) => {
      eventi.push(`salva ${t.nome}`);
      return salvataggio.p;
    });
    store().updateTappa("t1", { nome: "Finale" }); // la coda aspetterebbe 400 ms
    const fine = store().pubblica("t1");
    await vi.advanceTimersByTimeAsync(0);          // senza far passare i 400 ms del debounce
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    expect(archivio.pubblica).not.toHaveBeenCalled(); // il server non ha ancora la versione nuova
    salvataggio.ok(tappa("t1", "Finale"));
    await fine;
    expect(eventi).toEqual(["salva Finale", "pubblica t1"]);
  });

  it("con un salvataggio già in volo e una versione più nuova in coda aspetta anche quella", async () => {
    const primo = differita<Tappa>();
    api.putTappa.mockImplementationOnce(async (t) => {
      eventi.push(`salva ${t.nome}`);
      return primo.p;
    });
    store().updateTappa("t1", { nome: "Prima" });
    await vi.advanceTimersByTimeAsync(400);          // il primo salvataggio parte e resta in volo
    store().updateTappa("t1", { nome: "Seconda" });  // arriva mentre il primo è in volo
    const fine = store().pubblica("t1");
    await vi.advanceTimersByTimeAsync(0);
    expect(archivio.pubblica).not.toHaveBeenCalled();
    primo.ok(tappa("t1", "Prima"));
    await fine;
    // L'ultima versione è arrivata al server prima della pubblicazione, non solo la prima
    expect(eventi).toEqual(["salva Prima", "salva Seconda", "pubblica t1"]);
  });

  it("una tappa già salvata si pubblica subito, senza altri salvataggi", async () => {
    await store().pubblica("t1");
    expect(eventi).toEqual(["pubblica t1"]);
    expect(api.putTappa).not.toHaveBeenCalled();
  });

  it("la rinomina della lega ancora in attesa parte prima: la copia pubblica porta il nome che il server ha", async () => {
    store().setLegaName("Circuito Lazio"); // la PATCH aspetterebbe 400 ms
    await store().pubblica("t1");
    expect(eventi).toEqual(["rinomina Circuito Lazio", "pubblica t1"]);
  });

  it("pubblica solo l'id: la copia la costruisce il server", async () => {
    await store().pubblica("t1");
    expect(archivio.pubblica).toHaveBeenCalledExactlyOnceWith("t1");
  });
});

describe("pubblica: l'ordine è sempre salvataggio, poi pubblicazione", () => {
  it("in 200 sequenze casuali di modifiche e salvataggi lenti, quando parte la PUT dell'archivio il server ha già l'ultima versione", async () => {
    // Generatore con seme fisso: se cade una sequenza, si ripete uguale
    let seme = 20261007;
    const casuale = (max: number) => {
      seme = (seme * 1664525 + 1013904223) % 4294967296;
      return Math.floor((seme / 4294967296) * max);
    };
    for (let giro = 0; giro < 200; giro++) {
      store().reset();
      useAppStore.setState({ user: registrato, legaId: "l1", legaName: "Lega", tappe: [tappa("t1")] });
      // Il server tiene l'ultima versione che riceve (le tappe sono numerate "1", "2"...); ogni salvataggio dura da 0 a 900 ms,
      // cioè anche più del debounce della coda (400 ms): una versione può essere in volo mentre ne arriva un'altra
      let sulServer = 0;
      api.putTappa.mockImplementation(async (t) => {
        await new Promise((ok) => setTimeout(ok, casuale(900)));
        sulServer = Number(t.nome);
        return t;
      });
      let sulServerAllaPartenza = -1;
      archivio.pubblica.mockImplementation(async (id) => {
        sulServerAllaPartenza = sulServer;
        return { tappa: tappa(id), lega: "Lega", autore: "Anna", autoreId: "u1", ts: 1 };
      });

      const modifiche = 1 + casuale(6);
      for (let n = 1; n <= modifiche; n++) {
        store().updateTappa("t1", { nome: String(n) });
        await vi.advanceTimersByTimeAsync(casuale(700)); // la prossima modifica arriva prima o dopo il salvataggio della precedente
      }
      const fine = store().pubblica("t1");
      await vi.advanceTimersByTimeAsync(10_000);
      await fine;
      expect(sulServerAllaPartenza, `sequenza ${giro}: ${modifiche} modifiche`).toBe(modifiche);
    }
  });
});

describe("pubblica: se la coda non riesce a svuotarsi non si pubblica, e si sa perché", () => {
  it("rete assente: niente pubblicazione, il motivo è quello del salvataggio", async () => {
    api.putTappa.mockRejectedValue(new ApiError(0, "Server non raggiungibile: controlla la connessione."));
    store().updateTappa("t1", { nome: "Finale" });
    const fine = store().pubblica("t1");
    const esito = fine.then(() => null, (e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    const errore = await esito;
    expect(errore).toBeInstanceOf(ApiError);
    expect((errore as ApiError).message).toContain("salvata sul server");
    expect((errore as ApiError).message).toContain("Server non raggiungibile: controlla la connessione.");
    expect(archivio.pubblica).not.toHaveBeenCalled();
    // La modifica resta in coda: la barra degli avvisi continua a dirlo
    expect(store().inSospeso).toBe(1);
  });

  it("dati rifiutati dal server (400): la coda non riprova e dà la tappa per smaltita, ma non si pubblica la versione vecchia", async () => {
    api.putTappa.mockRejectedValue(new ApiError(400, "Il nome della tappa è obbligatorio"));
    store().updateTappa("t1", { nome: "" });
    await vi.advanceTimersByTimeAsync(400); // il salvataggio parte da solo e viene rifiutato: la coda è vuota
    expect(store().inSospeso).toBe(0);
    const esito = store().pubblica("t1").then(() => null, (e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    const errore = await esito;
    expect((errore as ApiError).message).toContain("Il nome della tappa è obbligatorio");
    expect(archivio.pubblica).not.toHaveBeenCalled();
  });

  it("dopo un rifiuto, un salvataggio riuscito toglie l'ostacolo", async () => {
    api.putTappa.mockRejectedValueOnce(new ApiError(400, "Il nome della tappa è obbligatorio"));
    store().updateTappa("t1", { nome: "" });
    await vi.advanceTimersByTimeAsync(400);
    store().updateTappa("t1", { nome: "Finale" }); // l'utente corregge: questo salvataggio riesce
    await store().pubblica("t1");
    expect(eventi).toEqual(["salva Finale", "pubblica t1"]);
  });

  it("le modifiche non salvate di un'altra tappa non impediscono di pubblicare questa", async () => {
    api.putTappa.mockRejectedValue(new ApiError(0, "Server non raggiungibile"));
    store().updateTappa("t2", { nome: "Altra, modificata" });
    await vi.advanceTimersByTimeAsync(400);   // la modifica di t2 non riesce e resta in coda
    expect(store().inSospeso).toBe(1);
    await store().pubblica("t1");              // t1 non ha niente in sospeso
    expect(archivio.pubblica).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("un rifiuto dell'archivio (409, tappa non conclusa) arriva a chi chiama com'è, con il messaggio del server", async () => {
    archivio.pubblica.mockRejectedValue(new ApiError(409, "La tappa non è conclusa: concludila prima di pubblicarla in archivio"));
    await expect(store().pubblica("t1")).rejects.toMatchObject({
      status: 409, message: "La tappa non è conclusa: concludila prima di pubblicarla in archivio",
    });
  });
});
