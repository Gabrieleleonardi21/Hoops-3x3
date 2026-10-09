import { create } from "zustand";
import { campettiApi, type RicercaCampetti } from "../services/campettiApi";
import { ApiError, testoErrore } from "../services/api";
import { replaceById } from "../utils/replaceById";
import { campettoModificatoAltrove } from "../utils/testi";
import type { Campetto, CampettoInput } from "../types/campetto";

/**
 * Cache dei campetti dell'ultima ricerca (D9): i campetti intorno a un punto, o quelli che corrispondono a un testo. Sta in uno store
 * e non nella pagina perché tornando sui Campetti con la stessa ricerca l'elenco è già qui, senza un'altra richiesta. Le scritture
 * (save, update, remove: T5.5) aggiornano server ed elenco. La lettura è pubblica, ma la forma dipende dal token: senza account il
 * server manda `autoreId` null (come i dati riservati dell'anagrafe), e `autoreId` decide chi vede «Modifica» ed «Elimina». Per questo
 * la cache si svuota (svuota) ogni volta che cambia chi la guarda, come l'anagrafe (useAuth, App).
 */
interface CampettiState {
  /** null = non ancora caricati, o l'ultima ricerca è fallita (`errore` dice perché): un caricamento fallito non è una zona vuota */
  campetti: Campetto[] | null;
  /** La ricerca di cui `campetti` è il risultato, o quella in corso; null all'inizio e dopo svuota */
  ricerca: RicercaCampetti | null;
  /** Perché l'ultima ricerca non è riuscita; null se è andata bene o è in corso */
  errore: string | null;
  /** true mentre il server risponde: la pagina può dirlo senza svuotare l'elenco di prima */
  inCorso: boolean;
  /** Quante ricerche sono partite. Ogni risposta porta l'epoca della sua ricerca: se intanto ne è partita un'altra (o la cache è
   *  stata svuotata), la risposta è vecchia e si scarta, così scrivere nella casella di ricerca non fa comparire i risultati
   *  nell'ordine in cui il server risponde */
  epoca: number;
  /** Quante volte la cache è stata svuotata: la pagina aperta lo mette tra le dipendenze dell'effetto che chiama `carica`, e
   *  riscarica dopo un accesso o un'uscita. Non `epoca`, che cambia a ogni ricerca: l'effetto si richiamerebbe da solo */
  svuotata: number;
  /** Chiede al server i campetti della ricerca; con la stessa ricerca già caricata non fa niente. Dopo un errore ritenta sempre
   *  (il «Riprova» della pagina). Non rifiuta mai: l'esito è nello stato */
  carica: (ricerca: RicercaCampetti) => Promise<void>;
  /** Crea il campetto sul server (POST, 401 senza token) e lo mette in testa all'elenco corrente, se c'è: la pagina lo riordina.
   *  Il rifiuto del server passa a chi chiama (il form lo mostra, con i dati che restano) */
  save: (input: CampettoInput) => Promise<void>;
  /** Sovrascrive un campetto (PUT con la `versione` dell'input) e mette nell'elenco quello restituito dal server. Con un 409
   *  (modificato da un altro dispositivo) ricarica la ricerca corrente, così l'elenco mostra la versione del server, e rifiuta con
   *  il testo per l'utente; ogni altro errore passa com'è */
  update: (id: string, input: CampettoInput) => Promise<void>;
  /** Elimina il campetto sul server (DELETE, solo autore o ADMIN) e lo toglie dall'elenco */
  remove: (id: string) => Promise<void>;
  /** Butta via la cache: accesso, registrazione e uscita (useAuth), accesso o uscita in un'altra scheda (App). Una ricerca in corso
   *  non conta più: la sua risposta, partita con il token di prima, si scarta quando arriva */
  svuota: () => void;
}

/** Due ricerche sono uguali se hanno gli stessi parametri: il confronto per valore, non per oggetto (la pagina ne costruisce uno nuovo
 *  a ogni render). Le chiavi di RicercaCampetti sono poche e in ordine fisso, quindi basta il JSON */
const stessaRicerca = (a: RicercaCampetti | null, b: RicercaCampetti) => JSON.stringify(a) === JSON.stringify(b);

export const useCampettiStore = create<CampettiState>((set, get) => {
  /** Chiede al server i campetti della ricerca, senza guardare la cache */
  const scarica = (ricerca: RicercaCampetti) => {
    const epoca = get().epoca + 1;
    // L'elenco di prima resta finché non arriva quello nuovo: la mappa non si svuota a ogni ricerca
    set({ ricerca, errore: null, inCorso: true, epoca });
    const vecchia = () => get().epoca !== epoca;
    return campettiApi.list(ricerca)
      .then((campetti) => {
        if (vecchia()) return;
        set({ campetti, inCorso: false });
      })
      // I campetti vanno a null, non restano quelli di prima: erano i risultati di un'altra ricerca, e sotto l'errore direbbero una
      // cosa falsa. La pagina mostra il motivo con «Riprova»
      .catch((e) => {
        if (vecchia()) return;
        set({ campetti: null, errore: testoErrore(e), inCorso: false });
      });
  };

  /** Dopo una scrittura riuscita aggiorna l'elenco in memoria; se non c'è (non caricato, in errore) lo porterà la prossima ricerca */
  const aggiorna = (fn: (campetti: Campetto[]) => Campetto[]) => {
    const { campetti } = get();
    if (campetti) set({ campetti: fn(campetti) });
  };

  return {
    campetti: null,
    ricerca: null,
    errore: null,
    inCorso: false,
    epoca: 0,
    svuotata: 0,

    carica: (ricerca) => {
      const s = get();
      if (s.campetti && !s.errore && stessaRicerca(s.ricerca, ricerca)) return Promise.resolve();
      return scarica(ricerca);
    },

    save: async (input) => {
      const rec = await campettiApi.create(input);
      aggiorna((campetti) => [rec, ...campetti]);
    },

    update: async (id, input) => {
      try {
        const rec = await campettiApi.update(id, input);
        aggiorna((campetti) => replaceById(campetti, rec));
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 409) throw e;
        // Vale il campetto del server: si rilegge la ricerca corrente (se la pagina ne ha una), poi il motivo a chi ha salvato
        const { ricerca } = get();
        if (ricerca) await scarica(ricerca);
        throw new ApiError(409, campettoModificatoAltrove(input.nome));
      }
    },

    remove: async (id) => {
      await campettiApi.remove(id);
      aggiorna((campetti) => campetti.filter((c) => c.id !== id));
    },

    svuota: () => set((s) => ({ campetti: null, ricerca: null, errore: null, inCorso: false, epoca: s.epoca + 1, svuotata: s.svuotata + 1 })),
  };
});
