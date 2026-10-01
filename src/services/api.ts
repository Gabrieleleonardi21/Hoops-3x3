/** Client HTTP minimale verso il backend Spring.
 *  In sviluppo le chiamate a /api passano dal proxy di Vite (vite.config.ts);
 *  in produzione si imposta VITE_API_URL con l'origine del server.
 *  Il JWT di accesso dura poco (30 minuti) e si rinnova da solo con il refresh token, che il server
 *  tiene in un cookie httpOnly: prima di una richiesta se sta per scadere, oppure dopo un 401
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

/** Scadenza (exp, in secondi) letta dal payload del JWT senza verificarne la firma: serve solo a decidere
 *  quando rinnovarlo in anticipo, la verifica vera la fa il server. null se il token non è leggibile. */
function scadenzaDi(jwt: string): number | null {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp === "number") return payload.exp;
    return null;
  } catch {
    return null;
  }
}

/** Token JWT in localStorage: sopravvive al reload, sparisce al logout */
export const token = {
  get: (): string | null => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string) => { localStorage.setItem(TOKEN_KEY, t); },
  clear: () => { localStorage.removeItem(TOKEN_KEY); },
  /** true se il JWT salvato scade entro MARGINE_SCADENZA secondi (o è già scaduto) */
  inScadenza: (): boolean => {
    const t = token.get();
    if (!t) return false;
    const exp = scadenzaDi(t);
    if (exp === null) return false;
    return exp - Date.now() / 1000 < MARGINE_SCADENZA;
  },
};

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
 *  false = sessione finita (401: token cancellato) oppure rinnovo non riuscito per rete o gara (token lasciato). */
export function rinnova(): Promise<boolean> {
  if (!rinnovoInCorso) {
    const tokenVecchio = token.get();
    rinnovoInCorso = conLock(async () => {
      // Un'altra scheda ha rinnovato mentre si aspettava il lock: il suo JWT è già in localStorage
      if (token.get() !== tokenVecchio && !token.inScadenza()) return true;
      try {
        const r = await chiama<{ token: string }>("/api/auth/refresh", { method: "POST" }, false);
        token.set(r.token);
        return true;
      } catch (e) {
        // Rinnovo fallito ma un'altra scheda ha già salvato un JWT nuovo (gara persa dove manca il lock):
        // la sessione è viva, si usa il suo token e non si cancella nulla
        const attuale = token.get();
        if (attuale && attuale !== tokenVecchio) return true;
        if (e instanceof ApiError && e.status === 401) token.clear();
        return false;
      }
    }).finally(() => { rinnovoInCorso = null; });
  }
  return rinnovoInCorso;
}

/** Esegue una chiamata JSON rinnovando il JWT quando serve e converte gli errori in ApiError */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  if (isAuth(path)) return chiama<T>(path, opts, false);
  // Rinnovo preventivo: un JWT che sta per scadere si cambia prima di usarlo. Non per i salvataggi in
  // chiusura pagina (keepalive): devono partire subito, e un JWT in scadenza è ancora valido
  if (!opts.keepalive && token.inScadenza()) await rinnova();
  try {
    return await chiama<T>(path, opts, true);
  } catch (e) {
    // Rinnovo reattivo: il JWT è scaduto nel frattempo; dopo il rinnovo la richiesta si ripete una volta sola
    if (!(e instanceof ApiError) || e.status !== 401 || !token.get()) throw e;
    const rinnovato = await rinnova();
    if (!rinnovato) throw e;
    return chiama<T>(path, opts, true);
  }
}
