import { create } from "zustand";
import type { Lega, Tappa, User } from "../types";
import { storage } from "../services/storage";

interface AppState {
  user: User | null;
  legaName: string;
  tappe: Tappa[];
  setUser: (u: User | null) => void;
  setLegaName: (nome: string) => void;
  setLega: (nome: string, tappe: Tappa[]) => void;
  addTappa: (t: Tappa) => void;
  updateTappa: (id: string, patch: Partial<Tappa>) => void;
  replaceTappa: (t: Tappa) => void;
  removeTappa: (id: string) => void;
  reset: () => void;
}

/** Chiave localStorage per la sessione utente corrente. */
export const SESSION_KEY = "hoop3x3_session";
/** Prefisso usato dal servizio storage (deve rimanere allineato con storage.ts). */
const NS = "hoop3x3_";

/** Legge sessione + lega in modo sincrono al caricamento del modulo,
 *  così lo store parte già idratato ed evita il flash della pagina di login. */
function getInitialState(): { user: User | null; legaName: string; tappe: Tappa[] } {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { user: null, legaName: "", tappe: [] };
    const user = JSON.parse(raw) as User;
    const legaKey = NS + (user.guest ? "lega3x3_guest" : "lega3x3");
    const legaRaw = localStorage.getItem(legaKey);
    if (!legaRaw) return { user, legaName: "", tappe: [] };
    const l = JSON.parse(legaRaw) as Lega;
    return { user, legaName: l.nome || "", tappe: l.tappe || [] };
  } catch {
    return { user: null, legaName: "", tappe: [] };
  }
}

const initial = getInitialState();

/** Persiste la lega su storage (registrati → "lega3x3", ospiti → "lega3x3_guest") */
function persist(state: Pick<AppState, "user" | "legaName" | "tappe">) {
  if (!state.user) return;
  const key = state.user.guest ? "lega3x3_guest" : "lega3x3";
  storage.set(key, JSON.stringify({ nome: state.legaName, tappe: state.tappe })).catch(() => {});
}

export const useAppStore = create<AppState>((set, get) => ({
  user: initial.user,
  legaName: initial.legaName,
  tappe: initial.tappe,
  setUser: (user) => set({ user }),
  setLegaName: (legaName) => { set({ legaName }); persist(get()); },
  setLega: (legaName, tappe) => set({ legaName, tappe }),
  addTappa: (t) => { set((s) => ({ tappe: [...s.tappe, t] })); persist(get()); },
  updateTappa: (id, patch) => {
    set((s) => ({ tappe: s.tappe.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    persist(get());
  },
  replaceTappa: (t) => {
    set((s) => ({ tappe: s.tappe.map((x) => (x.id === t.id ? t : x)) }));
    persist(get());
  },
  removeTappa: (id) => { set((s) => ({ tappe: s.tappe.filter((t) => t.id !== id) })); persist(get()); },
  reset: () => set({ user: null, legaName: "", tappe: [] }),
}));
