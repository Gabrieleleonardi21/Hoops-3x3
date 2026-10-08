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
/** Tempo massimo del rinnovo del JWT e dell'attesa del server all'avvio (ms). Un avvio a freddo su Render dura in genere 30-60
 *  secondi: un rinnovo abbandonato dopo 15 il server lo esegue lo stesso, ruota il refresh token, e il cookie nuovo arriva in una
 *  risposta che nessuno legge più. Al rinnovo successivo il cookie vecchio è respinto e l'utente si trova fuori */
const ATTESA_SERVER = 90_000;
/** Pausa tra due tentativi di attendiServer (ms) */
const PAUSA_ATTESA_SERVER = 2_000;

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

/** Status dopo i quali non si sa se il server ha eseguito la richiesta: nessuna risposta (0: rete assente, tempo massimo scaduto)
 *  oppure una risposta del proxy al posto del server (502, 503, 504: dietro Render la richiesta può essere arrivata lo stesso) */
const ESITO_IGNOTO = [0, 502, 503, 504];

/** true se dopo questo errore non si sa se il server ha eseguito la richiesta. Lo usano la pubblicazione (useTappa: non si dice
 *  «non pubblicata») e la coda delle tappe (useAppStore: il corpo mandato può essere stato salvato) */
export function esitoIgnoto(e: unknown): boolean {
  return e instanceof ApiError && ESITO_IGNOTO.includes(e.status);
}

/** La richiesta non ha avuto risposta: tempo massimo scaduto, rete assente o server spento */
function erroreDiRete(e: unknown): ApiError {
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return new ApiError(0, "Il server non risponde: controlla la connessione e riprova.");
  }
  // Testo per chi usa l'app, non per chi la sviluppa: «avvia il backend» non è un'istruzione per l'utente
  return new ApiError(0, "Server non raggiungibile: controlla la connessione e riprova.");
}

/** Scarto tra l'orologio del server e quello del dispositivo, in secondi: `iat` del JWT (l'ora del server quando lo ha emesso) meno
 *  l'ora locale al suo arrivo. Il giudizio di scadenza si fa nell'ora del server: con l'orologio del dispositivo avanti un JWT valido
 *  sembrerebbe scaduto (un rinnovo a ogni controllo), con l'orologio indietro un JWT scaduto sembrerebbe valido (401 alla chiusura
 *  della pagina, quando non c'è tempo per rinnovare). Vale per la vita della pagina: si ricalcola a ogni token che arriva (accesso,
 *  registrazione, rinnovo) e torna a zero all'uscita */
let scartoOrologio = 0;

/** Il payload del JWT, letto senza verificare la firma: serve solo a decidere quando rinnovare, la verifica vera la fa il server.
 *  null se il token non si legge */
function payloadDi(t: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
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
    // Un token appena arrivato dal server dice che ora è sul server (iat): da qui lo scarto con l'orologio del dispositivo
    const iat = payloadDi(t)?.iat;
    if (typeof iat === "number") scartoOrologio = iat - Date.now() / 1000;
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    scartoOrologio = 0;
  },
};

/** Secondi che mancano alla scadenza del JWT salvato (negativi se è già scaduto), nell'ora del server (scartoOrologio); null se
 *  manca o non è leggibile */
function secondiRimasti(): number | null {
  const t = token.get();
  if (!t) return null;
  const exp = payloadDi(t)?.exp;
  if (typeof exp !== "number") return null;
  return exp - (Date.now() / 1000 + scartoOrologio);
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

/** Un gestore a uno solo posto, registrato dall'app: `imposta` ne mette uno nuovo al posto del precedente e restituisce la funzione
 *  che lo toglie (solo se è ancora lui); `chiama` lo esegue, se c'è */
function gestoreSingolo() {
  let gestore: (() => void) | null = null;
  return {
    imposta(fn: () => void): () => void {
      gestore = fn;
      return () => {
        if (gestore === fn) gestore = null;
      };
    },
    chiama() { gestore?.(); },
  };
}

/** Gestore della fine della sessione registrato dall'app (vedi suSessioneFinita) */
const gestoreFineSessione = gestoreSingolo();
/** Gestore del cambio di sessione fatto in un'altra scheda (vedi suSessioneCambiataAltrove) */
const gestoreSessioneCambiata = gestoreSingolo();

/** Registra il gestore della fine della sessione. Lo chiamano il rinnovo respinto dal server (refresh token scaduto o
 *  revocato) e, in ogni scheda, la cancellazione del token fatta da un'altra (uscita o sessione finita lì). Ce n'è uno
 *  solo: uno nuovo sostituisce il precedente.
 *  @returns la funzione che lo toglie */
export function suSessioneFinita(fn: () => void): () => void {
  return gestoreFineSessione.imposta(fn);
}

/** Registra il gestore del token che compare o sparisce per mano di un'altra scheda (accesso o uscita lì): le richieste di questa
 *  scheda cambiano senza che la scheda l'abbia deciso (da quel momento portano il Bearer, o non lo portano più), e ciò che
 *  dipende dal token, come i dati personali dell'anagrafe, va riletto. Un token solo rinnovato non conta: la sessione è la stessa.
 *  Ce n'è uno solo: uno nuovo sostituisce il precedente.
 *  @returns la funzione che lo toglie */
export function suSessioneCambiataAltrove(fn: () => void): () => void {
  return gestoreSessioneCambiata.imposta(fn);
}

/** Sveglia il backend all'apertura dell'app, senza aspettare la risposta. Sul piano free di Render il server si spegne
 *  dopo 15 minuti senza richieste e per ripartire impiega più di TEMPO_MASSIMO: partita subito, la chiamata lo
 *  riaccende mentre l'utente guarda la home, e di solito al login è già pronto. /actuator/health è pubblico e leggero:
 *  niente Bearer né tempo massimo, e gli errori (server spento in sviluppo, rete assente) si ignorano. */
export function svegliaServer(): void {
  fetch(`${BASE}/actuator/health`, { cache: "no-store" }).catch(() => {});
}

/** Aspetta che il server risponda a /actuator/health, al massimo `limite` ms: un tentativo ogni PAUSA_ATTESA_SERVER finché non
 *  risponde 200. All'avvio con una sessione salvata la verifica (che può rinnovare il JWT) parte solo dopo, così il rinnovo non
 *  incontra un server ancora spento. Non lancia mai eccezioni.
 *  @returns true se il server ha risposto, false se il tempo è finito */
export async function attendiServer(limite = ATTESA_SERVER): Promise<boolean> {
  const fine = Date.now() + limite;
  for (;;) {
    const resto = fine - Date.now();
    if (resto <= 0) return false;
    let signal: AbortSignal | undefined;
    if (typeof AbortSignal.timeout === "function") signal = AbortSignal.timeout(resto);
    try {
      const res = await fetch(`${BASE}/actuator/health`, { cache: "no-store", signal });
      if (res.ok) return true;
    } catch { /* server spento, rete assente o tempo finito: si riprova finché c'è tempo */ }
    const pausa = Math.min(PAUSA_ATTESA_SERVER, fine - Date.now());
    if (pausa > 0) await new Promise((fatto) => setTimeout(fatto, pausa));
  }
}

// Token cambiato da un'altra scheda: l'evento storage arriva solo alle altre schede dello stesso browser.
// - Token comparso o sparito (accesso o uscita lì): la sessione del browser è cambiata, e chi dipende dal token lo deve sapere.
// - Token cancellato: per tutte la sessione è finita. Un token appena rinnovato o salvato da un accesso non chiude niente
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== TOKEN_KEY) return;
    if ((e.oldValue === null) !== (e.newValue === null)) gestoreSessioneCambiata.chiama();
    if (!token.get()) gestoreFineSessione.chiama();
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
        // Tempo massimo lungo (ATTESA_SERVER): un rinnovo abbandonato che il server esegue lo stesso fa uscire l'utente
        const r = await chiama<{ token: string }>("/api/auth/refresh", { method: "POST", tempoMassimo: ATTESA_SERVER }, false);
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
          gestoreFineSessione.chiama();
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
