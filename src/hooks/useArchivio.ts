import { useEffect, useState } from "react";
import { archivioApi } from "../services/archivioApi";
import { ApiError, testoErrore } from "../services/api";
import type { PubTappaMeta } from "../types";

/** Carica l'elenco sintetico delle tappe pubblicate nell'archivio circuito (endpoint pubblico, già ordinato dal server: più recenti
 *  prima). `pubs` è null finché non arrivano; se il caricamento fallisce resta null e `errore` dice perché: un archivio che non si è
 *  potuto caricare non è un archivio vuoto. `reload` ritenta (il «Riprova» della pagina).
 *  `ritira` toglie una pubblicazione (chi l'ha pubblicata, o l'ADMIN) e ricarica l'elenco. Un rifiuto resta in `erroreRitiro` e l'elenco
 *  non cambia; il 404 vuol dire che la tappa era già tolta, quindi si ricarica come se fosse andata bene. */
export function useArchivio() {
  const [pubs, setPubs] = useState<PubTappaMeta[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [erroreRitiro, setErroreRitiro] = useState<string | null>(null);

  const reload = async () => {
    setErrore(null);
    try {
      setPubs(await archivioApi.list());
    } catch (e) {
      setErrore(testoErrore(e));
    }
  };

  const ritira = async (tappaId: string) => {
    setErroreRitiro(null);
    try {
      await archivioApi.rimuovi(tappaId);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) {
        setErroreRitiro(testoErrore(e));
        return;
      }
    }
    await reload();
  };

  useEffect(() => { reload(); }, []);
  return { pubs, errore, reload, erroreRitiro, ritira };
}
