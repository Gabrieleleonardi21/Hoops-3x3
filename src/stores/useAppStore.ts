import { create } from "zustand";
import type { LegaMeta, Partita, Tappa, User } from "../types";
import { uid } from "../utils/uid";
import { replaceById } from "../utils/replaceById";
import { legheApi } from "../services/legheApi";
import { archivioApi } from "../services/archivioApi";
import { ApiError, esitoIgnoto, testoErrore } from "../services/api";
import { createSaveQueue } from "./saveQueue";
import { leggiLegaSalvata, type LegaSalvata } from "../utils/legaFile";
import { impronta } from "../utils/stessaTappa";
import {
  SPAZIO_ESAURITO, SPAZIO_ESAURITO_CAMBIO, SPAZIO_ESAURITO_LEGA, eliminazioneTappaInConflitto, pubblicazioneSenzaSalvataggio,
  salvataggioRifiutato, tappaEliminataAltrove, tappaModificataAltrove,
} from "../utils/testi";

/**
 * Store globale: utente, indice leghe e lega attiva con le sue tappe.
 * Le azioni aggiornano SUBITO lo stato in memoria (la UI resta reattiva) e poi persistono:
 *  - ospite  → localStorage, come nelle versioni precedenti
 *  - registrato → backend REST (legheApi); creazione e modifiche delle tappe passano dalla coda
 *    dei salvataggi (saveQueue.ts): una raffica di input diventa un solo invio, mai due richieste
 *    insieme per la stessa tappa, nuovi tentativi se la rete o il server hanno un problema temporaneo.
 * Gli errori finiscono in `syncError`, le tappe non ancora salvate in `inSospeso` ed `erroreSalvataggio`, i salvataggi rifiutati dal
 * server in `avvisoRifiutate` (tutti mostrati da SyncBanner in App). `syncError` porta anche gli avvisi sui dati dell'ospite nel browser: letti
 * (tappe non valide scartate, lega illeggibile) e scritti (spazio esaurito: la modifica resta in memoria ma non è salvata),
 * e quelli dei conflitti con un altro dispositivo.
 * Ogni tappa del server ha una `versione` (T2.7): la PUT manda quella dell'ultima risposta, e se nel frattempo un altro
 * dispositivo ha salvato il server risponde 409. Allora si rilegge la lega e vale la tappa del server, con un avviso, a meno
 * che il conflitto non l'abbia causato questo client (un suo salvataggio rimasto senza risposta): vedi dopoUnConflitto.
 */
interface AppState {
  user: User | null;
  legaId: string | null;    // ID della lega attualmente aperta
  leghe: LegaMeta[];        // indice di tutte le leghe dell'utente
  legaName: string;
  tappe: Tappa[];
  /** false mentre si caricano i dati dal server dopo login/reload (per i registrati) */
  ready: boolean;
  syncError: string | null;
  /** Ospite: la lega aperta ha modifiche che il browser non ha salvato (spazio esaurito) e che esistono solo in memoria. È la
   *  protezione, separata dal testo dell'avviso: la X della barra chiude il testo (`syncError`), non questo. Finché è vero, aprire,
   *  creare o importare un'altra lega prova prima a salvare quella aperta, e «Esci» chiede conferma. Torna falso solo con una
   *  scrittura riuscita che contiene la lega aperta, con l'eliminazione della lega aperta e all'uscita (reset) */
  spazioEsaurito: boolean;
  /** Avvisi dei conflitti con un altro dispositivo (T2.7), una frase per tappa, finché non si chiudono. Stanno a parte da
   *  `syncError`: un errore arrivato dopo non deve nascondere che delle modifiche sono state scartate */
  avvisoConflitti: string | null;
  chiudiAvvisoConflitti: () => void;
  /** Salvataggi di tappe rifiutati dal server (dati non validi), una frase per tappa. Viene da `rifiutate` e dura quanto il rifiuto:
   *  non si chiude a mano, perché sul server resta la versione di prima finché la tappa non si salva, si elimina o si riapre la lega.
   *  Sta a parte da `syncError`, come i conflitti: un errore meno grave arrivato dopo non lo deve coprire */
  avvisoRifiutate: string | null;
  /** Tappe con modifiche non ancora confermate dal server (coda dei salvataggi) */
  inSospeso: number;
  /** Motivo dell'ultimo salvataggio non riuscito per un problema temporaneo (rete, sessione, server):
   *  torna null da solo quando la coda ha salvato tutto */
  erroreSalvataggio: string | null;
  setUser: (u: User | null) => void;
  clearSyncError: () => void;
  /** Salva subito le modifiche in attesa (tappe e rinomina della lega) e aspetta le richieste in corso
   *  (logout, «Riprova ora», apertura di una lega).
   *  @returns quante tappe hanno ancora modifiche non salvate: quelle in attesa e quelle il cui salvataggio il server ha rifiutato
   *  (la coda le dà per smaltite, ma sul server c'è la versione di prima), ognuna una volta */
  salvaTutto: () => Promise<number>;
  /** Pubblica la tappa (già conclusa) nell'Archivio circuito. Prima salva tutto e aspetta la coda: la copia pubblica la costruisce il
   *  server da ciò che ha salvato, quindi deve avere l'ultima versione. Se la tappa non arriva al server (rete assente, dati
   *  rifiutati) non pubblica e rifiuta con il motivo; rifiuta anche con l'errore dell'archivio (409 se la tappa non risulta conclusa
   *  sul server). Anche la rinomina della lega in attesa parte prima, ma non si controlla: se la PATCH fallisce l'errore compare solo
   *  nella barra degli avvisi e la copia pubblica porta il nome che il server ha. Lo usano la pagina della tappa e il Coach,
   *  con lo stesso ordine. */
  pubblica: (tappaId: string) => Promise<void>;
  createLega: (nome: string) => Promise<string>;
  selectLega: (id: string) => Promise<void>;
  deleteLega: (id: string) => Promise<void>;
  setLegaName: (nome: string) => void;
  addTappa: (t: Tappa) => void;
  /** Modifica una tappa. `modifica` è l'insieme dei campi da cambiare oppure una funzione `(tappa) => tappa`: la
   *  funzione riceve la tappa com'è nello store nel momento in cui viene applicata, non una copia letta prima
   *  (magari vecchia), e serve quando il nuovo valore dipende da ciò che c'è già, come l'elenco delle squadre. */
  updateTappa: (id: string, modifica: Partial<Tappa> | ((tappa: Tappa) => Tappa)) => void;
  /** Aggiorna una singola partita in modo atomico, evita race condition in chiamate parallele. */
  updateTappaPartita: (tappaId: string, partitaId: string, patch: Partial<Partita>) => void;
  /** Crea una nuova lega con nome e tappe di un file importato. Le tappe arrivano da leggiFileLega (utils/legaFile), che le ha
   *  già controllate e ha dato loro id nuovi: con gli id del file, ripristinare una lega esportata che esiste ancora avrebbe
   *  il 409 del server. Chi la chiama con altre tappe deve darne id nuovi. */
  importLega: (nome: string, tappe: Tappa[]) => Promise<void>;
  replaceTappa: (t: Tappa) => void;
  removeTappa: (id: string) => void;
  reset: () => void;
  /** Ricarica leghe e lega attiva (localStorage per l'ospite, server per i registrati) */
  rehydrate: () => Promise<void>;
}

export const SESSION_KEY = "hoop3x3_session";
const NS = "hoop3x3_";
const INDEX_KEY  = NS + "leghe_index";   // indice leghe dell'ospite
// ID della lega aperta per ultima: una chiave per l'ospite e una per il registrato. Con una sola, chi passava da una modalità
// all'altra su questo browser trovava l'id dell'altra (un id locale non esiste sul server e viceversa) e lo cancellava.
// Quella dell'ospite è la storica, già nei browser di chi usa l'app senza account.
const ACTIVE_KEY_OSPITE = NS + "active_lega_id";
const ACTIVE_KEY_REGISTRATO = NS + "active_lega_id_registrato";

const legaStorageKey = (id: string) => NS + `lega_${id}`;

/* ── localStorage (ospite) ─────────────────────────────────────────────────── */

function readIndex(): LegaMeta[] {
  try {
    const indice: unknown = JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
    // Solo le voci con un id: un indice rovinato (non un elenco, voci vuote) non si può mostrare né aprire
    if (Array.isArray(indice)) return indice.filter((m) => typeof m?.id === "string");
  } catch { /* JSON rovinato */ }
  return [];
}

/** Scrive nel localStorage. false se il browser rifiuta (spazio esaurito, archivio disattivato): chi scrive non deve andare in
 *  errore, perché lo stato in memoria resta giusto e le azioni dell'utente vanno comunque a buon fine */
function scrivi(chiave: string, valore: string): boolean {
  try {
    localStorage.setItem(chiave, valore);
    return true;
  } catch {
    return false;
  }
}

/** Lega dell'ospite dal browser, controllata con lo schema del file di lega (utils/legaFile): solo le tappe valide, e un avviso
 *  se ne ha scartata qualcuna. null se non c'è o non si legge. */
function readLegaData(id: string): LegaSalvata | null {
  try { return leggiLegaSalvata(JSON.parse(localStorage.getItem(legaStorageKey(id)) || "null")); }
  catch { return null; }
}

/** Perché una lega dell'ospite non si apre, con la via d'uscita: eliminarla dall'elenco */
function legaIllegibile(leghe: LegaMeta[], id: string): string {
  const nome = leghe.find((m) => m.id === id)?.nome || "senza nome";
  return `I dati della lega «${nome}» non ci sono più nel browser o sono danneggiati: puoi eliminarla dall'elenco delle leghe.`;
}

type StatoOspite = Pick<AppState, "leghe" | "legaId" | "legaName" | "tappe" | "syncError">;

/** Stato dell'ospite letto dal browser: indice delle leghe e lega aperta per ultima. Una lega che non si legge non si apre, e
 *  l'avviso in `syncError` (la barra sotto l'intestazione) dice perché; una con tappe non valide si apre senza quelle, e
 *  l'avviso dice quali. Così all'avvio non ci sono pagine bianche né un errore che torna a ogni ricarica. */
function statoOspite(): StatoOspite {
  const leghe = readIndex();
  const vuoto: StatoOspite = { leghe, legaId: null, legaName: "", tappe: [], syncError: null };
  const activeId = localStorage.getItem(ACTIVE_KEY_OSPITE);
  if (!activeId) return vuoto;
  const letta = readLegaData(activeId);
  if (letta) return { leghe, legaId: activeId, legaName: letta.lega.nome, tappe: letta.lega.tappe, syncError: letta.avviso };
  // Non si riapre a ogni ricarica; dell'id si dice qualcosa solo se la lega è nell'elenco: se non c'è più (eliminata da un'altra
  // scheda) è un id rimasto, non un problema
  localStorage.removeItem(ACTIVE_KEY_OSPITE);
  if (!leghe.some((m) => m.id === activeId)) return vuoto;
  return { ...vuoto, syncError: legaIllegibile(leghe, activeId) };
}

function readSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/** Stato iniziale sincrono: l'ospite ha già tutto in localStorage, il registrato aspetta rehydrate() */
function getInitialState(): Pick<AppState, "user" | "legaId" | "leghe" | "legaName" | "tappe" | "ready" | "syncError"> {
  const empty = { user: null, legaId: null, leghe: [], legaName: "", tappe: [], ready: true, syncError: null };
  const user = readSession();
  if (!user) return empty;
  if (!user.guest) return { ...empty, user, ready: false };
  return { ...empty, user, ...statoOspite() };
}

/* ── Salvataggi sul server (registrati) ───────────────────────────────────── */

/** Attesa dopo l'ultima modifica prima di salvare una tappa o rinominare la lega */
const SAVE_DELAY = 400;

/** Errori temporanei, per cui la coda riprova: rete assente (status 0), guasto del server (5xx) e JWT respinto
 *  senza un rinnovo riuscito (401). Con il 401 la modifica resta in attesa invece di essere scartata: il rinnovo
 *  può essere fallito solo per la rete e, se la sessione è finita davvero, il logout la conta tra quelle perse.
 *  Gli altri rifiuti riguardano i dati: ripetere la stessa richiesta non servirebbe. */
function riprovabile(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 0 || e.status === 401 || e.status >= 500);
}

/** 409 del server. Sulla PUT e sulla DELETE di una tappa vuol dire che sul server è cambiata («modificata da un altro dispositivo», o
 *  il messaggio generico «I dati sono stati modificati o eliminati…»); sulla POST che esiste già (T1.6). Si distinguono dal metodo */
const conflitto = (e: unknown): e is ApiError => e instanceof ApiError && e.status === 409;

/** 404 del server: la tappa (o la sua lega) non c'è */
const nonTrovata = (e: unknown): e is ApiError => e instanceof ApiError && e.status === 404;

/** 400 della PUT senza versione: la tappa è stata caricata da una pagina aperta prima dell'aggiornamento del server (T2.7). Si
 *  riconosce dal messaggio del server, perché gli altri 400 sono dati rifiutati */
const mancaVersione = (e: unknown): e is ApiError =>
  e instanceof ApiError && e.status === 400 && e.message.startsWith("Manca la versione della tappa");

/** Quanti corpi mandati senza risposta si ricordano per tappa. Bastano per una ripartenza di Render (circa un minuto, qualche
 *  tentativo); oltre si tengono gli ultimi: i più vecchi vengono da una lunga assenza di rete e al server non sono mai arrivati */
const TETTO_SENZA_RISPOSTA = 20;

/** Una tappa riletta dalla lega dopo un conflitto, con il posto che ha nella lega sul server */
interface TappaLetta {
  tappa: Tappa;
  posizione: number;
}

const initial = getInitialState();

export const useAppStore = create<AppState>((set, get) => {
  const isRemote = () => {
    const u = get().user;
    return !!u && !u.guest;
  };

  const reportError = (e: unknown, cosa: string) => {
    set({ syncError: `${cosa}: ${testoErrore(e)}` });
  };

  /** Le modifiche dell'ospite non sono più solo in memoria: la protezione (spazioEsaurito) si abbassa e l'avviso «spazio esaurito»
   *  sparisce, perché da lì direbbe il falso. Gli altri avvisi non si toccano. La chiamano solo una scrittura riuscita che contiene
   *  la lega aperta (salvaLegaAperta, scriviLegaNuova), l'eliminazione della lega aperta e il cambio senza una lega aperta */
  const spazioTornato = () => {
    set({ spazioEsaurito: false });
    if (get().syncError === SPAZIO_ESAURITO) set({ syncError: null });
  };
  /** Scrive i dati dell'ospite nel browser, una coppia (chiave, valore) per scrittura. Se il browser ne rifiuta una (spazio esaurito)
   *  l'azione riesce lo stesso, in memoria, e la barra degli avvisi dice che non è salvata: l'app non va in errore. Si tentano tutte,
   *  anche dopo un rifiuto (una scrittura piccola può riuscire dove una grande no). Non toglie mai l'avviso né la protezione: lo fa
   *  solo salvaLegaAperta, perché una scrittura che riesce non prova che la lega aperta sia salvata.
   *  @returns true se sono riuscite tutte */
  const scriviOspite = (...coppie: [string, string][]): boolean => {
    const riuscite = coppie.map(([chiave, valore]) => scrivi(chiave, valore));
    if (riuscite.includes(false)) {
      set({ syncError: SPAZIO_ESAURITO, spazioEsaurito: true });
      return false;
    }
    return true;
  };
  /** Scrive la lega aperta e l'indice. Solo se riesce tutto le modifiche sono davvero nel browser, e l'avviso dello spazio non dice
   *  più il vero: l'indice da solo (eliminando un'altra lega) o la lega aperta ricordata non bastano, perché le modifiche della lega
   *  aperta potrebbero essere ancora solo in memoria. */
  const salvaLegaAperta = (...coppie: [string, string][]) => {
    if (scriviOspite(...coppie)) spazioTornato();
  };
  const writeIndex = (leghe: LegaMeta[]) => scriviOspite([INDEX_KEY, JSON.stringify(leghe)]);
  /** Scrive i dati e l'indice di una lega nuova dell'ospite (creata o importata): tutto o niente. Senza spazio non si crea niente,
   *  e l'errore dice perché, come per ogni altro rifiuto: l'ospite non ha un server, e 507 è lo stato che userebbe (come il 404 di
   *  una lega che non si legge). Se i dati entrano ma l'indice no, i dati si tolgono: una lega fuori dall'indice si aprirebbe al
   *  ricaricamento senza comparire nell'elenco, e passando a un'altra resterebbe irraggiungibile, a occupare spazio. */
  const scriviLegaNuova = (id: string, contenuto: { nome: string; tappe: Tappa[] }, leghe: LegaMeta[]) => {
    const chiave = legaStorageKey(id);
    if (!scrivi(chiave, JSON.stringify(contenuto))) throw new ApiError(507, SPAZIO_ESAURITO_LEGA);
    if (!scrivi(INDEX_KEY, JSON.stringify(leghe))) {
      localStorage.removeItem(chiave);
      throw new ApiError(507, SPAZIO_ESAURITO_LEGA);
    }
    spazioTornato();
  };

  /** Ospite: prima di aprire, creare o importare un'altra lega. Con la protezione alzata (spazioEsaurito, anche se l'avviso è stato
   *  chiuso con la X) le modifiche della lega aperta esistono solo in memoria, e il cambio le sostituirebbe (riaprendo la stessa lega,
   *  con la versione vecchia salvata nel browser): in silenzio. Quindi si prova a salvarla: se riesce, protezione e avviso spariscono e
   *  si procede; se no, non si cambia niente e l'errore dice perché (lo mostrano le pagine che chiamano). Senza la protezione non c'è
   *  niente da salvare. */
  const salvaLegaApertaPrimaDelCambio = () => {
    if (!get().spazioEsaurito) return;
    if (!get().legaId) {
      spazioTornato(); // nessuna lega aperta: non c'è niente da salvare
      return;
    }
    persistLocal();
    if (get().spazioEsaurito) throw new ApiError(507, SPAZIO_ESAURITO_CAMBIO);
  };

  /** Chiave della lega aperta per ultima, di chi usa l'app adesso */
  const chiaveAttiva = () => {
    if (isRemote()) return ACTIVE_KEY_REGISTRATO;
    return ACTIVE_KEY_OSPITE;
  };
  /** Ricorda la lega aperta, per riaprirla alla prossima visita. Per il registrato è solo una comodità (i dati stanno sul server):
   *  se il browser rifiuta la scrittura non si dice niente */
  const ricordaLega = (id: string) => {
    if (isRemote()) {
      scrivi(ACTIVE_KEY_REGISTRATO, id);
      return;
    }
    scriviOspite([ACTIVE_KEY_OSPITE, id]);
  };

  /** Ospite: salva la lega attiva su localStorage e aggiorna nTappe/ts nell'indice */
  const persistLocal = () => {
    const s = get();
    if (!s.legaId) return;
    const leghe = s.leghe.map((m) =>
      m.id === s.legaId ? { ...m, nTappe: s.tappe.length, ts: Date.now() } : m
    );
    salvaLegaAperta([legaStorageKey(s.legaId), JSON.stringify({ nome: s.legaName, tappe: s.tappe })], [INDEX_KEY, JSON.stringify(leghe)]);
    set({ leghe });
  };

  /** Tappe aggiunte la cui POST non è ancora confermata dal server: id → id della lega */
  const daCreare = new Map<string, string>();
  /** Tappe eliminate prima che il server confermasse la creazione: se la POST era già in volo e riesce,
   *  la tappa va cancellata subito dopo (una DELETE partita prima arriverebbe su una tappa ancora da creare) */
  const eliminatePrimaDellaCreazione = new Set<string>();

  /* ── Versioni delle tappe e conflitti tra dispositivi (T2.7) ──
   * Le voci di `sulServer` e `sostituite` per una tappa eliminata restano fino all'uscita (reset): non si leggono più. */

  /** Per ogni tappa del server, la sua lega e la sua versione come le ha dette l'ultima risposta (GET della lega, POST, PUT,
   *  rilettura dopo un conflitto). È la versione su cui si basano le modifiche locali: la PUT la rimanda così com'è, senza
   *  calcolarla, e non scende mai (versioneDaRicordare). Sta qui e non nella copia della tappa in coda, che può essere stata fatta
   *  prima dell'ultima risposta; la tappa dello store ne tiene una copia (`versione`). undefined = il server non l'ha mandata
   *  (backend precedente a T2.7). La lega serve a rileggere la tappa dopo un conflitto anche se intanto se ne è aperta un'altra. */
  const sulServer = new Map<string, { legaId: string; versione: number | undefined }>();
  /** Corpi di una tappa partiti senza che se ne sia letta la risposta (esitoIgnoto: tempo scaduto, rete caduta, 502-504; keepalive
   *  alla chiusura della pagina), dall'ultima risposta riuscita: il server può averli salvati. Dopo un 409 (sulla PUT, sulla POST o
   *  sulla DELETE) dicono se il conflitto l'ha causato questo client. Si tengono tutti, non solo l'ultimo: quando Render riparte le
   *  richieste trattenute arrivano insieme, la prima salva e le altre ricevono 409, quindi il corpo salvato è il più vecchio di
   *  quelle. Senza doppioni e al massimo TETTO_SENZA_RISPOSTA per tappa (inviataSenzaRisposta). */
  const senzaRisposta = new Map<string, Tappa[]>();
  /** Tappe sostituite dalla versione del server, o tolte perché eliminate altrove, dopo un conflitto: id → frase dell'avviso. La
   *  pubblicazione durante la quale arriva il conflitto non parte (pubblica) */
  const sostituite = new Map<string, string>();
  /** Le frasi dell'avviso dei conflitti ancora aperto (avvisoConflitti), una per tappa: id → frase */
  const avvisiConflitto = new Map<string, string>();
  /** DELETE di tappe non ancora confermate dal server, in attesa della fine della richiesta in volo della loro tappa o già partite
   *  (eliminaDopo): id → attesa. salvaTutto, prima di «Esci», le aspetta, così il token c'è ancora quando partono; alla chiusura della
   *  pagina partono con keepalive (pagehide), altrimenti si perderebbero e la tappa ricomparirebbe */
  const eliminazioniInAttesa = new Map<string, Promise<void>>();

  /** La lega di una tappa: quella detta dal server, oppure quella in cui la tappa si sta creando, oppure la lega aperta */
  const legaDi = (id: string): string | null => sulServer.get(id)?.legaId ?? daCreare.get(id) ?? get().legaId;

  /** La versione da ricordare per una tappa: quella nuova, ma mai più bassa di una già nota. Sul server le versioni salgono
   *  soltanto: una risposta arrivata fuori ordine (una lettura della lega partita prima di un salvataggio) non la riporta indietro */
  const versioneDaRicordare = (id: string, versione: number | undefined): number | undefined => {
    const nota = sulServer.get(id)?.versione;
    if (nota === undefined) return versione;
    if (versione === undefined || versione < nota) return nota;
    return versione;
  };

  /** true se la tappa arriva da una lettura più vecchia della versione nota: i suoi dati sono superati da un salvataggio di qui */
  const piuVecchiaDellaNota = (t: Tappa): boolean => {
    const nota = sulServer.get(t.id)?.versione;
    return nota !== undefined && t.versione !== undefined && t.versione < nota;
  };

  /** Ricorda lega e versione di una tappa dette dal server e mette la versione anche sulla tappa dello store. Solo la versione: i
   *  dati in memoria possono essere più recenti della risposta (modifiche fatte mentre la richiesta era in volo) */
  const ricordaVersione = (legaId: string, id: string, nuova: number | undefined) => {
    const versione = versioneDaRicordare(id, nuova);
    sulServer.set(id, { legaId, versione });
    const attuale = get().tappe.find((x) => x.id === id);
    if (!attuale || attuale.versione === versione) return; // fuori dalla lega aperta, o già quella: niente da ridisegnare
    set((s) => ({ tappe: replaceById(s.tappe, { ...attuale, versione }) }));
  };

  /** Le tappe appena lette dal server, con la loro versione: da qui le loro modifiche si basano su quella */
  const ricordaTappe = (legaId: string, tappe: Tappa[]) => {
    for (const t of tappe) sulServer.set(t.id, { legaId, versione: versioneDaRicordare(t.id, t.versione) });
  };

  /** La tappa con la versione nota (sulServer), non con quella della copia: è il corpo della PUT e la tappa da mettere nello store */
  const conVersione = (t: Tappa): Tappa => {
    const nota = sulServer.get(t.id);
    if (!nota) return t;
    return { ...t, versione: nota.versione };
  };

  /** Il corpo è partito ma la risposta non si è letta: il server può averlo salvato. La stessa copia rimandata (nuovi tentativi,
   *  «Riprova ora», chiusura della pagina) si conta una volta; oltre il tetto escono i corpi più vecchi */
  const inviataSenzaRisposta = (t: Tappa) => {
    const inviate = senzaRisposta.get(t.id) ?? [];
    if (inviate.includes(t)) return;
    senzaRisposta.set(t.id, [...inviate, t].slice(-TETTO_SENZA_RISPOSTA));
  };

  /** I corpi senza risposta di una tappa, tolti dalla mappa: chi li prende decide il conflitto, e dopo non servono più */
  const prendiSenzaRisposta = (id: string): Tappa[] => {
    const inviate = senzaRisposta.get(id) ?? [];
    senzaRisposta.delete(id);
    return inviate;
  };

  /** true se la tappa del server è uno dei corpi mandati da questo client senza risposta. Il confronto è quello del server
   *  (impronta), versione esclusa; l'impronta della tappa del server si calcola una volta sola */
  const unoDeiNostri = (inviate: Tappa[], delServer: Tappa): boolean => {
    const daServer = impronta(delServer);
    return inviate.some((x) => impronta(x) === daServer);
  };

  /** Risposta riuscita di una POST o di una PUT: da qui le modifiche locali si basano sulla sua versione, e i corpi rimasti senza
   *  risposta non contano più (il server ha la versione appena confermata) */
  const confermata = (t: Tappa, risposta: Tappa | undefined) => {
    senzaRisposta.delete(t.id);
    const legaId = legaDi(t.id);
    if (legaId) ricordaVersione(legaId, t.id, risposta?.versione);
  };

  /** Aggiunge la frase di una tappa all'avviso dei conflitti, che le nomina tutte finché non si chiude (chiudiAvvisoConflitti). Una
   *  frase nuova per la stessa tappa sostituisce quella di prima */
  const avvisaConflitto = (id: string, frase: string) => {
    avvisiConflitto.set(id, frase);
    set({ avvisoConflitti: [...avvisiConflitto.values()].join(" ") });
  };

  /** La tappa com'è adesso sul server, riletta dalla lega (non c'è un GET della singola tappa), con il suo posto nella lega; null se
   *  non c'è più. Lancia l'errore della lettura */
  const tappaSulServer = async (legaId: string, id: string): Promise<TappaLetta | null> => {
    const lega = await legheApi.get(legaId);
    const posizione = lega.tappe.findIndex((x) => x.id === id);
    if (posizione < 0) return null;
    return { tappa: lega.tappe[posizione], posizione };
  };

  /** Conflitto risolto a favore del server: la tappa riletta prende il posto di quella locale, con la sua versione, e le modifiche in
   *  sospeso nella coda si scartano (rimandarle cancellerebbe il lavoro dell'altro; una richiesta già in volo finisce da sola). Una
   *  tappa che non è più nello store (DELETE respinta) torna al posto che ha sul server. Solo nella lega aperta: se intanto se ne è
   *  aperta un'altra resta l'avviso */
  const applicaQuellaDelServer = (legaId: string, letta: TappaLetta, frase: string) => {
    const { tappa, posizione } = letta;
    ricordaTappe(legaId, [tappa]);
    coda.annulla(tappa.id);
    senzaRisposta.delete(tappa.id);
    avvisaConflitto(tappa.id, frase);
    if (get().legaId !== legaId) return;
    if (get().tappe.some((x) => x.id === tappa.id)) {
      set((s) => ({ tappe: replaceById(s.tappe, tappa) }));
      return;
    }
    set((s) => ({ tappe: [...s.tappe.slice(0, posizione), tappa, ...s.tappe.slice(posizione)] }));
    touchIndex();
  };

  /** Conflitto con un altro dispositivo su un salvataggio: vale la tappa del server (applicaQuellaDelServer), con l'avviso, e la
   *  pubblicazione in corso non parte (pubblica) */
  const vinceIlServer = (legaId: string, letta: TappaLetta) => {
    const frase = tappaModificataAltrove(letta.tappa.nome);
    sostituite.set(letta.tappa.id, frase);
    applicaQuellaDelServer(legaId, letta, frase);
  };

  /** Dopo un 409 la tappa non c'è più sul server: l'ha eliminata un altro dispositivo. Esce anche da qui, con l'avviso: le sue
   *  modifiche non si possono più salvare, e lasciarla darebbe un 404 a ogni modifica */
  const eliminataAltrove = (legaId: string, t: Tappa) => {
    coda.annulla(t.id);
    senzaRisposta.delete(t.id);
    const frase = tappaEliminataAltrove(t.nome);
    sostituite.set(t.id, frase);
    avvisaConflitto(t.id, frase);
    if (get().legaId !== legaId || !get().tappe.some((x) => x.id === t.id)) return;
    set((s) => ({ tappe: s.tappe.filter((x) => x.id !== t.id) }));
    touchIndex();
  };

  /** La tappa l'ha eliminata l'utente qui: la sua lega è quella aperta, ma nello store non c'è più (removeTappa) */
  const eliminataQui = (legaId: string, id: string) => get().legaId === legaId && !get().tappe.some((x) => x.id === id);

  /** Dopo un 409 (sulla PUT, o sulla POST di una tappa già creata) o un 400 «Manca la versione» rilegge la lega e decide:
   *  - il conflitto è di questo client se la versione mancava (pagina aperta prima dell'aggiornamento del server), oppure se la tappa
   *    del server è uno dei corpi mandati senza risposta (salvato quando il client aveva già rinunciato, per esempio mentre Render
   *    ripartiva): si prende la versione del server e si rimanda lo stato locale, senza avviso (true);
   *  - altrimenti l'ha cambiata un altro dispositivo e vale la tappa del server, con l'avviso (vinceIlServer: false);
   *  - se sul server non c'è più, l'ha eliminata un altro dispositivo (eliminataAltrove: false);
   *  - se nel frattempo l'ha eliminata l'utente qui, niente avviso né invii (false): i corpi senza risposta restano alla DELETE, che
   *    parte dopo (removeTappa).
   *  Dopo un nuovo invio (`rimandata`) non si rimanda più: resta la seconda strada. Se la lega non si legge lancia l'errore della
   *  lettura: se è temporaneo la coda riprova, e i corpi senza risposta restano per allora. */
  const dopoUnConflitto = async (t: Tappa, errore: ApiError, rimandata: boolean): Promise<boolean> => {
    const legaId = legaDi(t.id);
    if (!legaId) throw errore;
    const letta = await tappaSulServer(legaId, t.id);
    if (eliminataQui(legaId, t.id)) return false;
    if (!letta) {
      eliminataAltrove(legaId, t);
      return false;
    }
    const inviate = prendiSenzaRisposta(t.id);
    if (!rimandata && (mancaVersione(errore) || unoDeiNostri(inviate, letta.tappa))) {
      ricordaVersione(legaId, t.id, letta.tappa.versione);
      return true;
    }
    vinceIlServer(legaId, letta);
    return false;
  };

  /** Dopo un 404 della PUT su una tappa ancora qui: il server controlla l'esistenza della tappa prima della versione, quindi una tappa
   *  eliminata da un altro dispositivo dà 404 e non 409. Si rilegge la lega per esserne certi: se la tappa non c'è più esce anche da
   *  qui, con l'avviso (eliminataAltrove: true); se l'utente l'ha eliminata qui nel frattempo non c'è niente da dire (true); se c'è
   *  ancora, false, e l'errore resta quello della PUT. Se la lega non si legge lancia l'errore della lettura: se è temporaneo la coda
   *  riprova */
  const eliminataSulServer = async (t: Tappa): Promise<boolean> => {
    const legaId = legaDi(t.id);
    if (!legaId) return false;
    if (await tappaSulServer(legaId, t.id)) return false;
    if (!eliminataQui(legaId, t.id)) eliminataAltrove(legaId, t);
    return true;
  };

  /** PUT della tappa con la versione nota. Dopo un 409, o un 400 «Manca la versione» al primo invio, si rilegge la lega
   *  (dopoUnConflitto) e si rimanda al massimo una volta: se anche quell'invio fallisce vale la gestione degli errori di sempre,
   *  tranne un altro 409, dopo il quale vale la tappa del server. Dopo un 404 si rilegge la lega (eliminataSulServer) */
  const aggiornaSulServer = async (t: Tappa, rimandata = false): Promise<void> => {
    try {
      confermata(t, await legheApi.putTappa(conVersione(t)));
    } catch (e) {
      if (esitoIgnoto(e)) inviataSenzaRisposta(t);
      // Si rilegge la lega dopo ogni 409, e dopo un 400 «Manca la versione» solo al primo invio
      if (conflitto(e) || (mancaVersione(e) && !rimandata)) {
        if (await dopoUnConflitto(t, e, rimandata)) await aggiornaSulServer(t, true);
        return;
      }
      // Un 404 atteso (la tappa o la sua lega eliminate qui) non chiede la rilettura: lo lascia passare eliminataNelFrattempo
      if (nonTrovata(e) && !eliminataNelFrattempo(e, t) && await eliminataSulServer(t)) return;
      throw e;
    }
  };

  /** POST di una tappa nuova. Un 409 vuol dire che la tappa esiste già, e si rilegge la lega (dopoUnConflitto). Se la tappa del
   *  server è uno dei corpi mandati senza risposta (la risposta di una POST precedente si è persa) si fa come in T1.6: si passa alla
   *  PUT con questa copia, che è la più recente, e con la versione letta. Altrimenti nel frattempo l'ha cambiata un altro
   *  dispositivo: vince il server, con l'avviso. */
  const creaSulServer = async (legaId: string, t: Tappa) => {
    try {
      confermata(t, await legheApi.addTappa(legaId, t));
    } catch (e) {
      if (esitoIgnoto(e)) inviataSenzaRisposta(t);
      if (!conflitto(e)) throw e;
      if (await dopoUnConflitto(t, e, false)) await aggiornaSulServer(t, true);
    }
  };

  /** 409 sulla DELETE: un salvataggio della tappa è arrivato al server nello stesso istante, e la tappa resta. Si rilegge la lega:
   *  - se la tappa non c'è più non c'è niente da fare;
   *  - se è uno dei corpi mandati da questo client senza risposta, il salvataggio era suo (Render che riparte): si rimanda la DELETE
   *    una volta, senza avviso;
   *  - altrimenti l'ha salvata un altro dispositivo: torna al suo posto com'è sul server, con l'avviso.
   *  Se la lega non si legge resta l'errore della DELETE */
  const dopoUnaDeleteInConflitto = async (id: string, legaId: string, errore: ApiError, inviate: Tappa[], rimandata: boolean) => {
    let letta: TappaLetta | null;
    try {
      letta = await tappaSulServer(legaId, id);
    } catch {
      reportError(errore, "Eliminazione tappa non riuscita");
      return;
    }
    if (!letta) return;
    if (!rimandata && unoDeiNostri(inviate, letta.tappa)) {
      await mandaDelete(id, legaId, [], true);
      return;
    }
    applicaQuellaDelServer(legaId, letta, eliminazioneTappaInConflitto(letta.tappa.nome));
  };

  /** La DELETE di una tappa; `inviate` sono i suoi corpi rimasti senza risposta, per decidere dopo un 409 */
  const mandaDelete = (id: string, legaId: string | null, inviate: Tappa[], rimandata: boolean): Promise<void> =>
    legheApi.removeTappa(id).catch(async (e: unknown) => {
      // 404: sul server la tappa non c'è già più (per esempio l'ha eliminata la DELETE partita alla chiusura della pagina)
      if (e instanceof ApiError && e.status === 404) return;
      if (!conflitto(e) || !legaId) {
        reportError(e, "Eliminazione tappa non riuscita");
        return;
      }
      await dopoUnaDeleteInConflitto(id, legaId, e, inviate, rimandata);
    });

  /** Elimina la tappa sul server, con i corpi rimasti senza risposta: da qui la tappa non li usa più */
  const eliminaSulServer = (id: string, legaId: string | null): Promise<void> =>
    mandaDelete(id, legaId, prendiSenzaRisposta(id), false);

  /** La DELETE parte quando è finita la richiesta in volo della tappa, se ce n'è una (coda.annulla la restituisce): arrivando
   *  insieme a un salvataggio avrebbe un 409. Senza richiesta in volo parte subito. Finché il server non la conferma resta in
   *  eliminazioniInAttesa (salvaTutto e chiusura della pagina) */
  const eliminaDopo = (inVolo: Promise<void> | null, id: string) => {
    const legaId = legaDi(id); // letta subito: intanto si può aprire un'altra lega
    let attesa: Promise<void>;
    if (inVolo) attesa = inVolo.then(() => eliminaSulServer(id, legaId));
    else attesa = eliminaSulServer(id, legaId);
    eliminazioniInAttesa.set(id, attesa);
    void attesa.finally(() => {
      if (eliminazioniInAttesa.get(id) === attesa) eliminazioniInAttesa.delete(id);
    });
  };

  /** Invio di una copia della tappa (lo chiama la coda, una richiesta alla volta per tappa): POST finché la creazione non è
   *  confermata, poi PUT con la versione nota. La PUT non parte prima che la POST abbia dato la prima versione. */
  const salvaSulServer = async (t: Tappa) => {
    const legaId = daCreare.get(t.id);
    if (legaId === undefined) {
      await aggiornaSulServer(t);
      return;
    }
    await creaSulServer(legaId, t);
    daCreare.delete(t.id);
    if (eliminatePrimaDellaCreazione.delete(t.id)) eliminaDopo(null, t.id);
  };

  /** Leghe la cui DELETE è partita da qui e non è ancora finita (deleteLega): le loro tappe stanno per andarsene con loro */
  const legheInEliminazione = new Set<string>();

  /** Un 404 per una tappa che non è più nello stato, o la cui lega si sta eliminando, non è un salvataggio fallito: la tappa è
   *  stata eliminata e non c'è più niente da salvare. Da questo client succede eliminando la sua lega (anche con un nuovo tentativo
   *  partito durante la DELETE, quando la tappa è ancora nello stato), dopo una DELETE della tappa partita alla chiusura della
   *  pagina, oppure quando la tappa l'ha eliminata un altro dispositivo e qui è già uscita */
  const eliminataNelFrattempo = (e: unknown, t: Tappa) => {
    if (!nonTrovata(e)) return false;
    const lega = legaDi(t.id);
    if (lega !== null && legheInEliminazione.has(lega)) return true;
    return !get().tappe.some((x) => x.id === t.id);
  };

  /** Tappe il cui ultimo salvataggio il server ha rifiutato (dati non validi): id → nome mandato, motivo e lega (letta al rifiuto: dopo,
   *  la lega aperta può essere un'altra). La coda non riprova e le dà per smaltite, ma sul server c'è ancora la versione di prima:
   *  pubblicarla metterebbe in archivio una versione vecchia, e uscire la perderebbe («Esci» le conta, salvaTutto). Una voce si toglie
   *  quando: un salvataggio della tappa riesce; si apre una lega (selectLega: le sue tappe arrivano dal server, e quelle che non ci
   *  sono più non contano); la tappa o la lega si eliminano (removeTappa, deleteLega); si esce (reset). Ogni cambio passa da rifiuta
   *  e togliRifiutata, che tengono la riga della barra (avvisoRifiutate) uguale alla mappa. */
  const rifiutate = new Map<string, { nome: string; motivo: string; legaId: string | null }>();

  /** La riga dei salvataggi rifiutati, rifatta dalla mappa */
  const mostraRifiutate = () => {
    const frasi = [...rifiutate.values()].map(({ nome, motivo }) => salvataggioRifiutato(nome, motivo));
    set({ avvisoRifiutate: frasi.join(" ") || null });
  };
  const rifiuta = (t: Tappa, e: unknown) => {
    rifiutate.set(t.id, { nome: t.nome, motivo: testoErrore(e), legaId: legaDi(t.id) });
    mostraRifiutate();
  };
  /** Il rifiuto della tappa non vale più; la riga si rifà solo se c'era */
  const togliRifiutata = (id: string) => {
    if (rifiutate.delete(id)) mostraRifiutate();
  };
  /** Toglie i rifiuti delle tappe della lega, tranne quelli delle tappe che `resta` tiene */
  const togliRifiutateDellaLega = (legaId: string, resta: (id: string) => boolean = () => false) => {
    for (const [id, voce] of [...rifiutate]) {
      if (voce.legaId === legaId && !resta(id)) togliRifiutata(id);
    }
  };

  const coda = createSaveQueue({
    salva: (t) => salvaSulServer(t).then(
      () => { togliRifiutata(t.id); },
      (e: unknown) => {
        if (eliminataNelFrattempo(e, t)) return;
        if (!riprovabile(e)) rifiuta(t, e);
        throw e;
      },
    ),
    riprovabile,
    ritardo: SAVE_DELAY,
    // Un rifiuto (definitivo) è già nella sua riga, da rifiuta: qui solo i problemi temporanei, che la coda riprova
    onErrore: (e, definitivo) => {
      if (definitivo) return;
      set({ erroreSalvataggio: testoErrore(e) });
    },
    // Coda vuota = tutto confermato dal server: l'avviso del salvataggio non riuscito sparisce da solo
    onInSospeso: (inSospeso) => {
      if (inSospeso === 0) { set({ inSospeso, erroreSalvataggio: null }); return; }
      set({ inSospeso });
    },
  });

  /** Punto d'ingresso unico per «questa tappa è cambiata, salvala»: localStorage per l'ospite,
   *  coda dei salvataggi per il registrato, con la versione della tappa presente adesso nello stato */
  const afterTappaChange = (tappaId: string) => {
    if (!isRemote()) { persistLocal(); return; }
    const t = get().tappe.find((x) => x.id === tappaId);
    if (t) coda.accoda(t);
  };

  /** Tappe di una lega appena arrivate dal server, con sopra le versioni locali non ancora confermate: senza,
   *  lo schermo tornerebbe alla versione del server e la modifica successiva sostituirebbe in coda quella
   *  con i risultati. `locali` = le versioni in attesa lette prima della GET (un nuovo tentativo partito durante
   *  la GET può salvarle dopo che il server ha già letto la versione vecchia) e quelle non confermate a GET finita, comprese le
   *  richieste ancora in volo (C1): la loro risposta alza la versione nota senza toccare i dati, quindi i dati devono essere già i
   *  loro. A parità di tappa vale l'ultima dell'elenco. `nuove` = tappe della lega non ancora create sul server, assenti dalla risposta.
   *  La versione segue i dati: una tappa del server porta la sua, una versione locale quella su cui si basa (con quella del server
   *  cancellerebbe in silenzio il lavoro di un altro dispositivo; così la sua PUT riceve il 409 e decide dopoUnConflitto).
   *  Una tappa letta con una versione più vecchia di quella nota viene da una lettura partita prima di un salvataggio riuscito di
   *  qui: i suoi dati sono superati, e resta quella dello store.
   *  Una tappa dello store creata sul server durante la GET (sulServer la dà in questa lega, ma prima della GET non c'era: `notePrima`)
   *  manca dalla risposta se la GET l'ha letta prima della POST: resta. Una che il server conosceva già prima della GET e che manca
   *  l'ha eliminata un altro dispositivo: esce, come prima. */
  const conVersioniLocali = (
    legaId: string, dalServer: Tappa[], locali: Tappa[], nuove: Tappa[], notePrima: Set<string>,
  ): Tappa[] => {
    const perId = new Map(locali.map((t) => [t.id, t]));
    const tappe = dalServer.map((t) => {
      const locale = perId.get(t.id);
      if (locale) return conVersione(locale);
      const nelloStore = get().tappe.find((x) => x.id === t.id);
      if (nelloStore && piuVecchiaDellaNota(t)) return conVersione(nelloStore);
      ricordaTappe(legaId, [t]);
      return conVersione(t);
    });
    const manca = (id: string) => !tappe.some((x) => x.id === id);
    for (const t of nuove) {
      if (manca(t.id)) tappe.push(perId.get(t.id) ?? t);
    }
    for (const t of get().tappe) {
      const creataDuranteLaGet = sulServer.get(t.id)?.legaId === legaId && !notePrima.has(t.id);
      if (creataDuranteLaGet && manca(t.id)) tappe.push(conVersione(perId.get(t.id) ?? t));
    }
    return tappe;
  };

  /** Aggiorna nTappe/ts della lega attiva nell'indice in memoria (il server lo fa da sé) */
  const touchIndex = () => {
    const s = get();
    set({ leghe: s.leghe.map((m) => m.id === s.legaId ? { ...m, nTappe: s.tappe.length, ts: Date.now() } : m) });
  };

  // Chiusura pagina: le versioni non ancora confermate dal server partono subito con keepalive (POST per le tappe non
  // ancora create), comprese quelle di una richiesta in corso, che il browser interrompe chiudendo la pagina. Restano in
  // coda: se la pagina torna dalla cache del browser vengono rinviate, e rinviarle non fa danni (la PUT sostituisce
  // tutta la tappa, una POST già arrivata riceve un 409). La risposta non si legge: se il server le salva, il rinvio con la
  // versione di prima riceve un 409 che dopoUnConflitto riconosce come proprio (sono tra i corpi senza risposta)
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      for (const t of coda.nonConfermate()) {
        inviataSenzaRisposta(t);
        const legaId = daCreare.get(t.id);
        if (legaId === undefined) {
          legheApi.putTappa(conVersione(t), true).catch(() => {});
          continue;
        }
        legheApi.addTappa(legaId, t, true).catch(() => {});
      }
      // Le DELETE non ancora confermate, comprese quelle che aspettano un salvataggio in volo: senza keepalive si perderebbero e la
      // tappa ricomparirebbe. Se la pagina torna dalla cache del browser la DELETE in attesa parte lo stesso, e il suo 404 si tollera
      for (const id of eliminazioniInAttesa.keys()) legheApi.removeTappa(id, true).catch(() => {});
    });
  }

  let renameTimer = 0;
  /** PATCH della rinomina che aspetta il suo timer; null se non ce n'è */
  let rinominaInAttesa: (() => Promise<void>) | null = null;

  /** Manda subito la rinomina in attesa, se c'è: allo scadere del timer, oppure da salvaTutto prima del logout,
   *  quando il token sta per sparire */
  const rinomina = async () => {
    window.clearTimeout(renameTimer);
    const invio = rinominaInAttesa;
    rinominaInAttesa = null;
    if (invio) await invio();
  };

  return {
    ...initial,
    inSospeso: 0,
    erroreSalvataggio: null,
    avvisoConflitti: null,
    avvisoRifiutate: null,
    spazioEsaurito: false,

    setUser: (user) => set({ user }),
    clearSyncError: () => set({ syncError: null }),
    chiudiAvvisoConflitti: () => {
      avvisiConflitto.clear();
      set({ avvisoConflitti: null });
    },

    salvaTutto: async () => {
      // Anche le DELETE che aspettano un salvataggio in volo: prima di «Esci» devono partire con il token
      await Promise.all([coda.svuota(), rinomina(), ...eliminazioniInAttesa.values()]);
      // Una tappa rifiutata e poi modificata di nuovo, ancora in attesa, è in tutti e due gli elenchi: conta una volta
      return new Set([...coda.inAttesa().map((t) => t.id), ...rifiutate.keys()]).size;
    },

    pubblica: async (tappaId) => {
      // Conta solo un conflitto arrivato durante questo salvataggio: dopo uno di prima l'utente ha già davanti la tappa del server
      sostituite.delete(tappaId);
      await get().salvaTutto();
      // Il salvataggio di questa tappa non è andato a buon fine (rete assente: è ancora in coda; dati rifiutati: la coda l'ha
      // scartata; conflitto con un altro dispositivo: ora c'è la tappa del server, diversa da quella che si voleva pubblicare):
      // la pubblicazione non parte. Le modifiche in sospeso di altre tappe non c'entrano
      const rifiutata = rifiutate.get(tappaId)?.motivo;
      const sostituita = sostituite.get(tappaId);
      const inCoda = coda.inAttesa().some((t) => t.id === tappaId);
      if (inCoda || rifiutata !== undefined || sostituita !== undefined) {
        // 412 (precondizione non soddisfatta): errore nostro, non del server; testoErrore ne mostra il messaggio
        throw new ApiError(412, pubblicazioneSenzaSalvataggio(rifiutata ?? sostituita ?? get().erroreSalvataggio));
      }
      await archivioApi.pubblica(tappaId);
    },

    createLega: async (nome) => {
      const trimmed = nome.trim() || "Nuova lega";
      if (isRemote()) {
        const meta = await legheApi.create(trimmed);
        ricordaLega(meta.id);
        set({ legaId: meta.id, leghe: [meta, ...get().leghe], legaName: meta.nome, tappe: [] });
        return meta.id;
      }
      salvaLegaApertaPrimaDelCambio();
      const id = uid();
      const meta: LegaMeta = { id, nome: trimmed, ts: Date.now(), nTappe: 0 };
      const leghe = [...get().leghe, meta];
      scriviLegaNuova(id, { nome: trimmed, tappe: [] }, leghe);
      ricordaLega(id);
      set({ legaId: id, leghe, legaName: trimmed, tappe: [] });
      return id;
    },

    selectLega: async (id) => {
      if (isRemote()) {
        // Prima si salva ciò che è in attesa: quello che resta (rete assente) è più recente della risposta del server
        await get().salvaTutto();
        const inCoda = coda.inAttesa();
        // Le tappe della lega che il server conosce già prima della GET: se mancano dalla risposta sono state eliminate altrove
        const notePrima = new Set(get().tappe.filter((t) => sulServer.get(t.id)?.legaId === id).map((t) => t.id));
        const lega = await legheApi.get(id);
        // Dopo la GET: anche le versioni in volo e le tappe aggiunte nel frattempo, con la POST ancora da confermare (C1)
        const locali = [...inCoda, ...coda.nonConfermate()];
        const nuove = locali.filter((t) => daCreare.get(t.id) === id);
        const tappe = conVersioniLocali(id, lega.tappe, locali, nuove, notePrima);
        // Le tappe arrivano com'è sul server: un vecchio rifiuto del loro salvataggio non vale più, e non deve bloccare la pubblicazione.
        // Nemmeno quello di una tappa della lega che non c'è più (mai creata sul server): non resta niente da salvare
        for (const t of lega.tappe) togliRifiutata(t.id);
        togliRifiutateDellaLega(id, (tid) => tappe.some((t) => t.id === tid));
        ricordaLega(id);
        set({ legaId: id, legaName: lega.nome, tappe });
        return;
      }
      salvaLegaApertaPrimaDelCambio();
      const letta = readLegaData(id);
      // L'ospite non ha un server: una lega che nel browser non c'è o è rovinata si segnala come la segnalerebbe il server
      // (404), e la pagina mostra il motivo come per ogni altro errore
      if (!letta) throw new ApiError(404, legaIllegibile(get().leghe, id));
      ricordaLega(id);
      set({ legaId: id, legaName: letta.lega.nome, tappe: letta.lega.tappe, syncError: letta.avviso });
    },

    deleteLega: async (id) => {
      if (isRemote()) {
        // Durante la DELETE un nuovo tentativo di salvataggio di una sua tappa riceve 404: non è un errore (eliminataNelFrattempo)
        legheInEliminazione.add(id);
        try {
          await legheApi.remove(id);
        } finally {
          legheInEliminazione.delete(id);
        }
      } else {
        localStorage.removeItem(legaStorageKey(id));
      }
      const leghe = get().leghe.filter((m) => m.id !== id);
      if (!isRemote()) writeIndex(leghe);
      // I rifiuti delle tappe della lega non valgono più, anche se non è quella aperta: non c'è più niente da salvare
      togliRifiutateDellaLega(id);
      if (get().legaId === id) {
        // Le tappe se ne vanno con la lega: i loro salvataggi in attesa o in nuovo tentativo partirebbero dopo la DELETE
        // e avrebbero un 404 (la POST, su una lega che non c'è più), cioè un errore per dati eliminati apposta
        for (const t of get().tappe) {
          coda.annulla(t.id);
          senzaRisposta.delete(t.id);
          daCreare.delete(t.id);
        }
        localStorage.removeItem(chiaveAttiva());
        set({ leghe, legaId: null, legaName: "", tappe: [] });
        spazioTornato(); // la lega con le modifiche non salvate non c'è più: avviso e protezione non dicono più il vero
      } else {
        set({ leghe });
      }
    },

    setLegaName: (legaName) => {
      set({ legaName });
      const s = get();
      if (!s.legaId) return;
      const leghe = s.leghe.map((m) => m.id === s.legaId ? { ...m, nome: legaName, ts: Date.now() } : m);
      set({ leghe });
      if (isRemote()) {
        // L'input chiama setLegaName a ogni tasto: una sola PATCH a fine digitazione (o prima, da salvaTutto)
        const legaId = s.legaId;
        rinominaInAttesa = async () => {
          try {
            await legheApi.rename(legaId, get().legaName.trim() || "Lega");
          } catch (e) {
            reportError(e, "Rinomina lega non riuscita");
          }
        };
        window.clearTimeout(renameTimer);
        renameTimer = window.setTimeout(() => { void rinomina(); }, SAVE_DELAY);
        return;
      }
      salvaLegaAperta([legaStorageKey(s.legaId), JSON.stringify({ nome: legaName, tappe: s.tappe })], [INDEX_KEY, JSON.stringify(leghe)]);
    },

    addTappa: (t) => {
      set((s) => ({ tappe: [...s.tappe, t] }));
      if (isRemote()) {
        touchIndex();
        daCreare.set(t.id, get().legaId!); // il primo invio della coda sarà la POST di creazione
      }
      afterTappaChange(t.id);
    },

    updateTappa: (id, modifica) => {
      set((s) => ({
        tappe: s.tappe.map((t) => {
          if (t.id !== id) return t;
          // La funzione lavora sulla tappa dello store adesso, dentro lo stesso set: nessuna modifica si perde nel mezzo
          if (typeof modifica === "function") return modifica(t);
          return { ...t, ...modifica };
        }),
      }));
      afterTappaChange(id);
    },

    updateTappaPartita: (tappaId, partitaId, patch) => {
      set((s) => ({
        tappe: s.tappe.map((t) =>
          t.id !== tappaId ? t : {
            ...t,
            partite: t.partite.map((m) => m.id === partitaId ? { ...m, ...patch } : m),
          }
        ),
      }));
      afterTappaChange(tappaId);
    },

    importLega: async (nome, tappe) => {
      const trimmed = nome.trim() || "Lega importata";
      if (isRemote()) {
        const meta = await legheApi.create(trimmed, tappe);
        // Le tappe importate nascono sul server con la versione 0 (l'import ignora quella del corpo, contratto T2.7): la risposta
        // è solo la voce dell'indice, e la versione da mandare con la prima PUT è quella
        const importate = tappe.map((t) => ({ ...t, versione: 0 }));
        ricordaTappe(meta.id, importate);
        ricordaLega(meta.id);
        set({ legaId: meta.id, leghe: [meta, ...get().leghe], legaName: meta.nome, tappe: importate });
        return;
      }
      salvaLegaApertaPrimaDelCambio();
      const id = uid();
      const meta: LegaMeta = { id, nome: trimmed, ts: Date.now(), nTappe: tappe.length };
      const leghe = [...get().leghe, meta];
      scriviLegaNuova(id, { nome: trimmed, tappe }, leghe);
      ricordaLega(id);
      set({ legaId: id, leghe, legaName: trimmed, tappe });
    },

    replaceTappa: (t) => {
      set((s) => ({ tappe: s.tappe.map((x) => (x.id === t.id ? t : x)) }));
      afterTappaChange(t.id);
    },

    removeTappa: (id) => {
      set((s) => ({ tappe: s.tappe.filter((t) => t.id !== id) }));
      if (isRemote()) {
        // Un salvataggio ancora in attesa su una tappa eliminata darebbe 404; quello già in volo finisce, e la DELETE lo aspetta.
        // I corpi senza risposta della tappa li prende la DELETE (eliminaSulServer), per decidere dopo un suo 409
        const inVolo = coda.annulla(id);
        togliRifiutata(id);
        touchIndex();
        // Creazione non ancora confermata: niente DELETE, la tappa potrebbe non essere mai arrivata al server
        if (daCreare.delete(id)) {
          eliminatePrimaDellaCreazione.add(id);
          senzaRisposta.delete(id);
          return;
        }
        eliminaDopo(inVolo, id);
        return;
      }
      persistLocal();
    },

    reset: () => {
      // Chi esce rinuncia a ciò che non è stato salvato: nessun invio parte più dopo il logout
      coda.azzera();
      daCreare.clear();
      eliminatePrimaDellaCreazione.clear();
      rifiutate.clear();
      sulServer.clear();
      senzaRisposta.clear();
      sostituite.clear();
      avvisiConflitto.clear();
      eliminazioniInAttesa.clear();
      // Chi esce dimentica la sua lega aperta; quella dell'altra modalità (ospite o registrato) resta
      localStorage.removeItem(chiaveAttiva());
      set({
        user: null, legaId: null, leghe: [], legaName: "", tappe: [], ready: true, syncError: null, avvisoConflitti: null,
        avvisoRifiutate: null, spazioEsaurito: false,
      });
    },

    rehydrate: async () => {
      if (isRemote()) {
        set({ ready: false });
        try {
          const leghe = await legheApi.list();
          // In mancanza della propria, la chiave storica (scritta quando ce n'era una sola per tutti): l'elenco del server qui sotto
          // scarta già l'id che non è di questo utente, e il ramo senza lega toglie solo la chiave del registrato
          const activeId = localStorage.getItem(ACTIVE_KEY_REGISTRATO) ?? localStorage.getItem(ACTIVE_KEY_OSPITE);
          // La lega attiva potrebbe essere di un altro account usato su questo browser
          const attiva = activeId && leghe.some((m) => m.id === activeId) ? await legheApi.get(activeId) : null;
          if (!attiva) {
            localStorage.removeItem(ACTIVE_KEY_REGISTRATO);
            set({ leghe, legaId: null, legaName: "", tappe: [], ready: true });
            return;
          }
          ricordaTappe(attiva.id, attiva.tappe);
          set({ leghe, legaId: attiva.id, legaName: attiva.nome, tappe: attiva.tappe, ready: true });
        } catch (e) {
          reportError(e, "Caricamento leghe non riuscito");
          set({ ready: true });
        }
        return;
      }
      set({ ...statoOspite(), ready: true });
    },
  };
});

/** La tappa com'è adesso nello store. Chi calcola una nuova versione con le funzioni di tappaOps parte da qui e non
 *  dalla copia vista dal componente: dopo un'attesa, o se nel frattempo è cambiato qualcosa, quella copia è vecchia
 *  e salvarne un derivato cancellerebbe le modifiche arrivate nel frattempo. */
export function tappaCorrente(id: string | undefined): Tappa | null {
  return useAppStore.getState().tappe.find((t) => t.id === id) ?? null;
}
