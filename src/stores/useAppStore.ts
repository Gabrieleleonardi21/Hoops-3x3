import { create } from "zustand";
import type { Tappa, User } from "../types";
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

/** Persiste la lega su storage (solo per utenti registrati) */
function persist(state: Pick<AppState, "user" | "legaName" | "tappe">) {
  if (!state.user || state.user.guest) return;
  storage.set("lega3x3", JSON.stringify({ nome: state.legaName, tappe: state.tappe })).catch(() => {});
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  legaName: "",
  tappe: [],
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
