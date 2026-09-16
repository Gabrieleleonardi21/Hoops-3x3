import { create } from "zustand";
import type { BracketMatch, Lega, LegaMeta, Partita, Tappa, User } from "../types";
import { uid, isUuid } from "../utils/uid";
import { legheApi } from "../services/legheApi";
import { ApiError } from "../services/api";

/**
 * Store globale: utente, indice leghe e lega attiva con le sue tappe.
 * Le azioni aggiornano SUBITO lo stato in memoria (la UI resta reattiva) e poi persistono:
 *  - ospite  → localStorage, come nelle versioni precedenti
 *  - registrato → backend REST (legheApi); le modifiche alle tappe sono raggruppate
 *    con un debounce per tappa, così una raffica di input non genera una PUT per tasto.
 * Gli errori di salvataggio finiscono in `syncError` (mostrato da SyncBanner in App).
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
  setUser: (u: User | null) => void;
  clearSyncError: () => void;
  createLega: (nome: string) => Promise<string>;
  selectLega: (id: string) => Promise<void>;
  deleteLega: (id: string) => Promise<void>;
  setLegaName: (nome: string) => void;
  setLega: (nome: string, tappe: Tappa[]) => void;
  addTappa: (t: Tappa) => void;
  updateTappa: (id: string, patch: Partial<Tappa>) => void;
  /** Aggiorna una singola partita in modo atomico, evita race condition in chiamate parallele. */
  updateTappaPartita: (tappaId: string, partitaId: string, patch: Partial<Partita>) => void;
  /** Aggiorna un singolo match del bracket in modo atomico. */
  updateBracketMatch: (tappaId: string, matchId: string, patch: Partial<BracketMatch>) => void;
  /** Crea una nuova lega importando dati JSON (nome + tappe). */
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

/* ── Debounce dei salvataggi tappa (registrati) ───────────────────────────── */

const SAVE_DELAY = 400;
const pending = new Map<string, { tappa: Tappa; timer: number }>();

/** Sostituisce gli id non-UUID (versioni vecchie / file importati) prima di mandare la tappa al server */
function withUuid(t: Tappa): Tappa {
  if (isUuid(t.id)) return t;
  return { ...t, id: uid() };
}

const initial = getInitialState();

export const useAppStore = create<AppState>((set, get) => {
  const isRemote = () => {
    const u = get().user;
    return !!u && !u.guest;
  };

  const reportError = (e: unknown, cosa: string) => {
    const msg = e instanceof ApiError ? e.message : "errore imprevisto";
    set({ syncError: `${cosa}: ${msg}` });
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

  /** Registrato: PUT dell'ultima versione della tappa dopo SAVE_DELAY ms di quiete */
  const scheduleSave = (tappaId: string) => {
    const t = get().tappe.find((x) => x.id === tappaId);
    if (!t) return;
    const prev = pending.get(tappaId);
    if (prev) window.clearTimeout(prev.timer);
    const timer = window.setTimeout(() => {
      pending.delete(tappaId);
      legheApi.putTappa(t).catch((e) => reportError(e, "Salvataggio tappa non riuscito"));
    }, SAVE_DELAY);
    pending.set(tappaId, { tappa: t, timer });
  };

  /** Dopo una modifica alle tappe: localStorage per l'ospite, PUT differita per il registrato */
  const afterTappaChange = (tappaId: string) => {
    if (isRemote()) { scheduleSave(tappaId); return; }
    persistLocal();
  };

  /** Aggiorna nTappe/ts della lega attiva nell'indice in memoria (il server lo fa da sé) */
  const touchIndex = () => {
    const s = get();
    set({ leghe: s.leghe.map((m) => m.id === s.legaId ? { ...m, nTappe: s.tappe.length, ts: Date.now() } : m) });
  };

  // Chiusura pagina: le PUT in attesa partono subito (keepalive)
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      for (const [id, p] of pending) {
        window.clearTimeout(p.timer);
        pending.delete(id);
        legheApi.putTappa(p.tappa, true).catch(() => {});
      }
    });
  }

  let renameTimer = 0;

  return {
    ...initial,
    syncError: null,

    setUser: (user) => set({ user }),
    clearSyncError: () => set({ syncError: null }),

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
        const lega = await legheApi.get(id);
        localStorage.setItem(ACTIVE_KEY, id);
        set({ legaId: id, legaName: lega.nome, tappe: lega.tappe });
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
        // L'input chiama setLegaName a ogni tasto: una sola PATCH a fine digitazione
        window.clearTimeout(renameTimer);
        renameTimer = window.setTimeout(() => {
          legheApi.rename(s.legaId!, get().legaName.trim() || "Lega")
            .catch((e) => reportError(e, "Rinomina lega non riuscita"));
        }, SAVE_DELAY);
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
        legheApi.addTappa(get().legaId!, t).catch((e) => reportError(e, "Creazione tappa non riuscita"));
        return;
      }
      persistLocal();
    },

    updateTappa: (id, patch) => {
      set((s) => ({ tappe: s.tappe.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
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

    updateBracketMatch: (tappaId, matchId, patch) => {
      set((s) => ({
        tappe: s.tappe.map((t) =>
          t.id !== tappaId ? t : {
            ...t,
            bracket: (t.bracket ?? []).map((m) => m.id === matchId ? { ...m, ...patch } : m),
          }
        ),
      }));
      afterTappaChange(tappaId);
    },

    importLega: async (nome, tappe) => {
      const trimmed = nome.trim() || "Lega importata";
      if (isRemote()) {
        const fixed = tappe.map(withUuid);
        const meta = await legheApi.create(trimmed, fixed);
        localStorage.setItem(ACTIVE_KEY, meta.id);
        set({ legaId: meta.id, leghe: [meta, ...get().leghe], legaName: meta.nome, tappe: fixed });
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
        // Una PUT in coda su una tappa eliminata darebbe 404: si annulla
        const p = pending.get(id);
        if (p) { window.clearTimeout(p.timer); pending.delete(id); }
        touchIndex();
        legheApi.removeTappa(id).catch((e) => reportError(e, "Eliminazione tappa non riuscita"));
        return;
      }
      persistLocal();
    },

    reset: () => {
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
