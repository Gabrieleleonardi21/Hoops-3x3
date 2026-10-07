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
  const { load, epoca } = anagrafe;
  // Scarica l'anagrafe solo se non è già in cache. Con l'epoca tra le dipendenze riparte ogni volta che la cache viene svuotata sotto
  // una pagina già aperta, anche se era in errore o in caricamento (`caricata` non cambierebbe). Un errore non cambia l'epoca:
  // niente tentativi a raffica, il nuovo tentativo è il «Riprova»
  useEffect(() => { load(); }, [load, epoca]);
  return anagrafe;
}
