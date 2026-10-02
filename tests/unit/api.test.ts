import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, token } from "../../src/services/api";

/** localStorage e fetch non esistono nell'ambiente node: si sostituiscono con versioni in memoria */
const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => { memoria.set(k, v); },
  removeItem: (k: string) => { memoria.delete(k); },
});
const fetchFinto = vi.fn();
vi.stubGlobal("fetch", fetchFinto);

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
