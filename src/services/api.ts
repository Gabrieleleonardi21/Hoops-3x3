/** Client HTTP minimale verso il backend Spring.
 *  In sviluppo le chiamate a /api passano dal proxy di Vite (vite.config.ts); in produzione
 *  VITE_API_URL resta vuoto dietro un reverse proxy sulla stessa origine e contiene l'origine
 *  del backend solo se l'API ne ha una propria.
 *  Il JWT di accesso dura poco (30 minuti) e si rinnova da solo con il refresh token, che il server
 *  imposta in un cookie httpOnly: in anticipo quando sta per scadere, oppure dopo un 401
 *  ripetendo la richiesta una sola volta.
 *  Il cookie viaggia solo se pagina e API hanno la stessa origine (proxy di Vite o reverse proxy):
 *  per origini diverse vedi «Sessioni e refresh token» nel README del backend. */

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const TOKEN_KEY = "hoop3x3_token";
/** Secondi prima della scadenza entro cui il JWT viene rinnovato in anticipo */
const MARGINE_SCADENZA = 120;

/** Errore HTTP con lo status del server; status 0 = rete assente / server spento */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Token JWT in localStorage: sopravvive al reload, sparisce al logout.
 *  Lo condividono tutte le schede: finché c'è, in questo browser la sessione è aperta. */
export const token = {
  get: (): string | null => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string) => { localStorage.setItem(TOKEN_KEY, t); },
  clear: () => { localStorage.removeItem(TOKEN_KEY); },
};

/** Secondi che mancano alla scadenza del JWT salvato (negativi se è già scaduto); null se manca o non è
 *  leggibile. La scadenza (exp) si legge dal payload senza verificare la firma: serve solo a decidere
 *  quando rinnovare, la verifica vera la fa il server. */
function secondiRimasti(): number | null {
  const t = token.get();
  if (!t) return null;
  try {
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp !== "number") return null;
    return payload.exp - Date.now() / 1000;
  } catch {
    return null;
  }
}

/** true se il JWT salvato è già scaduto */
function scaduto(): boolean {
  const resto = secondiRimasti();
  return resto !== null && resto <= 0;
}

/** true se il JWT salvato scade entro MARGINE_SCADENZA secondi (o è già scaduto) */
function inScadenza(): boolean {
  const resto = secondiRimasti();
  return resto !== null && resto < MARGINE_SCADENZA;
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** true: la richiesta prosegue anche se la pagina si chiude (salvataggi in uscita) */
  keepalive?: boolean;
}

/** Login, registrazione, refresh e logout non usano il JWT: partono senza Bearer e senza rinnovi */
const isAuth = (path: string) => path.startsWith("/api/auth/") && path !== "/api/auth/me";

/** Una chiamata JSON senza rinnovi; conBearer = allega il JWT salvato.
 *  Il cookie di refresh lo gestisce il browser: lo invia e lo salva da solo sulle chiamate alla stessa origine. */
async function chiama<T>(path: string, opts: Options, conBearer: boolean): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const t = token.get();
  if (conBearer && t) headers.Authorization = `Bearer ${t}`;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      keepalive: opts.keepalive,
    });
  } catch {
    throw new ApiError(0, "Server non raggiungibile: controlla la connessione o avvia il backend.");
  }

  if (!res.ok) {
    // Il backend risponde sempre {message, timestamp}; se il corpo manca si usa lo status
    let message = `Errore ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.message === "string") message = data.message;
    } catch { /* corpo non JSON */ }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Esegue il rinnovo tenendo il lock condiviso tra le schede (Web Locks API); dove manca
 *  (browser vecchi, pagine non https) lo esegue senza lock */
async function conLock(fn: () => Promise<boolean>): Promise<boolean> {
  // await: per TypeScript request() restituisce una promise di promise, a runtime è una sola
  if (typeof navigator !== "undefined" && navigator.locks) return await navigator.locks.request("hoop3x3_refresh", fn);
  return fn();
}

let rinnovoInCorso: Promise<boolean> | null = null;

/** Chiede un nuovo JWT con il cookie di refresh. Una sola chiamata in volo per scheda (promise condivisa)
 *  e una sola per browser (lock): se nel frattempo un'altra scheda ha rinnovato, si usa il suo JWT.
 *  Non lancia mai eccezioni. false = sessione finita (401 dal server: token cancellato), sessione chiusa
 *  da un logout nel frattempo, oppure rinnovo non riuscito per rete, gara o lock non utilizzabile
 *  (token lasciato). */
function rinnova(): Promise<boolean> {
  if (!rinnovoInCorso) {
    const tokenVecchio = token.get();
    rinnovoInCorso = conLock(async () => {
      const attuale = token.get();
      // Sessione chiusa mentre si aspettava il lock (logout in questa o in un'altra scheda)
      if (!attuale) return false;
      // Un'altra scheda ha rinnovato mentre si aspettava il lock: il suo JWT è già in localStorage
      if (attuale !== tokenVecchio && !inScadenza()) return true;
      try {
        const r = await chiama<{ token: string }>("/api/auth/refresh", { method: "POST" }, false);
        // Logout arrivato durante il rinnovo: vince il logout. Il JWT nuovo non si salva e la sessione
        // appena rinnovata si chiude sul server, altrimenti resterebbe aperta dopo l'uscita
        // (keepalive: la chiusura parte anche se intanto la scheda viene chiusa)
        if (!token.get()) {
          await chiama<void>("/api/auth/logout", { method: "POST", keepalive: true }, false).catch(() => {});
          return false;
        }
        token.set(r.token);
        return true;
      } catch (e) {
        // Rinnovo fallito ma un'altra scheda ha già salvato un JWT nuovo (gara persa dove manca il lock):
        // la sessione è viva, si usa il suo token e non si cancella nulla
        const dopo = token.get();
        if (dopo && dopo !== tokenVecchio) return true;
        if (e instanceof ApiError && e.status === 401) token.clear();
        return false;
      }
    })
      .catch(() => false) // lock non utilizzabile o errore imprevisto: il rinnovo risulta non riuscito
      .finally(() => { rinnovoInCorso = null; });
  }
  return rinnovoInCorso;
}

/** Esegue una chiamata JSON rinnovando il JWT quando serve e converte gli errori in ApiError */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  if (isAuth(path)) return chiama<T>(path, opts, false);
  // Rinnovo preventivo, mai per i salvataggi in chiusura pagina (keepalive), che devono partire subito.
  // JWT già scaduto: si aspetta il rinnovo, altrimenti la richiesta fallirebbe. JWT ancora valido ma vicino
  // alla scadenza: il rinnovo parte in parallelo e la richiesta non aspetta
  if (!opts.keepalive) {
    if (scaduto()) await rinnova();
    else if (inScadenza()) void rinnova();
  }
  try {
    return await chiama<T>(path, opts, true);
  } catch (e) {
    // Rinnovo reattivo: il server ha respinto il JWT; dopo il rinnovo la richiesta si ripete una volta sola
    if (!(e instanceof ApiError) || e.status !== 401 || !token.get()) throw e;
    const rinnovato = await rinnova();
    if (!rinnovato) throw e;
    return chiama<T>(path, opts, true);
  }
}
