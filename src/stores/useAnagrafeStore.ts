import { create } from "zustand";
import {
  anagrafeApi, toGiocatoreInput, toSquadraInput,
  type GiocatoreInput, type SquadraInput,
} from "../services/anagrafeApi";
import { replaceById } from "../utils/replaceById";
import type { RegGiocatore, RegSquadra } from "../types";

/**
 * Cache dell'anagrafe condivisa del circuito (giocatori e squadre).
 * Il primo load() la scarica dal server; da lì in poi le pagine la leggono da qui senza altre
 * richieste, e ogni scrittura (dalle pagine o dal Coach AI) aggiorna sia il server sia la cache.
 * Le modifiche fatte da altri utenti si vedono al reload della pagina.
 */
interface AnagrafeState {
  /** null = non ancora caricata (le pagine mostrano il caricamento) */
  giocatori: RegGiocatore[] | null;
  squadre: RegSquadra[] | null;
  /** true dopo un caricamento riuscito: i load() successivi non richiamano il server */
  caricata: boolean;
  load: () => Promise<void>;
  /** Cerca una squadra per nome (case-insensitive): prima in cache, poi sul server */
  trovaSquadra: (nome: string) => Promise<RegSquadra | undefined>;
  saveGiocatore: (data: GiocatoreInput) => Promise<void>;
  saveSquadra: (data: SquadraInput) => Promise<RegSquadra>;
  removeGiocatore: (id: string) => Promise<void>;
  /** Sovrascrive un giocatore esistente (id e autore restano, il server aggiorna ts) */
  updateGiocatore: (updated: RegGiocatore) => Promise<void>;
  removeSquadra: (id: string) => Promise<void>;
  /** Sovrascrive una squadra esistente (roster compreso) */
  updateSquadra: (updated: RegSquadra) => Promise<void>;
}

// Caricamento in corso: più componenti montati insieme (o lo StrictMode) condividono la stessa richiesta
let inCorso: Promise<void> | null = null;
// Scritture completate: un caricamento partito prima di una scrittura può non contenerla
let scritture = 0;

export const useAnagrafeStore = create<AnagrafeState>((set, get) => {
  /** Dopo una scrittura riuscita aggiorna le liste in memoria; se non ci sono ancora le porterà il prossimo load() */
  const aggiorna = (fn: (giocatori: RegGiocatore[], squadre: RegSquadra[]) => Partial<AnagrafeState>) => {
    scritture++;
    const { giocatori, squadre } = get();
    if (giocatori && squadre) set(fn(giocatori, squadre));
  };

  return {
    giocatori: null,
    squadre: null,
    caricata: false,

    load: () => {
      if (get().caricata) return Promise.resolve();
      if (inCorso) return inCorso;
      const scrittureAllInizio = scritture;
      inCorso = Promise.all([anagrafeApi.listGiocatori(), anagrafeApi.listSquadre()])
        // La cache vale solo se nel frattempo non ci sono state scritture: altrimenti il prossimo load() riscarica
        .then(([giocatori, squadre]) => set({ giocatori, squadre, caricata: scritture === scrittureAllInizio }))
        // Server non raggiungibile: liste vuote come prima; la cache resta non valida e il prossimo mount riprova
        .catch(() => set((s) => ({ giocatori: s.giocatori ?? [], squadre: s.squadre ?? [] })))
        .finally(() => { inCorso = null; });
      return inCorso;
    },

    trovaSquadra: async (nome) => {
      const cercato = nome.trim().toLowerCase();
      const stessoNome = (s: RegSquadra) => s.nome.toLowerCase() === cercato;
      const inCache = (get().squadre ?? []).find(stessoNome);
      if (inCache) return inCache;
      // Non in cache: un altro utente può averla registrata dopo il caricamento, quindi prima di
      // farne un doppione si ricontrolla sul server (a server spento vale la risposta della cache)
      const fresche = await anagrafeApi.listSquadre().catch(() => []);
      return fresche.find(stessoNome);
    },

    saveGiocatore: async (data) => {
      const rec = await anagrafeApi.createGiocatore(data);
      aggiorna((giocatori) => ({ giocatori: [rec, ...giocatori] }));
    },

    saveSquadra: async (data) => {
      const rec = await anagrafeApi.createSquadra(data);
      aggiorna((_giocatori, squadre) => ({ squadre: [rec, ...squadre] }));
      return rec;
    },

    removeGiocatore: async (id) => {
      await anagrafeApi.removeGiocatore(id);
      // Il server lo toglie anche dai roster: si allinea la copia locale delle squadre
      aggiorna((giocatori, squadre) => ({
        giocatori: giocatori.filter((x) => x.id !== id),
        squadre: squadre.map((s) => ({ ...s, roster: s.roster.filter((g) => g !== id) })),
      }));
    },

    updateGiocatore: async (updated) => {
      const rec = await anagrafeApi.updateGiocatore(updated.id, toGiocatoreInput(updated));
      aggiorna((giocatori) => ({ giocatori: replaceById(giocatori, rec) }));
    },

    removeSquadra: async (id) => {
      await anagrafeApi.removeSquadra(id);
      aggiorna((_giocatori, squadre) => ({ squadre: squadre.filter((x) => x.id !== id) }));
    },

    updateSquadra: async (updated) => {
      const rec = await anagrafeApi.updateSquadra(updated.id, toSquadraInput(updated));
      aggiorna((_giocatori, squadre) => ({ squadre: replaceById(squadre, rec) }));
    },
  };
});
