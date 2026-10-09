/** La finestra con il form di un campetto: «Nuovo campetto» o «Modifica campetto» con il nome. La chiusura (X, Esc, sfondo, «Annulla»)
 *  la decide chi la apre; l'esito del salvataggio lo decide la pagina con `onSave` (chiude se il server accetta). */
import { Modal } from "../ui/Modal";
import { CampettoForm } from "./CampettoForm";
import type { Campetto, CampettoInput } from "../../types/campetto";

interface Props {
  /** Il campetto da correggere; null per uno nuovo */
  campetto: Campetto | null;
  /** I campetti mostrati nella pagina: i pin della mappa del form */
  campetti: Campetto[];
  onSave: (input: CampettoInput) => Promise<void>;
  onClose: () => void;
}

export function CampettoModal({ campetto, campetti, onSave, onClose }: Props) {
  let titolo = "Nuovo campetto";
  let etichetta = "Nuovo campetto";
  if (campetto) {
    titolo = "Modifica campetto";
    etichetta = `Modifica campetto ${campetto.nome}`;
  }
  return (
    // Un po' più larga delle schede: dentro c'è la mappa, quadrata, su cui si sceglie la posizione
    <Modal label={etichetta} title={titolo} subtitle={campetto?.nome} width={560} onClose={onClose}>
      <CampettoForm campetto={campetto ?? undefined} campetti={campetti} onSave={onSave} onAnnulla={onClose} />
    </Modal>
  );
}
