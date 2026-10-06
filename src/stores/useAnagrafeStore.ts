import { create } from "zustand";
import {
  anagrafeApi, toGiocatoreInput, toSquadraInput,
  type GiocatoreInput, type SquadraInput,
} from "../services/anagrafeApi";
import { testoErrore } from "../services/api";
import { replaceById } from "../utils/replaceById";
import type { RegGiocatore, RegSquadra } from "../types";

/**
 * Cache dell'anagrafe condivisa del circuito (giocatori e squadre).
 * Il primo load() la scarica dal server; da lì in poi le pagine la leggono da qui senza altre
 * richieste, e ogni scrittura (dalle pagine o dal Coach AI) aggiorna sia il server sia la cache.
 * Le modifiche fatte da altri utenti si vedono al reload della pagina.
 */
interface AnagrafeState {
  /** null = non ancora caricata (le pagine mostrano il caricamento, o l'errore se `errore` c'è) */
  giocatori: RegGiocatore[] | null;
  squadre: RegSquadra[] | null;
  /** Perché l'ultimo caricamento non è riuscito; null se è andato bene o è in corso. Le liste restano a null: un caricamento
   *  fallito non è un'anagrafe vuota, e la pagina deve dirlo con un «Riprova» */
  errore: string | null;
  /** true dopo un caricamento riuscito: i load() successivi non richiamano il server */
  caricata: boolean;
  load: () => Promise<void>;
  /** Cerca una squadra per nome (case-insensitive): prima in cache, poi sul server */
  trovaSquadra: (nome: string) => Promise<RegSquadra | undefined>;
  saveGiocatore: (data: GiocatoreInput) => Promise<void>;
  saveSquadra: (data: SquadraInput) => Promise<RegSquadra>;
  removeGiocatore: (id: string) => Promise<void>;
  /** Sovrascrive un giocatore esistente (id e autore restano, il server aggiorna ts).
   *  @returns il giocatore com'è sul server: è quello da mostrare, non ciò che si è scritto */
  updateGiocatore: (updated: RegGiocatore) => Promise<RegGiocatore>;
  removeSquadra: (id: string) => Promise<void>;
  /** Sovrascrive una squadra esistente (roster compreso).
   *  @returns la squadra com'è sul server */
  updateSquadra: (updated: RegSquadra) => Promise<RegSquadra>;
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
    errore: null,
    caricata: false,

    load: () => {
      if (get().caricata) return Promise.resolve();
      if (inCorso) return inCorso;
      const scrittureAllInizio = scritture;
      set({ errore: null });
      inCorso = Promise.all([anagrafeApi.listGiocatori(), anagrafeApi.listSquadre()])
        // La cache vale solo se nel frattempo non ci sono state scritture: altrimenti il prossimo load() riscarica
        .then(([giocatori, squadre]) => set({ giocatori, squadre, caricata: scritture === scrittureAllInizio }))
        // Server non raggiungibile o che risponde con un errore: le liste restano come erano (null se non sono mai arrivate) e il
        // motivo va in `errore`. La cache resta non valida: «Riprova», o il prossimo mount, ritenta
        .catch((e) => set({ errore: testoErrore(e) }))
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
      const trovata = fresche.find(stessoNome);
      // La voce entra in cache: chi la vedrà collegata a una squadra (la pagina della tappa, che scollega le squadre senza voce)
      // la ritrova, e non la crede eliminata
      if (trovata) {
        aggiorna((_giocatori, squadre) => {
          // Già in cache con un altro nome (rinominata dopo il caricamento): si aggiorna, non si raddoppia
          if (squadre.some((s) => s.id === trovata.id)) return { squadre: replaceById(squadre, trovata) };
          return { squadre: [trovata, ...squadre] };
        });
      }
      return trovata;
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
      return rec;
    },

    removeSquadra: async (id) => {
      await anagrafeApi.removeSquadra(id);
      aggiorna((_giocatori, squadre) => ({ squadre: squadre.filter((x) => x.id !== id) }));
    },

    updateSquadra: async (updated) => {
      const rec = await anagrafeApi.updateSquadra(updated.id, toSquadraInput(updated));
      aggiorna((_giocatori, squadre) => ({ squadre: replaceById(squadre, rec) }));
      return rec;
    },
  };
});
