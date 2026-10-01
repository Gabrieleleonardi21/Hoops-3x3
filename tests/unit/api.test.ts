import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, token, ApiError } from "../../src/services/api";

/** localStorage e fetch non esistono nell'ambiente node: si sostituiscono con versioni in memoria */
const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => { memoria.set(k, v); },
  removeItem: (k: string) => { memoria.delete(k); },
});
const fetchFinto = vi.fn();
vi.stubGlobal("fetch", fetchFinto);

/** JWT finto (firma non verificata dal client) che scade tra `secondi` secondi */
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
/** Lock finto tra le schede (Web Locks API): esegue subito, come quando nessun'altra scheda sta rinnovando */
const lockLibero = { locks: { request: (_nome: string, fn: () => unknown) => fn() } };

beforeEach(() => {
  memoria.clear();
  fetchFinto.mockReset();
  vi.stubGlobal("navigator", lockLibero);
});

describe("api: rinnovo del JWT con il refresh token", () => {
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
  });

  it("su 401 rinnova il token e ripete la richiesta una volta sola", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, "Sessione scaduta o token non valido: accedi di nuovo"))
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
      .mockResolvedValueOnce(errore(401, "Sessione scaduta o token non valido: accedi di nuovo"))
      .mockResolvedValueOnce(ok({ token: jwt(1800), user: {} }))
      .mockResolvedValueOnce(errore(401, "Sessione scaduta o token non valido: accedi di nuovo"));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(fetchFinto).toHaveBeenCalledTimes(3);
  });

  it("se il rinnovo risponde 401 cancella il token e rilancia il 401 originale senza ripetere", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, "Sessione scaduta o token non valido: accedi di nuovo"))
      .mockResolvedValueOnce(errore(401, "Sessione scaduta: accedi di nuovo"));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401, message: "Sessione scaduta o token non valido: accedi di nuovo" });
    expect(fetchFinto).toHaveBeenCalledTimes(2);
    expect(token.get()).toBeNull();
  });

  it("se il rinnovo fallisce per rete il token resta e l'errore originale viene rilanciato", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, "Sessione scaduta o token non valido: accedi di nuovo"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api("/api/leghe")).rejects.toBeInstanceOf(ApiError);
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

  it("rinnova in anticipo un JWT che scade entro due minuti", async () => {
    token.set(jwt(60));
    fetchFinto
      .mockResolvedValueOnce(ok({ token: "jwt-nuovo", user: {} }))
      .mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(chiamata(0).url).toBe("/api/auth/refresh");
    expect(header(1, "Authorization")).toBe("Bearer jwt-nuovo");
  });

  it("non rinnova un JWT ancora lontano dalla scadenza", async () => {
    token.set(jwt(3600));
    fetchFinto.mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it("senza token (ospite) un 401 non fa partire nessun rinnovo", async () => {
    fetchFinto.mockResolvedValueOnce(errore(401, "Autenticazione richiesta: accedi per continuare"));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it("un salvataggio keepalive (chiusura pagina) parte subito, senza aspettare il rinnovo preventivo", async () => {
    token.set(jwt(60)); // in scadenza: una richiesta normale rinnoverebbe prima
    fetchFinto.mockResolvedValueOnce(ok({ id: "t1" }));
    const richiesta = api("/api/tappe/t1", { method: "PUT", body: { id: "t1" }, keepalive: true });
    // La fetch deve essere già partita in questo stesso giro di esecuzione: quando la pagina si chiude non c'è un «dopo»
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(chiamata(0).url).toBe("/api/tappe/t1");
    expect(chiamata(0).init.keepalive).toBe(true);
    await richiesta;
  });

  it("se un'altra scheda ha già rinnovato mentre si aspettava il lock non chiama il server", async () => {
    token.set(jwt(-10)); // JWT già scaduto
    // Il lock finto simula l'altra scheda: prima di cedere il turno salva un JWT fresco in localStorage
    vi.stubGlobal("navigator", { locks: { request: (_nome: string, fn: () => unknown) => { token.set(jwt(3600)); return fn(); } } });
    fetchFinto.mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(chiamata(0).url).toBe("/api/leghe");
  });

  it("un 409 dal rinnovo (gara persa con un'altra richiesta) non cancella il token", async () => {
    token.set(jwt(3600));
    fetchFinto
      .mockResolvedValueOnce(errore(401, "Sessione scaduta o token non valido: accedi di nuovo"))
      .mockResolvedValueOnce(errore(409, "Sessione già rinnovata da un'altra richiesta: riprova"));
    await expect(api("/api/leghe")).rejects.toMatchObject({ status: 401 });
    expect(fetchFinto).toHaveBeenCalledTimes(2);
    expect(token.get()).not.toBeNull();
  });

  it("se il rinnovo risponde 401 ma un'altra scheda ha già salvato un JWT nuovo, non cancella il token e ripete la richiesta", async () => {
    token.set(jwt(3600));
    const jwtAltraScheda = jwt(1800);
    fetchFinto
      .mockResolvedValueOnce(errore(401, "Sessione scaduta o token non valido: accedi di nuovo"))
      // mentre il nostro rinnovo fallisce (cookie già ruotato), l'altra scheda ha salvato il suo JWT
      .mockImplementationOnce(async () => { token.set(jwtAltraScheda); return errore(401, "Sessione scaduta: accedi di nuovo"); })
      .mockResolvedValueOnce(ok([{ id: "l1" }]));
    await expect(api("/api/leghe")).resolves.toEqual([{ id: "l1" }]);
    expect(token.get()).toBe(jwtAltraScheda);
    expect(header(2, "Authorization")).toBe(`Bearer ${jwtAltraScheda}`);
  });

  it("senza Web Locks (browser vecchio o pagina non https) il rinnovo funziona lo stesso", async () => {
    vi.stubGlobal("navigator", {});
    token.set(jwt(60));
    fetchFinto
      .mockResolvedValueOnce(ok({ token: "jwt-nuovo", user: {} }))
      .mockResolvedValueOnce(ok([]));
    await api("/api/leghe");
    expect(chiamata(0).url).toBe("/api/auth/refresh");
    expect(header(1, "Authorization")).toBe("Bearer jwt-nuovo");
  });
});
