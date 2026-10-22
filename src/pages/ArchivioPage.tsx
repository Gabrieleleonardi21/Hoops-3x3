import { useNavigate } from "react-router-dom";
import { useArchivio } from "../hooks/useArchivio";
import { ArchivioList } from "../components/archivio/ArchivioList";
import { useAppStore } from "../stores/useAppStore";

/** La pagina è pubblica: senza account `user` è null (o l'ospite), e nell'elenco non c'è «Ritira» */
export function ArchivioPage() {
  const { pubs, errore, reload, erroreRitiro, ritira } = useArchivio();
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();
  return (
    <ArchivioList pubs={pubs} errore={errore} onRiprova={() => { void reload(); }}
      onOpen={(voce) => navigate(`/tappa/${voce.tappaId}`)}
      user={user} erroreRitiro={erroreRitiro} onRitira={(voce) => { void ritira(voce.tappaId); }} />
  );
}
