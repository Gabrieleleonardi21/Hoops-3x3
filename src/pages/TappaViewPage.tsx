import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { archivioApi } from "../services/archivioApi";
import { ApiError, testoErrore } from "../services/api";
import { isUuid } from "../utils/uid";
import { ArchivioTappaView } from "../components/archivio/ArchivioTappaView";
import { ErroreCaricamento } from "../components/ui/ErroreCaricamento";
import { Loading } from "../components/ui/Loading";
import type { PubTappa } from "../types";

/** Pagina PUBBLICA di una tappa conclusa (raggiungibile da link diretto) */
export function TappaViewPage() {
  const { id } = useParams();
  const [pub, setPub] = useState<PubTappa | null | undefined>(undefined);
  /** Perché la tappa non si è potuta caricare (rete assente, server in errore): non vuol dire che non esista */
  const [errore, setErrore] = useState<string | null>(null);
  // «Riprova» ripete la richiesta della stessa tappa: cambiando questo numero l'effetto riparte
  const [tentativo, setTentativo] = useState(0);

  useEffect(() => {
    // Solo UUID nel path: evita di inoltrare al server stringhe arbitrarie (e l'errore di una tappa vista prima non resta)
    if (!id || !isUuid(id)) { setErrore(null); setPub(null); return; }
    // Una risposta arrivata quando la tappa aperta è un'altra (id cambiato con i tasti avanti e indietro, o «Riprova» già
    // ripartito) non si applica: la tappa, o l'errore, di prima finirebbero sulla nuova
    let attuale = true;
    setErrore(null);
    setPub(undefined); // mentre carica la nuova non si vede quella di prima
    archivioApi.get(id)
      .then((trovata) => { if (attuale) setPub(trovata); })
      .catch((e: unknown) => {
        if (!attuale) return;
        // Solo il 404 dice «non trovata»: ogni altro errore non dice che la tappa non c'è, ne mostra il motivo con «Riprova»
        if (e instanceof ApiError && e.status === 404) {
          setPub(null);
          return;
        }
        setErrore(testoErrore(e));
      });
    return () => { attuale = false; };
  }, [id, tentativo]);

  if (errore) {
    return <ErroreCaricamento cosa="Non è stato possibile caricare la tappa." motivo={errore} onRiprova={() => setTentativo((n) => n + 1)} />;
  }
  if (pub === undefined) return <Loading>Sto caricando la tappa…</Loading>;
  if (pub === null)
    return (
      <p className="text-chalk-muted">
        Tappa non trovata nell'archivio. <Link to="/archivio" className="linkbtn">Vai all'archivio</Link>
      </p>
    );
  return <ArchivioTappaView t={pub.tappa} lega={pub.lega} autore={pub.autore} />;
}
