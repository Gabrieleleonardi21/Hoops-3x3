import { create } from "zustand";
import type { LegaMeta, Partita, Tappa, User } from "../types";
import { uid } from "../utils/uid";
import { replaceById } from "../utils/replaceById";
import { legheApi } from "../services/legheApi";
import { archivioApi } from "../services/archivioApi";
import { ApiError, esitoIgnoto, testoErrore } from "../services/api";
import { createSaveQueue } from "./saveQueue";
import {
  ACTIVE_KEY_OSPITE, ACTIVE_KEY_REGISTRATO, INDEX_KEY, leggiDaRimandare, legaIllegibile, legaStorageKey, readIndex, readLegaData,
  readSession, scrivi, scriviDaRimandare, statoOspite, type DaRimandare,
} from "./memoriaBrowser";
import {
  conflitto, creaVersioniTappe, mancaVersione, nonTrovata, riprovabile, tappaSulServer, unoDeiNostri, type TappaLetta,
} from "./versioniTappe";
import {
  LEGA_ELIMINATA_IN_ALTRA_SCHEDA, LEGA_RILETTA_DA_ALTRA_SCHEDA, SPAZIO_ESAURITO, SPAZIO_ESAURITO_CAMBIO, SPAZIO_ESAURITO_LEGA,
  eliminazioneTappaInConflitto, pubblicazioneSenzaSalvataggio,
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
 * server in `rifiuti` (tutti mostrati da SyncBanner in App; la riga dei rifiuti la calcola avvisoRifiutate). `syncError` porta
 * anche gli avvisi sui dati dell'ospite nel browser: letti (tappe non valide scartate, lega illeggibile) e scritti (spazio esaurito:
 * la modifica resta in memoria ma non è salvata), e quelli dei conflitti con un altro dispositivo.
 * Ogni tappa del server ha una `versione` (T2.7): la PUT manda quella dell'ultima risposta, e se nel frattempo un altro
 * dispositivo ha salvato il server risponde 409. Allora si rilegge la lega e vale la tappa del server, con un avviso, a meno
 * che il conflitto non l'abbia causato questo client (un suo salvataggio rimasto senza risposta): vedi dopoUnConflitto.
 */
/** Una tappa il cui ultimo salvataggio il server ha rifiutato: il nome mandato, il motivo, la lega (letta al rifiuto) e se era la POST
 *  di creazione (`nuova`: sul server la tappa non c'è) */
export interface Rifiuto {
  id: string;
  nome: string;
  motivo: string;
  legaId: string | null;
  nuova: boolean;
}

interface AppState {
  user: User | null;
  legaId: string | null;    // ID della lega attualmente aperta
  /** Indice di tutte le leghe dell'utente; null finché il registrato non l'ha ricevuto dal server (o se la lettura non è riuscita:
   *  `erroreLeghe` dice perché). Un elenco che non si sa non è un elenco vuoto: la pagina delle leghe mostra l'errore con «Riprova» */
  leghe: LegaMeta[] | null;
  /** Perché l'ultima lettura dell'elenco delle leghe (rehydrate) non è riuscita; null se è andata bene o è in corso */
  erroreLeghe: string | null;
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
  /** Salvataggi di tappe rifiutati dal server (dati non validi), uno per tappa: la copia di `rifiutate`, da cui la barra degli avvisi
   *  calcola la sua riga (avvisoRifiutate). Durano quanto il rifiuto: sul server resta la versione di prima finché la tappa non si salva,
   *  si elimina o si riapre la lega */
  rifiuti: Rifiuto[];
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

// La chiave della sessione sta con gli altri dati del browser (memoriaBrowser): useAuth e i test la prendono da qui
export { SESSION_KEY } from "./memoriaBrowser";

/** Stato iniziale sincrono: l'ospite ha già tutto in localStorage, il registrato aspetta rehydrate() */
function getInitialState(): Pick<AppState, "user" | "legaId" | "leghe" | "erroreLeghe" | "legaName" | "tappe" | "ready" | "syncError"> {
  const empty = { user: null, legaId: null, leghe: [], erroreLeghe: null, legaName: "", tappe: [], ready: true, syncError: null };
  const user = readSession();
  if (!user) return empty;
  // Il registrato non ha ancora l'elenco: arriva con rehydrate
  if (!user.guest) return { ...empty, user, leghe: null, ready: false };
  return { ...empty, user, ...statoOspite() };
}

/* ── Salvataggi sul server (registrati) ───────────────────────────────────── */

/** Attesa dopo l'ultima modifica prima di salvare una tappa o rinominare la lega */
const SAVE_DELAY = 400;

/** Il browser rifiuta una richiesta keepalive se, con quelle già in volo, i corpi superano 64 KiB (specifica Fetch): una tappa con i
 *  tabellini di 16 squadre pesa 34-46 KiB, una da 32 squadre 64-89 KiB. Si resta un po' sotto, per le altre richieste keepalive */
const SOGLIA_KEEPALIVE = 60 * 1024;
/** Byte del corpo JSON di una richiesta, come lo manda api.ts */
const byteDelCorpo = (corpo: unknown) => new TextEncoder().encode(JSON.stringify(corpo)).length;

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
  /** Ospite: l'indice delle leghe da cui partire per riscriverlo, riletto dal browser. Un'altra scheda può averci aggiunto una lega:
   *  riscrivere quello in memoria la farebbe sparire dall'elenco. Le leghe che conosce solo questa scheda restano, in fondo */
  const indiceAttuale = (): LegaMeta[] => {
    const nelBrowser = readIndex();
    const soloQui = (get().leghe ?? []).filter((m) => !nelBrowser.some((x) => x.id === m.id));
    return [...nelBrowser, ...soloQui];
  };
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
  /** Ricorda la lega aperta, per riaprirla alla prossima visita. È solo una comodità, anche per l'ospite: non è un dato della lega, e
   *  se il browser rifiuta la scrittura non si dice niente. Con scriviOspite alzerebbe la protezione dello spazio esaurito
   *  (spazioEsaurito) senza nessuna modifica rimasta solo in memoria */
  const ricordaLega = (id: string) => {
    scrivi(chiaveAttiva(), id);
  };

  /** Registrato: l'elenco con la lega appena creata in testa. Se l'elenco non è mai arrivato (F1) resta null: inventarne uno con
   *  la sola lega nuova farebbe sparire l'errore e «Riprova», e le altre leghe sembrerebbero perse; al «Riprova» arrivano tutte */
  const conInTesta = (meta: LegaMeta): LegaMeta[] | null => {
    const leghe = get().leghe;
    if (leghe === null) return null;
    return [meta, ...leghe];
  };

  /** Ospite: salva la lega attiva su localStorage e aggiorna nTappe/ts nell'indice */
  const persistLocal = () => {
    const s = get();
    if (!s.legaId) return;
    const leghe = indiceAttuale().map((m) =>
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
   * Il registro delle versioni e dei corpi mandati senza risposta è in versioniTappe.ts; qui ciò che tocca lo store. Le voci di
   * `sostituite` per una tappa eliminata restano fino all'uscita (reset): non si leggono più. */
  const versioni = creaVersioniTappe();
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
  const legaDi = (id: string): string | null => versioni.legaNota(id) ?? daCreare.get(id) ?? get().legaId;

  /** Ricorda lega e versione di una tappa dette dal server e mette la versione anche sulla tappa dello store. Solo la versione: i
   *  dati in memoria possono essere più recenti della risposta (modifiche fatte mentre la richiesta era in volo) */
  const ricordaVersione = (legaId: string, id: string, nuova: number | undefined) => {
    const versione = versioni.ricorda(legaId, id, nuova);
    const attuale = get().tappe.find((x) => x.id === id);
    if (!attuale || attuale.versione === versione) return; // fuori dalla lega aperta, o già quella: niente da ridisegnare
    set((s) => ({ tappe: replaceById(s.tappe, { ...attuale, versione }) }));
  };

  /** Risposta riuscita di una POST o di una PUT: da qui le modifiche locali si basano sulla sua versione, e i corpi rimasti senza
   *  risposta non contano più (il server ha la versione appena confermata) */
  const confermata = (t: Tappa, risposta: Tappa | undefined) => {
    versioni.dimenticaSenzaRisposta(t.id);
    const legaId = legaDi(t.id);
    if (legaId) ricordaVersione(legaId, t.id, risposta?.versione);
  };

  /** Aggiunge la frase di una tappa all'avviso dei conflitti, che le nomina tutte finché non si chiude (chiudiAvvisoConflitti). Una
   *  frase nuova per la stessa tappa sostituisce quella di prima */
  const avvisaConflitto = (id: string, frase: string) => {
    avvisiConflitto.set(id, frase);
    set({ avvisoConflitti: [...avvisiConflitto.values()].join(" ") });
  };

  /** Conflitto risolto a favore del server: la tappa riletta prende il posto di quella locale, con la sua versione, e le modifiche in
   *  sospeso nella coda si scartano (rimandarle cancellerebbe il lavoro dell'altro; una richiesta già in volo finisce da sola). Una
   *  tappa che non è più nello store (DELETE respinta) torna al posto che ha sul server. Nello store solo nella lega aperta: se intanto
   *  se ne è aperta un'altra resta l'avviso, e la tappa si ricorda per quando la lega si riapre (versioni.ricordaCopiaFuoriLega) */
  const applicaQuellaDelServer = (legaId: string, letta: TappaLetta, frase: string) => {
    const { tappa, posizione } = letta;
    versioni.ricordaTappe(legaId, [tappa]);
    coda.annulla(tappa.id);
    versioni.uscitaDuranteLeLetture(tappa.id);
    versioni.dimenticaSenzaRisposta(tappa.id);
    avvisaConflitto(tappa.id, frase);
    if (get().legaId !== legaId) {
      versioni.ricordaCopiaFuoriLega(tappa);
      return;
    }
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
    versioni.uscitaDuranteLeLetture(t.id);
    versioni.dimenticaCopiaFuoriLega(t.id);
    versioni.dimenticaSenzaRisposta(t.id);
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
    const inviate = versioni.prendiSenzaRisposta(t.id);
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
      confermata(t, await legheApi.putTappa(versioni.conVersione(t)));
    } catch (e) {
      if (esitoIgnoto(e)) versioni.inviataSenzaRisposta(t);
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
      if (esitoIgnoto(e)) versioni.inviataSenzaRisposta(t);
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
    mandaDelete(id, legaId, versioni.prendiSenzaRisposta(id), false);

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
   *  pubblicarla metterebbe in archivio una versione vecchia, e uscire perderebbe la versione rifiutata della lega aperta, che è nello
   *  store («Esci» le conta, salvaTutto). Una voce si toglie quando: un salvataggio della tappa riesce; si apre una lega (selectLega:
   *  le sue tappe arrivano dal server, e quelle che non ci sono più non contano); la tappa o la lega si eliminano (removeTappa,
   *  deleteLega); si esce (reset). Ogni cambio passa da rifiuta e togliRifiutata, che tengono lo stato (rifiuti) uguale alla mappa. */
  const rifiutate = new Map<string, Rifiuto>();

  /** I rifiuti nello stato (rifiuti), copiati dalla mappa: la barra ne fa la sua riga */
  const mostraRifiutate = () => {
    set({ rifiuti: [...rifiutate.values()] });
  };
  /** Il server ha rifiutato la versione `t`. Il rifiuto vale solo se è l'ultima della tappa: se in coda ce n'è già una più nuova decide
   *  il salvataggio di quella, e la riga direbbe il falso (riaprendo la lega si troverebbe la versione in attesa, non quella del server).
   *  Una GET della lega in corso l'ha letta prima: riaprendo vale la tappa del server, non la versione rifiutata (N2) */
  const rifiuta = (t: Tappa, e: unknown) => {
    if (coda.inAttesa().some((x) => x.id === t.id)) return;
    rifiutate.set(t.id, { id: t.id, nome: t.nome, motivo: testoErrore(e), legaId: legaDi(t.id), nuova: daCreare.has(t.id) });
    versioni.uscitaDuranteLeLetture(t.id);
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
    if (!t) return;
    // Una versione più nuova: un rifiuto di prima non descrive più la tappa, e il salvataggio di questa decide (riesce, è rifiutata
    // di nuovo, o resta in attesa e «Esci» la conta)
    togliRifiutata(tappaId);
    coda.accoda(t);
  };

  /** Tappe di una lega appena arrivate dal server, con sopra quelle di qui più recenti: senza, lo schermo tornerebbe a ciò che la GET
   *  ha letto e la modifica successiva cancellerebbe in silenzio quello che è cambiato nel frattempo. Per ogni tappa letta vale:
   *  - la copia dello store, se la tappa è nello store (la lega era già aperta) e ha una versione non ancora confermata o è stata letta
   *    più vecchia della versione nota. È sempre la più recente: la coda manda proprio quella (afterTappaChange), una risposta ne alza
   *    solo la versione, un conflitto la sostituisce con la tappa del server (C1, P1, P2);
   *  - niente, se è uscita durante la GET (`uscite`) e non è più nello store: eliminata, qui o altrove (P7). Se invece un conflitto con
   *    la lega chiusa ha messo la tappa del server (versioni.copiaFuoriLega), vale quella quando la lettura è più vecchia (P6);
   *  - la versione non confermata, se la tappa non è nello store (per esempio tornando da un'altra lega con la rete giù);
   *  - altrimenti la tappa letta, che porta le modifiche degli altri dispositivi.
   *  `locali` = le versioni in attesa lette prima della GET, tranne quelle uscite nel frattempo, e quelle non confermate a GET finita,
   *  comprese le richieste in volo; a parità di tappa vale l'ultima. La versione segue i dati: una tappa del server porta la sua, una
   *  locale quella su cui si basa (con quella del server cancellerebbe il lavoro di un altro dispositivo; così la sua PUT riceve il 409
   *  e decide dopoUnConflitto).
   *  `nuove` = tappe della lega non ancora create sul server, assenti dalla risposta. Una tappa dello store creata sul server durante la
   *  GET (versioni.legaNota la dà in questa lega, ma prima della GET non c'era: `notePrima`) manca dalla risposta se la GET l'ha letta prima
   *  della POST: resta. Una che il server conosceva già prima della GET e che manca l'ha eliminata un altro dispositivo: esce. */
  const conVersioniLocali = (
    legaId: string, dalServer: Tappa[], locali: Tappa[], nuove: Tappa[], notePrima: Set<string>, uscite: Set<string>,
  ): Tappa[] => {
    const perId = new Map(locali.map((t) => [t.id, t]));
    const nelloStore = (id: string) => get().tappe.find((x) => x.id === id);
    /** La copia da tenere della tappa letta `t`, secondo le regole qui sopra; null se non deve tornare */
    const daTenere = (t: Tappa): Tappa | null => {
      const qui = nelloStore(t.id);
      if (qui && (perId.has(t.id) || versioni.piuVecchiaDellaNota(t))) return versioni.conVersione(qui);
      if (!qui && uscite.has(t.id)) {
        const delServer = versioni.copiaFuoriLega(t.id);
        if (!delServer) return null;
        if (versioni.piuVecchiaDellaNota(t)) return versioni.conVersione(delServer);
      }
      const locale = perId.get(t.id);
      if (locale) return versioni.conVersione(locale);
      versioni.ricordaTappe(legaId, [t]);
      return versioni.conVersione(t);
    };
    const tappe: Tappa[] = [];
    for (const t of dalServer) {
      const tenuta = daTenere(t);
      if (tenuta) tappe.push(tenuta);
    }
    const manca = (id: string) => !tappe.some((x) => x.id === id);
    for (const t of nuove) {
      if (manca(t.id)) tappe.push(nelloStore(t.id) ?? perId.get(t.id) ?? t);
    }
    for (const t of get().tappe) {
      const creataDuranteLaGet = versioni.legaNota(t.id) === legaId && !notePrima.has(t.id);
      if (creataDuranteLaGet && manca(t.id)) tappe.push(versioni.conVersione(t));
    }
    // Da qui le tappe della lega sono nello store: le copie ricordate a lega chiusa non servono più
    versioni.dimenticaCopieDellaLega(legaId);
    return tappe;
  };

  /** Aggiorna nTappe/ts della lega attiva nell'indice in memoria (il server lo fa da sé) */
  const touchIndex = () => {
    const s = get();
    if (!s.leghe) return; // l'elenco non è arrivato: non c'è niente da aggiornare
    set({ leghe: s.leghe.map((m) => m.id === s.legaId ? { ...m, nTappe: s.tappe.length, ts: Date.now() } : m) });
  };

  // Chiusura pagina: le versioni non ancora confermate dal server partono subito con keepalive (POST per le tappe non
  // ancora create), comprese quelle di una richiesta in corso, che il browser interrompe chiudendo la pagina. Restano in
  // coda: se la pagina torna dalla cache del browser vengono rinviate, e rinviarle non fa danni (la PUT sostituisce
  // tutta la tappa, una POST già arrivata riceve un 409). La risposta non si legge: se il server le salva, il rinvio con la
  // versione di prima riceve un 409 che dopoUnConflitto riconosce come proprio (sono tra i corpi senza risposta).
  // Oltre la soglia keepalive (SOGLIA_KEEPALIVE, contando le tappe già partite) il browser rifiuterebbe la richiesta: quella versione
  // resta nel browser (DA_RIMANDARE_KEY) e parte alla prossima apertura (rimandaRimaste)
  const allaChiusura = () => {
    let spazio = SOGLIA_KEEPALIVE;
    const rimaste: DaRimandare[] = [];
    const userId = get().user?.id;
    for (const t of coda.nonConfermate()) {
      const legaNuova = daCreare.get(t.id);
      const corpo = versioni.conVersione(t);
      const peso = byteDelCorpo(corpo);
      if (peso > spazio) {
        const legaId = legaNuova ?? legaDi(t.id);
        if (userId && legaId) rimaste.push({ userId, legaId, nuova: legaNuova !== undefined, tappa: corpo });
        continue;
      }
      spazio -= peso;
      versioni.inviataSenzaRisposta(t);
      if (legaNuova === undefined) {
        legheApi.putTappa(corpo, true).catch(() => {});
        continue;
      }
      legheApi.addTappa(legaNuova, t, true).catch(() => {});
    }
    // Una versione più nuova della stessa tappa sostituisce quella rimasta da una chiusura precedente
    if (rimaste.length) {
      const prima = leggiDaRimandare().filter((v) => !rimaste.some((r) => r.tappa.id === v.tappa.id));
      scriviDaRimandare([...prima, ...rimaste]);
    }
    // Le DELETE non ancora confermate, comprese quelle che aspettano un salvataggio in volo: senza keepalive si perderebbero e la
    // tappa ricomparirebbe. Se la pagina torna dalla cache del browser la DELETE in attesa parte lo stesso, e il suo 404 si tollera
    for (const id of eliminazioniInAttesa.keys()) legheApi.removeTappa(id, true).catch(() => {});
  };

  /** La pagina torna dalla cache del browser (indietro/avanti): la coda è ancora viva e rimanda da sé le versioni rimaste nel browser
   *  alla chiusura; rimandarle anche alla prossima apertura darebbe un 409 su dati già salvati */
  const tornataDallaCache = () => {
    const inCoda = new Set(coda.nonConfermate().map((t) => t.id));
    scriviDaRimandare(leggiDaRimandare().filter((v) => !inCoda.has(v.tappa.id)));
  };

  /** Prossima apertura (rehydrate): rimanda le tappe rimaste nel browser alla chiusura, prima di leggere le leghe, così la lettura le
   *  trova già salvate. Un errore temporaneo le lascia lì per la volta dopo; un 409 vuol dire che intanto un altro dispositivo ha
   *  salvato la tappa, e vale la sua (con l'avviso dei conflitti), a meno che il server non abbia proprio questa versione: il
   *  salvataggio a scheda nascosta (visibilitychange), partito prima della chiusura, può essere arrivato; un altro rifiuto va nella
   *  barra degli avvisi */
  const rimandaRimaste = async () => {
    const userId = get().user?.id;
    const tutte = leggiDaRimandare();
    const mie = tutte.filter((v) => v.userId === userId);
    if (mie.length === 0) return;
    const restano = tutte.filter((v) => v.userId !== userId);
    for (const v of mie) {
      try {
        await mandaRimasta(v);
      } catch (e) {
        if (riprovabile(e)) restano.push(v);
        else if (conflitto(e)) await conflittoDiUnaRimasta(v);
        else reportError(e, `Salvataggio della tappa «${v.tappa.nome}», rimasto dalla chiusura della pagina, non riuscito`);
      }
    }
    scriviDaRimandare(restano);
  };
  /** 409 di una tappa rimasta: se il server ha già questa stessa versione (impronta, versione esclusa) era arrivata prima della
   *  chiusura e non c'è niente da dire; altrimenti vale la tappa dell'altro dispositivo, con l'avviso. Se la lega non si legge,
   *  l'avviso resta: meglio uno di troppo che una modifica persa in silenzio */
  const conflittoDiUnaRimasta = async (v: DaRimandare) => {
    try {
      const letta = await tappaSulServer(v.legaId, v.tappa.id);
      if (letta && unoDeiNostri([v.tappa], letta.tappa)) return;
    } catch { /* lettura non riuscita: si avvisa comunque */ }
    avvisaConflitto(v.tappa.id, tappaModificataAltrove(v.tappa.nome));
  };
  /** Una tappa rimasta: PUT con la versione su cui si basa, oppure POST se non era ancora creata. Un 409 della POST vuol dire che la
   *  POST partita prima della chiusura è arrivata: questa versione, più recente, la sostituisce con la versione letta dal server */
  const mandaRimasta = async (v: DaRimandare) => {
    if (!v.nuova) {
      await legheApi.putTappa(v.tappa);
      return;
    }
    try {
      await legheApi.addTappa(v.legaId, v.tappa);
    } catch (e) {
      if (!conflitto(e)) throw e;
      const letta = await tappaSulServer(v.legaId, v.tappa.id);
      if (!letta) throw e;
      await legheApi.putTappa({ ...v.tappa, versione: letta.tappa.versione });
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", allaChiusura);
    window.addEventListener("pageshow", (e) => { if (e.persisted) tornataDallaCache(); });
    // Scheda nascosta (cambio di scheda o di app, spesso l'ultimo momento prima della chiusura su mobile): si salva subito, con una
    // richiesta normale, senza aspettare il ritardo della coda e senza il limite di keepalive
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && isRemote()) void get().salvaTutto();
    });
    // Chiusura con versioni non ancora confermate dal server: il browser chiede conferma («Uscire dal sito?»)
    window.addEventListener("beforeunload", (e) => {
      if (!isRemote() || (coda.nonConfermate().length === 0 && eliminazioniInAttesa.size === 0)) return;
      e.preventDefault();
    });
  }

  /** Ospite con l'app aperta in più schede: ogni scheda scrive la lega e l'indice dalla sua memoria, quindi deve sapere che cosa ha
   *  scritto l'altra. L'evento storage arriva solo alle altre schede dello stesso browser, dopo una scrittura riuscita.
   *  - Indice cambiato: l'elenco delle leghe si rilegge (una lega creata o eliminata là compare o sparisce anche qui).
   *  - Lega aperta salvata là: si rilegge, e da qui si continua dalla versione dell'altra scheda (ogni modifica dell'ospite è già
   *    nel browser, quindi non si perde niente; se qui c'erano modifiche solo in memoria per lo spazio esaurito, l'avviso lo dice).
   *  - Lega aperta eliminata là: si chiude anche qui, con l'avviso, invece di riscriverla al prossimo salvataggio. */
  const allineaConAltraScheda = (e: StorageEvent) => {
    const s = get();
    if (!s.user?.guest) return;
    if (e.key === INDEX_KEY) {
      set({ leghe: readIndex() });
      return;
    }
    if (!s.legaId || e.key !== legaStorageKey(s.legaId)) return;
    if (e.newValue === null) {
      localStorage.removeItem(ACTIVE_KEY_OSPITE);
      set({ legaId: null, legaName: "", tappe: [], syncError: LEGA_ELIMINATA_IN_ALTRA_SCHEDA, spazioEsaurito: false });
      return;
    }
    const letta = readLegaData(s.legaId);
    if (!letta) {
      set({ syncError: legaIllegibile(s.leghe ?? [], s.legaId) });
      return;
    }
    let syncError = letta.avviso ?? s.syncError;
    if (s.spazioEsaurito) syncError = LEGA_RILETTA_DA_ALTRA_SCHEDA;
    set({ legaName: letta.lega.nome, tappe: letta.lega.tappe, syncError, spazioEsaurito: false });
  };
  if (typeof window !== "undefined") window.addEventListener("storage", allineaConAltraScheda);

  let renameTimer = 0;
  /** PATCH della rinomina che aspetta il suo timer; null se non ce n'è */
  let rinominaInAttesa: (() => Promise<void>) | null = null;
  /** Il nome della lega aperta com'è sul server (letto all'apertura, confermato da ogni PATCH riuscita): se il server rifiuta una
   *  rinomina (400: troppo lungo, vuoto) lo schermo torna a questo, invece di mostrare un nome che sul server non c'è */
  let nomeSulServer = "";

  /** Scrive il nome della lega aperta nello stato e nell'indice. L'ospite riparte dall'indice del browser (indiceAttuale): un'altra
   *  scheda può averlo cambiato. @returns l'indice aggiornato, che l'ospite salva */
  const scriviNomeLega = (legaName: string): LegaMeta[] => {
    const s = get();
    let base = s.leghe ?? [];
    if (!isRemote()) base = indiceAttuale();
    const leghe = base.map((m) => m.id === s.legaId ? { ...m, nome: legaName, ts: Date.now() } : m);
    set({ legaName, leghe });
    return leghe;
  };

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
    rifiuti: [],
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
      // Contano i rifiuti della lega aperta: la versione rifiutata è nello store, e uscendo si perde. Quella di un'altra lega non è più
      // in memoria (lo store l'ha sostituita aprendo l'altra lega): uscire non perde niente, e la riga dei rifiuti lo dice. Una tappa
      // rifiutata e poi modificata di nuovo, ancora in attesa, è in tutti e due gli elenchi: conta una volta
      const rifiutateQui = [...rifiutate.values()].filter((r) => r.legaId === get().legaId).map((r) => r.id);
      return new Set([...coda.inAttesa().map((t) => t.id), ...rifiutateQui]).size;
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
        nomeSulServer = meta.nome;
        set({ legaId: meta.id, leghe: conInTesta(meta), legaName: meta.nome, tappe: [] });
        return meta.id;
      }
      salvaLegaApertaPrimaDelCambio();
      const id = uid();
      const meta: LegaMeta = { id, nome: trimmed, ts: Date.now(), nTappe: 0 };
      const leghe = [...indiceAttuale(), meta];
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
        const notePrima = new Set(get().tappe.filter((t) => versioni.legaNota(t.id) === id).map((t) => t.id));
        // Le tappe che durante la GET escono dalla coda per un conflitto, o dallo store perché eliminate: la GET le ha lette prima
        const uscite = new Set<string>();
        const lega = await versioni.leggiLega(id, uscite);
        // Dopo la GET: anche le versioni in volo e le tappe aggiunte nel frattempo, con la POST ancora da confermare (C1); non quelle
        // in attesa prima della GET che un conflitto ha tolto dalla coda nel frattempo (P2, P6)
        const locali = [...inCoda.filter((t) => !uscite.has(t.id)), ...coda.nonConfermate()];
        const nuove = locali.filter((t) => daCreare.get(t.id) === id);
        const tappe = conVersioniLocali(id, lega.tappe, locali, nuove, notePrima, uscite);
        // Le tappe arrivano com'è sul server: un vecchio rifiuto del loro salvataggio non vale più, e non deve bloccare la pubblicazione.
        // Nemmeno quello di una tappa della lega che non c'è più (mai creata sul server): non resta niente da salvare
        for (const t of lega.tappe) togliRifiutata(t.id);
        togliRifiutateDellaLega(id, (tid) => tappe.some((t) => t.id === tid));
        ricordaLega(id);
        nomeSulServer = lega.nome;
        set({ legaId: id, legaName: lega.nome, tappe });
        return;
      }
      salvaLegaApertaPrimaDelCambio();
      const letta = readLegaData(id);
      // L'ospite non ha un server: una lega che nel browser non c'è o è rovinata si segnala come la segnalerebbe il server
      // (404), e la pagina mostra il motivo come per ogni altro errore
      if (!letta) throw new ApiError(404, legaIllegibile(get().leghe ?? [], id));
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
      let leghe = (get().leghe ?? []).filter((m) => m.id !== id);
      if (!isRemote()) {
        leghe = indiceAttuale().filter((m) => m.id !== id);
        writeIndex(leghe);
      }
      // I rifiuti delle tappe della lega non valgono più, anche se non è quella aperta: non c'è più niente da salvare
      togliRifiutateDellaLega(id);
      versioni.dimenticaCopieDellaLega(id);
      if (get().legaId === id) {
        // Le tappe se ne vanno con la lega: i loro salvataggi in attesa o in nuovo tentativo partirebbero dopo la DELETE
        // e avrebbero un 404 (la POST, su una lega che non c'è più), cioè un errore per dati eliminati apposta
        for (const t of get().tappe) {
          coda.annulla(t.id);
          versioni.dimenticaSenzaRisposta(t.id);
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
      const s = get();
      if (!s.legaId) {
        set({ legaName });
        return;
      }
      const leghe = scriviNomeLega(legaName);
      if (isRemote()) {
        // L'input chiama setLegaName a ogni tasto: una sola PATCH a fine digitazione (o prima, da salvaTutto)
        const legaId = s.legaId;
        rinominaInAttesa = async () => {
          const nome = get().legaName.trim() || "Lega";
          try {
            await legheApi.rename(legaId, nome);
            nomeSulServer = nome;
          } catch (e) {
            reportError(e, "Rinomina lega non riuscita");
            // Rifiuto definitivo (400, 403…): sul server resta il nome di prima, e lo schermo lo mostra. Un errore temporaneo (rete,
            // server) lascia il nome scritto: si rimanda da salvaTutto o alla prossima modifica
            if (!riprovabile(e) && get().legaId === legaId) scriviNomeLega(nomeSulServer);
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
        // Il primo invio della coda sarà la POST di creazione, nella lega aperta (le tappe si aggiungono solo con una lega aperta)
        const legaId = get().legaId;
        if (legaId) daCreare.set(t.id, legaId);
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
        versioni.ricordaTappe(meta.id, importate);
        ricordaLega(meta.id);
        nomeSulServer = meta.nome;
        set({ legaId: meta.id, leghe: conInTesta(meta), legaName: meta.nome, tappe: importate });
        return;
      }
      salvaLegaApertaPrimaDelCambio();
      const id = uid();
      const meta: LegaMeta = { id, nome: trimmed, ts: Date.now(), nTappe: tappe.length };
      const leghe = [...indiceAttuale(), meta];
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
        versioni.uscitaDuranteLeLetture(id); // una GET della lega in corso l'ha letta prima: non deve farla tornare
        versioni.dimenticaCopiaFuoriLega(id);
        togliRifiutata(id);
        touchIndex();
        // Creazione non ancora confermata: niente DELETE, la tappa potrebbe non essere mai arrivata al server
        if (daCreare.delete(id)) {
          eliminatePrimaDellaCreazione.add(id);
          versioni.dimenticaSenzaRisposta(id);
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
      versioni.azzera();
      sostituite.clear();
      avvisiConflitto.clear();
      eliminazioniInAttesa.clear();
      // Chi esce dimentica la sua lega aperta; quella dell'altra modalità (ospite o registrato) resta
      localStorage.removeItem(chiaveAttiva());
      set({
        user: null, legaId: null, leghe: [], erroreLeghe: null, legaName: "", tappe: [], ready: true, syncError: null,
        avvisoConflitti: null, rifiuti: [], spazioEsaurito: false,
      });
    },

    rehydrate: async () => {
      if (isRemote()) {
        set({ ready: false, erroreLeghe: null });
        let leghe: LegaMeta[];
        try {
          await rimandaRimaste();
          leghe = await legheApi.list();
        } catch (e) {
          // L'elenco non si sa: resta null (non vuoto) e la pagina delle leghe mostra il motivo con «Riprova», che richiama rehydrate
          set({ leghe: null, erroreLeghe: testoErrore(e), ready: true });
          return;
        }
        // In mancanza della propria, la chiave storica (scritta quando ce n'era una sola per tutti): l'elenco del server qui sotto
        // scarta già l'id che non è di questo utente, e il ramo senza lega toglie solo la chiave del registrato
        const activeId = localStorage.getItem(ACTIVE_KEY_REGISTRATO) ?? localStorage.getItem(ACTIVE_KEY_OSPITE);
        // La lega attiva potrebbe essere di un altro account usato su questo browser
        if (!activeId || !leghe.some((m) => m.id === activeId)) {
          localStorage.removeItem(ACTIVE_KEY_REGISTRATO);
          set({ leghe, legaId: null, legaName: "", tappe: [], ready: true });
          return;
        }
        try {
          const attiva = await legheApi.get(activeId);
          versioni.ricordaTappe(attiva.id, attiva.tappe);
          nomeSulServer = attiva.nome;
          set({ leghe, legaId: attiva.id, legaName: attiva.nome, tappe: attiva.tappe, ready: true });
        } catch (e) {
          // Solo la lega aperta per ultima non si è letta: l'elenco c'è, e la lega si riapre da lì. L'avviso va nella barra
          reportError(e, "Apertura dell'ultima lega non riuscita");
          set({ leghe, legaId: null, legaName: "", tappe: [], ready: true });
        }
        return;
      }
      set({ ...statoOspite(), ready: true });
    },
  };
});

/** La riga dei salvataggi rifiutati nella barra degli avvisi (SyncBanner), una frase per tappa; null se non ce ne sono. Si calcola
 *  dallo stato di adesso, perché la frase dipende dalla lega aperta (la versione rifiutata è ancora sullo schermo o no) e dai nomi
 *  delle leghe, che cambiano */
export function avvisoRifiutate(s: Pick<AppState, "rifiuti" | "legaId" | "leghe">): string | null {
  const frasi = s.rifiuti.map((r) => {
    const lega = (s.leghe ?? []).find((m) => m.id === r.legaId)?.nome || "senza nome";
    return salvataggioRifiutato(r.nome, r.motivo, lega, r.legaId === s.legaId, r.nuova);
  });
  return frasi.join(" ") || null;
}

/** La tappa com'è adesso nello store. Chi calcola una nuova versione con le funzioni di tappaOps parte da qui e non
 *  dalla copia vista dal componente: dopo un'attesa, o se nel frattempo è cambiato qualcosa, quella copia è vecchia
 *  e salvarne un derivato cancellerebbe le modifiche arrivate nel frattempo. */
export function tappaCorrente(id: string | undefined): Tappa | null {
  return useAppStore.getState().tappe.find((t) => t.id === id) ?? null;
}
