/** Form per registrare una nuova squadra nell'anagrafe condivisa. Si svuota solo se il salvataggio riesce: `onSave` rifiuta la
 *  promessa se il server non accetta, e allora il motivo compare sotto i pulsanti e i dati restano. */
import { useState } from "react";
import { useInvio } from "../../hooks/useInvio";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Icon } from "../ui/Icon";
import { CampiSquadra } from "./CampiAnagrafe";
import type { SquadraInput } from "../../services/anagrafeApi";
import type { RegGiocatore, RegSquadra } from "../../types";
import { MAX_ROSTER_ANAGRAFE } from "../../constants/rules";
import { erroreUrlSquadra } from "../../utils/safeUrl";
import { normalizza } from "../../utils/identita";
import { AVVISO_VOCE_OMONIMA } from "../../utils/testi";

/** I campi che il server fa scrivere (senza id, autore, autoreId e ts) */
type Draft = SquadraInput;
const EMPTY: Draft = { nome: "", citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "" };

/** `squadre`: le voci già registrate, per avvisare di un nome uguale (facoltativo) */
export function SquadraAnagrafeForm({ giocatori, squadre = [], onSave }: {
  giocatori: RegGiocatore[];
  squadre?: RegSquadra[];
  onSave: (d: Draft) => Promise<void>;
}) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [pick, setPick] = useState("");
  // Un nome già registrato si avvisa al primo Salva; il secondo registra lo stesso
  const [avviso, setAvviso] = useState<string | null>(null);
  const [confermato, setConfermato] = useState(false);
  const { invio, errore, setErrore, esegui } = useInvio();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setD({ ...d, [k]: e.target.value });
    // Cambiare il nome annulla l'avviso: il nome nuovo va controllato da capo
    if (k === "nome") {
      setAvviso(null);
      setConfermato(false);
    }
  };
  const gName = (id: string) => {
    const g = giocatori.find((x) => x.id === id);
    return g ? `${g.nome} ${g.cognome}` : "?";
  };

  // Il limite che l'etichetta dichiara si applica qui: a roster pieno «Aggiungi» è disattivato e un clic non aggiunge nessuno
  const rosterPieno = d.roster.length >= MAX_ROSTER_ANAGRAFE;
  const addToRoster = () => {
    if (!pick || rosterPieno || d.roster.includes(pick)) return;
    setD({ ...d, roster: [...d.roster, pick] });
    setPick("");
  };

  const save = async () => {
    if (!d.nome.trim()) { setErrore("Il nome della squadra è obbligatorio."); return; }
    // Gli indirizzi si controllano qui con il criterio del server (B10): un 400 dopo l'invio direbbe la stessa cosa, più tardi
    const urlNonValido = erroreUrlSquadra(d);
    if (urlNonValido) { setErrore(urlNonValido); return; }
    const omonima = squadre.find((s) => normalizza(s.nome) === normalizza(d.nome));
    if (omonima && !confermato) {
      setAvviso(AVVISO_VOCE_OMONIMA(`«${omonima.nome}» (${omonima.citta || "senza città"}, di ${omonima.autore || "autore sconosciuto"})`, "squadra"));
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
      <h3 className="font-display text-xl mb-3">Registra una squadra</h3>
      {/* Il roster, tra i dati e le note, c'è solo qui: nella scheda in modifica non si cambia */}
      <CampiSquadra valori={d} set={set} segnaObbligatori>
        <div>
          <div className="input-label">Roster (dai giocatori registrati, {d.roster.length}/{MAX_ROSTER_ANAGRAFE})</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <select className="statin max-w-[260px]" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Scegli un giocatore" disabled={rosterPieno}>
              <option value="">— scegli un giocatore —</option>
              {giocatori.filter((g) => !d.roster.includes(g.id)).map((g) => (
                <option key={g.id} value={g.id}>{g.nome} {g.cognome}{g.squadra ? ` (${g.squadra})` : ""}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={addToRoster} disabled={rosterPieno}>Aggiungi</Button>
            {d.roster.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-sm border border-asphalt-600 bg-asphalt-800 px-2 py-1 text-xs font-semibold text-chalk">
                {gName(id)}
                <button onClick={() => setD({ ...d, roster: d.roster.filter((x) => x !== id) })} className="area-tocco text-chalk-dim hover:text-loss" aria-label={`Rimuovi ${gName(id)}`}>
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </CampiSquadra>
      {errore && <p className="mt-2 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
      {avviso && <p className="mt-2 text-[13px] text-court" role="status">{avviso}</p>}
      <Button className="mt-3" onClick={save} disabled={invio}>Salva nell'anagrafe</Button>
    </Card>
  );
}
