import { create } from "zustand";
import {
  anagrafeApi, toGiocatoreInput, toSquadraInput,
  type GiocatoreInput, type SquadraInput,
} from "../services/anagrafeApi";
import { testoErrore } from "../services/api";
import { senzaDoppioni } from "../services/senzaDoppioni";
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

/** Un campo com'è sul server: il server toglie gli spazi ai lati dei testi */
function pulito(valore: unknown): unknown {
  if (typeof valore === "string") return valore.trim();
  return valore;
}

/** La voce del server ha tutti i campi con cui è stata creata (i campi del form, roster compreso: gli id si confrontano in ordine) */
function haGliStessiCampi(voce: object, dati: object): boolean {
  const campi = voce as Record<string, unknown>;
  return Object.entries(dati).every(([campo, valore]) => JSON.stringify(pulito(campi[campo])) === JSON.stringify(pulito(valore)));
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

  // Le POST di creazione non sono idempotenti (l'id lo assegna il server): se una risposta si perde, il nuovo tentativo con gli
  // stessi dati cerca la voce già creata invece di farne un doppione (vedi senzaDoppioni)
  const creaGiocatore = senzaDoppioni<GiocatoreInput, RegGiocatore>({
    crea: (dati) => anagrafeApi.createGiocatore(dati),
    elenca: () => anagrafeApi.listGiocatori(),
    corrisponde: haGliStessiCampi,
    noti: () => (get().giocatori ?? []).map((g) => g.id),
  });
  const creaSquadra = senzaDoppioni<SquadraInput, RegSquadra>({
    crea: (dati) => anagrafeApi.createSquadra(dati),
    elenca: () => anagrafeApi.listSquadre(),
    corrisponde: haGliStessiCampi,
    noti: () => (get().squadre ?? []).map((s) => s.id),
  });

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
      return fresche.find(stessoNome);
    },

    // I filtri servono se la voce è quella di un tentativo precedente e la cache la conteneva già
    saveGiocatore: async (data) => {
      const rec = await creaGiocatore.crea(data);
      aggiorna((giocatori) => ({ giocatori: [rec, ...giocatori.filter((x) => x.id !== rec.id)] }));
    },

    saveSquadra: async (data) => {
      const rec = await creaSquadra.crea(data);
      aggiorna((_giocatori, squadre) => ({ squadre: [rec, ...squadre.filter((x) => x.id !== rec.id)] }));
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
