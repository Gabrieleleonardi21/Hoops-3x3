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

  /** Carica la tappa. Solo il 404 dice «non trovata» (pub null); ogni altro errore non dice che la tappa non c'è: ne mostra il
   *  motivo, con «Riprova» */
  const carica = (tappaId: string) => {
    setErrore(null);
    archivioApi.get(tappaId).then(setPub).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) {
        setPub(null);
        return;
      }
      setErrore(testoErrore(e));
    });
  };

  useEffect(() => {
    // Solo UUID nel path: evita di inoltrare al server stringhe arbitrarie (e l'errore di una tappa vista prima non resta)
    if (!id || !isUuid(id)) { setErrore(null); setPub(null); return; }
    carica(id);
  }, [id]);

  if (errore && id) {
    return <ErroreCaricamento cosa="Non è stato possibile caricare la tappa." motivo={errore} onRiprova={() => carica(id)} />;
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
