/** Client HTTP minimale verso il backend Spring.
 *  In sviluppo le chiamate a /api passano dal proxy di Vite (vite.config.ts); in produzione
 *  VITE_API_URL resta vuoto dietro un reverse proxy sulla stessa origine e contiene l'origine
 *  del backend solo se l'API ne ha una propria.
 *  Il JWT di accesso dura poco (30 minuti) e si rinnova da solo con il refresh token, che il server
 *  imposta in un cookie httpOnly: in anticipo quando sta per scadere (anche a pagina ferma, con
 *  avviaRinnovoAutomatico), oppure dopo un 401 ripetendo la richiesta una sola volta. Ogni richiesta ha
 *  un tempo massimo; quando il server respinge anche il refresh token la sessione è finita e l'app lo
 *  sa dal gestore registrato con suSessioneFinita.
 *  Il cookie viaggia solo se pagina e API hanno la stessa origine (proxy di Vite o reverse proxy):
 *  per origini diverse vedi «Sessioni e refresh token» nel README del backend. */

import { SPAZIO_ESAURITO_ACCESSO } from "../utils/testi";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const TOKEN_KEY = "hoop3x3_token";
/** Secondi prima della scadenza entro cui il JWT viene rinnovato in anticipo */
const MARGINE_SCADENZA = 120;
/** Tempo massimo di una richiesta, lettura della risposta compresa (ms) */
const TEMPO_MASSIMO = 15_000;

/** Errore HTTP con lo status del server; status 0 = rete assente, server spento o che non risponde entro TEMPO_MASSIMO */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Testo dell'errore per l'utente: il messaggio del server o della rete (ApiError), altrimenti uno generico. Lo usano lo store
 *  delle leghe e le pagine che mostrano un errore, così il testo di un errore è lo stesso ovunque. */
export function testoErrore(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "errore imprevisto";
}

/** La richiesta non ha avuto risposta: tempo massimo scaduto, rete assente o server spento */
function erroreDiRete(e: unknown): ApiError {
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return new ApiError(0, "Il server non risponde: controlla la connessione e riprova.");
  }
  return new ApiError(0, "Server non raggiungibile: controlla la connessione o avvia il backend.");
}

/** Token JWT in localStorage: sopravvive al reload, sparisce al logout.
 *  Lo condividono tutte le schede: finché c'è, in questo browser la sessione è aperta. */
export const token = {
  get: (): string | null => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  /** Salva il JWT. Se il browser rifiuta la scrittura (spazio esaurito) lancia un ApiError 507 con il motivo, che il modulo d'accesso
   *  mostra com'è: il JWT non si tiene solo in memoria, perché la sessione non sopravvivrebbe al ricaricamento né alle altre schede. */
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      throw new ApiError(507, SPAZIO_ESAURITO_ACCESSO);
    }
  },
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
  /** Tempo massimo in ms, lettura della risposta compresa: TEMPO_MASSIMO se manca, null = nessun limite */
  tempoMassimo?: number | null;
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
  // Tempo massimo su ogni richiesta, rinnovo e uscita compresi: una risposta che non arriva non tiene più in attesa le
  // richieste che aspettano il rinnovo, né le altre schede ferme sul suo lock, né «Esci». Chi chiama può indicarne uno
  // suo (tempoMassimo): più lungo per la chat del Coach, che aspetta il modello, nessuno (null) per i salvataggi in
  // chiusura pagina, che devono arrivare al server anche se è lento. Una richiesta keepalive con il limite (revoca
  // all'uscita) prosegue lo stesso a pagina chiusa: lì il timer non scatta più. Dove AbortSignal.timeout manca
  // (Safari prima della 16) la richiesta parte senza limite, come prima, invece di fallire
  let limite: number | null = TEMPO_MASSIMO;
  if (opts.tempoMassimo !== undefined) limite = opts.tempoMassimo;
  let signal: AbortSignal | undefined;
  if (limite !== null && typeof AbortSignal.timeout === "function") signal = AbortSignal.timeout(limite);

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      keepalive: opts.keepalive,
      signal,
    });
  } catch (e) {
    throw erroreDiRete(e);
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

  // 204: nessun corpo (DELETE, logout). Le altre risposte riuscite hanno sempre un corpo JSON
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch (e) {
    // Corpo non JSON, anche vuoto: chi chiama riceve un ApiError come per ogni altro errore, non un SyntaxError.
    // Una lettura interrotta dal tempo massimo resta invece un errore di rete
    if (e instanceof SyntaxError) throw new ApiError(res.status, "Risposta del server non valida");
    throw erroreDiRete(e);
  }
}

/** Esegue il rinnovo tenendo il lock condiviso tra le schede (Web Locks API); dove manca
 *  (browser vecchi, pagine non https) lo esegue senza lock */
async function conLock(fn: () => Promise<boolean>): Promise<boolean> {
  // await: per TypeScript request() restituisce una promise di promise, a runtime è una sola
  if (typeof navigator !== "undefined" && navigator.locks) return await navigator.locks.request("hoop3x3_refresh", fn);
  return fn();
}

/** Gestore della fine della sessione registrato dall'app (vedi suSessioneFinita) */
let gestoreFineSessione: (() => void) | null = null;

/** Registra il gestore della fine della sessione. Lo chiamano il rinnovo respinto dal server (refresh token scaduto o
 *  revocato) e, in ogni scheda, la cancellazione del token fatta da un'altra (uscita o sessione finita lì). Ce n'è uno
 *  solo: uno nuovo sostituisce il precedente.
 *  @returns la funzione che lo toglie */
export function suSessioneFinita(fn: () => void): () => void {
  gestoreFineSessione = fn;
  return () => {
    if (gestoreFineSessione === fn) gestoreFineSessione = null;
  };
}

// Token cancellato da un'altra scheda: l'evento storage arriva solo alle altre schede dello stesso browser, e per
// tutte la sessione è finita. Un token appena rinnovato o salvato da un accesso non chiude niente
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY && !token.get()) gestoreFineSessione?.();
  });
}

let rinnovoInCorso: Promise<boolean> | null = null;

/** Chiede un nuovo JWT con il cookie di refresh. Una sola chiamata in volo per scheda (promise condivisa)
 *  e una sola per browser (lock): se nel frattempo un'altra scheda ha rinnovato, si usa il suo JWT.
 *  Non lancia mai eccezioni. false = sessione finita (401 dal server: token cancellato e gestore di fine sessione
 *  chiamato), sessione chiusa da un logout nel frattempo, oppure rinnovo non riuscito per rete, tempo massimo,
 *  gara o lock non utilizzabile (token lasciato). */
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
        // Refresh token respinto: la sessione è finita sul server e l'app lo deve sapere (ritorno al form). Se il token
        // è già sparito non c'è niente da segnalare: un'uscita in questa scheda è già in corso, e per una sessione
        // chiusa in un'altra scheda arriva l'evento storage
        if (e instanceof ApiError && e.status === 401 && dopo) {
          token.clear();
          gestoreFineSessione?.();
        }
        return false;
      }
    })
      .catch(() => false) // lock non utilizzabile o errore imprevisto: il rinnovo risulta non riuscito
      .finally(() => { rinnovoInCorso = null; });
  }
  return rinnovoInCorso;
}

/** Ogni quanto il rinnovo automatico controlla la scadenza del JWT (ms) */
const INTERVALLO_RINNOVO = 60_000;

/** Rinnovo automatico. Senza, il JWT si rinnova solo quando parte una richiesta: con la pagina ferma negli ultimi
 *  2 minuti della sua vita scade, e una modifica seguita dalla chiusura della pagina va persa (il salvataggio in
 *  chiusura parte subito, senza aspettare il rinnovo). Controlla il JWT ogni 60 secondi e quando la scheda torna
 *  visibile (il browser rallenta i timer delle schede nascoste); se scade entro MARGINE_SCADENZA lo rinnova.
 *  @returns la funzione che lo ferma (all'uscita) */
export function avviaRinnovoAutomatico(): () => void {
  const controlla = () => {
    if (inScadenza()) void rinnova();
  };
  const alRitornoSullaScheda = () => {
    if (document.visibilityState === "visible") controlla();
  };
  const timer = setInterval(controlla, INTERVALLO_RINNOVO);
  document.addEventListener("visibilitychange", alRitornoSullaScheda);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", alRitornoSullaScheda);
  };
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
