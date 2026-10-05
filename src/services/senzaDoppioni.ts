/** Creazione con una POST che il server esegue a ogni richiesta, assegnando lui l'id: leghe e voci dell'anagrafe (le tappe no:
 *  l'id lo sceglie il client e un nuovo tentativo riceve 409). Se la richiesta finisce senza una risposta, per rete lenta o
 *  tempo massimo scaduto (api.ts), non si sa se il server abbia creato la voce: dire «riprova» e rifare la POST ne farebbe un
 *  doppione. Il tentativo senza risposta si ricorda; al nuovo tentativo con gli stessi dati si guarda prima l'elenco e, se c'è
 *  una voce nuova che corrisponde, la si restituisce invece di crearne un'altra. Se l'elenco non si legge il tentativo fallisce
 *  senza creare niente: meglio un altro «riprova» di un doppione. Soluzione del client: la vera, sul server, è che l'id lo scelga
 *  il client come per le tappe (o una chiave di idempotenza), ma richiede di cambiare il contratto. */
import { ApiError } from "./api";

/** La richiesta può essere arrivata ed eseguita lo stesso: rete assente o tempo scaduto (status 0) oppure il proxy davanti al
 *  server che non ha avuto risposta (502, 503, 504). Gli altri errori sono un rifiuto del server: la voce non è stata creata. */
function senzaRisposta(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 0 || e.status >= 502);
}

export function senzaDoppioni<D, T extends { id: string }>(opzioni: {
  /** La POST di creazione */
  crea: (dati: D) => Promise<T>;
  /** L'elenco com'è sul server adesso */
  elenca: () => Promise<T[]>;
  /** `voce` è quella che i `dati` avrebbero creato? */
  corrisponde: (voce: T, dati: D) => boolean;
  /** Gli id che il client già conosce: una voce già nota prima del tentativo non può esserne il risultato */
  noti: () => string[];
}) {
  // Tentativi finiti senza risposta: i dati inviati (come testo) → gli id che il client conosceva allora
  const incerti = new Map<string, Set<string>>();

  const crea = async (dati: D): Promise<T> => {
    const chiave = JSON.stringify(dati);
    const prima = incerti.get(chiave);
    if (prima) {
      // Se l'elenco non si legge l'errore sale e non si crea niente; la memoria resta per il tentativo dopo
      const trovata = (await opzioni.elenca()).find((voce) => !prima.has(voce.id) && opzioni.corrisponde(voce, dati));
      if (trovata) {
        incerti.delete(chiave);
        return trovata;
      }
    }
    try {
      const creata = await opzioni.crea(dati);
      incerti.delete(chiave);
      return creata;
    } catch (e) {
      if (!senzaRisposta(e)) {
        incerti.delete(chiave);
        throw e;
      }
      // Si tiene l'elenco di id noti del primo tentativo: ciò che compare dopo, anche dal secondo, è nuovo
      incerti.set(chiave, prima ?? new Set(opzioni.noti()));
      throw e;
    }
  };

  /** Cancella la memoria dei tentativi: all'uscita, perché erano di chi se n'è andato */
  const dimentica = () => incerti.clear();

  return { crea, dimentica };
}
