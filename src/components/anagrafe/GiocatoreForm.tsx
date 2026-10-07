/** Form per registrare un nuovo giocatore nell'anagrafe condivisa del circuito. Si svuota solo se il salvataggio riesce:
 *  `onSave` rifiuta la promessa se il server non accetta, e allora il motivo compare sotto i pulsanti e i dati restano. */
import { useState } from "react";
import { useInvio } from "../../hooks/useInvio";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CampiGiocatore } from "./CampiAnagrafe";
import type { GiocatoreInput } from "../../services/anagrafeApi";
import type { RegSquadra } from "../../types";

/** I campi che il server fa scrivere (senza id, autore, autoreId e ts) */
type Draft = GiocatoreInput;
const EMPTY: Draft = {
  nome: "", cognome: "", soprannome: "", nascita: "", citta: "", nazionalita: "Italia",
  altezza: "", peso: "", ruolo: "Universale", numero: "", squadra: "", esperienza: "", note: "",
};

export function GiocatoreForm({ squadre, onSave }: { squadre: RegSquadra[]; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const { invio, errore, setErrore, esegui } = useInvio();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: e.target.value });

  const save = async () => {
    if (!d.nome.trim() || !d.cognome.trim()) { setErrore("Nome e cognome sono obbligatori."); return; }
    // Si svuota solo se il server ha accettato: altrimenti chi scrive ritrova ciò che aveva scritto
    if (await esegui(() => onSave(d), "Salvataggio non riuscito")) setD(EMPTY);
  };

  return (
    <Card className="mb-4">
      <h3 className="font-display text-xl mb-3">Registra un giocatore</h3>
      <CampiGiocatore valori={d} set={set} segnaObbligatori squadre={squadre} />
      {errore && <p className="mt-2 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
      <Button className="mt-3" onClick={save} disabled={invio}>Salva nell'anagrafe</Button>
    </Card>
  );
}
