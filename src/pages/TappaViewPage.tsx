import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { archivioApi } from "../services/archivioApi";
import { isUuid } from "../utils/uid";
import { ArchivioTappaView } from "../components/archivio/ArchivioTappaView";
import { Loading } from "../components/ui/Loading";
import type { PubTappa } from "../types";

/** Pagina PUBBLICA di una tappa conclusa (raggiungibile da link diretto) */
export function TappaViewPage() {
  const { id } = useParams();
  const [pub, setPub] = useState<PubTappa | null | undefined>(undefined);

  useEffect(() => {
    // Solo UUID nel path: evita di inoltrare al server stringhe arbitrarie
    if (!id || !isUuid(id)) { setPub(null); return; }
    archivioApi.get(id).then(setPub).catch(() => setPub(null));
  }, [id]);

  if (pub === undefined) return <Loading>Sto caricando la tappa…</Loading>;
  if (pub === null)
    return (
      <p className="text-chalk-muted">
        Tappa non trovata nell'archivio. <Link to="/archivio" className="linkbtn">Vai all'archivio</Link>
      </p>
    );
  return <ArchivioTappaView t={pub.tappa} lega={pub.lega} autore={pub.autore} />;
}
