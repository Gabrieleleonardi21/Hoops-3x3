import { useNavigate } from "react-router-dom";
import { useArchivio } from "../hooks/useArchivio";
import { ArchivioList } from "../components/archivio/ArchivioList";

export function ArchivioPage() {
  const { pubs } = useArchivio();
  const navigate = useNavigate();
  return <ArchivioList pubs={pubs} onOpen={(p) => navigate(`/tappa/${p.tappa.id}`)} />;
}
