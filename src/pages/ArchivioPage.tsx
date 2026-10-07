import { useNavigate } from "react-router-dom";
import { useArchivio } from "../hooks/useArchivio";
import { ArchivioList } from "../components/archivio/ArchivioList";

export function ArchivioPage() {
  const { pubs, errore, reload } = useArchivio();
  const navigate = useNavigate();
  return (
    <ArchivioList pubs={pubs} errore={errore} onRiprova={() => { void reload(); }}
      onOpen={(voce) => navigate(`/tappa/${voce.tappaId}`)} />
  );
}
