/** Hook per l'anagrafe condivisa del circuito (giocatori e squadre) sul backend.
 *  I dati stanno in cache in useAnagrafeStore: il primo componente che lo usa li scarica,
 *  gli altri (e i mount successivi) li trovano già pronti senza richiamare il server.
 *  Lettura pubblica (anche ospite); scrittura solo con account: il server assegna
 *  id, autore e timestamp e rifiuta (403) le modifiche di chi non è autore o ADMIN. */
import { useEffect } from "react";
import { useAnagrafeStore } from "../stores/useAnagrafeStore";

export function useAnagrafe() {
  const anagrafe = useAnagrafeStore();
  const { load } = anagrafe;
  // Scarica l'anagrafe solo se non è già in cache
  useEffect(() => { load(); }, [load]);
  return anagrafe;
}
