import { create } from "zustand";
import {
  anagrafeApi, toGiocatoreInput, toSquadraInput,
  type GiocatoreInput, type SquadraInput,
} from "../services/anagrafeApi";
import { ApiError, testoErrore } from "../services/api";
import { replaceById } from "../utils/replaceById";
import { voceAnagrafeModificataAltrove } from "../utils/testi";
import type { RegGiocatore, RegSquadra } from "../types";

/** Il 409 di una PUT (B6): la voce è stata modificata da un altro dispositivo, e la versione mandata è vecchia. Si rilegge la voce
 *  dal server e `metti` la mette in cache (senza contare una scrittura: ciò che il server ha non l'abbiamo cambiato noi), così la
 *  scheda aperta mostra la versione nuova e il prossimo salvataggio parte da quella; a chi ha salvato torna un 409 con il testo
 *  per l'utente. Ogni altro errore, anche della rilettura, passa com'è. Se la voce sul server non c'è più resta il 409 del server */
async function dopoUnConflitto<T extends { id: string }>(
  e: unknown, id: string, rileggi: () => Promise<T[]>, metti: (voce: T) => void, frase: string,
): Promise<never> {
  if (!(e instanceof ApiError) || e.status !== 409) throw e;
  const voce = (await rileggi()).find((v) => v.id === id);
  if (!voce) throw e;
  metti(voce);
  throw new ApiError(409, frase);
}

/**
 * Cache dell'anagrafe condivisa del circuito (giocatori e squadre).
 * Il primo load() la scarica dal server; da lì in poi le pagine la leggono da qui senza altre
 * richieste, e ogni scrittura (dalle pagine o dal Coach AI) aggiorna sia il server sia la cache.
 * Le modifiche fatte da altri utenti si vedono al reload della pagina.
 * La forma dei dati dipende dal token: senza account il server nasconde i dati personali (data di nascita, misure, note,
 * autore), con un account li manda. Per questo la cache si svuota (svuota) ogni volta che cambia chi la guarda.
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
  /** Quante volte la cache è stata svuotata. Una lettura partita in un'epoca diversa da quella di adesso ha la forma del token di
   *  prima e non va usata. Sta nello stato, non in una variabile di modulo, perché chi la legge (useAnagrafe, useTappa) deve
   *  poterla confrontare, e perché cambia anche quando liste, errore e `caricata` erano già «vuoti» e niente altro cambierebbe:
   *  una pagina ferma sull'errore, o su un caricamento in volo, riparte solo se l'epoca cambia. */
  epoca: number;
  load: () => Promise<void>;
  /** Butta via la cache: accesso, registrazione e uscita (useAuth), accesso o uscita in un'altra scheda (App). Il load() successivo
   *  riscarica con il token di adesso. Un caricamento già in corso non conta più: la sua risposta, partita con il token di prima,
   *  si scarta quando arriva e non riempie la cache con la forma sbagliata. */
  svuota: () => void;
  /** Cerca una squadra per nome (case-insensitive): prima in cache, poi sul server. Se la lista del server non arriva rifiuta la
   *  promessa: «non trovata» farebbe creare un doppione di una squadra che sul server c'è */
  trovaSquadra: (nome: string) => Promise<RegSquadra | undefined>;
  /** Mette in cache voci lette dal server fuori dal caricamento (la ricerca per nome, la verifica di una tappa): in testa quelle nuove,
   *  aggiornate quelle già presenti con lo stesso id. Non conta come scrittura e non invalida la cache (`scritture` e `caricata`
   *  restano com'erano): non cambia ciò che il server ha, solo ciò che la cache sapeva. Con la cache non caricata non fa niente:
   *  non crea una cache parziale. */
  registraInCache: (squadre: RegSquadra[]) => void;
  saveGiocatore: (data: GiocatoreInput) => Promise<void>;
  saveSquadra: (data: SquadraInput) => Promise<RegSquadra>;
  removeGiocatore: (id: string) => Promise<void>;
  /** Sovrascrive un giocatore esistente (id e autore restano, il server aggiorna ts e versione). Con un 409 (modificato da un altro
   *  dispositivo) la cache prende la voce del server e la promessa è rifiutata con il testo per l'utente (dopoUnConflitto).
   *  @returns il giocatore com'è sul server: è quello da mostrare, non ciò che si è scritto */
  updateGiocatore: (updated: RegGiocatore) => Promise<RegGiocatore>;
  removeSquadra: (id: string) => Promise<void>;
  /** Sovrascrive una squadra esistente (roster compreso); il 409 come per updateGiocatore.
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
    epoca: 0,

    load: () => {
      if (get().caricata) return Promise.resolve();
      if (inCorso) return inCorso;
      const scrittureAllInizio = scritture;
      const epocaAllInizio = get().epoca;
      // Svuotata nel frattempo (accesso, uscita): la risposta è di un'altra sessione e non si usa, né come dati né come errore
      const scaduta = () => get().epoca !== epocaAllInizio;
      set({ errore: null });
      const richiesta = Promise.all([anagrafeApi.listGiocatori(), anagrafeApi.listSquadre()])
        // La cache vale solo se nel frattempo non ci sono state scritture: altrimenti il prossimo load() riscarica
        .then(([giocatori, squadre]) => {
          if (scaduta()) return;
          set({ giocatori, squadre, caricata: scritture === scrittureAllInizio });
        })
        // Server non raggiungibile o che risponde con un errore: le liste restano come erano (null se non sono mai arrivate) e il
        // motivo va in `errore`. La cache resta non valida: «Riprova», o il prossimo mount, ritenta
        .catch((e) => {
          if (!scaduta()) set({ errore: testoErrore(e) });
        })
        // Solo la propria richiesta: dopo uno svuotamento `inCorso` può essere già quella di un caricamento più recente
        .finally(() => {
          if (inCorso === richiesta) inCorso = null;
        });
      inCorso = richiesta;
      return richiesta;
    },

    svuota: () => {
      // Il prossimo load() riparte da zero, non si accoda a una richiesta partita con il token di prima
      inCorso = null;
      set({ giocatori: null, squadre: null, errore: null, caricata: false, epoca: get().epoca + 1 });
    },

    trovaSquadra: async (nome) => {
      const cercato = nome.trim().toLowerCase();
      const stessoNome = (s: RegSquadra) => s.nome.toLowerCase() === cercato;
      const inCache = (get().squadre ?? []).find(stessoNome);
      if (inCache) return inCache;
      // Non in cache: un altro utente può averla registrata dopo il caricamento, quindi prima di farne un doppione si ricontrolla
      // sul server. Un errore della lista arriva a chi chiama: a server spento rispondere «non trovata» farebbe creare la squadra
      // una seconda volta nell'anagrafe condivisa
      const epocaAllInizio = get().epoca;
      const fresche = await anagrafeApi.listSquadre();
      const trovata = fresche.find(stessoNome);
      // La voce entra in cache: chi la vedrà collegata a una squadra (la pagina della tappa, che scollega le squadre senza voce)
      // la ritrova, e non la crede eliminata. Non se nel frattempo la cache è stata svuotata: la voce ha la forma del token di prima
      // e sostituirebbe quella completa di una cache nuova (a chi la cercava la squadra si restituisce lo stesso)
      if (trovata && get().epoca === epocaAllInizio) get().registraInCache([trovata]);
      return trovata;
    },

    registraInCache: (nuove) => set((s) => {
      // Niente da fare (cache non caricata, o niente da registrare): lo stato resta lo stesso oggetto e nessuno viene notificato
      if (!s.squadre || nuove.length === 0) return s;
      let squadre = s.squadre;
      for (const voce of nuove) {
        // Già in cache con un altro nome (rinominata dopo il caricamento): si aggiorna, non si raddoppia
        if (squadre.some((x) => x.id === voce.id)) {
          squadre = replaceById(squadre, voce);
        } else {
          squadre = [voce, ...squadre];
        }
      }
      return { squadre };
    }),

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
      try {
        const rec = await anagrafeApi.updateGiocatore(updated.id, toGiocatoreInput(updated));
        aggiorna((giocatori) => ({ giocatori: replaceById(giocatori, rec) }));
        return rec;
      } catch (e) {
        return dopoUnConflitto(e, updated.id, anagrafeApi.listGiocatori,
          (voce) => set((s) => ({ giocatori: replaceById(s.giocatori ?? [], voce) })),
          voceAnagrafeModificataAltrove("Il giocatore", `${updated.nome} ${updated.cognome}`));
      }
    },

    removeSquadra: async (id) => {
      await anagrafeApi.removeSquadra(id);
      aggiorna((_giocatori, squadre) => ({ squadre: squadre.filter((x) => x.id !== id) }));
    },

    updateSquadra: async (updated) => {
      try {
        const rec = await anagrafeApi.updateSquadra(updated.id, toSquadraInput(updated));
        aggiorna((_giocatori, squadre) => ({ squadre: replaceById(squadre, rec) }));
        return rec;
      } catch (e) {
        return dopoUnConflitto(e, updated.id, anagrafeApi.listSquadre, (voce) => get().registraInCache([voce]),
          voceAnagrafeModificataAltrove("La squadra", updated.nome));
      }
    },
  };
});
