/** Coda dei salvataggi delle tappe verso il server (utenti registrati).
 *  Garantisce tre cose che il semplice debounce non dava:
 *   1. una sola richiesta in volo per tappa, e sempre con l'ultima versione (niente sovrascritture fuori ordine);
 *   2. se la rete manca o il server ha un guasto temporaneo, riprova da sola;
 *   3. si può svuotare (`svuota`) prima di un logout o di una pubblicazione, aspettando che tutto sia salvato. */
import type { Tappa } from "../types";

interface Opzioni {
  /** Invia la tappa al server; rifiuta con un errore se non riesce */
  salva: (t: Tappa) => Promise<unknown>;
  /** true = errore temporaneo (rete assente, 5xx): la coda riprova; false = il server ha rifiutato i dati */
  riprovabile: (e: unknown) => boolean;
  /** `definitivo` = true quando riprovare è inutile (dati rifiutati) */
  onErrore: (e: unknown, definitivo: boolean) => void;
  /** Avvisa a ogni cambio: numero di tappe con modifiche non ancora confermate dal server */
  onInSospeso?: (n: number) => void;
  /** Attesa dopo l'ultima modifica prima di salvare (ms) */
  ritardo?: number;
  /** Pause tra un tentativo e il successivo (ms); finiti i tentativi si riparte alla prossima modifica */
  attese?: number[];
}

interface Voce {
  ultima: Tappa | null;                        // versione più recente ancora da salvare
  timer: ReturnType<typeof setTimeout> | null; // debounce oppure attesa prima di riprovare
  inVolo: Promise<void> | null;                // richiesta in corso
  tentativi: number;                           // tentativi falliti di fila
}

export function createSaveQueue(opz: Opzioni) {
  const ritardo = opz.ritardo ?? 400;
  const attese = opz.attese ?? [2000, 5000, 15000];
  const voci = new Map<string, Voce>();

  const voce = (id: string): Voce => {
    let v = voci.get(id);
    if (!v) {
      v = { ultima: null, timer: null, inVolo: null, tentativi: 0 };
      voci.set(id, v);
    }
    return v;
  };

  const fermaTimer = (v: Voce) => {
    if (v.timer) clearTimeout(v.timer);
    v.timer = null;
  };

  const notifica = () => {
    if (!opz.onInSospeso) return;
    opz.onInSospeso([...voci.values()].filter((v) => v.ultima !== null || v.inVolo !== null).length);
  };

  /** Invia l'ultima versione della tappa. Se c'è già una richiesta in volo restituisce quella:
   *  al suo termine la coda riparte da sola con la versione più recente. */
  const invia = (id: string): Promise<void> => {
    const v = voce(id);
    fermaTimer(v);
    if (v.inVolo) return v.inVolo;
    const t = v.ultima;
    if (!t) return Promise.resolve();

    v.ultima = null;
    let riparti = true; // a richiesta finita, invia subito un'eventuale versione più nuova
    const richiesta = opz.salva(t).then(
      () => { v.tentativi = 0; },
      (e: unknown) => {
        if (!opz.riprovabile(e)) {
          v.tentativi = 0;
          opz.onErrore(e, true);
          return;
        }
        // Errore temporaneo: la versione torna in coda (a meno che ne sia già arrivata una più nuova)
        if (!v.ultima) v.ultima = t;
        riparti = false;
        const attesa = attese[v.tentativi];
        v.tentativi++;
        if (v.tentativi === 1 || attesa === undefined) opz.onErrore(e, false);
        if (attesa !== undefined) v.timer = setTimeout(() => { void invia(id); }, attesa);
      },
    ).then(() => {
      v.inVolo = null;
      notifica();
      if (riparti && v.ultima) return invia(id);
    });
    v.inVolo = richiesta;
    notifica();
    return richiesta;
  };

  return {
    /** Registra una nuova versione della tappa: verrà salvata dopo `ritardo` ms senza altre modifiche */
    accoda(t: Tappa) {
      const v = voce(t.id);
      v.ultima = t;
      v.tentativi = 0;
      fermaTimer(v);
      v.timer = setTimeout(() => { void invia(t.id); }, ritardo);
      notifica();
    },

    /** Salva subito tutto ciò che è in attesa e aspetta le richieste in corso.
     *  @returns true se alla fine non resta nulla da salvare */
    async svuota(): Promise<boolean> {
      await Promise.all([...voci.keys()].map((id) => invia(id)));
      return [...voci.values()].every((v) => v.ultima === null);
    },

    /** La tappa è stata eliminata: niente più salvataggi per lei */
    annulla(id: string) {
      const v = voci.get(id);
      if (!v) return;
      fermaTimer(v);
      voci.delete(id);
      notifica();
    },

    /** Versioni non ancora inviate (usato alla chiusura della pagina per l'invio con keepalive) */
    inAttesa(): Tappa[] {
      return [...voci.values()].flatMap((v) => {
        if (v.ultima) return [v.ultima];
        return [];
      });
    },

    /** Dimentica tutto senza salvare (dopo il logout) */
    azzera() {
      voci.forEach(fermaTimer);
      voci.clear();
      notifica();
    },
  };
}
