import { create } from "zustand";
import type { Lega, LegaMeta, Tappa, User } from "../types";
import { uid } from "../utils/uid";

interface AppState {
  user: User | null;
  legaId: string | null;    // ID della lega attualmente aperta
  leghe: LegaMeta[];        // indice di tutte le leghe dell'utente
  legaName: string;
  tappe: Tappa[];
  setUser: (u: User | null) => void;
  createLega: (nome: string) => string;
  selectLega: (id: string) => void;
  deleteLega: (id: string) => void;
  setLegaName: (nome: string) => void;
  setLega: (nome: string, tappe: Tappa[]) => void;
  addTappa: (t: Tappa) => void;
  updateTappa: (id: string, patch: Partial<Tappa>) => void;
  replaceTappa: (t: Tappa) => void;
  removeTappa: (id: string) => void;
  reset: () => void;
  /** Ricarica leghe e lega attiva da localStorage (usato dopo login/logout) */
  rehydrate: () => void;
}

export const SESSION_KEY = "hoop3x3_session";
const NS = "hoop3x3_";
const INDEX_KEY  = NS + "leghe_index";   // lista dei metadati di tutte le leghe
const ACTIVE_KEY = NS + "active_lega_id"; // ID della lega aperta per ultima

const legaStorageKey = (id: string) => NS + `lega_${id}`;

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

/** Legge sessione + leghe all'avvio, con migrazione automatica dalla vecchia chiave singola */
function getInitialState(): { user: User | null; legaId: string | null; leghe: LegaMeta[]; legaName: string; tappe: Tappa[] } {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { user: null, legaId: null, leghe: [], legaName: "", tappe: [] };
    const user = JSON.parse(raw) as User;

    let leghe = readIndex();

    // Migrazione dalla vecchia chiave singola (lega3x3 / lega3x3_guest)
    if (leghe.length === 0) {
      const oldKey = NS + (user.guest ? "lega3x3_guest" : "lega3x3");
      const oldRaw = localStorage.getItem(oldKey);
      if (oldRaw) {
        const oldLega = JSON.parse(oldRaw) as Lega;
        const migId = uid();
        const meta: LegaMeta = {
          id: migId, nome: oldLega.nome || "La mia lega",
          ts: Date.now(), nTappe: (oldLega.tappe || []).length,
        };
        localStorage.setItem(legaStorageKey(migId), oldRaw);
        leghe = [meta];
        writeIndex(leghe);
        localStorage.setItem(ACTIVE_KEY, migId);
        return { user, legaId: migId, leghe, legaName: meta.nome, tappe: oldLega.tappe || [] };
      }
    }

    const activeId = localStorage.getItem(ACTIVE_KEY);
    if (!activeId) return { user, legaId: null, leghe, legaName: "", tappe: [] };

    const lega = readLegaData(activeId);
    if (!lega) return { user, legaId: null, leghe, legaName: "", tappe: [] };

    return { user, legaId: activeId, leghe, legaName: lega.nome || "", tappe: lega.tappe || [] };
  } catch {
    return { user: null, legaId: null, leghe: [], legaName: "", tappe: [] };
  }
}

const initial = getInitialState();

export const useAppStore = create<AppState>((set, get) => {
  /** Persiste la lega attiva su localStorage e aggiorna nTappe nell'indice in memoria */
  const persistActive = () => {
    const s = get();
    if (!s.legaId) return;
    localStorage.setItem(legaStorageKey(s.legaId), JSON.stringify({ nome: s.legaName, tappe: s.tappe }));
    const leghe = s.leghe.map((m) =>
      m.id === s.legaId ? { ...m, nTappe: s.tappe.length, ts: Date.now() } : m
    );
    writeIndex(leghe);
    set({ leghe });
  };

  return {
    user: initial.user,
    legaId: initial.legaId,
    leghe: initial.leghe,
    legaName: initial.legaName,
    tappe: initial.tappe,

    setUser: (user) => set({ user }),

    createLega: (nome) => {
      const id = uid();
      const trimmed = nome.trim() || "Nuova lega";
      const meta: LegaMeta = { id, nome: trimmed, ts: Date.now(), nTappe: 0 };
      const leghe = [...get().leghe, meta];
      localStorage.setItem(legaStorageKey(id), JSON.stringify({ nome: trimmed, tappe: [] }));
      localStorage.setItem(ACTIVE_KEY, id);
      writeIndex(leghe);
      set({ legaId: id, leghe, legaName: trimmed, tappe: [] });
      return id;
    },

    selectLega: (id) => {
      const lega = readLegaData(id);
      if (!lega) return;
      localStorage.setItem(ACTIVE_KEY, id);
      set({ legaId: id, legaName: lega.nome || "", tappe: lega.tappe || [] });
    },

    deleteLega: (id) => {
      localStorage.removeItem(legaStorageKey(id));
      const leghe = get().leghe.filter((m) => m.id !== id);
      writeIndex(leghe);
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
      localStorage.setItem(legaStorageKey(s.legaId), JSON.stringify({ nome: legaName, tappe: s.tappe }));
      const leghe = s.leghe.map((m) => m.id === s.legaId ? { ...m, nome: legaName, ts: Date.now() } : m);
      writeIndex(leghe);
      set({ leghe });
    },

    // Usato per viste pubbliche/archivio: non cambia legaId né persiste
    setLega: (legaName, tappe) => set({ legaName, tappe }),

    addTappa: (t) => { set((s) => ({ tappe: [...s.tappe, t] })); persistActive(); },

    updateTappa: (id, patch) => {
      set((s) => ({ tappe: s.tappe.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      persistActive();
    },

    replaceTappa: (t) => {
      set((s) => ({ tappe: s.tappe.map((x) => (x.id === t.id ? t : x)) }));
      persistActive();
    },

    removeTappa: (id) => { set((s) => ({ tappe: s.tappe.filter((t) => t.id !== id) })); persistActive(); },

    reset: () => {
      localStorage.removeItem(ACTIVE_KEY);
      set({ user: null, legaId: null, leghe: [], legaName: "", tappe: [] });
    },

    // Rilege l'indice delle leghe e la lega attiva da localStorage.
    // Usato dopo login/logout per ripristinare lo stato senza ricaricare la pagina.
    rehydrate: () => {
      const leghe = readIndex();
      const activeId = localStorage.getItem(ACTIVE_KEY);
      if (!activeId) { set({ leghe }); return; }
      const lega = readLegaData(activeId);
      if (!lega) { set({ leghe }); return; }
      set({ leghe, legaId: activeId, legaName: lega.nome || "", tappe: lega.tappe || [] });
    },
  };
});
