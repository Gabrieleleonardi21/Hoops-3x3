/** Form per registrare un nuovo giocatore nell'anagrafe condivisa del circuito. Si svuota solo se il salvataggio riesce:
 *  `onSave` rifiuta la promessa se il server non accetta, e allora il motivo compare sotto i pulsanti e i dati restano. */
import { useState } from "react";
import { useInvio } from "../../hooks/useInvio";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CampiGiocatore } from "./CampiAnagrafe";
import type { GiocatoreInput } from "../../services/anagrafeApi";
import type { RegGiocatore, RegSquadra } from "../../types";
import { nomeCompleto, nomeSquadraDi, stessoNomeGiocatore } from "../../utils/identita";
import { AVVISO_VOCE_OMONIMA } from "../../utils/testi";

/** I campi che il server fa scrivere (senza id, autore, autoreId e ts) */
type Draft = GiocatoreInput;
const EMPTY: Draft = {
  nome: "", cognome: "", soprannome: "", nascita: "", citta: "", nazionalita: "Italia",
  altezza: "", peso: "", ruolo: "Universale", numero: "", squadra: "", esperienza: "", note: "",
};

/** `giocatori`: quelli già registrati, per avvisare di un nome e cognome uguali (facoltativo) */
export function GiocatoreForm({ squadre, giocatori = [], onSave }: {
  squadre: RegSquadra[];
  giocatori?: RegGiocatore[];
  onSave: (d: Draft) => Promise<void>;
}) {
  const [d, setD] = useState<Draft>(EMPTY);
  // Un nome e cognome già registrati si avvisano al primo Salva; il secondo registra lo stesso
  const [avviso, setAvviso] = useState<string | null>(null);
  const [confermato, setConfermato] = useState(false);
  const { invio, errore, setErrore, esegui } = useInvio();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setD({ ...d, [k]: e.target.value });
    // Cambiare nome o cognome annulla l'avviso: la coppia nuova va controllata da capo
    if (k === "nome" || k === "cognome") {
      setAvviso(null);
      setConfermato(false);
    }
  };

  const save = async () => {
    if (!d.nome.trim() || !d.cognome.trim()) { setErrore("Nome e cognome sono obbligatori."); return; }
    // Vale «nome cognome» e «cognome nome»: chi scrive i due campi nell'ordine opposto è la stessa persona
    const omonimo = giocatori.find((g) => stessoNomeGiocatore(`${d.nome} ${d.cognome}`, g));
    if (omonimo && !confermato) {
      setAvviso(AVVISO_VOCE_OMONIMA(`${nomeCompleto(omonimo)} (${nomeSquadraDi(omonimo, squadre) || "senza squadra"})`, "giocatore"));
      setConfermato(true);
      return;
    }
    // Si svuota solo se il server ha accettato: altrimenti chi scrive ritrova ciò che aveva scritto
    if (await esegui(() => onSave(d), "Salvataggio non riuscito")) {
      setD(EMPTY);
      setAvviso(null);
      setConfermato(false);
    }
  };

  return (
    <Card className="mb-4">
      <h3 className="font-display text-xl mb-3">Registra un giocatore</h3>
      <CampiGiocatore valori={d} set={set} segnaObbligatori squadre={squadre} />
      {errore && <p className="mt-2 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
      {avviso && <p className="mt-2 text-[13px] text-court" role="status">{avviso}</p>}
      <Button className="mt-3" onClick={save} disabled={invio}>Salva nell'anagrafe</Button>
    </Card>
  );
}
