/** Hook per l'anagrafe condivisa del circuito (giocatori e squadre) sul backend.
 *  I dati stanno in cache in useAnagrafeStore: il primo componente che lo usa li scarica,
 *  gli altri (e i mount successivi) li trovano già pronti senza richiamare il server.
 *  Lettura pubblica (anche ospite); scrittura solo con account: il server assegna
 *  id, autore e timestamp e rifiuta (403) le modifiche di chi non è autore o ADMIN.
 *  Se il caricamento fallisce le liste restano null e `errore` dice perché: le pagine mostrano
 *  l'errore con «Riprova» (`load`), non un'anagrafe vuota.
 *  La cache si svuota quando cambia chi la guarda (accesso, uscita, anche in un'altra scheda): una pagina già aperta la riscarica da sola. */
import { useEffect } from "react";
import { useAnagrafeStore } from "../stores/useAnagrafeStore";

export function useAnagrafe() {
  const anagrafe = useAnagrafeStore();
  const { load, caricata } = anagrafe;
  // Scarica l'anagrafe solo se non è già in cache. Con `caricata` tra le dipendenze riparte anche quando la cache viene svuotata
  // sotto una pagina già aperta; dopo un errore resta falsa e non cambia, quindi niente tentativi a raffica
  useEffect(() => { load(); }, [load, caricata]);
  return anagrafe;
}
