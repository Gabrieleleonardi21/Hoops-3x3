import { useRef, useState } from "react";
import { testoErrore } from "../services/api";

/** Stato di un invio al server (salvataggio, creazione, eliminazione): `invio` è true finché la richiesta è in corso, così i
 *  pulsanti si disattivano e un secondo clic non la ripete; `errore` dice perché è fallita. `esegui` lancia l'azione e risponde
 *  se è riuscita: chi chiama chiude la finestra o svuota il form solo con `true`, e ciò che l'utente ha scritto non si perde. */
export function useInvio() {
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Il blocco del doppio invio non può affidarsi allo stato: due clic nello stesso istante vedono lo stesso `invio`
  const inCorso = useRef(false);

  /** @param cosa che cosa si sta facendo, per il messaggio d'errore («Salvataggio non riuscito: …»); senza, il messaggio è il solo
   *  motivo (il modulo d'accesso mostra il messaggio del server com'è: «Email già registrata»)
   *  @returns true se l'azione è riuscita; false se è fallita (il motivo è in `errore`) o un'altra è ancora in corso */
  const esegui = async (azione: () => Promise<unknown>, cosa?: string): Promise<boolean> => {
    if (inCorso.current) return false;
    inCorso.current = true;
    setInvio(true);
    setErrore(null);
    try {
      await azione();
      return true;
    } catch (e) {
      let motivo = testoErrore(e);
      if (cosa) motivo = `${cosa}: ${motivo}`;
      setErrore(motivo);
      return false;
    } finally {
      inCorso.current = false;
      setInvio(false);
    }
  };

  return { invio, errore, setErrore, esegui };
}
