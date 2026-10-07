import { create } from "zustand";
import type { LegaMeta, Partita, Tappa, User } from "../types";
import { uid } from "../utils/uid";
import { legheApi } from "../services/legheApi";
import { ApiError, testoErrore } from "../services/api";
import { createSaveQueue } from "./saveQueue";
import { leggiLegaSalvata, type LegaSalvata } from "../utils/legaFile";
import { SPAZIO_ESAURITO, SPAZIO_ESAURITO_CAMBIO, SPAZIO_ESAURITO_LEGA } from "../utils/testi";

/**
 * Store globale: utente, indice leghe e lega attiva con le sue tappe.
 * Le azioni aggiornano SUBITO lo stato in memoria (la UI resta reattiva) e poi persistono:
 *  - ospite  → localStorage, come nelle versioni precedenti
 *  - registrato → backend REST (legheApi); creazione e modifiche delle tappe passano dalla coda
 *    dei salvataggi (saveQueue.ts): una raffica di input diventa un solo invio, mai due richieste
 *    insieme per la stessa tappa, nuovi tentativi se la rete o il server hanno un problema temporaneo.
 * Gli errori finiscono in `syncError`, le tappe non ancora salvate in `inSospeso` ed `erroreSalvataggio`
 * (tutti mostrati da SyncBanner in App). `syncError` porta anche gli avvisi sui dati dell'ospite nel browser: letti
 * (tappe non valide scartate, lega illeggibile) e scritti (spazio esaurito: la modifica resta in memoria ma non è salvata).
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
  /** Tappe con modifiche non ancora confermate dal server (coda dei salvataggi) */
  inSospeso: number;
  /** Motivo dell'ultimo salvataggio non riuscito per un problema temporaneo (rete, sessione, server):
   *  torna null da solo quando la coda ha salvato tutto */
  erroreSalvataggio: string | null;
  setUser: (u: User | null) => void;
  clearSyncError: () => void;
  /** Salva subito le modifiche in attesa (tappe e rinomina della lega) e aspetta le richieste in corso
   *  (logout, «Riprova ora», apertura di una lega).
   *  @returns quante tappe hanno ancora modifiche non salvate */
  salvaTutto: () => Promise<number>;
  createLega: (nome: string) => Promise<string>;
  selectLega: (id: string) => Promise<void>;
  deleteLega: (id: string) => Promise<void>;
  setLegaName: (nome: string) => void;
  setLega: (nome: string, tappe: Tappa[]) => void;
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

const initial = getInitialState();

export const useAppStore = create<AppState>((set, get) => {
  const isRemote = () => {
    const u = get().user;
    return !!u && !u.guest;
  };

  const reportError = (e: unknown, cosa: string) => {
    set({ syncError: `${cosa}: ${testoErrore(e)}` });
  };

  /** Toglie l'avviso «spazio esaurito» quando le scritture dell'ospite tornano a riuscire (per esempio dopo aver eliminato una
   *  lega): da lì dice il falso. Gli altri avvisi non si toccano. */
  const spazioTornato = () => {
    if (get().syncError === SPAZIO_ESAURITO) set({ syncError: null });
  };
  /** Scrive i dati dell'ospite nel browser, una coppia (chiave, valore) per scrittura. Se il browser ne rifiuta una (spazio esaurito)
   *  l'azione riesce lo stesso, in memoria, e la barra degli avvisi dice che non è salvata: l'app non va in errore. Si tentano tutte,
   *  anche dopo un rifiuto (una scrittura piccola può riuscire dove una grande no). Non toglie mai l'avviso: lo fa solo
   *  salvaLegaAperta, perché una scrittura che riesce non prova che la lega aperta sia salvata.
   *  @returns true se sono riuscite tutte */
  const scriviOspite = (...coppie: [string, string][]): boolean => {
    const riuscite = coppie.map(([chiave, valore]) => scrivi(chiave, valore));
    if (riuscite.includes(false)) {
      set({ syncError: SPAZIO_ESAURITO });
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

  /** Ospite: prima di aprire, creare o importare un'altra lega. Con l'avviso «spazio esaurito» attivo le modifiche della lega aperta
   *  esistono solo in memoria, e il cambio le sostituirebbe (riaprendo la stessa lega, con la versione vecchia salvata nel browser)
   *  e toglierebbe l'avviso: in silenzio. Quindi si prova a salvarla: se riesce, l'avviso sparisce e si procede; se no, non si cambia
   *  niente e l'errore dice perché (lo mostrano le pagine che chiamano). Senza l'avviso non c'è niente da salvare. */
  const salvaLegaApertaPrimaDelCambio = () => {
    if (get().syncError !== SPAZIO_ESAURITO) return;
    if (!get().legaId) {
      spazioTornato(); // nessuna lega aperta: non c'è niente da salvare
      return;
    }
    persistLocal();
    if (get().syncError === SPAZIO_ESAURITO) throw new ApiError(507, SPAZIO_ESAURITO_CAMBIO);
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

  const eliminaSulServer = (id: string) => {
    legheApi.removeTappa(id).catch((e) => reportError(e, "Eliminazione tappa non riuscita"));
  };

  /** Invio di una versione della tappa (lo chiama la coda): POST finché la creazione non è confermata, poi PUT.
   *  Un 409 sulla POST vuol dire che la tappa esiste già, perché la risposta di una POST precedente si è persa:
   *  si passa alla PUT con questa versione, che è la più recente. */
  const salvaSulServer = async (t: Tappa) => {
    const legaId = daCreare.get(t.id);
    if (legaId === undefined) {
      await legheApi.putTappa(t);
      return;
    }
    try {
      await legheApi.addTappa(legaId, t);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) throw e;
      await legheApi.putTappa(t);
    }
    daCreare.delete(t.id);
    if (eliminatePrimaDellaCreazione.delete(t.id)) eliminaSulServer(t.id);
  };

  /** Un 404 per una tappa che non è più nello stato non è un salvataggio fallito: la tappa è stata eliminata (la DELETE
   *  è arrivata prima della PUT in volo, oppure se n'è andata con la sua lega) e non c'è più niente da salvare */
  const eliminataNelFrattempo = (e: unknown, t: Tappa) =>
    e instanceof ApiError && e.status === 404 && !get().tappe.some((x) => x.id === t.id);

  const coda = createSaveQueue({
    salva: (t) => salvaSulServer(t).catch((e: unknown) => {
      if (!eliminataNelFrattempo(e, t)) throw e;
    }),
    riprovabile,
    ritardo: SAVE_DELAY,
    onErrore: (e, definitivo) => {
      if (definitivo) { reportError(e, "Salvataggio tappa non riuscito"); return; }
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

  /** Tappe di una lega appena arrivate dal server, con sopra le versioni locali non ancora salvate: senza,
   *  lo schermo tornerebbe alla versione del server e la modifica successiva sostituirebbe in coda quella
   *  con i risultati. `inCoda` = versioni in attesa lette prima della GET (un nuovo tentativo partito durante
   *  la GET può salvarle dopo che il server ha già letto la versione vecchia); si aggiungono quelle entrate in
   *  coda nel frattempo. `nuove` = tappe della lega non ancora create sul server, assenti dalla risposta. */
  const conVersioniLocali = (dalServer: Tappa[], inCoda: Tappa[], nuove: Tappa[]): Tappa[] => {
    const locali = new Map([...inCoda, ...coda.inAttesa()].map((t) => [t.id, t]));
    const tappe = dalServer.map((t) => locali.get(t.id) ?? t);
    for (const t of nuove) {
      if (!tappe.some((x) => x.id === t.id)) tappe.push(locali.get(t.id) ?? t);
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
  // tutta la tappa, una POST già arrivata riceve un 409)
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      for (const t of coda.nonConfermate()) {
        const legaId = daCreare.get(t.id);
        if (legaId === undefined) {
          legheApi.putTappa(t, true).catch(() => {});
          continue;
        }
        legheApi.addTappa(legaId, t, true).catch(() => {});
      }
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

    setUser: (user) => set({ user }),
    clearSyncError: () => set({ syncError: null }),

    salvaTutto: async () => {
      await Promise.all([coda.svuota(), rinomina()]);
      return coda.inAttesa().length;
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
        const nuove = inCoda.filter((t) => daCreare.get(t.id) === id);
        const lega = await legheApi.get(id);
        ricordaLega(id);
        set({ legaId: id, legaName: lega.nome, tappe: conVersioniLocali(lega.tappe, inCoda, nuove) });
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
        await legheApi.remove(id);
      } else {
        localStorage.removeItem(legaStorageKey(id));
      }
      const leghe = get().leghe.filter((m) => m.id !== id);
      if (!isRemote()) writeIndex(leghe);
      if (get().legaId === id) {
        // Le tappe se ne vanno con la lega: i loro salvataggi in attesa o in nuovo tentativo partirebbero dopo la DELETE
        // e avrebbero un 404 (la POST, su una lega che non c'è più), cioè un errore per dati eliminati apposta
        for (const t of get().tappe) {
          coda.annulla(t.id);
          daCreare.delete(t.id);
        }
        localStorage.removeItem(chiaveAttiva());
        set({ leghe, legaId: null, legaName: "", tappe: [] });
        spazioTornato(); // la lega con le modifiche non salvate non c'è più: l'avviso non dice più il vero
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

    // Usato per viste pubbliche/archivio: non cambia legaId né persiste
    setLega: (legaName, tappe) => set({ legaName, tappe }),

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
        ricordaLega(meta.id);
        set({ legaId: meta.id, leghe: [meta, ...get().leghe], legaName: meta.nome, tappe });
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
        coda.annulla(id); // un salvataggio ancora in attesa su una tappa eliminata darebbe 404
        touchIndex();
        // Creazione non ancora confermata: niente DELETE, la tappa potrebbe non essere mai arrivata al server
        if (daCreare.delete(id)) {
          eliminatePrimaDellaCreazione.add(id);
          return;
        }
        eliminaSulServer(id);
        return;
      }
      persistLocal();
    },

    reset: () => {
      // Chi esce rinuncia a ciò che non è stato salvato: nessun invio parte più dopo il logout
      coda.azzera();
      daCreare.clear();
      eliminatePrimaDellaCreazione.clear();
      // Chi esce dimentica la sua lega aperta; quella dell'altra modalità (ospite o registrato) resta
      localStorage.removeItem(chiaveAttiva());
      set({ user: null, legaId: null, leghe: [], legaName: "", tappe: [], ready: true, syncError: null });
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
