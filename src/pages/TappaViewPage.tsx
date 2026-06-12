import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { storage } from "../services/storage";
import { ArchivioTappaView } from "../components/archivio/ArchivioTappaView";
import { Loading } from "../components/ui/Loading";
import type { PubTappa } from "../types";

/** Pagina PUBBLICA di una tappa conclusa (raggiungibile da link diretto) */
export function TappaViewPage() {
  const { id } = useParams();
  const [pub, setPub] = useState<PubTappa | null | undefined>(undefined);

  useEffect(() => {
    storage.get(`pub_${id}`, true)
      .then((r) => setPub(JSON.parse(r.value)))
      .catch(() => setPub(null));
  }, [id]);

  if (pub === undefined) return <Loading>Sto caricando la tappa…</Loading>;
  if (pub === null)
    return (
      <p style={{ fontStyle: "italic" }}>
        Tappa non trovata nell'archivio. <Link to="/archivio" className="linkbtn">Vai all'archivio</Link>
      </p>
    );
  return <ArchivioTappaView t={pub.tappa} lega={pub.lega} autore={pub.autore} />;
}
