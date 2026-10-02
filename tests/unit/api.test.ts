import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, token, ApiError, suSessioneFinita, avviaRinnovoAutomatico } from "../../src/services/api";

/** localStorage e fetch non esistono nell'ambiente node: si sostituiscono con versioni in memoria */
const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => { memoria.set(k, v); },
  removeItem: (k: string) => { memoria.delete(k); },
});
const fetchFinto = vi.fn();
vi.stubGlobal("fetch", fetchFinto);
/** Nemmeno document esiste: al rinnovo automatico servono solo la visibilità della scheda e i suoi eventi */
vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));

/** JWT finto (firma non verificata dal client) che scade tra `secondi` secondi (negativi = già scaduto) */
function jwt(secondi: number): string {
  const payload = btoa(JSON.stringify({ sub: "u1", exp: Math.floor(Date.now() / 1000) + secondi }));
  return `intestazione.${payload}.firma`;
}
const ok = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "Content-Type": "application/json" } });
const errore = (status: number, message: string) =>
  new Response(JSON.stringify({ message, timestamp: "2026-10-01T10:00:00" }), { status, headers: { "Content-Type": "application/json" } });
/** URL e opzioni della n-esima chiamata a fetch */
const chiamata = (n: number) => ({ url: fetchFinto.mock.calls[n][0] as string, init: fetchFinto.mock.calls[n][1] as RequestInit });
const header = (n: number, nome: string) => (chiamata(n).init.headers as Record<string, string>)[nome];
/** Posizione della prima chiamata a fetch verso quell'URL (-1 se non c'è stata) */
const indiceDi = (url: string) => fetchFinto.mock.calls.findIndex(([u]) => u === url);
/** Lock finto tra le schede (Web Locks API): esegue subito, come quando nessun'altra scheda sta rinnovando */
const lockLibero = { locks: { request: (_nome: string, fn: () => unknown) => fn() } };
/** Lock finto che, prima di cedere il turno, fa quello che nel frattempo ha fatto un'altra scheda */
const lockDopo = (altraScheda: () => void) => ({ locks: { request: (_nome: string, fn: () => unknown) => { altraScheda(); return fn(); } } });

const SCADUTO = "Sessione scaduta o token non valido: accedi di nuovo";

beforeEach(() => {
  memoria.clear();
  fetchFinto.mockReset();
  vi.stubGlobal("navigator", lockLibero);
});

describe("api: Bearer e richieste di autenticazione", () => {
  it("allega il Bearer alle richieste normali", async () => {
    token.set(jwt(3600));
    fetchFinto.mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(header(0, "Authorization")).toBe(`Bearer ${token.get()}`);
  });

  it("login, registrazione, refresh e logout viaggiano senza Bearer; /me lo porta", async () => {
    token.set(jwt(3600));
    fetchFinto.mockImplementation(async () => ok({}));
    await api("/api/auth/login", { method: "POST", body: { email: "a@b.it", password: "x" } });
    await api("/api/auth/register", { method: "POST", body: { name: "Anna", email: "a@b.it", password: "x" } });
    await api("/api/auth/refresh", { method: "POST" });
    await api("/api/auth/logout", { method: "POST" });
    await api("/api/auth/me");
    for (const n of [0, 1, 2, 3]) expect(header(n, "Authorization")).toBeUndefined();
    expect(header(4, "Authorization")).toBe(`Bearer ${token.get()}`);
    // Nessuna opzione credentials: vale la modalità predefinita del browser (cookie solo sulla stessa origine)
    for (const n of [0, 1, 2, 3, 4]) expect(chiamata(n).init.credentials).toBeUndefined();
  });

  it("le chiamate di autenticazione non fanno partire rinnovi nemmeno con un JWT scaduto in memoria", async () => {
    token.set(jwt(-10));
    fetchFinto.mockImplementation(async () => ok({}));
    await api("/api/auth/login", { method: "POST", body: { email: "a@b.it", password: "x" } });
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(chiamata(0).url).toBe("/api/auth/login");
  });
});

describe("api: rinnovo dopo un 401", () => {
  it("su 401 rinnova il token e ripete la richiesta una volta sola", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      .mockResolvedValueOnce(ok({ token: "jwt-nuovo", user: { id: "u1", name: "Anna", email: "a@b.it", ruolo: "USER" } }))
      .mockResolvedValueOnce(ok([{ id: "l1" }]));
    const risultato = await api("/api/leghe");
    expect(risultato).toEqual([{ id: "l1" }]);
    expect(fetchFinto).toHaveBeenCalledTimes(3);
    expect(chiamata(1).url).toBe("/api/auth/refresh");
    expect(chiamata(1).init.method).toBe("POST");
    expect(header(2, "Authorization")).toBe("Bearer jwt-nuovo");
    expect(token.get()).toBe("jwt-nuovo");
  });

  it("se anche la richiesta ripetuta risponde 401 rilancia l'errore senza altri rinnovi", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      .mockResolvedValueOnce(ok({ token: jwt(1800), user: {} }))
      .mockResolvedValueOnce(errore(401, SCADUTO));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(fetchFinto).toHaveBeenCalledTimes(3);
  });

  it("se il rinnovo risponde 401 cancella il token e rilancia il 401 originale senza ripetere", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      .mockResolvedValueOnce(errore(401, "Sessione scaduta: accedi di nuovo"));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401, message: SCADUTO });
    expect(fetchFinto).toHaveBeenCalledTimes(2);
    expect(token.get()).toBeNull();
  });

  it("se il rinnovo fallisce per rete il token resta e l'errore originale viene rilanciato", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    // L'errore è il 401 della richiesta, non lo status 0 («server non raggiungibile») del rinnovo
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401, message: SCADUTO });
    expect(fetchFinto).toHaveBeenCalledTimes(2);
    expect(token.get()).not.toBeNull();
  });

  it("tre richieste in 401 nello stesso momento condividono un solo rinnovo", async () => {
    token.set(jwt(3600));
    const giaFallite = new Set<string>();
    fetchFinto.mockImplementation(async (url: string) => {
      if (url === "/api/auth/refresh") return ok({ token: "jwt-nuovo", user: {} });
      if (!giaFallite.has(url)) { giaFallite.add(url); return errore(401, "scaduto"); }
      return ok({ url });
    });
    const risultati = await Promise.all([api("/api/a"), api("/api/b"), api("/api/c")]);
    expect(risultati).toEqual([{ url: "/api/a" }, { url: "/api/b" }, { url: "/api/c" }]);
    const rinnovi = fetchFinto.mock.calls.filter(([url]) => url === "/api/auth/refresh");
    expect(rinnovi).toHaveLength(1);
  });

  it("senza token (ospite) un 401 non fa partire nessun rinnovo, nemmeno la richiesta del lock", async () => {
    const richiestaLock = vi.fn((_nome: string, fn: () => unknown) => fn());
    vi.stubGlobal("navigator", { locks: { request: richiestaLock } });
    fetchFinto.mockResolvedValueOnce(errore(401, "Autenticazione richiesta: accedi per continuare"));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(richiestaLock).not.toHaveBeenCalled();
  });
});

describe("api: rinnovo in anticipo", () => {
  it("con il JWT già scaduto aspetta il rinnovo e manda la richiesta con il JWT nuovo", async () => {
    token.set(jwt(-10));
    fetchFinto
      .mockResolvedValueOnce(ok({ token: "jwt-nuovo", user: {} }))
      .mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(chiamata(0).url).toBe("/api/auth/refresh");
    expect(chiamata(1).url).toBe("/api/leghe");
    expect(header(1, "Authorization")).toBe("Bearer jwt-nuovo");
  });

  it("con il JWT in scadenza ma ancora valido la richiesta parte subito e il rinnovo corre in parallelo", async () => {
    const vecchio = jwt(90);
    token.set(vecchio);
    // Il rinnovo risponde solo quando lo decide il test: la richiesta non deve aspettarlo
    let rispondiAlRinnovo: (r: Response) => void = () => {};
    fetchFinto.mockImplementation((url: string) => {
      if (url === "/api/auth/refresh") return new Promise<Response>((resolve) => { rispondiAlRinnovo = resolve; });
      return Promise.resolve(ok([{ id: "l1" }]));
    });
    const richiesta = api("/api/leghe");
    try {
      // Sono già partite tutte e due in questo stesso giro di esecuzione: la richiesta, con il JWT vecchio, e il rinnovo
      expect(indiceDi("/api/leghe")).toBeGreaterThanOrEqual(0);
      expect(header(indiceDi("/api/leghe"), "Authorization")).toBe(`Bearer ${vecchio}`);
      // (il lock finto esegue subito: con il lock vero del browser il rinnovo parte un giro dopo)
      expect(indiceDi("/api/auth/refresh")).toBeGreaterThanOrEqual(0);
    } finally {
      // Il rinnovo si sblocca comunque e si aspetta la fine: nessuna promessa resta appesa per i test successivi
      rispondiAlRinnovo(ok({ token: "jwt-nuovo", user: {} }));
      await richiesta.catch(() => {});
    }
    await expect(richiesta).resolves.toEqual([{ id: "l1" }]);
    await vi.waitFor(() => expect(token.get()).toBe("jwt-nuovo"));
  });

  it("non rinnova un JWT a cui mancano più di due minuti", async () => {
    token.set(jwt(150));
    fetchFinto.mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(chiamata(0).url).toBe("/api/leghe");
  });

  it.each([
    ["in scadenza", 60],
    ["già scaduto", -10],
  ])("un salvataggio keepalive (chiusura pagina) con il JWT %s parte subito e non fa partire rinnovi", async (_stato, secondi) => {
    token.set(jwt(secondi));
    fetchFinto.mockResolvedValueOnce(ok({ id: "t1" }));
    const richiesta = api("/api/tappe/t1", { method: "PUT", body: { id: "t1" }, keepalive: true });
    // La fetch deve essere già partita in questo stesso giro di esecuzione: quando la pagina si chiude non c'è un «dopo»
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(chiamata(0).url).toBe("/api/tappe/t1");
    expect(chiamata(0).init.keepalive).toBe(true);
    await richiesta;
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it("una richiesta keepalive respinta con 401 viene ripetuta dopo il rinnovo, se la pagina è ancora viva", async () => {
    token.set(jwt(-10));
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      .mockResolvedValueOnce(ok({ token: "jwt-nuovo", user: {} }))
      .mockResolvedValueOnce(ok({ id: "t1" }));
    await expect(api("/api/tappe/t1", { method: "PUT", body: { id: "t1" }, keepalive: true })).resolves.toEqual({ id: "t1" });
    // Prima la richiesta (nessun rinnovo in anticipo), poi il rinnovo, poi la ripetizione ancora keepalive
    expect(chiamata(0).url).toBe("/api/tappe/t1");
    expect(chiamata(1).url).toBe("/api/auth/refresh");
    expect(chiamata(2).init.keepalive).toBe(true);
    expect(header(2, "Authorization")).toBe("Bearer jwt-nuovo");
  });
});

describe("api: più schede, logout e lock", () => {
  it("se un'altra scheda ha già rinnovato mentre si aspettava il lock non chiama il server", async () => {
    token.set(jwt(-10));
    vi.stubGlobal("navigator", lockDopo(() => token.set(jwt(3600))));
    fetchFinto.mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(chiamata(0).url).toBe("/api/leghe");
  });

  it("se il JWT salvato dall'altra scheda è a sua volta in scadenza rinnova lo stesso", async () => {
    token.set(jwt(-10));
    vi.stubGlobal("navigator", lockDopo(() => token.set(jwt(60))));
    fetchFinto
      .mockResolvedValueOnce(ok({ token: "jwt-nuovo", user: {} }))
      .mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(chiamata(0).url).toBe("/api/auth/refresh");
    expect(header(1, "Authorization")).toBe("Bearer jwt-nuovo");
  });

  it("se la sessione viene chiusa (logout) mentre si aspettava il lock non rinnova e non ripete la richiesta", async () => {
    token.set(jwt(3600));
    vi.stubGlobal("navigator", lockDopo(() => token.clear()));
    fetchFinto.mockResolvedValueOnce(errore(401, SCADUTO));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401, message: SCADUTO });
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it("un 409 dal rinnovo (gara persa con un'altra richiesta) non cancella il token", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      .mockResolvedValueOnce(errore(409, "Sessione già rinnovata da un'altra richiesta: riprova"));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(fetchFinto).toHaveBeenCalledTimes(2);
    expect(token.get()).not.toBeNull();
  });

  it("se il rinnovo risponde 401 ma un'altra scheda ha già salvato un JWT nuovo, non cancella il token e ripete la richiesta", async () => {
    token.set(jwt(3600));
    const jwtAltraScheda = jwt(1800);
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      // mentre il nostro rinnovo fallisce (cookie già ruotato), l'altra scheda ha salvato il suo JWT
      .mockImplementationOnce(async () => { token.set(jwtAltraScheda); return errore(401, "Sessione scaduta: accedi di nuovo"); })
      .mockResolvedValueOnce(ok([{ id: "l1" }]));
    await expect(api("/api/leghe")).resolves.toEqual([{ id: "l1" }]);
    expect(token.get()).toBe(jwtAltraScheda);
    expect(header(2, "Authorization")).toBe(`Bearer ${jwtAltraScheda}`);
  });

  it("un logout arrivato durante il rinnovo vince: il JWT nuovo non viene salvato e la sessione rinnovata viene chiusa", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      // mentre il server rinnova, l'utente esce (in questa o in un'altra scheda): il token locale sparisce
      .mockImplementationOnce(async () => { token.clear(); return ok({ token: "jwt-nuovo", user: {} }); })
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(token.get()).toBeNull();
    expect(fetchFinto).toHaveBeenCalledTimes(3);
    expect(chiamata(2).url).toBe("/api/auth/logout");
    expect(chiamata(2).init.method).toBe("POST");
    expect(chiamata(2).init.keepalive).toBe(true);
  });

  it("senza Web Locks (browser vecchio o pagina non https) il rinnovo funziona lo stesso", async () => {
    vi.stubGlobal("navigator", {});
    token.set(jwt(-10));
    fetchFinto
      .mockResolvedValueOnce(ok({ token: "jwt-nuovo", user: {} }))
      .mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(chiamata(0).url).toBe("/api/auth/refresh");
    expect(header(1, "Authorization")).toBe("Bearer jwt-nuovo");
  });

  it("con il lock non utilizzabile e il JWT in scadenza la richiesta va a buon fine lo stesso", async () => {
    vi.stubGlobal("navigator", { locks: { request: () => Promise.reject(new Error("lock negato")) } });
    token.set(jwt(90));
    fetchFinto.mockResolvedValueOnce(ok([{ id: "l1" }]));
    // Il rinnovo parte in parallelo senza await: il suo fallimento non deve diventare una promise rifiutata non gestita
    await expect(api("/api/leghe")).resolves.toEqual([{ id: "l1" }]);
    await new Promise((fatto) => setTimeout(fatto, 0));
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it("se il lock non è utilizzabile il rinnovo non riesce ma non lancia eccezioni", async () => {
    vi.stubGlobal("navigator", { locks: { request: () => Promise.reject(new Error("lock negato")) } });
    token.set(jwt(-10));
    fetchFinto.mockResolvedValueOnce(errore(401, SCADUTO));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(chiamata(0).url).toBe("/api/leghe");
  });
});

describe("api: fine della sessione", () => {
  it("se il rinnovo risponde 401 chiama il gestore di fine sessione una volta sola, anche con più richieste respinte", async () => {
    const gestore = vi.fn();
    const togli = suSessioneFinita(gestore);
    try {
      token.set(jwt(3600));
      fetchFinto.mockImplementation(async (url: string) => {
        if (url === "/api/auth/refresh") return errore(401, "Sessione scaduta: accedi di nuovo");
        return errore(401, SCADUTO);
      });
      const esiti = await Promise.allSettled([api("/api/a"), api("/api/b"), api("/api/c")]);
      expect(esiti.map((e) => e.status)).toEqual(["rejected", "rejected", "rejected"]);
      // Le richieste successive partono senza token: nessun altro rinnovo e nessun'altra segnalazione
      await expect(api("/api/d")).rejects.toMatchObject({ status: 401 });
      expect(gestore).toHaveBeenCalledTimes(1);
      expect(token.get()).toBeNull();
    } finally {
      togli();
    }
  });

  it("un rinnovo non riuscito per la rete non chiude la sessione: gestore non chiamato e token lasciato", async () => {
    const gestore = vi.fn();
    const togli = suSessioneFinita(gestore);
    try {
      token.set(jwt(3600));
      fetchFinto
        .mockResolvedValueOnce(errore(401, SCADUTO))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"));
      await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
      expect(gestore).not.toHaveBeenCalled();
      expect(token.get()).not.toBeNull();
    } finally {
      togli();
    }
  });

  it("se il token è già sparito quando il rinnovo riceve 401 (uscita in corso) il gestore non viene chiamato", async () => {
    const gestore = vi.fn();
    const togli = suSessioneFinita(gestore);
    try {
      token.set(jwt(3600));
      fetchFinto
        .mockResolvedValueOnce(errore(401, SCADUTO))
        // mentre il rinnovo è in volo l'utente esce: il token sparisce e il server respinge il cookie già revocato
        .mockImplementationOnce(async () => { token.clear(); return errore(401, "Sessione scaduta: accedi di nuovo"); });
      await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
      expect(gestore).not.toHaveBeenCalled();
    } finally {
      togli();
    }
  });

  it("un gestore tolto non viene più chiamato", async () => {
    const gestore = vi.fn();
    suSessioneFinita(gestore)();
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, SCADUTO))
      .mockResolvedValueOnce(errore(401, "Sessione scaduta: accedi di nuovo"));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(gestore).not.toHaveBeenCalled();
    expect(token.get()).toBeNull();
  });
});

describe("api: tempo massimo delle richieste", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // AbortSignal.timeout di Node non segue i timer finti: lo si sostituisce con lo stesso segnale costruito su setTimeout
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      const controllo = new AbortController();
      setTimeout(() => controllo.abort(new DOMException("The operation timed out.", "TimeoutError")), ms);
      return controllo.signal;
    });
  });

  afterEach(() => {
    vi.mocked(AbortSignal.timeout).mockRestore();
    vi.useRealTimers();
  });

  it("se il rinnovo non risponde, dopo 15 secondi la richiesta fallisce con ApiError e il token resta", async () => {
    const vecchio = jwt(3600);
    token.set(vecchio);
    let sblocca = () => {};
    fetchFinto.mockImplementation((url: string, init: RequestInit) => {
      if (url !== "/api/auth/refresh") return Promise.resolve(errore(401, SCADUTO));
      // Rinnovo senza risposta: come la fetch vera si interrompe solo quando scade il segnale
      // (sblocca serve solo a non lasciare la promessa appesa se il segnale non arriva)
      return new Promise<Response>((_risolvi, rifiuta) => {
        sblocca = () => rifiuta(new TypeError("Failed to fetch"));
        init.signal?.addEventListener("abort", () => rifiuta(init.signal!.reason));
      });
    });
    let esito: unknown = "in attesa";
    const richiesta = api("/api/leghe").then(() => { esito = "riuscita"; }, (e: unknown) => { esito = e; });
    try {
      await vi.advanceTimersByTimeAsync(14_999);
      expect(esito).toBe("in attesa");
      await vi.advanceTimersByTimeAsync(1);
      expect(esito).toBeInstanceOf(ApiError);
      expect(esito).toMatchObject({ status: 401, message: SCADUTO });
      expect(token.get()).toBe(vecchio);
      expect(AbortSignal.timeout).toHaveBeenCalledWith(15_000);
    } finally {
      sblocca();
      await richiesta;
    }
  });

  it("con il JWT scaduto e il rinnovo senza risposta, le richieste che lo aspettano falliscono invece di restare in attesa", async () => {
    token.set(jwt(-10));
    // Server che non risponde mai al rinnovo; il JWT scaduto viene respinto
    fetchFinto.mockImplementation((url: string, init: RequestInit) => {
      if (url !== "/api/auth/refresh") return Promise.resolve(errore(401, SCADUTO));
      return new Promise<Response>((_risolvi, rifiuta) => {
        init.signal?.addEventListener("abort", () => rifiuta(init.signal!.reason));
      });
    });
    const esiti = Promise.allSettled([api("/api/a"), api("/api/b")]);
    // Primo rinnovo (in anticipo) interrotto dopo 15 secondi, secondo (dopo il 401) dopo altri 15
    await vi.advanceTimersByTimeAsync(30_000);
    const [a, b] = await esiti;
    expect(a).toMatchObject({ status: "rejected", reason: { status: 401 } });
    expect(b).toMatchObject({ status: "rejected", reason: { status: 401 } });
    expect(token.get()).not.toBeNull();
  });

  it("una richiesta senza risposta fallisce dopo 15 secondi con ApiError e status 0, come senza rete", async () => {
    token.set(jwt(3600));
    fetchFinto.mockImplementation((_url: string, init: RequestInit) => new Promise<Response>((_risolvi, rifiuta) => {
      init.signal?.addEventListener("abort", () => rifiuta(init.signal!.reason));
    }));
    const esito = api("/api/leghe").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await esito).toMatchObject({ status: 0, message: "Il server non risponde: controlla la connessione e riprova." });
  });

  it("anche una risposta che non finisce di arrivare entro 15 secondi è un errore di rete, non una risposta non valida", async () => {
    token.set(jwt(3600));
    // Intestazioni arrivate, corpo fermo: come nella fetch vera, il segnale interrompe anche la lettura
    fetchFinto.mockImplementation(async (_url: string, init: RequestInit) => new Response(new ReadableStream({
      start(flusso) { init.signal?.addEventListener("abort", () => flusso.error(init.signal!.reason)); },
    }), { status: 200 }));
    const esito = api("/api/leghe").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await esito).toMatchObject({ status: 0 });
  });

  it("i salvataggi in chiusura pagina (keepalive) partono senza tempo massimo", async () => {
    token.set(jwt(3600));
    fetchFinto.mockImplementation(async () => ok({ id: "t1" }));
    await api("/api/tappe/t1", { method: "PUT", body: { id: "t1" }, keepalive: true });
    await api("/api/leghe");
    expect(chiamata(0).init.signal).toBeUndefined();
    expect(chiamata(1).init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("api: risposte senza corpo JSON", () => {
  it("200 con corpo vuoto: ApiError invece di SyntaxError", async () => {
    token.set(jwt(3600));
    fetchFinto.mockResolvedValueOnce(new Response("", { status: 200 }));
    const errore = await api("/api/leghe").catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(ApiError);
    expect(errore).toMatchObject({ status: 200, message: "Risposta del server non valida" });
  });

  it("204 senza corpo continua a funzionare (DELETE e logout)", async () => {
    token.set(jwt(3600));
    fetchFinto.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api("/api/tappe/t1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("api: rinnovo automatico", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("con il JWT in scadenza e la pagina ferma, dopo 60 secondi parte un rinnovo senza alcuna richiesta", async () => {
    token.set(jwt(100));
    fetchFinto.mockResolvedValueOnce(ok({ token: "jwt-nuovo", user: {} }));
    const ferma = avviaRinnovoAutomatico();
    try {
      await vi.advanceTimersByTimeAsync(59_999);
      expect(fetchFinto).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchFinto).toHaveBeenCalledTimes(1);
      expect(chiamata(0).url).toBe("/api/auth/refresh");
      expect(token.get()).toBe("jwt-nuovo");
    } finally {
      ferma();
    }
  });

  it("non rinnova un JWT a cui mancano più di due minuti e, fermato, non controlla più", async () => {
    token.set(jwt(3600));
    const ferma = avviaRinnovoAutomatico();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchFinto).not.toHaveBeenCalled();
    ferma();
    token.set(jwt(100));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchFinto).not.toHaveBeenCalled();
  });
});
