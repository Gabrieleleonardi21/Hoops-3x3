import { create } from "zustand";
import type { Lega, LegaMeta, Partita, Tappa, User } from "../types";
import { uid } from "../utils/uid";
import { legheApi } from "../services/legheApi";
import { ApiError } from "../services/api";
import { createSaveQueue } from "./saveQueue";

/**
 * Store globale: utente, indice leghe e lega attiva con le sue tappe.
 * Le azioni aggiornano SUBITO lo stato in memoria (la UI resta reattiva) e poi persistono:
 *  - ospite  → localStorage, come nelle versioni precedenti
 *  - registrato → backend REST (legheApi); creazione e modifiche delle tappe passano dalla coda
 *    dei salvataggi (saveQueue.ts): una raffica di input diventa un solo invio, mai due richieste
 *    insieme per la stessa tappa, nuovi tentativi se la rete o il server hanno un problema temporaneo.
 * Gli errori finiscono in `syncError`, le tappe non ancora salvate in `inSospeso` ed `erroreSalvataggio`
 * (tutti mostrati da SyncBanner in App).
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
const ACTIVE_KEY = NS + "active_lega_id"; // ID della lega aperta per ultima (ospite e registrati)

const legaStorageKey = (id: string) => NS + `lega_${id}`;

/* ── localStorage (ospite) ─────────────────────────────────────────────────── */

function readIndex(): LegaMeta[] {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]"); }
  catch { return []; }
}

function writeIndex(leghe: LegaMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(leghe));
}

function readLegaData(id: string): Lega | null {
  try { return JSON.parse(localStorage.getItem(legaStorageKey(id)) || "null"); }
  catch { return null; }
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
function getInitialState(): Pick<AppState, "user" | "legaId" | "leghe" | "legaName" | "tappe" | "ready"> {
  const empty = { user: null, legaId: null, leghe: [], legaName: "", tappe: [], ready: true };
  const user = readSession();
  if (!user) return empty;
  if (!user.guest) return { ...empty, user, ready: false };

  const leghe = readIndex();
  const activeId = localStorage.getItem(ACTIVE_KEY);
  const lega = activeId ? readLegaData(activeId) : null;
  if (!activeId || !lega) return { ...empty, user, leghe };
  return { user, legaId: activeId, leghe, legaName: lega.nome || "", tappe: lega.tappe || [], ready: true };
}

/* ── Salvataggi sul server (registrati) ───────────────────────────────────── */

/** Attesa dopo l'ultima modifica prima di salvare una tappa o rinominare la lega */
const SAVE_DELAY = 400;

/** Testo dell'errore per l'utente: il messaggio del server o della rete, altrimenti uno generico */
function testoErrore(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "errore imprevisto";
}

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

  /** Ospite: salva la lega attiva su localStorage e aggiorna nTappe/ts nell'indice */
  const persistLocal = () => {
    const s = get();
    if (!s.legaId) return;
    localStorage.setItem(legaStorageKey(s.legaId), JSON.stringify({ nome: s.legaName, tappe: s.tappe }));
    const leghe = s.leghe.map((m) =>
      m.id === s.legaId ? { ...m, nTappe: s.tappe.length, ts: Date.now() } : m
    );
    writeIndex(leghe);
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

  const coda = createSaveQueue({
    salva: salvaSulServer,
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
    syncError: null,
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
        localStorage.setItem(ACTIVE_KEY, meta.id);
        set({ legaId: meta.id, leghe: [meta, ...get().leghe], legaName: meta.nome, tappe: [] });
        return meta.id;
      }
      const id = uid();
      const meta: LegaMeta = { id, nome: trimmed, ts: Date.now(), nTappe: 0 };
      const leghe = [...get().leghe, meta];
      localStorage.setItem(legaStorageKey(id), JSON.stringify({ nome: trimmed, tappe: [] }));
      localStorage.setItem(ACTIVE_KEY, id);
      writeIndex(leghe);
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
        localStorage.setItem(ACTIVE_KEY, id);
        set({ legaId: id, legaName: lega.nome, tappe: conVersioniLocali(lega.tappe, inCoda, nuove) });
        return;
      }
      const lega = readLegaData(id);
      if (!lega) return;
      localStorage.setItem(ACTIVE_KEY, id);
      set({ legaId: id, legaName: lega.nome || "", tappe: lega.tappe || [] });
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
        localStorage.removeItem(ACTIVE_KEY);
        set({ leghe, legaId: null, legaName: "", tappe: [] });
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
      localStorage.setItem(legaStorageKey(s.legaId), JSON.stringify({ nome: legaName, tappe: s.tappe }));
      writeIndex(leghe);
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
        localStorage.setItem(ACTIVE_KEY, meta.id);
        set({ legaId: meta.id, leghe: [meta, ...get().leghe], legaName: meta.nome, tappe });
        return;
      }
      const id = uid();
      const meta: LegaMeta = { id, nome: trimmed, ts: Date.now(), nTappe: tappe.length };
      const leghe = [...get().leghe, meta];
      localStorage.setItem(legaStorageKey(id), JSON.stringify({ nome: trimmed, tappe }));
      localStorage.setItem(ACTIVE_KEY, id);
      writeIndex(leghe);
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
      localStorage.removeItem(ACTIVE_KEY);
      set({ user: null, legaId: null, leghe: [], legaName: "", tappe: [], ready: true, syncError: null });
    },

    rehydrate: async () => {
      if (isRemote()) {
        set({ ready: false });
        try {
          const leghe = await legheApi.list();
          const activeId = localStorage.getItem(ACTIVE_KEY);
          // La lega attiva potrebbe essere di un altro account usato su questo browser
          const attiva = activeId && leghe.some((m) => m.id === activeId) ? await legheApi.get(activeId) : null;
          if (!attiva) {
            localStorage.removeItem(ACTIVE_KEY);
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
      const leghe = readIndex();
      const activeId = localStorage.getItem(ACTIVE_KEY);
      const lega = activeId ? readLegaData(activeId) : null;
      if (!activeId || !lega) { set({ leghe, ready: true }); return; }
      set({ leghe, legaId: activeId, legaName: lega.nome || "", tappe: lega.tappe || [], ready: true });
    },
  };
});

/** La tappa com'è adesso nello store. Chi calcola una nuova versione con le funzioni di tappaOps parte da qui e non
 *  dalla copia vista dal componente: dopo un'attesa, o se nel frattempo è cambiato qualcosa, quella copia è vecchia
 *  e salvarne un derivato cancellerebbe le modifiche arrivate nel frattempo. */
export function tappaCorrente(id: string | undefined): Tappa | null {
  return useAppStore.getState().tappe.find((t) => t.id === id) ?? null;
}
