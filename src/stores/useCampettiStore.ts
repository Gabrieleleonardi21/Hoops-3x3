import { create } from "zustand";
import { campettiApi, type RicercaCampetti } from "../services/campettiApi";
import { testoErrore } from "../services/api";
import type { Campetto } from "../types/campetto";

/**
 * Cache dei campetti dell'ultima ricerca (D9): i campetti intorno a un punto, o quelli che corrispondono a un testo. Sta in uno store
 * e non nella pagina perché tornando sui Campetti con la stessa ricerca l'elenco è già qui, senza un'altra richiesta. Le scritture
 * (aggiungi, modifica, elimina: Task 4) aggiorneranno server e cache. La lettura è pubblica e ha la stessa forma con o senza
 * account, quindi la cache non dipende dal token e non si svuota all'accesso.
 */
interface CampettiState {
  /** null = non ancora caricati, o l'ultima ricerca è fallita (`errore` dice perché): un caricamento fallito non è una zona vuota */
  campetti: Campetto[] | null;
  /** La ricerca di cui `campetti` è il risultato, o quella in corso; null all'inizio */
  ricerca: RicercaCampetti | null;
  /** Perché l'ultima ricerca non è riuscita; null se è andata bene o è in corso */
  errore: string | null;
  /** true mentre il server risponde: la pagina può dirlo senza svuotare l'elenco di prima */
  inCorso: boolean;
  /** Quante ricerche sono partite. Ogni risposta porta l'epoca della sua ricerca: se intanto ne è partita un'altra, la risposta è
   *  vecchia e si scarta, così scrivere nella casella di ricerca non fa comparire i risultati nell'ordine in cui il server risponde */
  epoca: number;
  /** Chiede al server i campetti della ricerca; con la stessa ricerca già caricata non fa niente. Dopo un errore ritenta sempre
   *  (il «Riprova» della pagina). Non rifiuta mai: l'esito è nello stato */
  carica: (ricerca: RicercaCampetti) => Promise<void>;
}

/** Due ricerche sono uguali se hanno gli stessi parametri: il confronto per valore, non per oggetto (la pagina ne costruisce uno nuovo
 *  a ogni render). Le chiavi di RicercaCampetti sono poche e in ordine fisso, quindi basta il JSON */
const stessaRicerca = (a: RicercaCampetti | null, b: RicercaCampetti) => JSON.stringify(a) === JSON.stringify(b);

export const useCampettiStore = create<CampettiState>((set, get) => ({
  campetti: null,
  ricerca: null,
  errore: null,
  inCorso: false,
  epoca: 0,

  carica: (ricerca) => {
    const s = get();
    if (s.campetti && !s.errore && stessaRicerca(s.ricerca, ricerca)) return Promise.resolve();
    const epoca = s.epoca + 1;
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
  },
}));
