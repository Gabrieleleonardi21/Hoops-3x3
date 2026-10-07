import { useEffect, useState } from "react";
import { archivioApi } from "../services/archivioApi";
import { testoErrore } from "../services/api";
import type { PubTappaMeta } from "../types";

/** Carica l'elenco sintetico delle tappe pubblicate nell'archivio circuito (endpoint pubblico, già ordinato dal server: più recenti
 *  prima). `pubs` è null finché non arrivano; se il caricamento fallisce resta null e `errore` dice perché: un archivio che non si è
 *  potuto caricare non è un archivio vuoto. `reload` ritenta (il «Riprova» della pagina). */
export function useArchivio() {
  const [pubs, setPubs] = useState<PubTappaMeta[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const reload = async () => {
    setErrore(null);
    try {
      setPubs(await archivioApi.list());
    } catch (e) {
      setErrore(testoErrore(e));
    }
  };

  useEffect(() => { reload(); }, []);
  return { pubs, errore, reload };
}
